import {
  instrumentProblem,
  type BookingMode,
  type BookingResult,
  type CreateBookingInput,
  type CreateBookingOutcome,
  type MoneyBreakdown,
  type PaymentInstrument,
} from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  forwardRef,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

// Cross-module dependency goes through ListingModule's application service —
// never its repository (architecture.md invariant).
import { EbmSaleTrigger } from '../../ebm/application/ebm-sale-trigger.service';
import { reportAlarm } from '../../../shared/observability/error-reporter';
import { BookingNotificationsService } from './booking-notifications.service';
import { PaymentAttemptService } from './payment-attempt.service';
import {
  ListingService,
  type BookableRoomType,
} from '../../listing/application/listing.service';
import { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import { PaymentSeam } from '../../payments/domain/payment-seam';
import {
  captureKeyFor,
  refundKeyFor,
  voidKeyFor,
} from '../../payments/domain/keys';
import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  PaymentUnavailableError,
  type PaymentPort,
  type PaymentReceipt,
} from '../../payments/domain/payment-port';
import {
  DEFAULT_CAPACITY,
  MAX_HORIZON_DAYS,
  MAX_NIGHTS,
  approvalExpiresAt,
  computeBreakdown,
  daysFromToday,
  isCalendarDate,
  localToday,
  makeReference,
  nightsBetween,
  statusForMode,
} from '../domain/pricing';
import {
  BookingRepository,
  DuplicateAttemptError,
  NoAvailabilityError,
  type SettledAttempt,
} from '../infrastructure/booking.repository';

/**
 * The key one press of confirm charges on (ADR-020 D-c, AC-27).
 *
 * Scoped by workspace, in the `<workspaceId>:<operation>:<clientKey>` form this
 * codebase already uses for `folio_charges`, `housekeeping_tasks` and
 * `service_orders`, and for the same reason: `attemptToken` is minted by a
 * browser and is unique only to its sender, so an unscoped key could collide
 * across tenants on one provider account.
 */
// (`captureKeyFor` moved to payments/domain/keys.ts, review 4.2.)

/**
 * The key a compensating refund runs on, derived from the capture's.
 *
 * Derived rather than equal, because a payment provider scopes an idempotency
 * key per operation and an adapter that does not will answer a refund with the
 * capture it was supposed to reverse. Derived rather than fresh, because a
 * retried refund must replay rather than pay out twice.
 */
// (`refundKeyFor` moved to payments/domain/keys.ts.)

/**
 * What one attempt asked for, in sixteen hex characters (review 3.4).
 *
 * The idempotency key names the PRESS; this names the STAY. A replay carrying
 * the same token but different dates is not the same intent, and answering it
 * with the first booking would hand a guest a stay they did not ask for.
 */
function fingerprintOf(input: CreateBookingInput): string {
  return createHash('sha256')
    .update(
      [
        input.roomTypeId,
        input.checkIn,
        input.checkOut,
        input.guests,
        input.nonRefundable ? 1 : 0,
        // The INSTRUMENT is part of the intent (ADR-047). A guest whose MTN
        // payment was declined, who switches to Airtel and presses again, has
        // not repeated the first press — and answering them with it would
        // replay the decline for an account they are no longer paying from.
        // The client mints a fresh token on that change; this is the half that
        // catches a client which does not.
        instrumentFingerprint(input.instrument),
      ].join('|'),
    )
    .digest('hex')
    .slice(0, 16);
}

/**
 * The instrument, reduced to what distinguishes one payer from another.
 *
 * A card token is hashed rather than used directly: this value is stored on the
 * booking row, and a provider token is a bearer credential for that charge.
 */
function instrumentFingerprint(instrument: PaymentInstrument): string {
  return instrument.kind === 'mobile_money'
    ? `${instrument.network}:${instrument.msisdn}`
    : `card:${createHash('sha256').update(instrument.token).digest('hex').slice(0, 16)}`;
}

/**
 * The room was taken after this guest's money was captured, and the money has
 * been refunded. A 409 to a direct caller; a `refused` attempt with the refund
 * sentence to a guest waiting on a poll (`PaymentAttemptService.complete`).
 */
