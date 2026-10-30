import type {
  BookingMode,
  BookingStatus,
  CancellationTier,
  EscrowStatus,
  MoneyBreakdown,
  PaymentStatus,
} from '@injishi/contracts';
import { stayNightlyRateRwf } from '@injishi/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { makeReference } from '../domain/pricing';
import { hasFreeUnitEveryNight } from '../domain/sellable-capacity';

import {
  accountName,
  bookings,
  escrows,
  guestStays,
  properties,
  rooms,
  roomTypes,
  threads,
  users,
} from '../../../database/drizzle/schema';
import type { PaymentReceipt } from '../../payments/domain/payment-port';
import type {
  RefundOwedWrite,
  Tx as PaymentsTx,
} from '../../payments/infrastructure/payment-transactions.repository';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import { readNightlyCapacity } from './sellable-capacity.query';

/** Booking statuses that still hold inventory (F-B05 atomic hold). */
const HOLDING_STATUSES = ['pending_approval', 'confirmed'] as const;

export interface CreateBookingRow {
  roomTypeId: string;
  workspaceId: string;
  guestUserId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: 'confirmed' | 'pending_approval';
  bookingMode: BookingMode;
  nightlyRateRwf: number;
  cancellationTier: CancellationTier | null;
  nonRefundable: boolean;
  breakdown: MoneyBreakdown;
  reference: string;
  approvalExpiresAt: Date | null;
  /**
   * The receipt from the payment seam, captured BEFORE this transaction opened
   * (ADR-020 A1). Its `adapterRef` is what reconciliation matches against
   * (F-A06), and its `mode` replaces the literal `'mock'` this file used to
   * write — which was a placeholder for the adapter layer rather than the
   * adapter layer, as `architecture.md` said in as many words.
   */
  receipt: PaymentReceipt;
  /** The same key the capture used, so the escrow row and the charge agree. */
  idempotencyKey: string;
  /** What this attempt asked for, so a replay with a different stay is refused. */
  attemptFingerprint: string;
}

export interface CreatedBooking {
  id: string;
  reference: string;
  status: 'confirmed' | 'pending_approval';
  paymentStatus: 'captured';
  escrowStatus: 'held';
  approvalExpiresAt: Date | null;
}

/**
 * A booking a repeated attempt token already produced (ADR-020 D-c).
 *
 * Everything `BookingResult` needs except `breakdown`, which the caller
 * recomputes from `lockedNightlyRateRwf` so the second answer carries the same
 * number as the first rather than a freshly quoted one.
 */
export interface SettledAttempt {
  id: string;
  reference: string;
  status: BookingStatus;
  bookingMode: BookingMode;
  paymentStatus: PaymentStatus | null;
  escrowStatus: EscrowStatus | null;
  nonRefundable: boolean;
  lockedCancellationTier: CancellationTier | null;
  lockedNightlyRateRwf: number | null;
  /** What was actually captured; the number to answer a replay with. */
  grossRwf: number | null;
  attemptFingerprint: string | null;
  checkIn: string;
  checkOut: string;
  guests: number;
  approvalExpiresAt: Date | null;
}

/** How many expired holds one sweep claims (review 2.4). */
export const SWEEP_BATCH = 100;
/** How long a sweep owns a claimed hold before another may take it. */
const SWEEP_CLAIM_MS = 5 * 60_000;
/** How far back the desk list reaches by default (review 2.5). */
export const DESK_WINDOW_DAYS = 90;
/** The most rows one desk read returns. */
export const DESK_LIMIT = 1_000;
/** How many fresh references to try when one collides (review 3.5). */
const REFERENCE_RETRIES = 3;

export interface DeskFilter {
  /** Only bookings whose check-out is on or after this ISO date. */
  since: string;
  /** Narrow to these booking statuses; absent means all. */
  statuses?: readonly BookingStatus[];
}

/** Was this a unique-violation on the booking reference, and nothing else? */
function isReferenceCollision(err: unknown): boolean {
  const candidates = [err, (err as { cause?: unknown })?.cause];
  return candidates.some(
    (e) =>
      typeof e === 'object' &&
      e !== null &&
      (e as { code?: string }).code === '23505' &&
      (e as { constraint?: string }).constraint === 'bookings_reference_uk',
  );
}

/** One `request_to_book` that the sweep auto-declined for missing its window. */
export interface ExpiredRequest {
  id: string;
  reference: string;
}

/**
 * A booking row identified only well enough to prove who owns it (ADR-012,
 * AC-3).
 *
 * Read WITHOUT any workspace filter on purpose. `assertOwned` compares
 * `workspaceId` and turns a mismatch into a 404, so the ownership rule lives in
 * one shared helper rather than being re-spelled as a `where` clause in every
 * query — where leaving it out is invisible in review.
 */
export interface ReservationOwner {
  id: string;
  workspaceId: string;
  /** Through the room type: the branch of the reservation (ADR-054). */
  propertyId: string | null;
  status: BookingStatus;
}

/** One reservation as the front desk reads it. Shaped in the service. */
export interface OperatorReservationRow {
  id: string;
  reference: string;
  guestName: string | null;
  /** Display only: shown where there is no name, never recorded as one. */
  guestEmail: string | null;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  status: BookingStatus;
  grossRwf: number | null;
  approvalExpiresAt: Date | null;
  confirmedAt: Date | null;
  /** From the newest `guest_stays` row for this booking, if any. */
  stayLifecycle: 'open' | 'closed' | null;
  /** `rooms.label` for that stay. Never the room type's name. */
  roomLabel: string | null;
  /** The room type the guest bought; a room held for them must match it. */
  roomTypeId: string;
  /** The room type's name, and the property (branch) it belongs to. */
  roomTypeName: string | null;
  propertyName: string | null;
}

