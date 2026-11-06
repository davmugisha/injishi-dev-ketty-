import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { moneyOverrides, paymentTransactions } from '../../../database/drizzle/schema';
import { AuditWriter } from '../../../shared/audit/audit-writer';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import type { MoneyQueueBucket } from '@injishi/contracts';
import type { PayeeColumns, Tx } from './payment-transactions.repository';

/** How long a row unreachable at the bank waits before a person is told (AC-19, AC-27). */
export const PARKED_AFTER_MINUTES = 30;

export interface MoneyQueueRecord {
  id: string;
  bucket: MoneyQueueBucket;
  reference: string;
  providerReference: string | null;
  provider: string;
  adapterMode: 'mock' | 'live';
  direction: 'collection' | 'disbursement' | 'adjustment';
  operation: string;
  amountRwf: number;
  status: string;
  reason: string | null;
  party: string | null;
  bookingReference: string | null;
  createdAt: Date;
  pendingOverrideId: string | null;
  pendingOverrideAction: string | null;
}

export interface OverrideRecord {
  id: string;
  action: string;
  state: string;
  reason: string;
  subjectId: string | null;
  subjectReference: string | null;
  details: { amountRwf?: number; bankReference?: string; provider?: string } | null;
  initiatedByUserId: string;
  initiatedBy: string;
  approvedByUserId: string | null;
  decidedBy: string | null;
  createdAt: Date;
}

/**
 * The money queue's reads and its one person writes (073-gtbank-payments
 * AC-15, AC-18 to AC-21, AC-27).
 *
 * The buckets are SQL, one definition each, so the list a person reads and the
 * counter that alarms can never disagree about what is stuck. Every write here
 * is conditional on the state it leaves and lands its `audit_events` row in the
 * same transaction.
 */