export class SoldOutAfterCaptureError extends ConflictException {}

/**
 * Book a Room + capture into Escrow (F-B05 / FL07).
 *
 * The client sends only intent (Room type + dates + guests + refundability).
 * Everything that costs money is derived here from the Room type's own rate, so
 * a tampered client cannot under-charge itself.
 *
 * ## The money ordering (ADR-020 D-a)
 *
 * F-B05 §5 asks for capture "atomic with booking creation"; FL07 §6 asks for a
 * compensating refund when "payment captured but booking creation fails". Once
 * capture is a real network call those cannot both be literally true, because a
 * provider round trip inside a database transaction holds the room type's row
 * lock for the length of someone else's outage.
 *
 * So this method runs four phases:
 *
 *   1. Validate, recognise a repeated press, and pre-check availability. No
 *      money is touched.
 *   2. Capture through the seam. The only network call on the path.
 *   3. One transaction: lock, authoritative count, booking row, escrow row.
 *   4. Compensating refund if 3 failed, then re-raise the original failure.
 *
 * The booking and its escrow row are still written together or not at all,
 * which is the pair F-B05's "atomic" existed to protect.
 *
 * ## One press, one charge (ADR-020 D-c)
 *
 * The browser mints one `attemptToken` per press of confirm and reuses it on
 * every retry of that press. The key derived from it is the escrow row's
 * `idempotency_key`, which already carries a unique constraint, so a second
 * press is caught by the database rather than by a new column. A duplicate is
 * NOT a failure: it reads the first press's booking back and answers with it,
 * and never enters the compensating path — reversing the charge behind a
 * booking that stands is worse than the double press it was meant to prevent.
 *
 * Nothing here names a payment provider, an adapter or a mode. It depends on
 * `PAYMENT_PORT`, so going live changes `payments.module.ts` and not this file.
 */
@Injectable()
export class BookingService {
  private readonly log = new Logger(BookingService.name);

  constructor(
    private readonly bookings: BookingRepository,
    private readonly listings: ListingService,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    private readonly compensations: PaymentCompensationService,
    private readonly ebm: EbmSaleTrigger,
    private readonly notifications: BookingNotificationsService,
    /*
     * The wait between "we asked" and "they paid" (ADR-047 D-j).
     *
     * `forwardRef` because the two genuinely need each other: this service
     * begins an attempt when a capture comes back pending, and that service
     * calls `writeBooking` here when the provider says it settled. The cycle is
     * real rather than accidental — a payment that answers later has to hand
     * control back to the thing that writes reservations — so it is declared
     * rather than worked around with an event nobody can follow.
     */
    @Inject(forwardRef(() => PaymentAttemptService))
    private readonly attempts: PaymentAttemptService,
    private readonly seam: PaymentSeam,
  ) {}