/** Result of a host approve/decline transition (null when nothing was still pending). */
export interface ApprovalOutcome {
  id: string;
  reference: string;
  status: 'confirmed' | 'declined';
  declineReason: 'host_declined' | 'expired' | null;
  paymentStatus: 'captured' | MoneyOutcome;
  escrowStatus: 'held' | MoneyOutcome;
  confirmedAt: Date | null;
}

/** Where a booking's money stands after it is cancelled, declined or no-showed. */
export type MoneyOutcome = 'refunded_full' | 'refunded_partial' | 'forfeited' | 'refund_pending';

/** Writes the refund owed inside the booking's own transaction, shrunk to what remains. */
export type OweTx = (tx: PaymentsTx, amountRwf: number) => Promise<RefundOwedWrite>;

/**
 * Inside a booking transaction: write the refund owed, and say where the money
 * now stands (073-gtbank-payments AC-13). With nothing to owe (no refund, or
 * a payment from before the bank record) the caller's outcome is final. A
 * refund written reads `refund_pending` until the bank pays. With no room left
 * on the payment (earlier refunds took it all), nothing is written and the
 * money is final unless one of those earlier refunds is still moving.
 */
async function oweWithin(
  tx: PaymentsTx,
  owe: OweTx | undefined,
  refundRwf: number,
  outcome: MoneyOutcome,
): Promise<{ outcome: MoneyOutcome; refundRwf: number }> {
  if (!owe || refundRwf <= 0) return { outcome, refundRwf };
  const written = await owe(tx, refundRwf);
  if (written.row) {
    return { outcome: written.row.status === 'successful' ? outcome : 'refund_pending', refundRwf: written.amountRwf };
  }
  return { outcome: written.openSiblings ? 'refund_pending' : 'refunded_full', refundRwf: 0 };
}

/** One booking as a cancellation reads it (F-B11, ADR-051). */
export interface CancellableBooking {
  bookingId: string;
  reference: string;
  workspaceId: string;
  /** The branch of the reservation (ADR-054). */
  propertyId: string;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  grossRwf: number | null;
  nonRefundable: boolean;
  tier: CancellationTier | null;
  paymentStatus: PaymentStatus | null;
  /** The property's check-in time, `HH:MM:SS`, or null for the default. */
  checkInTime: string | null;
  escrowId: string | null;
  escrowStatus: EscrowStatus | null;
  adapterRef: string | null;
  escrowAmountRwf: number | null;
  idempotencyKey: string | null;
  /** Guest stays opened against it. Any at all means the guest has arrived. */
  stays: number;
}

/**
 * This attempt token has already been settled (ADR-020 D-c).
 *
 * Thrown from inside `create`'s transaction so the duplicate booking row that
 * transaction had already inserted is rolled back rather than committed. It is
 * NOT a failure: the caller reads the first press's booking back and answers
 * with it, and must never treat it as the compensating path (AC-24). A second
 * press that reversed the charge behind the booking the first press created
 * would leave a standing booking reading `escrow_status: held` with no money
 * behind it.
 */
export class DuplicateAttemptError extends Error {
  constructor(readonly idempotencyKey: string) {
    super(`Attempt ${idempotencyKey} has already been settled.`);
    this.name = 'DuplicateAttemptError';
  }
}

/**
 * A held escrow row, with everything an instruction to the seam needs.
 *
 * Read BEFORE any status is written, because ADR-020 D-h forbids recording a
 * refund the provider was never told to make: our mirror claiming money came
 * back that nobody returned is the exact divergence F-A06 exists to detect.
 */
export interface HeldEscrow {
  bookingId: string;
  reference: string;
  workspaceId: string;
  escrowId: string;
  /** The provider's own reference for the capture. Null on pre-seam rows. */
  adapterRef: string | null;
  /** Null only on malformed rows; a release cannot be instructed without it. */
  amountRwf: number | null;
  /** The capture's key. Null on rows written before the seam existed. */
  idempotencyKey: string | null;
}

/** Raised when every unit of the Room type is taken for those dates. */
export class NoAvailabilityError extends Error {
  constructor() {
    super('No rooms of that type are available for those dates.');
    this.name = 'NoAvailabilityError';
  }
}

/**
 * Infrastructure layer: the only place that touches Drizzle for bookings.
 *
 * `create` is the transactional heart of F-B05: the Booking row and its Escrow
 * row are written in ONE transaction, so a captured payment can never be
 * recorded without its booking (and vice versa). The last-unit double-book race
 * (FL07 §5C) is prevented by taking a row lock on the Room type inside the
 * transaction, which serialises concurrent bookings of the same type.
 *
 * What changed with the payment seam (ADR-020 A1): the CHARGE no longer happens
 * in here. It is a network call now, and a network call inside a transaction
 * holds this row lock open for the length of a third party's outage. So the
 * service captures first, outside any transaction, and hands the receipt in.
 * The pair that must not be separated — the booking and its escrow ROW — is
 * still exactly one transaction, which is what F-B05 §5's "atomic" was
 * protecting.
 */
