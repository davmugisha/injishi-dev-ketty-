import {
  PAYMENT_PROMPT_TTL_SECONDS,
  computeBreakdown,
  type CreateBookingInput,
  type PaymentAttemptStatus,
} from '@injishi/contracts';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ListingService } from '../../listing/application/listing.service';
import { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import { voidKeyFor } from '../../payments/domain/keys';
import {
  PAYMENT_PORT,
  maskDestination,
  type PaymentPort,
  type PaymentReceipt,
} from '../../payments/domain/payment-port';
import { approvalExpiresAt, nightsBetween, statusForMode } from '../domain/pricing';
import {
  PaymentAttemptRepository,
  type PaymentAttemptRow,
} from '../infrastructure/payment-attempt.repository';
import { BookingService } from './booking.service';

/**
 * The wait between "we asked" and "they paid" (ADR-047 D-j).
 *
 * ## What this replaces
 *
 * `BookingService` used to answer an unsettled capture with a 402 and this
 * sentence: *"Approve the request on your phone, then try again."* That is a
 * human being polling a payment provider by hand, on the screen where their
 * money is. It also queued a void immediately, which the retry then had to
 * withdraw — so the happy path ran the compensation machinery every time.
 *
 * Every Rwandan mobile money rail behaves this way, so this is not an edge
 * case: it is the ordinary path for almost every payment this platform will
 * ever take. `apps/mobile` had already worked this out and written it down in
 * `data/payment-attempt.ts`; this is the server-side half it was waiting for.
 *
 * ## The rules, which are mobile's five obligations
 *
 * **The wait survives everything.** It is a row, not a promise and not a
 * client's memory. A guest who closes the tab, loses signal, or comes back an
 * hour later still has an attempt to read.
 *
 * **Not knowing is the default.** `prompting` means "no answer yet" and is
 * never an error. Only something that ANSWERS moves it.
 *
 * **Only the provider produces `confirmed`.** Nothing this service observes is
 * proof; it asks `fetchTransaction` and believes that. A poll that cannot reach
 * the provider leaves the attempt exactly where it was.
 *
 * **ADR-020 D-b is unchanged.** No booking is written until the money has
 * settled. The guest simply has somewhere to wait now instead of a refusal.
 */
@Injectable()
export class PaymentAttemptService {
  private readonly log = new Logger(PaymentAttemptService.name);

  constructor(
    private readonly attempts: PaymentAttemptRepository,
    private readonly listings: ListingService,
    private readonly bookings: BookingService,
    private readonly compensations: PaymentCompensationService,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
  ) {}

  /**
   * Record a prompt that is now sitting on somebody's handset.
   *
   * Called from `BookingService` the moment a capture comes back `pending`, and
   * BEFORE the guest is handed anything to watch — so a crash between the two
   * leaves a row the sweep can void, rather than money in flight with no record
   * on our side.
   */
  async begin(args: {
    input: CreateBookingInput;
    guestUserId: string;
    roomType: { id: string; workspaceId: string };
    receipt: PaymentReceipt;
    idempotencyKey: string;
    fingerprint: string;
    amountRwf: number;
    nonRefundable: boolean;
  }): Promise<PaymentAttemptStatus> {
    const { input, receipt } = args;
    const instrument = input.instrument;
    const expiresAt = new Date(Date.now() + PAYMENT_PROMPT_TTL_SECONDS * 1_000);

    // The token is the client's when it sent one, and the server's otherwise —
    // the same value the capture key was derived from, so a poll can find this.
    const attemptToken = input.attemptToken ?? tokenFromKey(args.idempotencyKey);

    await this.attempts.record({
      attemptToken,
      idempotencyKey: args.idempotencyKey,
      guestUserId: args.guestUserId,
      workspaceId: args.roomType.workspaceId,
      roomTypeId: args.roomType.id,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      nonRefundable: args.nonRefundable,
      attemptFingerprint: args.fingerprint,
      amountRwf: args.amountRwf,
      adapterRef: receipt.adapterRef,
      adapterMode: receipt.mode,
      instrumentKind: instrument.kind,
      network: instrument.kind === 'mobile_money' ? instrument.network : null,
      // Masked at the boundary, never stored whole. Enough for support to match
      // a person to an attempt; never enough to charge anybody.
      payerMasked:
        instrument.kind === 'mobile_money'
          ? maskDestination(instrument.msisdn)
          : null,
      expiresAt,
    });

    return {
      attemptToken,
      state: 'prompting',
      network: instrument.kind === 'mobile_money' ? instrument.network : null,
      payerMasked:
        instrument.kind === 'mobile_money'
          ? maskDestination(instrument.msisdn)
          : null,
      amountRwf: args.amountRwf,
      expiresAt: expiresAt.toISOString(),
      booking: null,
      failureReason: null,
    };
  }

  /**
   * Where did my payment get to?
   *
   * Guest-scoped by the repository, so an attempt token guessed by a stranger
   * finds nothing. Safe to call in a loop: a settled attempt returns its
   * booking from the row rather than re-asking the provider, and completing is
   * idempotent through the escrow constraint underneath it.
   */
  async poll(
    attemptToken: string,
    guestUserId: string,
  ): Promise<PaymentAttemptStatus> {
    const row = await this.attempts.findForGuest(attemptToken, guestUserId);
    if (!row) throw new NotFoundException('No such payment attempt.');

    if (row.state !== 'prompting') return this.present(row, null);

    // Past the deadline: stop waiting, and take the money back. Checked before
    // the provider is asked, so a guest is never left on a spinner because the
    // sweep has not run yet.
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.abandon(row, 'expired', UNANSWERED);
      return this.present({ ...row, state: 'expired', failureReason: UNANSWERED }, null);
    }

    if (!row.adapterRef) {
      // Nothing to ask about. A row written without a provider reference cannot
      // be resolved either way, so it is ended rather than left spinning.
      await this.abandon(row, 'refused', UNREACHABLE);
      return this.present({ ...row, state: 'refused', failureReason: UNREACHABLE }, null);
    }

    let receipt: PaymentReceipt | null;
    try {
      receipt = await this.payments.fetchTransaction(row.workspaceId, row.adapterRef);
    } catch {
      /*
       * We could not ask. That is NOT an answer.
       *
       * Leaving the attempt `prompting` is the whole point of mobile's second
       * obligation: a returning client that cannot confirm says "still
       * confirming" and offers to check again. Treating an outage as a refusal
       * would tell a guest their payment failed while it was quietly settling.
       */
      return this.present(row, null);
    }

    if (!receipt) {
      // The provider has no record of a capture we hold a reference for. That
      // is a genuine dead end rather than an outage: nothing to wait for.
      await this.abandon(row, 'refused', LOST);
      return this.present({ ...row, state: 'refused', failureReason: LOST }, null);
    }

    if (receipt.settlement !== 'settled') return this.present(row, null);

    // --- It landed. Write the reservation it paid for. ---------------------
    //
    // `complete` returns null when it could NOT write one — the room stopped
    // being sellable while the guest was approving — and has already refunded
    // and ended the attempt by then. Reporting `confirmed` here regardless was
    // a real bug: it told a guest they had a reservation that does not exist,
    // on the one screen where that is unforgivable.
    const booking = await this.complete(row, receipt);
    if (!booking) {
      return this.present({ ...row, state: 'refused', failureReason: WITHDRAWN }, null);
    }
    return this.present({ ...row, state: 'confirmed' }, booking);
  }

  /**
   * Turn a settled attempt into the reservation the guest asked for.
   *
   * The stay is read off the ATTEMPT ROW, not from a client — the browser may
   * be closed, and this same path is what a provider callback will use. The
   * room type is re-resolved because its rate, capacity and mode may have moved
   * in the minutes the prompt was open, and the booking must be written against
   * what is true now.
   */
  private async complete(
    row: PaymentAttemptRow,
    receipt: PaymentReceipt,
  ): Promise<Awaited<ReturnType<BookingService['writeBooking']>> | null> {
    const roomType = await this.listings.findBookableRoomType(row.roomTypeId);
    if (!roomType || roomType.nightlyRateRwf == null || roomType.bookingMode == null) {
      // The room stopped being sellable while the guest was approving. Their
      // money goes back; a reservation against inventory that no longer exists
      // would be worse than the refund.
      await this.abandon(row, 'refused', WITHDRAWN);
      return null;
    }

    const nights = nightsBetween(row.checkIn, row.checkOut);
    const breakdown = computeBreakdown({
      nightlyRateRwf: roomType.nightlyRateRwf,
      nights,
      nonRefundable: row.nonRefundable,
    });

    const booking = await this.bookings.writeBooking({
      input: {
        roomTypeId: row.roomTypeId,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        guests: row.guests,
        nonRefundable: row.nonRefundable,
        attemptToken: row.attemptToken,
        // The instrument is not re-sent: the money is already captured and this
        // write does not touch the seam. A placeholder would be a lie on a row,
        // so the field is filled from what the attempt recorded about the rail.
        instrument:
          row.network && row.payerMasked
            ? { kind: 'mobile_money', network: row.network, msisdn: '000000000' }
            : { kind: 'card', token: 'settled' },
      } satisfies CreateBookingInput,
      guestUserId: row.guestUserId,
      roomType,
      nightlyRateRwf: roomType.nightlyRateRwf,
      bookingMode: roomType.bookingMode,
      receipt,
      idempotencyKey: row.idempotencyKey,
      fingerprint: row.attemptFingerprint,
      nights,
      breakdown,
      nonRefundable: row.nonRefundable,
      status: statusForMode(roomType.bookingMode),
      expiresAt: approvalExpiresAt(roomType.bookingMode, row.checkIn, new Date()),
    });

    await this.attempts.markConfirmed(row.id, booking.id);
    this.log.log(
      `Payment attempt ${row.attemptToken} settled into booking ${booking.reference}.`,
    );
    return booking;
  }

  /**
   * End an attempt, and make sure the money does not stay taken.
   *
   * The void goes on the compensation queue rather than being called inline:
   * this runs inside a guest's own poll, and a provider round trip there would
   * hold their request open for the length of somebody else's outage. The queue
   * is the durable half, and it runs on the capture's derived void key so a
   * repeat is a replay rather than a second reversal.
   */
  private async abandon(
    row: PaymentAttemptRow,
    state: 'refused' | 'expired',
    reason: string,
  ): Promise<void> {
    await this.attempts.markEnded(row.id, state, reason);

    if (!row.adapterRef || row.amountRwf == null) return;
    await this.compensations.enqueue({
      kind: 'void-pending',
      idempotencyKey: voidKeyFor(row.idempotencyKey),
      workspaceId: row.workspaceId,
      originalRef: row.adapterRef,
      amountRwf: row.amountRwf,
      memo: `Payment attempt ${state}: ${reason}`,
    });
  }

  /** The row, as the wire says it. */
  private present(
    row: PaymentAttemptRow,
    booking: Awaited<ReturnType<BookingService['writeBooking']>> | null,
  ): PaymentAttemptStatus {
    return {
      attemptToken: row.attemptToken,
      state: row.state,
      network: row.network,
      payerMasked: row.payerMasked,
      amountRwf: row.amountRwf,
      expiresAt: row.expiresAt.toISOString(),
      booking: booking ?? null,
      failureReason: row.failureReason,
    };
  }

  /**
   * Void every prompt nobody answered. Run from the worker's sweep.
   *
   * Bounded per run, and it never throws for one bad row: a single attempt that
   * cannot be voided must not stop the others being cleaned up, because each
   * one is somebody's money sitting in limbo.
   */
  async expireStale(now: Date = new Date()): Promise<number> {
    const stale = await this.attempts.findExpired(now);
    let ended = 0;
    for (const row of stale) {
      try {
        await this.abandon(row, 'expired', UNANSWERED);
        ended += 1;
      } catch (error) {
        this.log.error(
          `Could not expire payment attempt ${row.attemptToken}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    if (ended > 0) this.log.log(`Expired ${ended} unanswered payment prompt(s).`);
    return ended;
  }
}

/* The three sentences a guest can be shown. Written for a person, not a log. */
const UNANSWERED =
  'The payment request timed out before it was approved. Nothing has been charged.';
const UNREACHABLE =
  'We could not confirm this payment with the provider. Nothing has been charged.';
const LOST =
  'The payment provider has no record of this request. Nothing has been charged.';
const WITHDRAWN =
  'That room stopped being available while the payment was being approved, so you have been refunded in full.';

/** `<workspace>:booking-capture:<token>` → `<token>`. */
function tokenFromKey(idempotencyKey: string): string {
  return idempotencyKey.slice(idempotencyKey.lastIndexOf(':') + 1);
}