  async create(
    input: CreateBookingInput,
    guestUserId: string,
  ): Promise<CreateBookingOutcome> {
    const roomType = await this.listings.findBookableRoomType(
      input.roomTypeId,
    );
    if (!roomType) throw new NotFoundException('Room type not found.');

    // Residence inventory is never bookable as a stay (FL06 §5C).
    if (roomType.domain !== 'hospitality') {
      throw new BadRequestException('That room type is not bookable.');
    }
    if (roomType.nightlyRateRwf == null || roomType.bookingMode == null) {
      throw new BadRequestException('That room type is not priced for booking.');
    }

    // The wire regex admits eight digits in the right places; only a real
    // calendar date may reach the arithmetic below (review 4.6).
    if (!isCalendarDate(input.checkIn) || !isCalendarDate(input.checkOut)) {
      throw new BadRequestException('Check-in and check-out must be real dates.');
    }

    const nights = nightsBetween(input.checkIn, input.checkOut);
    if (nights <= 0) {
      throw new BadRequestException('Check-out must be after check-in.');
    }
    if (nights > MAX_NIGHTS) {
      throw new BadRequestException(`Stays are limited to ${MAX_NIGHTS} nights.`);
    }

    // "Today" is a Kigali fact, not a UTC one (review 1.6).
    if (input.checkIn < localToday()) {
      throw new BadRequestException('Check-in cannot be in the past.');
    }
    if (daysFromToday(input.checkIn) > MAX_HORIZON_DAYS) {
      throw new BadRequestException('Bookings open up to 18 months ahead.');
    }

    // A room type with no stated capacity is not unlimited (review 3.7).
    const capacity = roomType.capacity ?? DEFAULT_CAPACITY;
    if (input.guests > capacity) {
      throw new BadRequestException(
        `That room type sleeps at most ${capacity}.`,
      );
    }

    /*
     * The instrument is re-checked here, not trusted from the form (ADR-047).
     *
     * Zod has already proved the SHAPE — nine digits, a known rail — and that
     * is not the same as the number belonging to the rail it was filed under.
     * An Airtel number sent as `mtn_momo` is well-formed and unchargeable, and
     * refusing it here costs nothing, where refusing it at the provider costs a
     * thirty-second round trip and produces a message about the account rather
     * than about the number. `instrumentProblem` is the same function the web
     * form uses, from `@injishi/contracts`, so the two cannot drift.
     */
    const instrumentFault = instrumentProblem(input.instrument);
    if (instrumentFault) throw new BadRequestException(instrumentFault);

    const nonRefundable = input.nonRefundable && roomType.nonrefundableEligible;

    // Priced per person: the rate is per guest, per night (infants are not in
    // `guests`, so they stay free).
    const breakdown = computeBreakdown({
      nightlyRateRwf: roomType.nightlyRateRwf,
      nights,
      nonRefundable,
      guests: input.guests,
    });

    // The bank's rules, refused before any hold, attempt or prompt
    // (073-gtbank-payments AC-23, AC-24): a card while card payments are off,
    // a network not prompted here, a total above the collection limit. The
    // checkout has already said so with the same function.
    const ruleFault = this.seam.ruleProblem(breakdown.grossRwf, input.instrument);
    if (ruleFault) throw new UnprocessableEntityException(ruleFault);

    /**
     * The key that ties the charge, the escrow row and any later refund
     * together (ADR-020 D-c). The client's token is required on the wire
     * (073-gtbank-payments AC-25): the server used to mint one when it was
     * absent, which left a retried press with no token free to charge twice.
     */
    const attemptToken = input.attemptToken;
    const idempotencyKey = captureKeyFor(roomType.workspaceId, attemptToken);

    // --- Phase 1a: has this exact press already been settled -----------------
    //
    // Before the pre-check, not after. A second press of the LAST unit would
    // otherwise be refused as sold out — by the booking the first press made —
    // instead of being answered with it. Scoped by guest as well as by key, so
    // a guessed token cannot surface someone else's reservation.
    const fingerprint = fingerprintOf(input);
    const already = await this.bookings.findByAttemptKey(
      idempotencyKey,
      guestUserId,
    );
    if (already) {
      // Same press, different stay: refuse rather than answer with the first
      // booking (review 3.4). A row from before the fingerprint existed has
      // none, and is answered as before.
      if (already.attemptFingerprint && already.attemptFingerprint !== fingerprint) {
        throw new UnprocessableEntityException(
          'This confirmation was already used for a different stay. Start the booking again.',
        );
      }
      return { status: 'confirmed', booking: this.presentSettled(already, nights) };
    }

    // --- Phase 1b: HOLD a unit before anyone is charged (F-B05) --------------
    //
    // This used to be an advisory count of bookings, and then the capture. A
    // mobile money prompt writes no booking for up to three minutes, so two
    // guests could both pass it for the last unit and both be charged (booking
    // audit, 2026-09-13). The claim is authoritative instead: under the room
    // type's row lock it counts bookings AND every other live hold, and writes
    // this press's hold, so the second guest is refused here with nothing taken.
    const claim = await this.attempts.claimHold({
      input,
      guestUserId,
      roomType,
      idempotencyKey,
      fingerprint,
      amountRwf: breakdown.grossRwf,
      nonRefundable,
    });
    if (claim.kind === 'sold_out') {
      throw new ConflictException(new NoAvailabilityError().message);
    }
    // This press already ended without a booking; say how, rather than charge again.
    if (claim.kind === 'ended') return { status: 'awaiting_payment', attempt: claim.status };
    let hold = claim.row;

    const now = new Date();
    const status = statusForMode(roomType.bookingMode);
    const expiresAt = approvalExpiresAt(
      roomType.bookingMode,
      input.checkIn,
      now,
    );

    // --- Phase 2: capture, outside every transaction ------------------------
    let receipt: PaymentReceipt;
    try {
      receipt = await this.capture({
        idempotencyKey,
        amountRwf: breakdown.grossRwf,
        workspaceId: roomType.workspaceId,
        reference: input.roomTypeId,
        instrument: input.instrument,
      });
    } catch (err) {
      // Declined, or the provider could not be reached: no money moved on our
      // word, so the unit goes back for the next guest.
      await this.attempts.releaseHold(hold);
      throw err;
    }
    hold = await this.attempts.attachCapture(hold, receipt);

    // --- Phase 2a: a replayed, now-settled capture may have a void queued --
    //
    // The guest was told to retry after a pending refusal, and did. The queue
    // is still holding the void for that capture; withdraw it before a booking
    // stands on the money (review 3.2). The processor also checks the escrow
    // table before refunding, so this is the courteous half, not the lock.
    if (receipt.replayed && receipt.settlement === 'settled') {
      await this.compensations.cancel(voidKeyFor(idempotencyKey));
    }

    // --- Phase 2b: accepted is not the same as paid (ADR-020 D-b) -----------
    //
    // ADR-020 D-b is UNCHANGED: no booking is written on the strength of a
    // prompt nobody has answered. What changed (ADR-047 D-j) is what the guest
    // gets instead. This used to answer 402 and tell them to press the button
    // again — a person polling a payment provider by hand — and queue a void
    // that had to be withdrawn if they did. Now the wait is a first-class,
    // durable thing: the attempt is written down, the guest is handed something
    // to watch, and the provider's answer completes it.
    if (receipt.settlement === 'pending') {
      return { status: 'awaiting_payment', attempt: this.attempts.statusOf(hold) };
    }

    // --- Phases 3 to 6: write the reservation the money paid for -----------
    let booking: BookingResult;
    try {
      booking = await this.writeBooking({
        input,
        guestUserId,
        roomType,
        // Narrowed by the two guards at the top of this method. TypeScript
        // narrows a PROPERTY rather than the object, so they are passed
        // explicitly instead of as an intersection the call site cannot satisfy.
        nightlyRateRwf: roomType.nightlyRateRwf,
        bookingMode: roomType.bookingMode,
        receipt,
        idempotencyKey,
        fingerprint,
        nights,
        breakdown,
        nonRefundable,
        status,
        expiresAt,
      });
    } catch (err) {
      // Refunded inside `writeBooking`; the hold records why it ended. A plain
      // conflict is a key another guest's booking already holds: nothing was
      // compensated for it, so nothing is said about a refund.
      if (err instanceof SoldOutAfterCaptureError || !(err instanceof ConflictException)) {
        await this.attempts.markRefunded(hold);
      }
      throw err;
    }
    await this.attempts.markBooked(hold, booking.id);
    return { status: 'confirmed', booking };
  }