@Injectable()
export class BookingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // (`freeUnits`, the unlocked pre-check, is gone: `PaymentAttemptRepository.
  // claimBookingHold` counts bookings and holds under the lock before any
  // capture, which is the check this used to only approximate.)

  /**
   * Create, retrying only a reference collision (review 3.5).
   *
   * A colliding `BK-…` reference raises 23505 inside the transaction and used
   * to surface as a failed, refunded booking. It is the one unique violation on
   * this insert that says nothing about the guest's intent, so it — and only
   * it — gets a fresh draw. Every other error propagates untouched.
   */
  async create(input: CreateBookingRow): Promise<CreatedBooking> {
    let attempt = { ...input };
    for (let i = 0; ; i++) {
      try {
        return await this.createOnce(attempt);
      } catch (err) {
        if (!isReferenceCollision(err) || i >= REFERENCE_RETRIES) throw err;
        attempt = { ...attempt, reference: makeReference() };
      }
    }
  }

  private async createOnce(input: CreateBookingRow): Promise<CreatedBooking> {
    return this.db.transaction(async (tx) => {
      // 1. Serialise concurrent bookings of this Room type (atomic hold).
      await tx
        .select({ id: roomTypes.id })
        .from(roomTypes)
        .where(eq(roomTypes.id, input.roomTypeId))
        .for('update');

      // 1b. Has this press already been booked? Checked UNDER the lock and
      //     BEFORE the count. A poll and the sweep can complete the same settled
      //     attempt at once; the second arrives here after the first committed.
      //     Counted first, the last unit reads as sold out, the second writer
      //     goes down the compensating path, and the refund lands on the money
      //     behind the booking the first one just wrote (booking audit,
      //     2026-09-13). A duplicate is answered as a duplicate instead.
      const [already] = await tx
        .select({ id: escrows.id })
        .from(escrows)
        .where(eq(escrows.idempotencyKey, input.idempotencyKey))
        .limit(1);
      if (already) throw new DuplicateAttemptError(input.idempotencyKey);

      // 2. Is there still a unit on every night, read UNDER the lock (platform
      //    audit step 3)? Sellable capacity, not the declared `room_count`:
      //    rooms out of service and walk ins already in a room are not for
      //    sale, and a stop sell closes the night.
      //
      //    Bookings only, as before: payment holds are NOT counted here. Every
      //    press claimed its hold before it was charged, so the hold already
      //    did its job; counting other holds now would also count a unit twice
      //    in the moment between another press's booking committing and its
      //    attempt being marked booked, and refund a guest who had a room.
      const nights = await readNightlyCapacity(tx, {
        roomTypeId: input.roomTypeId,
        from: input.checkIn,
        to: input.checkOut,
        now: new Date(),
        countHolds: false,
      });
      if (!hasFreeUnitEveryNight(nights)) {
        throw new NoAvailabilityError();
      }

      // 3. Create the Booking. Price + cancellation tier are LOCKED here
      //    (F-B05 §9) so later rate edits never change a made booking.
      const [booking] = await tx
        .insert(bookings)
        .values({
          reference: input.reference,
          roomTypeId: input.roomTypeId,
          guestUserId: input.guestUserId,
          workspaceId: input.workspaceId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestCount: input.guests,
          status: input.status,
          bookingMode: input.bookingMode,
          // The party's nightly charge (per-guest rate × guests), so every
          // later reader of the locked rate posts what was actually paid.
          lockedNightlyRateRwf: stayNightlyRateRwf(input.breakdown),
          lockedCancellationTier: input.cancellationTier,
          nonrefundable: input.nonRefundable,
          grossRwf: input.breakdown.grossRwf,
          paymentStatus: 'captured',
          approvalExpiresAt: input.approvalExpiresAt,
          confirmedAt: input.status === 'confirmed' ? new Date() : null,
        })
        .returning({ id: bookings.id, reference: bookings.reference });

      if (!booking) throw new Error('Booking insert returned no row.');

      // 4. Record the Escrow the seam already captured, in the SAME transaction
      //    as the booking. The mode and the provider's reference come off the
      //    receipt, so this row says which adapter took the money and carries
      //    the identifier reconciliation matches it against (F-A06).
      //
      //    The idempotency key is the one the CAPTURE used, not one derived
      //    from `booking.id`. That is what lets the service replay a
      //    compensating refund against the same charge: a key minted here would
      //    name a booking that failed to exist.
      //
      //    5. And it is the duplicate-press check (ADR-020 D-c). The key is
      //    unique on this table already (`escrows_idempotency_key_uk`), so a
      //    second press of the same confirm button conflicts here and returns
      //    nothing. `ON CONFLICT` rather than catching the 23505: a raised
      //    23505 aborts this transaction, so nothing could be read back on this
      //    handle, and three constraints raise the same SQLSTATE on this insert
      //    — `bookings_reference_uk` among them — so a generic catch would read
      //    a random reference collision as a duplicate press.
      const [escrow] = await tx
        .insert(escrows)
        .values({
          workspaceId: input.workspaceId,
          source: 'booking',
          bookingId: booking.id,
          amountRwf: input.breakdown.grossRwf,
          status: 'held',
          adapterRef: input.receipt.adapterRef,
          adapterMode: input.receipt.mode,
          idempotencyKey: input.idempotencyKey,
          attemptFingerprint: input.attemptFingerprint,
        })
        .onConflictDoNothing({ target: escrows.idempotencyKey })
        .returning({ id: escrows.id });

      if (!escrow) {
        // The booking row inserted a moment ago belongs to a press that has
        // already been settled. Throwing rolls this transaction back, so it is
        // never committed and the guest ends up with one booking, not two.
        throw new DuplicateAttemptError(input.idempotencyKey);
      }

      // 6. The conversation this guest will ask their questions in (ADR-032,
      //    AC-13). Same transaction as the booking, not an outbox event: a
      //    booking without a thread is a booking a guest cannot ask about, and
      //    this is one cheap insert against a table the write already sits
      //    beside.
      //
      //    At ANY status, `pending_approval` included. A guest's question is
      //    most urgent while a request is still waiting on a host, and that is
      //    exactly the window a confirmation-gated thread would silence.
      //
      //    `subject` and `departmentId` are both left null on purpose. A
      //    reservation thread is with the property, not with one of its desks:
      //    the guest is asking about their booking and has no idea the property
      //    has a housekeeping department. Routing is F-P07's job and it assigns
      //    the department when a conversation is actually routed, which is the
      //    D14 rule that routing targets a department and never a person.
      //    Setting it here would pick a desk before anyone knows the question.
      //
      //    `workspaceId` is the booking's, so the thread lands in the
      //    property's workspace and the operator inbox sees it with no extra
      //    step. That is also why a guest cannot be authorized by workspace and
      //    `assertMine` exists.
      await tx.insert(threads).values({
        workspaceId: input.workspaceId,
        bookingId: booking.id,
      });

      return {
        id: booking.id,
        reference: booking.reference,
        status: input.status,
        paymentStatus: 'captured' as const,
        escrowStatus: 'held' as const,
        approvalExpiresAt: input.approvalExpiresAt,
      };
    });
  }

  /**
   * The booking a given attempt token already produced (ADR-020 D-c).
   *
   * Scoped by `guestUserId` as well as by the key, so a guessed or replayed
   * token can never surface another guest's reservation. The token is a client
   * generated value; treating it as a bearer credential for a booking would be
   * exactly that.
   *
   * Every field comes off the booking row, which already stores the locked
   * rate, tier, mode, party and approval window. The caller recomputes
   * `breakdown` from the locked rate with the same `computeBreakdown` the first
   * request used, which is what makes it the same number rather than a similar
   * one.
   */
  /**
   * How many units of one room type are free on EACH night of a window
   * (ADR-047 wave E).
   *
   * `freeUnits` above answers a different question — "is anything free across
   * this whole range" — and one number is the right answer for a pre-check and
   * the wrong one for a calendar: collapsing a month to a single count greys
   * out all of it because one Tuesday is full.
   *
   * ## The interval, which is the whole correctness of this
   *
   * A booking occupies a night when `check_in <= night < check_out`. Half-open,
   * so the CHECK-OUT day of one stay is bookable as the ARRIVAL day of the
   * next — that is the same rule the availability hold uses (`check_in <
   * checkOut AND check_out > checkIn`), and getting it wrong in one direction
   * oversells the room and in the other makes a night nobody can ever buy.
   *
   * `generate_series` drives the result rather than the bookings table, so a
   * night with NO bookings comes back as a row with zero held rather than
   * missing from the answer — a client must not have to infer availability from
   * a gap.
   *
   * Only `pending_approval` and `confirmed` hold inventory. A cancelled or
   * declined booking accumulates forever and must never make a room look full,
   * which is exactly what `HOLDING_STATUSES` and the partial index exist for.
   */
  async freeUnitsByNight(
    roomTypeId: string,
    from: string,
    to: string,
  ): Promise<{ night: string; freeUnits: number }[]> {
    // The same read the hold and the booking write take under their lock
    // (platform audit step 3), so the calendar never offers a night the
    // checkout then refuses. Held = bookings PLUS live payment holds (booking
    // audit, 2026-09-13); capacity = sellable rooms, not `room_count`. Free
    // units never go negative: a night sold past what can be sold reads as
    // sold out, not as "minus two free".
    const nights = await readNightlyCapacity(this.db, {
      roomTypeId,
      from,
      to,
      now: new Date(),
    });
    return nights.map(({ night, freeUnits }) => ({ night, freeUnits }));
  }

  async findByAttemptKey(
    idempotencyKey: string,
    guestUserId: string,
  ): Promise<SettledAttempt | null> {
    const [row] = await this.db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        status: bookings.status,
        bookingMode: bookings.bookingMode,
        paymentStatus: bookings.paymentStatus,
        escrowStatus: escrows.status,
        nonRefundable: bookings.nonrefundable,
        lockedCancellationTier: bookings.lockedCancellationTier,
        lockedNightlyRateRwf: bookings.lockedNightlyRateRwf,
        grossRwf: bookings.grossRwf,
        attemptFingerprint: escrows.attemptFingerprint,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        guests: bookings.guestCount,
        approvalExpiresAt: bookings.approvalExpiresAt,
      })
      .from(escrows)
      .innerJoin(bookings, eq(bookings.id, escrows.bookingId))
      .where(
        and(
          eq(escrows.idempotencyKey, idempotencyKey),
          eq(bookings.guestUserId, guestUserId),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  /**
   * Every `request_to_book` whose approval window has elapsed, with the escrow
   * row behind it. A READ, taking no lock and writing nothing.
   *
   * Split out of the write (ADR-020 D-h) because the sweep must instruct the
   * payment seam before it records a refund. The old shape flipped both
   * statuses inside one transaction with no port call at all, which is our
   * mirror declaring that money came back that the provider was never told to
   * return — the exact divergence F-A06 exists to detect.
   */
  async findExpiredRequests(
    now: Date,
    limit: number = SWEEP_BATCH,
  ): Promise<HeldEscrow[]> {
    // CLAIM a bounded batch rather than read everything (review 2.4). The
    // stamp is what stops two workers chasing the same hold; SKIP LOCKED is
    // what stops them waiting on each other to find out. The provider calls
    // still happen outside this transaction, as ADR-020 D-h requires.
    const claimUntil = new Date(now.getTime() + SWEEP_CLAIM_MS);
    const claimed = await this.db.execute<{ id: string }>(sql`
      UPDATE bookings b
      SET sweep_claimed_until = ${claimUntil}
      FROM (
        SELECT id FROM bookings
        WHERE status = 'pending_approval'
          AND approval_expires_at IS NOT NULL
          AND approval_expires_at <= ${now}
          AND (sweep_claimed_until IS NULL OR sweep_claimed_until < ${now})
        ORDER BY approval_expires_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      ) c
      WHERE b.id = c.id
      RETURNING b.id
    `);
    const ids = claimed.rows.map((r) => r.id);
    if (ids.length === 0) return [];

    return this.db
      .select({
        bookingId: bookings.id,
        reference: bookings.reference,
        workspaceId: bookings.workspaceId,
        escrowId: escrows.id,
        adapterRef: escrows.adapterRef,
        amountRwf: escrows.amountRwf,
        idempotencyKey: escrows.idempotencyKey,
      })
      .from(bookings)
      .innerJoin(
        escrows,
        and(eq(escrows.bookingId, bookings.id), eq(escrows.source, 'booking')),
      )
      .where(and(inArray(bookings.id, ids), eq(escrows.status, 'held')));
  }

  /**
   * Does a booking already stand behind this capture key? (review 3.2)
   *
   * The referee between a late-settling capture and the retry a guest was told
   * to make: once an escrow row claims the key, the void job must not refund
   * the money that booking is backed by.
   */
  async escrowExistsForCaptureKey(captureKey: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: escrows.id })
      .from(escrows)
      .where(eq(escrows.idempotencyKey, captureKey))
      .limit(1);
    return row !== undefined;
  }

  /**
   * Record the auto-declines the provider actually confirmed (F-B06 / F-B03
   * §10, ADR-020 D-h). Flipping the status to `declined` releases the atomic
   * hold, since `create` only counts `pending_approval` / `confirmed` bookings
   * as holding inventory.
   *
   * `bookingIds` is the confirmed set and nothing else. A booking whose release
   * the provider did not confirm is deliberately absent: it stays
   * `pending_approval` with its money still `held`, and the compensation queue
   * chases it. Marking it refunded on optimism is the thing D-h forbids.
   *
   * Idempotent: both writes are guarded on the state they move out of, so a
   * second run — or two concurrent runs — changes nothing already swept. Both
   * happen in ONE transaction, so a declined booking can never be left with its
   * money still `held`.
   */
  async recordExpiredDeclines(
    bookingIds: string[],
  ): Promise<ExpiredRequest[]> {
    if (bookingIds.length === 0) return [];

    return this.db.transaction(async (tx) => {
      const expired = await tx
        .update(bookings)
        .set({
          status: 'declined',
          declineReason: 'expired',
          paymentStatus: 'refunded_full',
        })
        .where(
          and(
            eq(bookings.status, 'pending_approval'),
            inArray(bookings.id, bookingIds),
          ),
        )
        .returning({ id: bookings.id, reference: bookings.reference });

      if (expired.length === 0) return [];

      // 100% on expiry — no contract was formed. Guarded on `held` so a refund
      // is never double-applied.
      await tx
        .update(escrows)
        .set({ status: 'refunded_full' })
        .where(
          and(
            eq(escrows.source, 'booking'),
            eq(escrows.status, 'held'),
            inArray(
              escrows.bookingId,
              expired.map((row) => row.id),
            ),
          ),
        );

      return expired;
    });
  }

  /**
   * Approve a pending request → `confirmed`. The hold and escrow are already in
   * place from booking time, so this only flips status + stamps `confirmedAt`.
   * Guarded on `pending_approval`; returns null if it was already resolved.
   */
  /**
   * The property a booking sells a room in, and the guest it is for.
   *
   * Read through the room type, because a booking names a room TYPE and only a
   * type knows which property it belongs to. Used when a confirmed reservation
   * opens its pre-arrival folio (ADR-016 D-k), which needs both.
   */
  async propertyForBooking(bookingId: string): Promise<{
    propertyId: string;
    guestUserId: string | null;
  } | null> {
    const [row] = await this.db
      .select({
        propertyId: roomTypes.propertyId,
        guestUserId: bookings.guestUserId,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .where(eq(bookings.id, bookingId))
      .limit(1);
    return row ?? null;
  }

  async approve(bookingId: string): Promise<ApprovalOutcome | null> {
    const [updated] = await this.db
      .update(bookings)
      .set({ status: 'confirmed', confirmedAt: new Date() })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.status, 'pending_approval'),
        ),
      )
      .returning({
        id: bookings.id,
        reference: bookings.reference,
        confirmedAt: bookings.confirmedAt,
      });

    if (!updated) return null;
    return {
      id: updated.id,
      reference: updated.reference,
      status: 'confirmed',
      declineReason: null,
      paymentStatus: 'captured',
      escrowStatus: 'held',
      confirmedAt: updated.confirmedAt,
    };
  }

  /**
   * The held escrow behind one booking, read before anything is written
   * (ADR-020 D-h).
   *
   * `null` means there is nothing to release: no such booking, it is not
   * pending, or its escrow is already resolved. The caller answers that as a
   * conflict and instructs the seam for nothing.
   */
  async findHeldEscrow(bookingId: string): Promise<HeldEscrow | null> {
    const [row] = await this.db
      .select({
        bookingId: bookings.id,
        reference: bookings.reference,
        workspaceId: bookings.workspaceId,
        escrowId: escrows.id,
        adapterRef: escrows.adapterRef,
        amountRwf: escrows.amountRwf,
        idempotencyKey: escrows.idempotencyKey,
      })
      .from(bookings)
      .innerJoin(
        escrows,
        and(eq(escrows.bookingId, bookings.id), eq(escrows.source, 'booking')),
      )
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.status, 'pending_approval'),
          eq(escrows.status, 'held'),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  /**
   * Record a decline the provider already confirmed → `declined` (reason
   * `host_declined`) with its Escrow refunded 100%, in ONE transaction. Guarded
   * on `pending_approval`; returns null if it was already resolved (e.g. the
   * auto-decline job won the race).
   *
   * The release instruction happens in `BookingApprovalService` BEFORE this
   * runs (ADR-020 D-h). This method records what the seam confirmed; it never
   * writes `refunded_full` on the strength of a database update alone.
   */
  async decline(
    bookingId: string,
    /** The refund owed, written in this transaction (073-gtbank-payments AC-13). */
    refund?: { owe: OweTx; amountRwf: number },
  ): Promise<ApprovalOutcome | null> {
    return this.declineWithin(bookingId, 'host_declined', refund);
  }

  /**
   * One expired request, declined with its refund owed in the same
   * transaction (073-gtbank-payments AC-13). The batch `recordExpiredDeclines`
   * stays for a payment from before the bank record, whose release the
   * provider has already confirmed.
   */
  async recordExpiredDecline(
    bookingId: string,
    refund: { owe: OweTx; amountRwf: number },
  ): Promise<ExpiredRequest | null> {
    const outcome = await this.declineWithin(bookingId, 'expired', refund);
    return outcome ? { id: outcome.id, reference: outcome.reference } : null;
  }

  private async declineWithin(
    bookingId: string,
    reason: 'host_declined' | 'expired',
    refund?: { owe: OweTx; amountRwf: number },
  ): Promise<ApprovalOutcome | null> {
    return this.db.transaction(async (tx) => {
      const pending = and(eq(bookings.id, bookingId), eq(bookings.status, 'pending_approval'));
      const [held] = await tx.select({ id: bookings.id }).from(bookings).where(pending).for('update');
      if (!held) return null;

      const money = await oweWithin(tx, refund?.owe, refund?.amountRwf ?? 0, 'refunded_full');
      const [updated] = await tx
        .update(bookings)
        .set({
          status: 'declined',
          declineReason: reason,
          paymentStatus: money.outcome,
          ...(refund ? { refundRwf: money.refundRwf } : {}),
        })
        .where(pending)
        .returning({ id: bookings.id, reference: bookings.reference });

      if (!updated) return null;

      await tx
        .update(escrows)
        .set({ status: money.outcome })
        .where(
          and(
            eq(escrows.source, 'booking'),
            eq(escrows.status, 'held'),
            eq(escrows.bookingId, bookingId),
          ),
        );

      return {
        id: updated.id,
        reference: updated.reference,
        status: 'declined' as const,
        declineReason: reason,
        paymentStatus: money.outcome,
        escrowStatus: money.outcome,
        confirmedAt: null,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Cancellation (F-B11, ADR-051)
  // -------------------------------------------------------------------------

  /**
   * Everything a cancellation decides on, for ONE booking, read before any
   * money moves. By reference and scoped to the guest, or by id for a host
   * whose authority the caller has already proved.
   *
   * The escrow is joined whatever its state, so the service can refuse a
   * booking whose money already moved rather than find nothing and 404.
   */
  async findForCancellation(
    where: { reference: string; guestUserId: string } | { bookingId: string },
  ): Promise<CancellableBooking | null> {
    const [row] = await this.db
      .select({
        bookingId: bookings.id,
        reference: bookings.reference,
        workspaceId: bookings.workspaceId,
        propertyId: roomTypes.propertyId,
        status: bookings.status,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        grossRwf: bookings.grossRwf,
        nonRefundable: bookings.nonrefundable,
        tier: bookings.lockedCancellationTier,
        paymentStatus: bookings.paymentStatus,
        checkInTime: properties.checkInTime,
        escrowId: escrows.id,
        escrowStatus: escrows.status,
        adapterRef: escrows.adapterRef,
        escrowAmountRwf: escrows.amountRwf,
        idempotencyKey: escrows.idempotencyKey,
        stays: sql<number>`(select count(*)::int from ${guestStays} gs where gs.booking_id = ${bookings.id})`,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .innerJoin(properties, eq(properties.id, roomTypes.propertyId))
      .leftJoin(escrows, and(eq(escrows.bookingId, bookings.id), eq(escrows.source, 'booking')))
      .where(
        'bookingId' in where
          ? eq(bookings.id, where.bookingId)
          : and(eq(bookings.reference, where.reference), eq(bookings.guestUserId, where.guestUserId)),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Record a cancellation, in ONE transaction: the booking, its escrow, and
   * (with `owe`) the refund it owes (073-gtbank-payments AC-13). Guarded on the
   * two states a cancellation moves out of, under a row lock, so a second
   * press, or a host and a guest at once, records nothing the second time and
   * the caller answers 409.
   *
   * With `owe` the money reads `refund_pending` until the bank pays, and
   * `refundRwf` is what was actually owed: the rule's amount, shrunk to what
   * remains of the payment. Without it (a payment from before the bank
   * record), the provider has already carried the refund out and `outcome` is
   * final, as before.
   */
  async recordCancellation(input: {
    bookingId: string;
    party: 'guest' | 'host';
    refundRwf: number;
    outcome: 'refunded_full' | 'refunded_partial' | 'forfeited';
    /** The desk's words, when it cancelled at the guest's request. */
    reason?: string | null;
    owe?: OweTx;
  }): Promise<{ id: string; reference: string; paymentStatus: MoneyOutcome; refundRwf: number } | null> {
    return this.db.transaction(async (tx) => {
      const [held] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.id, input.bookingId), inArray(bookings.status, [...HOLDING_STATUSES])))
        .for('update');
      if (!held) return null;

      const money = await oweWithin(tx, input.owe, input.refundRwf, input.outcome);
      const [updated] = await tx
        .update(bookings)
        .set({
          status: 'cancelled',
          paymentStatus: money.outcome,
          cancelledAt: new Date(),
          cancelledBy: input.party,
          refundRwf: money.refundRwf,
          ...(input.reason ? { cancelReason: input.reason } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(bookings.id, input.bookingId),
            inArray(bookings.status, [...HOLDING_STATUSES]),
          ),
        )
        .returning({ id: bookings.id, reference: bookings.reference });
      if (!updated) return null;

      await tx
        .update(escrows)
        .set({ status: money.outcome, updatedAt: new Date() })
        .where(
          and(
            eq(escrows.bookingId, input.bookingId),
            eq(escrows.source, 'booking'),
            eq(escrows.status, 'held'),
          ),
        );
      return { ...updated, paymentStatus: money.outcome, refundRwf: money.refundRwf };
    });
  }

  /**
   * Record a no-show the provider already settled, in ONE transaction: the
   * booking and its escrow (`BookingCancellationService.markNoShow`).
   *
   * Guarded on the booking still being confirmed with no stay against it, so
   * a check in racing the press, or a second press, records nothing and the
   * caller answers 409. `outcome` is null for a booking that took no money:
   * its payment status stays null and no escrow moves.
   */
  async recordNoShow(input: {
    bookingId: string;
    outcome: 'refunded_full' | 'refunded_partial' | 'forfeited' | null;
    refundRwf: number | null;
    reason: string | null;
    byUserId: string;
    /** The refund owed, written in this transaction (073-gtbank-payments AC-13). */
    owe?: OweTx;
  }): Promise<{ id: string; reference: string; paymentStatus: MoneyOutcome | null; refundRwf: number | null } | null> {
    return this.db.transaction(async (tx) => {
      const now = new Date();
      const stillNoShow = and(
        eq(bookings.id, input.bookingId),
        eq(bookings.status, 'confirmed'),
        sql`NOT EXISTS (SELECT 1 FROM ${guestStays} gs WHERE gs.booking_id = ${bookings.id})`,
      );
      const [held] = await tx.select({ id: bookings.id }).from(bookings).where(stillNoShow).for('update');
      if (!held) return null;

      const money = input.outcome
        ? await oweWithin(tx, input.owe, input.refundRwf ?? 0, input.outcome)
        : null;
      const [updated] = await tx
        .update(bookings)
        .set({
          status: 'no_show',
          ...(money ? { paymentStatus: money.outcome, refundRwf: money.refundRwf } : {}),
          noShowAt: now,
          noShowByUserId: input.byUserId,
          noShowReason: input.reason,
          updatedAt: now,
        })
        .where(stillNoShow)
        .returning({ id: bookings.id, reference: bookings.reference });
      if (!updated) return null;

      if (money) {
        await tx
          .update(escrows)
          .set({ status: money.outcome, updatedAt: now })
          .where(
            and(
              eq(escrows.bookingId, input.bookingId),
              eq(escrows.source, 'booking'),
              eq(escrows.status, 'held'),
            ),
          );
      }
      return { ...updated, paymentStatus: money?.outcome ?? null, refundRwf: money?.refundRwf ?? null };
    });
  }

  /**
   * The bank reversed this booking's payment and two people chose not to carry
   * it (073-gtbank-payments AC-20, `cancel_service`): cancelled with no refund,
   * because the guest already has the money back through the reversal, so the
   * money and the escrow read `refunded_full` with `refund_rwf` 0. Guarded on
   * the states a cancellation moves out of, under a row lock.
   */
  async cancelForReversal(bookingId: string): Promise<{ id: string; reference: string } | null> {
    return this.db.transaction(async (tx) => {
      const holding = and(eq(bookings.id, bookingId), inArray(bookings.status, [...HOLDING_STATUSES]));
      const [held] = await tx.select({ id: bookings.id }).from(bookings).where(holding).for('update');
      if (!held) return null;
      const now = new Date();
      const [updated] = await tx
        .update(bookings)
        .set({
          status: 'cancelled',
          paymentStatus: 'refunded_full',
          cancelledAt: now,
          cancelledBy: 'host',
          refundRwf: 0,
          cancelReason: 'The payment for this booking was reversed by the bank.',
          updatedAt: now,
        })
        .where(holding)
        .returning({ id: bookings.id, reference: bookings.reference });
      if (!updated) return null;
      await tx
        .update(escrows)
        .set({ status: 'refunded_full', updatedAt: now })
        .where(and(eq(escrows.bookingId, bookingId), eq(escrows.source, 'booking'), eq(escrows.status, 'held')));
      return updated;
    });
  }

  // -------------------------------------------------------------------------
  // The operator side (ADR-012, /api/v1/ops/reservations)
  // -------------------------------------------------------------------------

  /**
   * Who owns this booking, and what state is it in.
   *
   * Deliberately unfiltered by workspace: the caller hands the row to
   * `assertOwned`, which answers 404 for someone else's. Filtering here instead
   * would work, and would also mean every future query has to remember to do
   * it — an omission nothing can see. One helper, one rule.
   */
  async findReservationOwner(
    bookingId: string,
  ): Promise<ReservationOwner | null> {
    const [row] = await this.db
      .select({
        id: bookings.id,
        workspaceId: bookings.workspaceId,
        propertyId: roomTypes.propertyId,
        status: bookings.status,
      })
      .from(bookings)
      .leftJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    return row ?? null;
  }

  /**
   * Every reservation on this workspace's desk, newest arrival last.
   *
   * Two queries rather than one join, because a booking can carry more than one
   * `guest_stays` row and a join would then return the same reservation twice.
   * The desk list must have one row per reservation, so the stays are read
   * separately and the newest one wins. At desk sizes this is one extra round
   * trip; pagination is a named follow-up on the ADR for when a property
   * outgrows a screenful.
   */
  async listOperatorReservations(
    workspaceId: string,
    scope: BranchScope,
    filter: DeskFilter,
  ): Promise<OperatorReservationRow[]> {
    const rows = await this.db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        guestName: accountName,
        guestEmail: users.email,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        guestCount: bookings.guestCount,
        status: bookings.status,
        grossRwf: bookings.grossRwf,
        approvalExpiresAt: bookings.approvalExpiresAt,
        confirmedAt: bookings.confirmedAt,
        roomTypeId: bookings.roomTypeId,
        roomTypeName: roomTypes.name,
        propertyName: properties.name,
      })
      .from(bookings)
      .leftJoin(users, eq(users.id, bookings.guestUserId))
      .leftJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .leftJoin(properties, eq(properties.id, roomTypes.propertyId))
      .where(
        and(
          eq(bookings.workspaceId, workspaceId),
          // A reservation reaches its branch through its room type (ADR-054).
          inBranchScope(roomTypes.propertyId, scope),
          // A window and a ceiling (review 2.5): the desk shows what is still
          // relevant, not every booking the workspace has ever had.
          gte(bookings.checkOut, filter.since),
          filter.statuses && filter.statuses.length > 0
            ? inArray(bookings.status, [...filter.statuses])
            : undefined,
        ),
      )
      .orderBy(bookings.checkIn, bookings.reference)
      .limit(DESK_LIMIT);

    const stays = await this.newestStayPerBooking(rows.map((r) => r.id));

    return rows.map((row) => ({
      ...row,
      stayLifecycle: stays.get(row.id)?.lifecycle ?? null,
      roomLabel: stays.get(row.id)?.roomLabel ?? null,
    }));
  }

  /**
   * One reservation in the same shape, read back after a command so the client
   * patches its list from the server's answer rather than from a guess.
   */
  async findOperatorReservation(
    bookingId: string,
  ): Promise<OperatorReservationRow | null> {
    const [row] = await this.db
      .select({
        id: bookings.id,
        reference: bookings.reference,
        guestName: accountName,
        guestEmail: users.email,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        guestCount: bookings.guestCount,
        status: bookings.status,
        grossRwf: bookings.grossRwf,
        approvalExpiresAt: bookings.approvalExpiresAt,
        confirmedAt: bookings.confirmedAt,
        roomTypeId: bookings.roomTypeId,
        roomTypeName: roomTypes.name,
        propertyName: properties.name,
      })
      .from(bookings)
      .leftJoin(users, eq(users.id, bookings.guestUserId))
      .leftJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .leftJoin(properties, eq(properties.id, roomTypes.propertyId))
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row) return null;

    const stays = await this.newestStayPerBooking([row.id]);
    return {
      ...row,
      stayLifecycle: stays.get(row.id)?.lifecycle ?? null,
      roomLabel: stays.get(row.id)?.roomLabel ?? null,
    };
  }

  /**
   * The newest stay for each of these bookings, with its room label.
   *
   * `entry_at` descending and first one wins, so "the stay" is unambiguous even
   * when a booking was checked in twice. Returns an empty map for an empty
   * list rather than issuing a query that matches everything.
   */
  private async newestStayPerBooking(
    bookingIds: string[],
  ): Promise<Map<string, { lifecycle: 'open' | 'closed'; roomLabel: string | null }>> {
    const found = new Map<
      string,
      { lifecycle: 'open' | 'closed'; roomLabel: string | null }
    >();
    if (bookingIds.length === 0) return found;

    const rows = await this.db
      .select({
        bookingId: guestStays.bookingId,
        lifecycle: guestStays.lifecycle,
        roomLabel: rooms.label,
        entryAt: guestStays.entryAt,
      })
      .from(guestStays)
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .where(inArray(guestStays.bookingId, bookingIds))
      .orderBy(desc(guestStays.entryAt));

    for (const row of rows) {
      if (!row.bookingId || found.has(row.bookingId)) continue;
      found.set(row.bookingId, {
        lifecycle: row.lifecycle,
        roomLabel: row.roomLabel,
      });
    }
    return found;
  }
}
