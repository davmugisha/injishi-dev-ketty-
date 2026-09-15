import type { MobileMoneyNetwork, PaymentAttemptState } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';

import { hasFreeUnitEveryNight } from '../domain/sellable-capacity';

import { paymentAttempts, roomTypes } from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import { readNightlyCapacity } from './sellable-capacity.query';

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
  /** What it pays for (ADR-050 catalog child, amended). Completion branches on it. */
  purpose: 'booking' | 'service_order';
  /** Set on a `service_order` attempt: the pay now order it settles. */
  serviceOrderId: string | null;
  /** The stay, on a `booking` attempt only; null on an order's. */
  roomTypeId: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
  nonRefundable: boolean;
  attemptFingerprint: string;
  amountRwf: number | null;
  adapterRef: string | null;
  network: MobileMoneyNetwork | null;
  payerMasked: string | null;
  expiresAt: Date;
  bookingId: string | null;
  failureReason: string | null;
  createdAt: Date;
}

/** What every attempt records, whatever it pays for. */
interface RecordAttemptCommon {
  attemptToken: string;
  idempotencyKey: string;
  guestUserId: string;
  workspaceId: string;
  attemptFingerprint: string;
  amountRwf: number;
  adapterRef: string;
  adapterMode: 'mock' | 'live';
  instrumentKind: 'mobile_money' | 'card';
  network: MobileMoneyNetwork | null;
  payerMasked: string | null;
  expiresAt: Date;
}

/**
 * A union, so the compiler holds what `payment_attempts_purpose_shape` holds in
 * the database: a booking attempt cannot be written without its stay, nor an
 * order attempt without its order.
 */
