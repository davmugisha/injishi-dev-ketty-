import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, isNull, lte, or, sql, type SQL } from 'drizzle-orm';

import { paymentTransactions } from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * The bank record (073-gtbank-payments): one row per instruction sent to a
 * payment provider, written BEFORE the call (AC-9).
 *
 * Every status move is a conditional update from the statuses it may leave
 * (AC-6a), so a poll, the sweep, a callback's pull and the call's own answer
 * can all reach one row and only the first applies its verdict.
 */

export type TransactionStatus = typeof paymentTransactions.$inferSelect['status'];

/** The statuses a pulled verdict may still move a collection out of. */
const OPEN: TransactionStatus[] = ['sending', 'pending', 'unknown', 'expired'];

export interface TransactionRow {
  id: string;
  idempotencyKey: string;
  reference: string;
  providerReference: string | null;
  provider: string;
  adapterMode: 'mock' | 'live';
  direction: 'collection' | 'disbursement' | 'adjustment';
  operation: string;
  workspaceId: string | null;
  amountRwf: number;
  feeRwf: number;
  status: TransactionStatus;
  failureReason: string | null;
  queueReason: string | null;
  providerStatus: string | null;
  payerMsisdn: string | null;
  payerNetwork: string | null;
  bookingId: string | null;
  originalTransactionId: string | null;
  moneyOverrideId: string | null;
  attempts: number;
  sentAt: Date | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
  finalAt: Date | null;
}