@Injectable()
export class MoneyQueueRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Every row that needs a person, by bucket (AC-19). A row belongs to the
   * first bucket it matches, in this order.
   */
  async queue(now: Date): Promise<MoneyQueueRecord[]> {
    const parkedBefore = new Date(now.getTime() - PARKED_AFTER_MINUTES * 60_000);
    const result = await this.db.execute<{
      id: string;
      bucket: MoneyQueueBucket;
      reference: string;
      provider_reference: string | null;
      provider: string;
      adapter_mode: 'mock' | 'live';
      direction: 'collection' | 'disbursement' | 'adjustment';
      operation: string;
      amount_rwf: string | number;
      status: string;
      reason: string | null;
      party: string | null;
      booking_reference: string | null;
      created_at: Date | string;
      override_id: string | null;
      override_action: string | null;
      kind_rank: number;
    }>(sql`
      WITH flagged AS (
        SELECT t.*,
          CASE
            WHEN t.reversal_flagged_at IS NOT NULL AND t.resolved_at IS NULL THEN 'reversals'
            WHEN t.status = 'unknown' AND t.resolved_at IS NULL THEN 'parked'
            WHEN t.status = 'queued' AND t.queue_reason = 'provider_unavailable'
                 AND t.updated_at <= ${parkedBefore} THEN 'parked'
            WHEN t.direction = 'disbursement' AND t.status IN ('failed', 'rejected', 'reversed')
                 AND t.written_off_at IS NULL
                 AND NOT EXISTS (
                   SELECT 1 FROM payment_transactions r
                    WHERE r.idempotency_key LIKE 'resend:%'
                      AND right(r.idempotency_key, length(t.idempotency_key) + 1) = ':' || t.idempotency_key
                      AND r.status NOT IN ('failed', 'rejected', 'reversed')) THEN 'owed'
            WHEN t.status = 'queued' AND t.queue_reason = 'insufficient_funds' THEN 'short'
            WHEN t.status = 'queued' AND t.queue_reason = 'over_limit' THEN 'over_limit'
            WHEN t.status = 'queued' AND t.queue_reason = 'payee_details_missing' THEN 'waiting_on_payer'
          END AS bucket
          FROM payment_transactions t
      )
      SELECT f.id, f.bucket, f.reference, f.provider_reference, f.provider, f.adapter_mode, f.direction,
             f.operation, f.amount_rwf, f.status::text AS status,
             coalesce(f.reversal_kind, f.queue_reason, f.failure_reason) AS reason,
             coalesce(f.payee_account, f.payer_msisdn) AS party,
             b.reference AS booking_reference, f.created_at,
             o.id AS override_id, o.action::text AS override_action,
             CASE WHEN f.reversal_kind = 'double_refund' THEN 0 ELSE 1 END AS kind_rank
        FROM flagged f
        LEFT JOIN bookings b ON b.id = f.booking_id
        LEFT JOIN LATERAL (
          SELECT mo.id, mo.action FROM money_overrides mo
           WHERE mo.subject_type = 'payment_transaction' AND mo.subject_id = f.id AND mo.state = 'initiated'
           ORDER BY mo.created_at DESC LIMIT 1) o ON true
       WHERE f.bucket IS NOT NULL
       ORDER BY kind_rank, f.created_at
       LIMIT 500`);
    return result.rows.map((r) => ({
      id: r.id,
      bucket: r.bucket,
      reference: r.reference,
      providerReference: r.provider_reference,
      provider: r.provider,
      adapterMode: r.adapter_mode,
      direction: r.direction,
      operation: r.operation,
      amountRwf: Number(r.amount_rwf),
      status: r.status,
      reason: r.reason,
      party: r.party,
      bookingReference: r.booking_reference,
      createdAt: new Date(r.created_at),
      pendingOverrideId: r.override_id,
      pendingOverrideAction: r.override_action,
    }));
  }

  /** What the balance panel shows besides the available balance (AC-19). */
  async balanceFacts(
    provider: string,
    adapterMode: 'mock' | 'live',
    now: Date,
  ): Promise<{ inFlightRwf: number; queuedRwf: number; parkedCount: number; oldestParkedAt: Date | null; lastRun: { status: string; ranAt: Date } | null }> {
    const parkedBefore = new Date(now.getTime() - PARKED_AFTER_MINUTES * 60_000);
    const result = await this.db.execute<{
      in_flight: string | number;
      queued: string | number;
      parked: number;
      oldest_parked: Date | string | null;
    }>(sql`
      SELECT
        coalesce(sum(CASE WHEN direction = 'disbursement' AND status IN ('sending', 'pending', 'unknown')
                          THEN amount_rwf + fee_rwf END), 0) AS in_flight,
        coalesce(sum(CASE WHEN direction = 'disbursement' AND status = 'queued' THEN amount_rwf END), 0) AS queued,
        count(*) FILTER (WHERE (status = 'unknown' AND resolved_at IS NULL)
                            OR (status = 'queued' AND queue_reason = 'provider_unavailable'
                                AND updated_at <= ${parkedBefore}))::int AS parked,
        min(updated_at) FILTER (WHERE (status = 'unknown' AND resolved_at IS NULL)
                                   OR (status = 'queued' AND queue_reason = 'provider_unavailable')) AS oldest_parked
        FROM payment_transactions
       WHERE provider = ${provider} AND adapter_mode = ${adapterMode}`);
    const row = result.rows[0];
    const runs = await this.db.execute<{ status: string; ran_at: Date | string }>(sql`
      SELECT status::text AS status, ran_at FROM reconciliation_runs
       WHERE adapter_mode = ${adapterMode} ORDER BY ran_at DESC LIMIT 1`);
    const last = runs.rows[0];
    return {
      inFlightRwf: Number(row?.in_flight ?? 0),
      queuedRwf: Number(row?.queued ?? 0),
      parkedCount: Number(row?.parked ?? 0),
      oldestParkedAt: row?.oldest_parked ? new Date(row.oldest_parked) : null,
      lastRun: last ? { status: last.status, ranAt: new Date(last.ran_at) } : null,
    };
  }

  /**
   * One person resolves a row, with a note, and the audit row lands with it
   * (AC-20). `failed` moves an `unknown` row to `failed`; `stands` closes a
   * reversal flag and moves nothing.
   */
  async resolve(input: {
    id: string;
    outcome: 'failed' | 'stands';
    note: string;
    actorUserId: string;
  }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const moved =
        input.outcome === 'failed'
          ? await tx
              .update(paymentTransactions)
              .set({
                status: 'failed',
                failureReason: 'resolved as failed by a person',
                nextAttemptAt: null,
                finalAt: now,
                resolvedByUserId: input.actorUserId,
                resolvedAt: now,
                resolutionOutcome: 'failed',
                resolutionNote: input.note,
                updatedAt: now,
              })
              .where(
                and(
                  eq(paymentTransactions.id, input.id),
                  eq(paymentTransactions.status, 'unknown'),
                  sql`${paymentTransactions.resolvedAt} IS NULL`,
                ),
              )
              .returning({ id: paymentTransactions.id })
          : await tx
              .update(paymentTransactions)
              .set({
                resolvedByUserId: input.actorUserId,
                resolvedAt: now,
                resolutionOutcome: 'stands',
                resolutionNote: input.note,
                updatedAt: now,
              })
              .where(
                and(
                  eq(paymentTransactions.id, input.id),
                  sql`${paymentTransactions.reversalFlaggedAt} IS NOT NULL`,
                  sql`${paymentTransactions.resolvedAt} IS NULL`,
                ),
              )
              .returning({ id: paymentTransactions.id });
      if (moved.length === 0) return false;
      await audit(tx, input.actorUserId, input.id, `payment.resolved.${input.outcome}`, input.note);
      return true;
    });
  }

  /** The first signature (AC-21): one open request per row and action. */
  async requestOverride(input: {
    subjectId: string | null;
    action: 'resend_disbursement' | 'confirm_received' | 'cancel_service' | 'write_off' | 'treasury_adjustment';
    reason: string;
    initiatedByUserId: string;
    idempotencyKey: string | null;
    details: Record<string, unknown> | null;
  }): Promise<{ id: string; created: boolean }> {
    return this.db.transaction(async (tx) => {
      if (input.idempotencyKey) {
        const [same] = await tx
          .select({ id: moneyOverrides.id })
          .from(moneyOverrides)
          .where(eq(moneyOverrides.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (same) return { id: same.id, created: false };
      }
      if (input.subjectId) {
        const [open] = await tx
          .select({ id: moneyOverrides.id })
          .from(moneyOverrides)
          .where(
            and(
              eq(moneyOverrides.subjectType, 'payment_transaction'),
              eq(moneyOverrides.subjectId, input.subjectId),
              eq(moneyOverrides.action, input.action),
              eq(moneyOverrides.state, 'initiated'),
            ),
          )
          .for('update')
          .limit(1);
        if (open) return { id: open.id, created: false };
      }
      const [row] = await tx
        .insert(moneyOverrides)
        .values({
          // A treasury request names its transaction only once approval writes
          // it; the subject id is filled in then (AC-15).
          subjectType: 'payment_transaction',
          subjectId: input.subjectId,
          action: input.action,
          reason: input.reason,
          initiatedByUserId: input.initiatedByUserId,
          idempotencyKey: input.idempotencyKey,
          details: input.details,
        })
        .returning({ id: moneyOverrides.id });
      await audit(tx, input.initiatedByUserId, input.subjectId, `payment.override.requested.${input.action}`, input.reason, {
        overrideId: row.id,
        ...(input.details ?? {}),
      });
      return { id: row.id, created: true };
    });
  }

  async findOverride(id: string): Promise<OverrideRecord | null> {
    const rows = await this.overrides(sql`mo.id = ${id}`);
    return rows[0] ?? null;
  }

  async listOverrides(state: 'initiated' | 'all'): Promise<OverrideRecord[]> {
    return this.overrides(state === 'initiated' ? sql`mo.state = 'initiated'` : sql`true`);
  }

  private async overrides(where: ReturnType<typeof sql>): Promise<OverrideRecord[]> {
    const result = await this.db.execute<{
      id: string;
      action: string;
      state: string;
      reason: string;
      subject_id: string | null;
      subject_reference: string | null;
      details: OverrideRecord['details'];
      initiated_by_user_id: string;
      initiated_by: string;
      approved_by_user_id: string | null;
      decided_by: string | null;
      created_at: Date | string;
    }>(sql`
      SELECT mo.id, mo.action::text AS action, mo.state::text AS state, mo.reason, mo.subject_id,
             t.reference AS subject_reference, mo.details, mo.initiated_by_user_id,
             coalesce(iu.name, iu.email) AS initiated_by, mo.approved_by_user_id,
             coalesce(au.name, au.email) AS decided_by, mo.created_at
        FROM money_overrides mo
        LEFT JOIN payment_transactions t ON t.id = mo.subject_id AND mo.subject_type = 'payment_transaction'
        JOIN users iu ON iu.id = mo.initiated_by_user_id
        LEFT JOIN users au ON au.id = mo.approved_by_user_id
       WHERE mo.action IN ('resend_disbursement', 'confirm_received', 'cancel_service', 'write_off', 'treasury_adjustment')
         AND ${where}
       ORDER BY mo.created_at DESC
       LIMIT 200`);
    return result.rows.map((r) => ({
      id: r.id,
      action: r.action,
      state: r.state,
      reason: r.reason,
      subjectId: r.subject_id,
      subjectReference: r.subject_reference,
      details: r.details,
      initiatedByUserId: r.initiated_by_user_id,
      initiatedBy: r.initiated_by,
      approvedByUserId: r.approved_by_user_id,
      decidedBy: r.decided_by,
      createdAt: new Date(r.created_at),
    }));
  }

  /**
   * The second signature, in one transaction: the override moves from
   * `initiated` to `applied` (or `rejected`) under a row lock, `apply` does the
   * money work against the same transaction, and the audit row lands with it.
   * The table's own CHECK refuses an approver who is the initiator.
   */
  async decide<T>(input: {
    id: string;
    approverUserId: string;
    verdict: 'applied' | 'rejected';
    apply: (tx: Tx, override: OverrideRecord) => Promise<T>;
  }): Promise<{ override: OverrideRecord; result: T | null } | null> {
    return this.db.transaction(async (tx) => {
      const locked = await tx
        .select({ id: moneyOverrides.id })
        .from(moneyOverrides)
        .where(and(eq(moneyOverrides.id, input.id), eq(moneyOverrides.state, 'initiated')))
        .for('update');
      if (locked.length === 0) return null;
      const [override] = await this.overridesIn(tx, input.id);
      if (!override) return null;
      const result = input.verdict === 'applied' ? await input.apply(tx, override) : null;
      const [after] = await tx
        .update(moneyOverrides)
        .set({ state: input.verdict, approvedByUserId: input.approverUserId, updatedAt: new Date() })
        .where(eq(moneyOverrides.id, input.id))
        .returning({ subjectId: moneyOverrides.subjectId });
      // A treasury approval names its subject only once it has written it.
      await audit(
        tx,
        input.approverUserId,
        after?.subjectId ?? override.subjectId,
        `payment.override.${input.verdict === 'applied' ? 'approved' : 'rejected'}.${override.action}`,
        override.reason,
        { overrideId: override.id },
      );
      return { override, result };
    });
  }

  private async overridesIn(tx: Tx, id: string): Promise<OverrideRecord[]> {
    const rows = await tx
      .select()
      .from(moneyOverrides)
      .where(eq(moneyOverrides.id, id))
      .limit(1);
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      state: r.state,
      reason: r.reason,
      subjectId: r.subjectId ?? null,
      subjectReference: null,
      details: (r.details as OverrideRecord['details']) ?? null,
      initiatedByUserId: r.initiatedByUserId,
      initiatedBy: '',
      approvedByUserId: r.approvedByUserId ?? null,
      decidedBy: null,
      createdAt: r.createdAt,
    }));
  }

  /** The whole row a decision reads: the subject of an override, with its payee. */
  async subjectTx(tx: Tx, id: string): Promise<(typeof paymentTransactions.$inferSelect) | null> {
    const [row] = await tx.select().from(paymentTransactions).where(eq(paymentTransactions.id, id)).for('update');
    return row ?? null;
  }

  /** How many resends a disbursement already has, for the next key. */
  async resendCountTx(tx: Tx, originalKey: string): Promise<number> {
    const result = await tx.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM payment_transactions
       WHERE idempotency_key LIKE 'resend:%'
         AND right(idempotency_key, length(${originalKey}) + 1) = ':' || ${originalKey}`);
    return Number(result.rows[0]?.n ?? 0);
  }

  /** A resend, a confirmed collection, a write-off or an adjustment, written by the approval. */
  async insertResendTx(
    tx: Tx,
    input: {
      original: typeof paymentTransactions.$inferSelect;
      idempotencyKey: string;
      reference: string;
      overrideId: string;
      askPayer: boolean;
      feeRwf: number;
    },
  ): Promise<string> {
    const o = input.original;
    const payee: PayeeColumns = {
      payeeFullName: input.askPayer ? null : o.payeeFullName,
      payeeIdType: input.askPayer ? null : (o.payeeIdType as PayeeColumns['payeeIdType']),
      payeeIdNumber: input.askPayer ? null : o.payeeIdNumber,
      payeeDestination: (o.payeeDestination as PayeeColumns['payeeDestination']) ?? 'momo',
      payeeNetworkOrBank: o.payeeNetworkOrBank,
      payeeAccount: o.payeeAccount ?? '',
      payeePhone: o.payeePhone,
    };
    const [row] = await tx
      .insert(paymentTransactions)
      .values({
        workspaceId: o.workspaceId,
        provider: o.provider,
        adapterMode: o.adapterMode,
        direction: 'disbursement',
        operation: o.operation,
        originalTransactionId: o.originalTransactionId,
        payoutId: o.payoutId,
        bookingId: o.bookingId,
        moneyOverrideId: input.overrideId,
        idempotencyKey: input.idempotencyKey,
        reference: input.reference,
        amountRwf: o.amountRwf,
        feeRwf: input.feeRwf,
        status: 'queued',
        queueReason: input.askPayer ? 'payee_details_missing' : 'awaiting_dispatch',
        ...payee,
      })
      .returning({ id: paymentTransactions.id });
    return row.id;
  }

  async confirmReceivedTx(tx: Tx, id: string, approverUserId: string, note: string): Promise<boolean> {
    const now = new Date();
    const moved = await tx
      .update(paymentTransactions)
      .set({
        status: 'successful',
        failureReason: null,
        nextAttemptAt: null,
        finalAt: now,
        resolvedByUserId: approverUserId,
        resolvedAt: now,
        resolutionOutcome: 'successful',
        resolutionNote: note,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentTransactions.id, id),
          eq(paymentTransactions.direction, 'collection'),
          eq(paymentTransactions.status, 'unknown'),
        ),
      )
      .returning({ id: paymentTransactions.id });
    return moved.length > 0;
  }

  async cancelServiceTx(tx: Tx, id: string, approverUserId: string, note: string): Promise<boolean> {
    const now = new Date();
    const moved = await tx
      .update(paymentTransactions)
      .set({
        resolvedByUserId: approverUserId,
        resolvedAt: now,
        resolutionOutcome: 'cancel_service',
        resolutionNote: note,
        updatedAt: now,
      })
      .where(
        and(
          eq(paymentTransactions.id, id),
          sql`${paymentTransactions.reversalFlaggedAt} IS NOT NULL`,
          sql`${paymentTransactions.resolvedAt} IS NULL`,
        ),
      )
      .returning({ id: paymentTransactions.id });
    return moved.length > 0;
  }

  async writeOffTx(tx: Tx, id: string): Promise<boolean> {
    const now = new Date();
    const moved = await tx
      .update(paymentTransactions)
      .set({ writtenOffAt: now, updatedAt: now })
      .where(
        and(
          eq(paymentTransactions.id, id),
          eq(paymentTransactions.direction, 'disbursement'),
          sql`${paymentTransactions.status} IN ('failed', 'rejected', 'reversed')`,
          sql`${paymentTransactions.writtenOffAt} IS NULL`,
        ),
      )
      .returning({ id: paymentTransactions.id });
    return moved.length > 0;
  }

  /** The adjustment row an approved treasury request writes (AC-15). Unique per bank reference. */
  async insertAdjustmentTx(
    tx: Tx,
    input: { provider: string; adapterMode: 'mock' | 'live'; amountRwf: number; bankReference: string; idempotencyKey: string; reference: string; overrideId: string },
  ): Promise<string | null> {
    const [row] = await tx
      .insert(paymentTransactions)
      .values({
        workspaceId: null,
        provider: input.provider,
        adapterMode: input.adapterMode,
        direction: 'adjustment',
        operation: 'adjustment',
        moneyOverrideId: input.overrideId,
        idempotencyKey: input.idempotencyKey,
        reference: input.reference,
        providerReference: input.bankReference,
        amountRwf: input.amountRwf,
        status: 'successful',
        finalAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: paymentTransactions.id });
    if (!row) return null;
    await tx
      .update(moneyOverrides)
      .set({ subjectId: row.id, updatedAt: new Date() })
      .where(eq(moneyOverrides.id, input.overrideId));
    return row.id;
  }
}

async function audit(
  tx: Tx,
  actorUserId: string,
  subjectId: string | null,
  eventType: string,
  reason: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await AuditWriter.write(tx, {
    actorUserId,
    subjectType: 'payment',
    subjectId,
    eventType,
    reason,
    payloadDiff: payload,
  });
}