  /**
   * The reservation one press produced, for a poll that finds its attempt
   * already confirmed. Guest scoped, exactly as the replay read in `create`.
   */
  async settledForAttempt(
    idempotencyKey: string,
    guestUserId: string,
  ): Promise<BookingResult | null> {
    const settled = await this.bookings.findByAttemptKey(idempotencyKey, guestUserId);
    return settled
      ? this.presentSettled(settled, nightsBetween(settled.checkIn, settled.checkOut))
      : null;
  }

  /**
   * Everything after the money has landed: the reservation, the sale, the mail.
   *
   * Extracted from `create` because there are now TWO ways to arrive here
   * (ADR-047 D-j). A card settles inside the request and comes straight down
   * from `create`; a mobile money prompt settles minutes later, on a handset,
   * and arrives from `PaymentAttemptService` when a poll or a provider callback
   * finds the capture settled.
   *
   * Both must produce exactly the same reservation, the same EBM sale and the
   * same email. Writing that twice is how the async path quietly grows a
   * booking that never gets a confirmation, or never gets certified with RRA —
   * so it is written once and called from both.
   */
  async writeBooking(args: {
    input: CreateBookingInput;
    guestUserId: string;
    roomType: BookableRoomType;
    /** Narrowed by the caller; a room with neither is refused long before here. */
    nightlyRateRwf: number;
    bookingMode: BookingMode;
    receipt: PaymentReceipt;
    idempotencyKey: string;
    fingerprint: string;
    nights: number;
    breakdown: MoneyBreakdown;
    nonRefundable: boolean;
    status: 'confirmed' | 'pending_approval';
    expiresAt: Date | null;
  }): Promise<BookingResult> {
    const {
      input, guestUserId, roomType, receipt, idempotencyKey, fingerprint,
      nights, breakdown, nonRefundable, status, expiresAt,
      nightlyRateRwf, bookingMode,
    } = args;

    // --- Phase 3: booking + escrow row, in one transaction ------------------
    let created;
    try {
      created = await this.bookings.create({
        roomTypeId: roomType.id,
        workspaceId: roomType.workspaceId,
        guestUserId,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guests: input.guests,
        status,
        bookingMode,
        nightlyRateRwf,
        cancellationTier: roomType.cancellationTier,
        nonRefundable,
        breakdown,
        reference: makeReference(),
        approvalExpiresAt: expiresAt,
        receipt,
        idempotencyKey,
        attemptFingerprint: fingerprint,
      });
    } catch (err) {
      /**
       * A duplicate press is NOT a failure, and must never reach the
       * compensating path (ADR-020 AC-24).
       *
       * Two requests carrying the same token raced past the phase 1a read, and
       * the escrow constraint caught the second one. The charge behind the
       * first booking stands and that booking is the correct answer. Refunding
       * here would reverse a charge behind a reservation that still exists and
       * still reads `escrow_status: held`.
       */
      if (err instanceof DuplicateAttemptError) {
        const settled = await this.bookings.findByAttemptKey(
          idempotencyKey,
          guestUserId,
        );
        if (settled) return this.presentSettled(settled, nights);
        // The key is taken by a booking this guest does not own. That is a
        // replayed or guessed token, not their reservation, and it is answered
        // as a conflict rather than with someone else's booking.
        throw new ConflictException(
          'That confirmation has already been used. Start the booking again.',
        );
      }

      // --- Phase 4: the money is out there and the booking is not ----------
      await this.compensate(receipt, idempotencyKey, roomType.workspaceId);

      if (err instanceof NoAvailabilityError) {
        // The last unit went to someone else: a hold that lapsed before this
        // money landed. Refunded above, so the guest is out nothing, and the
        // async path answers that in words rather than as this 409.
        throw new SoldOutAfterCaptureError(err.message);
      }
      throw err;
    }

    // --- Phase 5: an instant-book booking is a sale from this moment -------
    //
    // Recorded for RRA certification (F-B13, ADR-041). A request-to-book
    // booking is NOT: its money is captured but the host may still decline, so
    // it becomes a sale at approval (`BookingDecisionService.approve`). Never
    // throws — the reservation is committed, and the reconcile sweep backs this
    // call up if it fails.
    if (created.status === 'confirmed') {
      await this.ebm.saleConfirmed(created.id);
    }

    /*
     * Phase 6: tell the guest, in writing (ADR-047).
     *
     * Until now this was the end of the road: a confirmation screen, and
     * nothing else anywhere. Closing that tab lost the reference, and the
     * reference is the only key to the guest's own fiscal receipt.
     *
     * Queued, never sent inline, and it cannot throw — the booking is
     * committed and the money is taken, so an unreachable mail relay must not
     * turn a paid reservation into a 500. Same rule as `saleConfirmed` above.
     */
    await this.notifications.notify(
      created.id,
      created.status === 'confirmed' ? 'confirmed' : 'request_sent',
    );
    // And the host, who has a window to answer a request and used to be told
    // nothing at all (booking audit, 2026-09-13).
    if (created.status === 'pending_approval') {
      await this.notifications.notify(created.id, 'host_request');
    }

    return {
      id: created.id,
      reference: created.reference,
      status: created.status,
      bookingMode,
      paymentStatus: created.paymentStatus,
      escrowStatus: created.escrowStatus,
      nonRefundable,
      lockedCancellationTier: roomType.cancellationTier,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      guests: input.guests,
      breakdown,
      approvalExpiresAt: created.approvalExpiresAt?.toISOString() ?? null,
    };
  }