@Injectable()
export class PaymentTransactionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Write a collection before its call. Returns the row and whether this call
   * wrote it; a row that already existed is the same press arriving again.
   */
  async recordCollection(input: {
    idempotencyKey: string;
    reference: string;
    workspaceId: string;
    provider: string;
    adapterMode: 'mock' | 'live';
    operation: 'escrow_capture' | 'one_time_fee' | 'recurring_charge';
    amountRwf: number;
    feeRwf: number;
    payerMsisdn: string | null;
    payerNetwork: string | null;
  }): Promise<{ row: TransactionRow; created: boolean }> {
    const [inserted] = await this.db
      .insert(paymentTransactions)
      .values({
        idempotencyKey: input.idempotencyKey,
        reference: input.reference,
        workspaceId: input.workspaceId,
        provider: input.provider,
        adapterMode: input.adapterMode,
        direction: 'collection',
        operation: input.operation,
        amountRwf: input.amountRwf,
        feeRwf: input.feeRwf,
        status: 'sending',
        payerMsisdn: input.payerMsisdn,
        payerNetwork: input.payerNetwork,
      })
      .onConflictDoNothing({ target: paymentTransactions.idempotencyKey })
      .returning();
    if (inserted) return { row: shape(inserted), created: true };
    const existing = await this.findByKey(input.idempotencyKey);
    if (!existing) {
      throw new Error(`Payment transaction ${input.idempotencyKey} conflicted and could not be read back.`);
    }
    return { row: existing, created: false };
  }

  async findByKey(idempotencyKey: string): Promise<TransactionRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.idempotencyKey, idempotencyKey))
      .limit(1);
    return row ? shape(row) : null;
  }

  async findByProviderReference(provider: string, providerReference: string): Promise<TransactionRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.provider, provider),
          eq(paymentTransactions.providerReference, providerReference),
        ),
      )
      .limit(1);
    return row ? shape(row) : null;
  }

  /** A `not_sent` row is sent again: nothing reached the provider the first time. */
  async resend(idempotencyKey: string): Promise<boolean> {
    const moved = await this.db
      .update(paymentTransactions)
      .set({ status: 'sending', failureReason: null, updatedAt: new Date() })
      .where(
        and(
          eq(paymentTransactions.idempotencyKey, idempotencyKey),
          eq(paymentTransactions.status, 'not_sent'),
        ),
      )
      .returning({ id: paymentTransactions.id });
    return moved.length > 0;
  }

  /** The provider answered the call: `pending` (out on a handset) or `successful`. */
  async markAnswered(
    idempotencyKey: string,
    answer: { settled: boolean; providerReference: string; adapterMode: 'mock' | 'live' },
  ): Promise<void> {
    const now = new Date();
    await this.db
      .update(paymentTransactions)
      .set({
        status: answer.settled ? 'successful' : 'pending',
        providerReference: answer.providerReference,
        adapterMode: answer.adapterMode,
        sentAt: now,
        finalAt: answer.settled ? now : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentTransactions.idempotencyKey, idempotencyKey),
          eq(paymentTransactions.status, 'sending'),
        ),
      );
  }

  /**
   * The call did not end in an answer: refused (`failed`), never delivered
   * (`not_sent`), or maybe delivered and parked (`unknown`).
   */
  async markUnanswered(
    idempotencyKey: string,
    status: 'failed' | 'not_sent' | 'unknown',
    reason: string,
  ): Promise<void> {
    const now = new Date();
    await this.db
      .update(paymentTransactions)
      .set({
        status,
        failureReason: reason,
        finalAt: status === 'unknown' ? null : now,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentTransactions.idempotencyKey, idempotencyKey),
          eq(paymentTransactions.status, 'sending'),
        ),
      );
  }

  /**
   * Apply a pulled verdict, once (AC-6a). Only an open row moves; the second
   * caller to arrive finds nothing to update and returns false.
   */
  async applyPulled(
    id: string,
    verdict: 'successful' | 'pending' | 'failed',
    reason: string | null = null,
  ): Promise<boolean> {
    const now = new Date();
    const from: TransactionStatus[] =
      verdict === 'pending' ? ['sending', 'unknown'] : OPEN;
    const moved = await this.db
      .update(paymentTransactions)
      .set({
        status: verdict,
        lastPulledAt: now,
        finalAt: verdict === 'pending' ? null : now,
        failureReason: verdict === 'failed' ? reason : null,
        updatedAt: now,
      })
      .where(and(eq(paymentTransactions.id, id), inArray(paymentTransactions.status, from)))
      .returning({ id: paymentTransactions.id });
    if (moved.length === 0) {
      await this.db
        .update(paymentTransactions)
        .set({ lastPulledAt: now })
        .where(eq(paymentTransactions.id, id));
    }
    return moved.length > 0;
  }

  /** The sweep abandoned this collection's prompt (AC-9a). */
  async markExpired(idempotencyKey: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(paymentTransactions)
      .set({ status: 'expired', finalAt: now, updatedAt: now })
      .where(
        and(
          eq(paymentTransactions.idempotencyKey, idempotencyKey),
          inArray(paymentTransactions.status, ['sending', 'pending']),
        ),
      );
  }

  /** A collection still `sending` long after its call: parked for a pull or a person (AC-9). */
  async markParked(idempotencyKey: string, reason: string): Promise<void> {
    await this.db
      .update(paymentTransactions)
      .set({ status: 'unknown', failureReason: reason, updatedAt: new Date() })
      .where(
        and(
          eq(paymentTransactions.idempotencyKey, idempotencyKey),
          eq(paymentTransactions.status, 'sending'),
        ),
      );
  }

  /** Point a collection at the attempt that waits on it. */
  async linkAttempt(idempotencyKey: string, paymentAttemptId: string): Promise<void> {
    await this.db
      .update(paymentTransactions)
      .set({ paymentAttemptId, updatedAt: new Date() })
      .where(
        and(
          eq(paymentTransactions.idempotencyKey, idempotencyKey),
          sql`${paymentTransactions.paymentAttemptId} IS NULL`,
        ),
      );
  }

  // -------------------------------------------------------------------------
  // Disbursements (073-gtbank-payments AC-11 to AC-14a)
  // -------------------------------------------------------------------------

  /** The collection a refund or guest release names, by the provider reference the caller holds. */
  async findCollection(provider: string, providerReference: string): Promise<TransactionRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.provider, provider),
          eq(paymentTransactions.providerReference, providerReference),
          eq(paymentTransactions.direction, 'collection'),
        ),
      )
      .limit(1);
    return row ? shape(row) : null;
  }

  /**
   * The same lookup under any provider: a refund naming a collection another
   * provider or mode took, which must be parked rather than sent (AC-11).
   */
  async findCollectionAnywhere(providerReference: string): Promise<TransactionRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.providerReference, providerReference),
          eq(paymentTransactions.direction, 'collection'),
        ),
      )
      .limit(1);
    return row ? shape(row) : null;
  }

  /** What remains refundable of a collection: its amount less every live child (AC-13). */
  async refundableRemaining(collectionId: string): Promise<number> {
    const result = await this.db.execute(sql`
      SELECT c.amount_rwf - coalesce((
               SELECT sum(d.amount_rwf) FROM payment_transactions d
                WHERE d.original_transaction_id = c.id
                  AND d.written_off_at IS NULL
                  AND d.status IN ('queued', 'sending', 'pending', 'successful', 'unknown')), 0) AS remaining
        FROM payment_transactions c
       WHERE c.id = ${collectionId}`);
    const row = result.rows[0] as { remaining: string | number } | undefined;
    return row ? Number(row.remaining) : 0;
  }

  /**
   * Write a disbursement owed back to a collection, once (AC-11, AC-13), inside
   * the caller's transaction, so a booking change and the refund it owes commit
   * together or not at all.
   *
   * The collection's row is locked while the room is checked, so two refunds
   * of one payment can never together exceed it: every child that has not
   * failed, been reversed or been written off counts. `fit: 'exact'` refuses a
   * refund larger than the room (AC-11); `fit: 'cap'` shrinks it to the room
   * (AC-13), and writes nothing when no room is left. A key already written is
   * the same instruction arriving again and is answered with its row.
   */
  async insertRefundOwedTx(tx: Tx, input: RefundOwedInput): Promise<RefundOwedWrite> {
    const existing = await tx
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (existing[0]) {
      return { row: shape(existing[0]), created: false, amountRwf: existing[0].amountRwf, openSiblings: false };
    }

    const [collection] = await tx
      .select({ amountRwf: paymentTransactions.amountRwf })
      .from(paymentTransactions)
      .where(eq(paymentTransactions.id, input.collectionId))
      .for('update');
    if (!collection) throw new Error(`Collection ${input.collectionId} vanished while a refund was written.`);
    const [{ taken, open }] = await tx
      .select({
        taken: sql<number>`coalesce(sum(${paymentTransactions.amountRwf}), 0)::bigint`,
        open: sql<number>`count(*) FILTER (WHERE ${paymentTransactions.status} <> 'successful')::int`,
      })
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.originalTransactionId, input.collectionId),
          inArray(paymentTransactions.status, ['queued', 'sending', 'pending', 'successful', 'unknown']),
          sql`${paymentTransactions.writtenOffAt} IS NULL`,
        ),
      );
    const room = collection.amountRwf - Number(taken);
    let amountRwf = input.amountRwf;
    if (amountRwf > room) {
      if (input.fit === 'exact') throw new RefundExceedsCollectionError(room, input.idempotencyKey);
      amountRwf = Math.max(room, 0);
    }
    if (amountRwf <= 0) return { row: null, created: false, amountRwf: 0, openSiblings: Number(open) > 0 };

    const [inserted] = await tx
      .insert(paymentTransactions)
      .values({
        idempotencyKey: input.idempotencyKey,
        reference: input.reference,
        workspaceId: input.workspaceId,
        provider: input.provider,
        adapterMode: input.adapterMode,
        direction: 'disbursement',
        operation: input.operation,
        originalTransactionId: input.collectionId,
        bookingId: input.bookingId,
        amountRwf,
        feeRwf: input.feeRwf,
        status: input.status,
        queueReason: input.queueReason,
        failureReason: input.failureReason,
        finalAt: input.status === 'failed' ? new Date() : null,
        ...input.payee,
      })
      .returning();
    return { row: shape(inserted), created: true, amountRwf, openSiblings: Number(open) > 0 };
  }

  /** The same write in a transaction of its own, for a refund with no booking change beside it. */
  async recordRefundOwed(input: RefundOwedInput): Promise<RefundOwedWrite> {
    return this.db.transaction((tx) => this.insertRefundOwedTx(tx, input));
  }

  /**
   * The available balance of one provider and mode (AC-14), computed, never
   * stored. Settled collections past the lag (less their fees), less every
   * disbursement still moving or paid (plus its fee), plus approved
   * adjustments. A reversed collection or disbursement simply leaves its sum.
   */
  async availableBalance(
    provider: string,
    adapterMode: 'mock' | 'live',
    lagMinutes: number,
    now: Date,
    executor: Pick<Database, 'execute'> = this.db,
  ): Promise<number> {
    const result = await executor.execute(sql`
      SELECT
        coalesce(sum(CASE WHEN direction = 'collection' AND status = 'successful'
                           AND final_at <= ${now}::timestamptz - make_interval(mins => ${lagMinutes})
                          THEN amount_rwf - fee_rwf END), 0)
      - coalesce(sum(CASE WHEN direction = 'disbursement'
                           AND status IN ('sending', 'pending', 'successful', 'unknown')
                          THEN amount_rwf + fee_rwf END), 0)
      + coalesce(sum(CASE WHEN direction = 'adjustment' AND status = 'successful'
                          THEN amount_rwf END), 0) AS available
        FROM payment_transactions
       WHERE provider = ${provider} AND adapter_mode = ${adapterMode}`);
    return Number((result.rows[0] as { available: string | number }).available);
  }

  async findById(id: string): Promise<TransactionRow | null> {
    const [row] = await this.db.select().from(paymentTransactions).where(eq(paymentTransactions.id, id)).limit(1);
    return row ? shape(row) : null;
  }

  /** By OUR reference, which the bank is asked by when it never gave its own (AC-6). */
  async findByReference(reference: string): Promise<TransactionRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentTransactions)
      .where(eq(paymentTransactions.reference, reference))
      .limit(1);
    return row ? shape(row) : null;
  }

  /** Whether a disbursement has a resend still alive (not failed, refused or reversed), AC-21. */
  async hasLiveResend(idempotencyKey: string): Promise<boolean> {
    const result = await this.db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM payment_transactions
       WHERE idempotency_key LIKE 'resend:%'
         AND right(idempotency_key, length(${idempotencyKey}) + 1) = ':' || ${idempotencyKey}
         AND status NOT IN ('failed', 'rejected', 'reversed')`);
    return Number(result.rows[0]?.n ?? 0) > 0;
  }

  /**
   * The bank reversed or refunded a collection it had reported successful
   * (AC-18): it takes that status and the flag, once. A collection that already
   * has a successful refund child is a double refund and sorts first.
   */
  async flagCollectionReversal(id: string, providerStatus: 'reversed' | 'refunded'): Promise<boolean> {
    const now = new Date();
    const moved = await this.db
      .update(paymentTransactions)
      .set({
        status: providerStatus,
        providerStatus,
        reversalFlaggedAt: now,
        reversalKind: sql`CASE WHEN EXISTS (
            SELECT 1 FROM payment_transactions d
             WHERE d.original_transaction_id = ${paymentTransactions.id} AND d.status = 'successful')
          THEN 'double_refund' ELSE 'reversal' END`,
        lastPulledAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentTransactions.id, id),
          eq(paymentTransactions.direction, 'collection'),
          eq(paymentTransactions.status, 'successful'),
          isNull(paymentTransactions.reversalFlaggedAt),
        ),
      )
      .returning({ id: paymentTransactions.id });
    return moved.length > 0;
  }

  /** One disbursement as the dispatcher sends or pulls it. */
  async dispatchRowById(id: string): Promise<DispatchRow | null> {
    const [row] = await this.db.select().from(paymentTransactions).where(eq(paymentTransactions.id, id)).limit(1);
    return row && row.direction === 'disbursement' ? this.dispatchRow(this.db, row) : null;
  }

  // -------------------------------------------------------------------------
  // The dispatcher (073-gtbank-payments AC-9, AC-9a, AC-14, AC-14a)
  // -------------------------------------------------------------------------

  /**
   * Choose what may be sent now, and mark it `sending`, under the provider's
   * funding lock.
   *
   * The advisory lock is held for this transaction only, so two dispatchers
   * (two worker replicas, or a tick that overran) never both spend the same
   * balance. Rows go in the fixed order: refunds and guest releases, then host
   * releases, then payouts, oldest first within each. The first row the
   * balance cannot cover stops the walk, so nothing younger overtakes it; it
   * stays `queued` with `insufficient_funds` and no next attempt, so it is
   * first in line every tick. A row above the disbursement limit is set aside
   * as `over_limit` for a person and does not block the rest.
   *
   * A row marked `sending` already counts against the balance, so it is sent
   * after this transaction commits, never inside it.
   */
  async claimForDispatch(input: {
    provider: string;
    adapterMode: 'mock' | 'live';
    lagMinutes: number;
    maxDisbursementRwf: number | null;
    now: Date;
  }): Promise<DispatchClaim> {
    const { provider, adapterMode, now } = input;
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`payments:dispatch:${provider}:${adapterMode}`}))`);
      let balance = await this.availableBalance(provider, adapterMode, input.lagMinutes, now, tx);
      const due = await tx
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.provider, provider),
            eq(paymentTransactions.adapterMode, adapterMode),
            eq(paymentTransactions.direction, 'disbursement'),
            eq(paymentTransactions.status, 'queued'),
            inArray(paymentTransactions.queueReason, ['awaiting_dispatch', 'insufficient_funds', 'provider_unavailable']),
            or(isNull(paymentTransactions.nextAttemptAt), lte(paymentTransactions.nextAttemptAt, now)),
          ),
        )
        .orderBy(
          sql`CASE ${paymentTransactions.operation}
                WHEN 'refund' THEN 0 WHEN 'escrow_release_guest' THEN 0
                WHEN 'escrow_release_host' THEN 1 ELSE 2 END`,
          asc(paymentTransactions.createdAt),
          asc(paymentTransactions.id),
        )
        .for('update');

      const claim: DispatchClaim = { sending: [], short: null, overLimit: [], balanceRwf: balance };
      for (const row of due) {
        if (input.maxDisbursementRwf !== null && row.amountRwf > input.maxDisbursementRwf) {
          await tx
            .update(paymentTransactions)
            .set({ queueReason: 'over_limit', nextAttemptAt: null, updatedAt: now })
            .where(eq(paymentTransactions.id, row.id));
          claim.overLimit.push(shape({ ...row, queueReason: 'over_limit' }));
          continue;
        }
        const cost = row.amountRwf + row.feeRwf;
        if (cost > balance) {
          if (row.queueReason !== 'insufficient_funds' || row.nextAttemptAt !== null) {
            await tx
              .update(paymentTransactions)
              .set({ queueReason: 'insufficient_funds', nextAttemptAt: null, updatedAt: now })
              .where(eq(paymentTransactions.id, row.id));
          }
          claim.short = shape({ ...row, queueReason: 'insufficient_funds' });
          break;
        }
        await tx
          .update(paymentTransactions)
          .set({
            status: 'sending',
            queueReason: null,
            failureReason: null,
            nextAttemptAt: null,
            sentAt: now,
            attempts: sql`${paymentTransactions.attempts} + 1`,
            updatedAt: now,
          })
          .where(eq(paymentTransactions.id, row.id));
        balance -= cost;
        claim.sending.push(await this.dispatchRow(tx, { ...row, status: 'sending', sentAt: now }));
      }
      claim.balanceRwf = balance;
      return claim;
    });
  }

  /**
   * Disbursements to ask the provider about (AC-9, AC-9a): `sending` rows a
   * process left behind more than a minute ago, and `pending` and `unknown`
   * rows whose next pull is due.
   */
  async dueDisbursementPulls(provider: string, adapterMode: 'mock' | 'live', now: Date): Promise<DispatchRow[]> {
    const stale = new Date(now.getTime() - 60_000);
    const rows = await this.db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.provider, provider),
          eq(paymentTransactions.adapterMode, adapterMode),
          eq(paymentTransactions.direction, 'disbursement'),
          or(
            and(eq(paymentTransactions.status, 'sending'), lte(paymentTransactions.sentAt, stale)),
            and(
              inArray(paymentTransactions.status, ['pending', 'unknown']),
              lte(paymentTransactions.nextAttemptAt, now),
            ),
          ),
        ),
      )
      .orderBy(asc(paymentTransactions.createdAt))
      .limit(100);
    return Promise.all(rows.map((row) => this.dispatchRow(this.db, row)));
  }

  /**
   * Apply what the provider said about a disbursement, once (AC-6a). Each
   * verdict moves only out of the statuses it may leave; false means another
   * caller got there first and nothing changed.
   */
  async applyDisbursementVerdict(id: string, verdict: DisbursementVerdict, now: Date = new Date()): Promise<boolean> {
    const where = (from: TransactionStatus[]): SQL | undefined =>
      and(eq(paymentTransactions.id, id), inArray(paymentTransactions.status, from));
    let moved: { id: string }[];
    switch (verdict.kind) {
      case 'successful':
        moved = await this.db
          .update(paymentTransactions)
          .set({
            status: 'successful',
            queueReason: null,
            failureReason: null,
            nextAttemptAt: null,
            finalAt: now,
            ...(verdict.providerReference ? { providerReference: verdict.providerReference } : {}),
            ...(verdict.pulled ? { lastPulledAt: now } : {}),
            updatedAt: now,
          })
          .where(where(['sending', 'pending', 'unknown']))
          .returning({ id: paymentTransactions.id });
        break;
      case 'pending':
        moved = await this.db
          .update(paymentTransactions)
          .set({
            status: 'pending',
            nextAttemptAt: verdict.nextAttemptAt,
            ...(verdict.providerReference ? { providerReference: verdict.providerReference } : {}),
            ...(verdict.pulled ? { lastPulledAt: now } : {}),
            updatedAt: now,
          })
          .where(where(['sending', 'pending', 'unknown']))
          .returning({ id: paymentTransactions.id });
        break;
      case 'failed':
        moved = await this.db
          .update(paymentTransactions)
          .set({
            status: 'failed',
            failureReason: verdict.reason,
            providerStatus: verdict.providerStatus ?? null,
            nextAttemptAt: null,
            finalAt: now,
            ...(verdict.pulled ? { lastPulledAt: now } : {}),
            updatedAt: now,
          })
          .where(where(['sending', 'pending', 'unknown']))
          .returning({ id: paymentTransactions.id });
        break;
      case 'requeue':
        moved = await this.db
          .update(paymentTransactions)
          .set({
            status: 'queued',
            queueReason: verdict.queueReason,
            failureReason: verdict.reason,
            nextAttemptAt: verdict.nextAttemptAt,
            ...(verdict.pulled ? { lastPulledAt: now } : {}),
            updatedAt: now,
          })
          .where(where(['sending']))
          .returning({ id: paymentTransactions.id });
        break;
      case 'unknown':
        moved = await this.db
          .update(paymentTransactions)
          .set({
            status: 'unknown',
            failureReason: verdict.reason,
            nextAttemptAt: verdict.nextAttemptAt,
            ...(verdict.pulled ? { lastPulledAt: now } : {}),
            updatedAt: now,
          })
          .where(where(verdict.from ?? ['sending']))
          .returning({ id: paymentTransactions.id });
        break;
      case 'reversed':
        moved = await this.db
          .update(paymentTransactions)
          .set({ status: 'reversed', providerStatus: verdict.providerStatus, lastPulledAt: now, updatedAt: now })
          .where(where(['successful']))
          .returning({ id: paymentTransactions.id });
        break;
    }
    return moved.length > 0;
  }

  /** The disbursement and what its send needs: the payee, and the collection it pays back. */
  private async dispatchRow(
    executor: Pick<Database, 'select'>,
    row: typeof paymentTransactions.$inferSelect,
  ): Promise<DispatchRow> {
    let originalRef: string | null = null;
    if (row.originalTransactionId) {
      const [original] = await executor
        .select({ providerReference: paymentTransactions.providerReference })
        .from(paymentTransactions)
        .where(eq(paymentTransactions.id, row.originalTransactionId))
        .limit(1);
      originalRef = original?.providerReference ?? null;
    }
    return {
      row: shape(row),
      originalRef,
      payee: {
        payeeFullName: row.payeeFullName,
        payeeIdType: row.payeeIdType as PayeeColumns['payeeIdType'],
        payeeIdNumber: row.payeeIdNumber,
        payeeDestination: row.payeeDestination as PayeeColumns['payeeDestination'],
        payeeNetworkOrBank: row.payeeNetworkOrBank,
        payeeAccount: row.payeeAccount ?? '',
        payeePhone: row.payeePhone,
      },
    };
  }

  /** The payee's name and ID arrived from the payer (AC-12): the refund may go. */
  async supplyPayee(id: string, payee: Pick<PayeeColumns, 'payeeFullName' | 'payeeIdType' | 'payeeIdNumber'>): Promise<boolean> {
    const moved = await this.db
      .update(paymentTransactions)
      .set({ ...payee, queueReason: 'awaiting_dispatch', nextAttemptAt: null, updatedAt: new Date() })
      .where(
        and(
          eq(paymentTransactions.id, id),
          eq(paymentTransactions.status, 'queued'),
          eq(paymentTransactions.queueReason, 'payee_details_missing'),
        ),
      )
      .returning({ id: paymentTransactions.id });
    return moved.length > 0;
  }

}