export type RecordAttemptInput = RecordAttemptCommon &
  (
    | {
        purpose?: 'booking';
        roomTypeId: string;
        checkIn: string;
        checkOut: string;
        guests: number;
        nonRefundable: boolean;
      }
    | { purpose: 'service_order'; serviceOrderId: string }
  );

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
  async record(input: RecordAttemptInput): Promise<string> {
    const subject =
      input.purpose === 'service_order'
        ? { purpose: 'service_order' as const, serviceOrderId: input.serviceOrderId }
        : {
            purpose: 'booking' as const,
            roomTypeId: input.roomTypeId,
            checkIn: input.checkIn,
            checkOut: input.checkOut,
            guestCount: input.guests,
            nonrefundable: input.nonRefundable,
          };
    const [row] = await this.db
      .insert(paymentAttempts)
      .values({
        attemptToken: input.attemptToken,
        idempotencyKey: input.idempotencyKey,
        guestUserId: input.guestUserId,
        workspaceId: input.workspaceId,
        ...subject,
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
      })
      .returning({ id: paymentAttempts.id });
    if (row) return row.id;

    // An attempt already answered: the conflict's `where` refused to touch it,
    // so nothing came back. It is still the row this press belongs to.
    const [existing] = await this.db
      .select({ id: paymentAttempts.id })
      .from(paymentAttempts)
      .where(eq(paymentAttempts.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (!existing) throw new Error(`payment_attempts refused ${input.idempotencyKey} and holds no row for it`);
    return existing.id;
  }

  /** One attempt, by its idempotency key, whatever state it reached. */
  async findByKey(idempotencyKey: string): Promise<PaymentAttemptRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.idempotencyKey, idempotencyKey))
      .limit(1);
    return row ? shape(row) : null;
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
    purpose: 'booking' | 'service_order' = 'booking',
  ): Promise<PaymentAttemptRow | null> {
    const [row] = await this.db
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.attemptToken, attemptToken),
          eq(paymentAttempts.guestUserId, guestUserId),
          // The purpose is part of the address: a booking poll never answers
          // with an order's attempt, nor an order poll with a booking's.
          eq(paymentAttempts.purpose, purpose),
        ),
      )
      .limit(1);

    return row ? shape(row) : null;
  }

  /**
   * Mark an attempt settled. A booking attempt names the reservation it
   * produced; an order attempt already names its order, so passes null.
   */
  async markConfirmed(id: string, bookingId: string | null): Promise<void> {
    await this.db
      .update(paymentAttempts)
      .set({ state: 'confirmed', bookingId, settledAt: new Date(), updatedAt: new Date() })
      .where(eq(paymentAttempts.id, id));
  }

  /**
   * Mark an attempt over, with a sentence the guest can read.
   *
   * Guarded on `prompting`, and it says whether it moved anything. A poll and
   * the sweep can reach the same attempt at the same moment; only the one whose
   * update changed the row may queue the void, or one expiry becomes two
   * reversals. Never overwrites an attempt that already completed.
   */
  async markEnded(
    id: string,
    state: 'refused' | 'expired',
    failureReason: string,
  ): Promise<boolean> {
    const moved = await this.db
      .update(paymentAttempts)
      .set({ state, failureReason, updatedAt: new Date() })
      .where(and(eq(paymentAttempts.id, id), eq(paymentAttempts.state, 'prompting')))
      .returning({ id: paymentAttempts.id });
    return moved.length > 0;
  }

  /**
   * Every prompt still waiting, for the sweep (booking audit, 2026-09-13).
   *
   * Not only the expired ones. A guest who approved on their handset and then
   * closed the tab has a settled payment and no poll coming, so the sweep has to
   * ask about live prompts too and complete the ones that landed. Rows younger
   * than `minAgeMs` are left to the request that is still writing them.
   *
   * Bounded, and oldest first, so a backlog drains in the order it built up
   * rather than starving the earliest guest.
   */
  async findPrompting(now: Date, minAgeMs: number, limit = 100): Promise<PaymentAttemptRow[]> {
    const rows = await this.db
      .select()
      .from(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.state, 'prompting'),
          lt(paymentAttempts.createdAt, new Date(now.getTime() - minAgeMs)),
        ),
      )
      .orderBy(paymentAttempts.createdAt)
      .limit(limit);

    return rows.map(shape);
  }

  /**
   * HOLD THE ROOM BEFORE ANYBODY IS CHARGED (F-B05, booking audit 2026-09-13).
   *
   * The booking path used to pre-check `bookings` and then capture. A prompt
   * sits on a handset for up to three minutes and writes no booking until it
   * settles, so two guests could both pass the pre-check for the last unit, both
   * be charged, and one of them be refunded. The attempt row IS the hold now:
   * written before the capture, counted by every later claim until it expires.
   *
   * One transaction that locks the room type row, the same lock
   * `BookingRepository.create` takes, so a claim and a booking write serialise.
   * Units taken are the holding bookings plus every OTHER unexpired prompting
   * booking attempt for an overlapping stay. This press's own key is excluded,
   * so a retried press re-claims its own hold instead of being refused by it.
   *
   * Answers `sold_out` without writing, `claimed` with the row (new, or this
   * press's existing one), or `ended` when this press already reached a final
   * state that is not a booking.
   */
  async claimBookingHold(
    input: Omit<RecordAttemptCommon, 'adapterRef' | 'adapterMode'> & {
      roomTypeId: string;
      checkIn: string;
      checkOut: string;
      guests: number;
      nonRefundable: boolean;
      now: Date;
    },
  ): Promise<
    | { kind: 'sold_out' }
    | { kind: 'claimed'; row: PaymentAttemptRow }
    | { kind: 'ended'; row: PaymentAttemptRow }
  > {
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: roomTypes.id })
        .from(roomTypes)
        .where(eq(roomTypes.id, input.roomTypeId))
        .for('update');

      const [existing] = await tx
        .select()
        .from(paymentAttempts)
        .where(eq(paymentAttempts.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (existing && existing.state === 'prompting') return { kind: 'claimed' as const, row: shape(existing) };
      if (existing) return { kind: 'ended' as const, row: shape(existing) };

      // Sellable capacity on every night, read UNDER the lock (platform audit
      // step 3): available rooms less walk ins already in them, or the declared
      // count for a type with no rooms, and zero on a stop sold night. Held =
      // holding bookings plus every OTHER live hold; this press's own key is
      // excluded so a retry re-claims rather than being refused by itself.
      const nights = await readNightlyCapacity(tx, {
        roomTypeId: input.roomTypeId,
        from: input.checkIn,
        to: input.checkOut,
        now: input.now,
        excludeAttemptKey: input.idempotencyKey,
      });
      if (!hasFreeUnitEveryNight(nights)) return { kind: 'sold_out' as const };

      const [row] = await tx
        .insert(paymentAttempts)
        .values({
          attemptToken: input.attemptToken,
          idempotencyKey: input.idempotencyKey,
          guestUserId: input.guestUserId,
          workspaceId: input.workspaceId,
          purpose: 'booking',
          roomTypeId: input.roomTypeId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestCount: input.guests,
          nonrefundable: input.nonRefundable,
          attemptFingerprint: input.attemptFingerprint,
          amountRwf: input.amountRwf,
          // No reference yet: the capture has not been asked for. It is attached
          // the moment the provider answers (`attachCapture`).
          adapterRef: null,
          instrumentKind: input.instrumentKind,
          network: input.network,
          payerMasked: input.payerMasked,
          expiresAt: input.expiresAt,
          state: 'prompting',
        })
        .returning();
      if (!row) throw new Error(`payment_attempts refused the hold for ${input.idempotencyKey}`);
      return { kind: 'claimed' as const, row: shape(row) };
    });
  }

  /** The provider answered the capture: record its reference on the hold. */
  async attachCapture(id: string, adapterRef: string, adapterMode: 'mock' | 'live'): Promise<void> {
    await this.db
      .update(paymentAttempts)
      .set({ adapterRef, adapterMode, updatedAt: new Date() })
      .where(eq(paymentAttempts.id, id));
  }

  /**
   * Give the room back when no money moved: the provider declined, or could not
   * be reached. Deleted rather than ended, because the row never stood for a
   * payment, and a retried press must be able to claim afresh exactly as it
   * could before holds existed. Only a hold with no reference is ever removed.
   */
  async releaseHold(id: string): Promise<void> {
    await this.db
      .delete(paymentAttempts)
      .where(
        and(
          eq(paymentAttempts.id, id),
          eq(paymentAttempts.state, 'prompting'),
          isNull(paymentAttempts.adapterRef),
        ),
      );
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
    purpose: row.purpose,
    serviceOrderId: row.serviceOrderId ?? null,
    roomTypeId: row.roomTypeId ?? null,
    checkIn: row.checkIn ?? null,
    checkOut: row.checkOut ?? null,
    guests: row.guestCount ?? null,
    nonRefundable: row.nonrefundable,
    attemptFingerprint: row.attemptFingerprint,
    amountRwf: row.amountRwf ?? null,
    adapterRef: row.adapterRef ?? null,
    network: (row.network as MobileMoneyNetwork | null) ?? null,
    payerMasked: row.payerMasked ?? null,
    expiresAt: row.expiresAt,
    bookingId: row.bookingId ?? null,
    failureReason: row.failureReason ?? null,
    createdAt: row.createdAt,
  };
}