  /**
   * The answer a repeated press gets: the booking the FIRST press created
   * (ADR-020 D-c, AC-13).
   *
   * Same 201 and same body, so a client that retried cannot tell the difference
   * and does not need to. Every field comes off the booking row, which already
   * stores what was locked; `breakdown` is recomputed from the locked nightly
   * rate with the same function the first request used, which is what makes it
   * the same number rather than a fresh quote at today's rate.
   */
  private presentSettled(
    settled: SettledAttempt,
    nights: number,
  ): BookingResult {
    return {
      id: settled.id,
      reference: settled.reference,
      status: settled.status,
      bookingMode: settled.bookingMode,
      paymentStatus: settled.paymentStatus,
      escrowStatus: settled.escrowStatus,
      nonRefundable: settled.nonRefundable,
      lockedCancellationTier: settled.lockedCancellationTier,
      checkIn: settled.checkIn,
      checkOut: settled.checkOut,
      guests: settled.guests,
      // The lines are recomputed for display; the total is what was captured
      // (review 3.6). A row with no locked rate must not answer "0 RWF".
      breakdown: withCapturedTotal(
        computeBreakdown({
          nightlyRateRwf: settled.lockedNightlyRateRwf ?? 0,
          nights,
          nonRefundable: settled.nonRefundable,
        }),
        settled.grossRwf,
      ),
      approvalExpiresAt: settled.approvalExpiresAt?.toISOString() ?? null,
    };
  }