function shape(row: typeof paymentTransactions.$inferSelect): TransactionRow {
  return {
    id: row.id,
    idempotencyKey: row.idempotencyKey,
    reference: row.reference,
    providerReference: row.providerReference ?? null,
    provider: row.provider,
    adapterMode: row.adapterMode,
    direction: row.direction,
    operation: row.operation,
    workspaceId: row.workspaceId ?? null,
    amountRwf: row.amountRwf,
    feeRwf: row.feeRwf,
    status: row.status,
    failureReason: row.failureReason ?? null,
    queueReason: row.queueReason ?? null,
    providerStatus: row.providerStatus ?? null,
    payerMsisdn: row.payerMsisdn ?? null,
    payerNetwork: row.payerNetwork ?? null,
    bookingId: row.bookingId ?? null,
    originalTransactionId: row.originalTransactionId ?? null,
    moneyOverrideId: row.moneyOverrideId ?? null,
    attempts: row.attempts,
    sentAt: row.sentAt ?? null,
    nextAttemptAt: row.nextAttemptAt ?? null,
    createdAt: row.createdAt,
    finalAt: row.finalAt ?? null,
  };
}

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** A disbursement ready to send or to pull: the row, its payee, and the collection it pays back. */
export interface DispatchRow {
  row: TransactionRow;
  payee: PayeeColumns;
  /** The provider reference of the collection a refund or guest release names. */
  originalRef: string | null;
}

