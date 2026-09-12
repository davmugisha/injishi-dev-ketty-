import type { MobileMoneyNetwork, PaymentAttemptState } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, lt, sql } from 'drizzle-orm';

import { paymentAttempts } from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

/**
 * One press of confirm on a rail that answers later (ADR-047 D-j).
 *
 * SEPARATE from `BookingRepository` for the reason `GuestTripsRepository` is:
 * that file is 34 KB of write path, holds and sweeps, and a payment waiting on
 * a handset is its own concern with its own lifecycle.
 *
 * Everything a poll, a provider callback and the expiry sweep need is on one
 * row, because when the money settles the booking still has to be WRITTEN and
 * the only other copy of what the guest asked for is in a browser that may be
 * closed.
 */

/** One attempt, as the service reads it. */
export interface PaymentAttemptRow {
  id: string;
  attemptToken: string;
  idempotencyKey: string;
  guestUserId: string;
  workspaceId: string;
  state: PaymentAttemptState;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nonRefundable: boolean;
  attemptFingerprint: string;
  amountRwf: number | null;
  adapterRef: string | null;
  network: MobileMoneyNetwork | null;
  payerMasked: string | null;
  expiresAt: Date;
  bookingId: string | null;
  failureReason: string | null;
}

export interface RecordAttemptInput {
  attemptToken: string;
  idempotencyKey: string;
  guestUserId: string;
  workspaceId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nonRefundable: boolean;
  attemptFingerprint: string;
  amountRwf: number;
  adapterRef: string;
  adapterMode: 'mock' | 'live';
  instrumentKind: 'mobile_money' | 'card';
  network: MobileMoneyNetwork | null;
  payerMasked: string | null;
  expiresAt: Date;
}

@Injectable()
export class PaymentAttemptRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Write the attempt down before anybody waits on it.
   *
   * `onConflictDoUpdate` on the idempotency key rather than `doNothing`: a
   * second press of the same confirm is the SAME attempt, and it must refresh
   * the provider reference rather than silently keep a stale one — but it must
   * not resurrect an attempt that has already been answered, which is what the
   * `where` clause protects. A settled or expired attempt is final.
   */
  async record(input: RecordAttemptInput): Promise<void> {
    await this.db
      .insert(paymentAttempts)
      .values({
        attemptToken: input.attemptToken,
        idempotencyKey: input.idempotencyKey,
        guestUserId: input.guestUserId,
        workspaceId: input.workspaceId,
        roomTypeId: input.roomTypeId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guestCount: input.guests,
        nonrefundable: input.nonRefundable,
        attemptFingerprint: input.attemptFingerprint,
        amountRwf: input.amountRwf,
        adapterRef: input.adapterRef,
        adapterMode: input.adapterMode,
        instrumentKind: input.instrumentKind,
        network: input.network,
        payerMasked: input.payerMasked,
        expiresAt: input.expiresAt,
        state: 'prompting',
      })
      .onConflictDoUpdate({
        target: paymentAttempts.idempotencyKey,
        set: {
          adapterRef: input.adapterRef,
          updatedAt: new Date(),
        },
        where: eq(paymentAttempts.state, 'prompting'),
      });
  }

  /**
   * One attempt, by the token the browser holds — scoped to its own guest.
   *
   * `guestUserId` is the whole security control here, exactly as it is on the
   * receipt route. An attempt token is a uuid a client minted; without the
   * scope, guessing one would show somebody else's payment, their dates and the
   * masked number that paid for it.
   */
  async findForGuest(
    attemptToken: string,
    guestUserId: string,
  ): Promise<PaymentAttemptRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.attemptToken, attemptToken),
          eq(paymentAttempts.guestUserId, guestUserId),
        ),
      )
      .limit(1);

    return row ? shape(row) : null;
  }

  /** Mark an attempt settled, and tie it to the reservation it produced. */
  async markConfirmed(id: string, bookingId: string): Promise<void> {
    await this.db
      .update(paymentAttempts)
      .set({ state: 'confirmed', bookingId, settledAt: new Date(), updatedAt: new Date() })
      .where(eq(paymentAttempts.id, id));
  }

  /** Mark an attempt over, with a sentence the guest can read. */
  async markEnded(
    id: string,
    state: 'refused' | 'expired',
    failureReason: string,
  ): Promise<void> {
    await this.db
      .update(paymentAttempts)
      .set({ state, failureReason, updatedAt: new Date() })
      .where(eq(paymentAttempts.id, id));
  }

  /**
   * Prompts nobody answered, for the sweep.
   *
   * Bounded, and it reads only `prompting` rows past their deadline — the
   * partial index is exactly this query. Ordered oldest first so a backlog
   * drains in the order it built up rather than starving the earliest guest.
   */
  async findExpired(now: Date, limit = 100): Promise<PaymentAttemptRow[]> {
    const rows = await this.db
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.state, 'prompting'),
          lt(paymentAttempts.expiresAt, now),
        ),
      )
      .orderBy(paymentAttempts.expiresAt)
      .limit(limit);

    return rows.map(shape);
  }

  /** How many prompts are in flight right now, for the health surface. */
  async countPrompting(): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.state, 'prompting'));
    return row?.count ?? 0;
  }
}

/** The Drizzle row, narrowed to what the service reads. */
function shape(row: typeof paymentAttempts.$inferSelect): PaymentAttemptRow {
  return {
    id: row.id,
    attemptToken: row.attemptToken,
    idempotencyKey: row.idempotencyKey,
    guestUserId: row.guestUserId,
    workspaceId: row.workspaceId,
    state: row.state,
    roomTypeId: row.roomTypeId,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    guests: row.guestCount,
    nonRefundable: row.nonrefundable,
    attemptFingerprint: row.attemptFingerprint,
    amountRwf: row.amountRwf ?? null,
    adapterRef: row.adapterRef ?? null,
    network: (row.network as MobileMoneyNetwork | null) ?? null,
    payerMasked: row.payerMasked ?? null,
    expiresAt: row.expiresAt,
    bookingId: row.bookingId ?? null,
    failureReason: row.failureReason ?? null,
  };
}