  /**
   * Take the money, and turn the seam's two failure kinds into the two answers
   * a guest can act on.
   *
   * A decline is the guest's problem to fix (another method, more funds), so it
   * is a 400. An unavailable provider is ours, so it is a 503 — and it must not
   * read as a decline, because telling someone their card was refused when the
   * gateway simply timed out sends them to their bank for nothing.
   */
  private async capture(args: {
    idempotencyKey: string;
    amountRwf: number;
    workspaceId: string;
    reference: string;
    instrument: PaymentInstrument;
  }): Promise<PaymentReceipt> {
    try {
      return await this.payments.captureEscrow({
        kind: 'escrow_capture',
        purpose: 'booking',
        idempotencyKey: args.idempotencyKey,
        amountRwf: args.amountRwf,
        currency: 'RWF',
        workspaceId: args.workspaceId,
        instrument: args.instrument,
        memo: `Escrow capture for room type ${args.reference}`,
      });
    } catch (err) {
      if (err instanceof PaymentDeclinedError) {
        throw new BadRequestException(
          'That payment was declined. Nothing has been charged.',
        );
      }
      if (err instanceof PaymentUnavailableError) {
        // Only a request that never arrived may be told nothing was charged
        // (073-gtbank-payments AC-7). One that may have arrived is parked, and
        // its money is never lost: a person confirms it and it is refunded.
        throw new ServiceUnavailableException(
          err.delivered === 'no'
            ? 'We could not reach the payment service. Nothing has been charged. Please try again.'
            : 'We could not confirm this payment with the payment service. If your phone shows it as paid, it will be refunded to you; you do not need to pay again for it.',
        );
      }
      throw err;
    }
  }