export interface DispatchClaim {
  /** Marked `sending` and counted against the balance; send each now. */
  sending: DispatchRow[];
  /** The first row the balance could not cover, which stopped the walk. */
  short: TransactionRow | null;
  /** Rows set aside above the disbursement limit this tick. */
  overLimit: TransactionRow[];
  /** What the balance stood at after this tick's claims. */
  balanceRwf: number;
}

/** What the provider said about a disbursement, as the bank record applies it. */
export type DisbursementVerdict =
  | { kind: 'successful'; providerReference?: string; pulled?: boolean }
  | { kind: 'pending'; nextAttemptAt: Date; providerReference?: string; pulled?: boolean }
  | { kind: 'failed'; reason: string; providerStatus?: string; pulled?: boolean }
  | {
      kind: 'requeue';
      queueReason: 'insufficient_funds' | 'provider_unavailable';
      nextAttemptAt: Date | null;
      reason: string;
      pulled?: boolean;
    }
  | { kind: 'unknown'; reason: string | null; nextAttemptAt: Date | null; from?: TransactionStatus[]; pulled?: boolean }
  | { kind: 'reversed'; providerStatus: string };

export interface RefundOwedInput {
  collectionId: string;
  idempotencyKey: string;
  reference: string;
  workspaceId: string;
  provider: string;
  adapterMode: 'mock' | 'live';
  operation: 'refund' | 'escrow_release_guest';
  amountRwf: number;
  fit: 'exact' | 'cap';
  feeRwf: number;
  bookingId: string | null;
  /** `failed` only for a refund refused before it was ever sent (AC-11). */
  status: 'queued' | 'failed';
  queueReason: 'awaiting_dispatch' | 'payee_details_missing' | null;
  failureReason: string | null;
  payee: PayeeColumns;
}

export interface RefundOwedWrite {
  /** Null when `fit: 'cap'` found no room left: nothing was written. */
  row: TransactionRow | null;
  created: boolean;
  /** What was written, after the cap. */
  amountRwf: number;
  /** Whether earlier refunds of the same collection are still moving. */
  openSiblings: boolean;
}

/** The payee columns of a disbursement, as written. Never logged. */
export interface PayeeColumns {
  payeeFullName: string | null;
  payeeIdType: 'national_id' | 'passport' | null;
  payeeIdNumber: string | null;
  payeeDestination: 'momo' | 'bank';
  payeeNetworkOrBank: string | null;
  payeeAccount: string;
  payeePhone: string | null;
}

/** A refund that would take back more than its collection brought in (AC-11). */
export class RefundExceedsCollectionError extends Error {
  constructor(
    readonly roomRwf: number,
    readonly idempotencyKey: string,
  ) {
    super(`refund exceeds what remains of the collection (${roomRwf} RWF left)`);
    this.name = 'RefundExceedsCollectionError';
  }
}