  /**
   * Refuse a capture the provider accepted and has not settled (ADR-020 D-b,
   * AC-4, AC-26).
   *
   * The guest gets no booking, because a reservation on the strength of a
   * prompt nobody has answered is a receipt for something that does not exist.
   *
   * **The refusal must not drop the charge.** A handset push can settle after
   * this returns, and a refusal that wrote nothing would leave the provider's
   * reference in a log line with no row to match it and no way to reverse it.
   * So the `adapterRef` goes on the compensation queue, which cancels the
   * request where the provider can and refunds it once it settles where it
   * cannot.
   *
   * Answered 402 rather than 400 or 503, because it is neither: the provider
   * did not refuse and was reached fine. The checkout needs the three apart to
   * say which one happened (AC-17).
   */
  private async refusePending(
    receipt: PaymentReceipt,
    captureKey: string,
    workspaceId: string,
  ): Promise<never> {
    await this.compensations.enqueue({
      kind: 'void-pending',
      idempotencyKey: voidKeyFor(captureKey),
      workspaceId,
      originalRef: receipt.adapterRef,
      amountRwf: receipt.amountRwf,
      memo: 'Refused: payment had not settled when the booking was attempted',
    });

    this.log.warn(
      `Refused unsettled capture ${receipt.adapterRef} (capture key ` +
        `${captureKey}, workspace ${workspaceId}). Queued to void or refund.`,
    );

    throw new HttpException(
      'Your payment has not completed yet, so we have not held the room. ' +
        'Approve the request on your phone, then try again — you will not be charged twice.',
      HttpStatus.PAYMENT_REQUIRED,
    );
  }

  /**
   * Give the money back when the booking could not be written (FL07 §6).
   *
   * Safe to run twice: the refund goes on its OWN derived key, so a provider
   * that has already reversed it answers with the original result instead of
   * paying out again.
   *
   * A compensation that itself fails goes on the `PaymentCompensation` queue
   * (ADR-020 D-d) and is then swallowed, so the caller still receives the real
   * reason their booking failed rather than a second error about the cleanup.
   * The `STUCK MONEY` line stays beside the queue rather than being replaced by
   * it: a queued job and a loud log answer different questions, and only one of
   * them wakes a human up.
   */
  private async compensate(
    receipt: PaymentReceipt,
    captureKey: string,
    workspaceId: string,
  ): Promise<void> {
    const refundKey = refundKeyFor(captureKey);
    const memo = 'Compensating refund: booking creation failed after capture';
    try {
      await this.payments.refund({
        kind: 'refund',
        // The refund's OWN key, derived from the capture's rather than equal to
        // it. Equal keys were a real bug: an adapter that scopes its memory by
        // key alone answers the refund with the capture it was meant to reverse,
        // reports success, and leaves the money captured. Derived, so retrying
        // this refund still replays THIS refund.
        idempotencyKey: refundKey,
        originalRef: receipt.adapterRef,
        amountRwf: receipt.amountRwf,
        currency: receipt.currency,
        workspaceId,
        memo,
      });
    } catch (refundErr) {
      await this.compensations.enqueue({
        kind: 'refund',
        idempotencyKey: refundKey,
        workspaceId,
        originalRef: receipt.adapterRef,
        amountRwf: receipt.amountRwf,
        memo,
      });

      this.log.error(
        `STUCK MONEY: captured ${receipt.amountRwf} ${receipt.currency} ` +
          `(adapterRef ${receipt.adapterRef}, capture key ${captureKey}, ` +
          `refund key ${refundKey}, workspace ${workspaceId}) and the ` +
          'compensating refund failed. Queued for retry on the refund key; ' +
          'a human should confirm it landed.',
        refundErr instanceof Error ? refundErr.stack : undefined,
      );
      reportAlarm(
        'STUCK_MONEY',
        'A capture was taken, the booking was not written, and the compensating refund failed.',
        { adapterRef: receipt.adapterRef, amountRwf: receipt.amountRwf, captureKey, refundKey, workspaceId },
        refundErr,
      );
    }
  }
}

function withCapturedTotal<T extends { grossRwf: number }>(
  breakdown: T,
  captured: number | null,
): T {
  return captured == null ? breakdown : { ...breakdown, grossRwf: captured };
}
