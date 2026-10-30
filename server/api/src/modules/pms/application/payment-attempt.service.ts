import {
  PAYMENT_PROMPT_TTL_SECONDS,
  computeBreakdown,
  type BookingResult,
  type CreateBookingInput,
  type OrderPaymentAttemptStatus,
  type PaymentAttemptStatus,
  type PaymentInstrument,
  type RegistrationFeeAttemptStatus,
} from '@injishi/contracts';
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ListingService } from '../../listing/application/listing.service';
import { GuestOrderingService } from '../../outlets/application/guest-ordering.service';
import { OrderPaymentService } from '../../outlets/application/order-payment.service';
import { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import { feeDuplicateKeyFor, registrationFeeKeyFor, voidKeyFor } from '../../payments/domain/keys';
import { PaymentTransactionsRepository } from '../../payments/infrastructure/payment-transactions.repository';
import { REGISTRATION_FEES, type RegistrationFees } from '../domain/registration-fees';
import { reportAlarm } from '../../../shared/observability/error-reporter';
import {
  PAYMENT_PORT,
  PaymentDeclinedError,
  PaymentUnavailableError,
  maskDestination,
  type PaymentPort,
  type PaymentReceipt,
} from '../../payments/domain/payment-port';
import { approvalExpiresAt, nightsBetween, statusForMode } from '../domain/pricing';
import {
  PaymentAttemptRepository,
  type PaymentAttemptRow,
} from '../infrastructure/payment-attempt.repository';
import { BookingService, SoldOutAfterCaptureError } from './booking.service';

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
    private readonly orderPayments: OrderPaymentService,
    private readonly guestOrders: GuestOrderingService,
    /** The bank record, so an attempt and its collection stay linked (073 AC-9). */
    private readonly transactions: PaymentTransactionsRepository,
    /** Settles a registration once its fee lands (073 AC-16). */
    @Inject(REGISTRATION_FEES) private readonly registrations: RegistrationFees,
  ) {}

  /**
   * ASK FOR A PAY NOW ORDER'S MONEY (ADR-050 D-n, D-p; AC-21).
   *
   * The order already exists, `pending_payment`, so a crash from here on leaves
   * a row the guest can see and cancel rather than money with nothing behind it.
   * The capture key is derived from the guest's own key for the order, so a
   * retry of the same press is a provider replay and the same attempt row.
   *
   * Three outcomes, none of which throws for a person to decode:
   * - the rail settled at once: the order is settled and its `NS` raised;
   * - it is waiting on the handset: the attempt is recorded, named on the order,
   *   and the guest polls it exactly as a booking's;
   * - the provider refused: the order is `payment_failed` and the attempt
   *   answers `refused` with the sentence to show.
   *
   * A provider that could not be reached is a 503 and changes nothing: the
   * order stays waiting, and the same press sent again asks again.
   */
  async beginForOrder(args: {
    orderId: string;
    workspaceId: string;
    guestUserId: string;
    amountRwf: number;
    orderNumber: string;
    instrument: PaymentInstrument;
    clientKey: string;
  }): Promise<Omit<OrderPaymentAttemptStatus, 'order'>> {
    const idempotencyKey = `${args.workspaceId}:order-capture:${args.clientKey}`;
    const instrument = args.instrument;
    const network = instrument.kind === 'mobile_money' ? instrument.network : null;
    const payerMasked =
      instrument.kind === 'mobile_money' ? maskDestination(instrument.msisdn) : null;

    // A press already answered is final, and says so without asking again.
    const known = await this.attempts.findByKey(idempotencyKey);
    if (known && known.state !== 'prompting') return this.presentOrderAttempt(known);

    let receipt: PaymentReceipt;
    try {
      receipt = await this.payments.captureEscrow({
        kind: 'escrow_capture',
        purpose: 'service_order',
        idempotencyKey,
        amountRwf: args.amountRwf,
        currency: 'RWF',
        workspaceId: args.workspaceId,
        instrument,
        memo: `Pay now order ${args.orderNumber}`,
      });
    } catch (err) {
      if (err instanceof PaymentDeclinedError) {
        await this.orderPayments.fail(args.orderId, DECLINED);
        return {
          attemptToken: args.clientKey,
          state: 'refused',
          network,
          payerMasked,
          amountRwf: args.amountRwf,
          expiresAt: new Date().toISOString(),
          failureReason: DECLINED,
        };
      }
      if (err instanceof PaymentUnavailableError) {
        throw new ServiceUnavailableException(
          'We could not reach the payment service. Nothing has been charged. Please try again.',
        );
      }
      throw err;
    }

    const expiresAt = new Date(Date.now() + PAYMENT_PROMPT_TTL_SECONDS * 1_000);
    const attemptId = await this.attempts.record({
      purpose: 'service_order',
      serviceOrderId: args.orderId,
      attemptToken: args.clientKey,
      idempotencyKey,
      guestUserId: args.guestUserId,
      workspaceId: args.workspaceId,
      attemptFingerprint: `order:${args.orderId}:${args.amountRwf}`,
      amountRwf: args.amountRwf,
      adapterRef: receipt.adapterRef,
      adapterMode: receipt.mode,
      instrumentKind: instrument.kind,
      network,
      payerMasked,
      expiresAt,
    });
    await this.orderPayments.attach(args.orderId, attemptId);
    await this.transactions.linkAttempt(idempotencyKey, attemptId);

    const row = await this.attempts.findByKey(idempotencyKey);
    if (!row) throw new Error(`Payment attempt ${idempotencyKey} was written and could not be read back.`);
    if (receipt.settlement === 'settled') {
      await this.completeOrder(row);
      return this.presentOrderAttempt({ ...row, state: 'confirmed' });
    }
    return this.presentOrderAttempt(row);
  }

  /**
   * Where did my order's payment get to? The booking poll's rules exactly:
   * the provider first, an outage is not an answer, and only the provider
   * produces `confirmed`. Guest scoped, and a 404 for a token that is not theirs.
   */
  async pollOrder(attemptToken: string, guestUserId: string): Promise<OrderPaymentAttemptStatus> {
    const row = await this.attempts.findForGuest(attemptToken, guestUserId, 'service_order');
    if (!row?.serviceOrderId) throw new NotFoundException('No such payment attempt.');

    let state = row.state;
    let failureReason = row.failureReason;
    if (row.state === 'prompting') {
      const settled = await this.resolve(row, 'poll');
      state = settled.state;
      failureReason = settled.failureReason;
    }

    return {
      ...this.presentOrderAttempt({ ...row, state, failureReason }),
      order: await this.guestOrders.detail(guestUserId, row.serviceOrderId),
    };
  }

  /**
   * ASK FOR A REGISTRATION'S FEE (073-gtbank-payments AC-16).
   *
   * The caller has already checked that the fee is owed, payable (the operator
   * contract is accepted) and not settling free. One press is one key, so a
   * retried press replays rather than prompting the registrant twice; a press
   * already answered is final and says so without asking again.
   *
   * - The provider refused: `refused`, with nothing recorded and the invoice
   *   still payable with a fresh press.
   * - It waits on the handset: the attempt is recorded and the registrant polls.
   * - It settled inside the call: the registration is settled at once.
   *
   * A provider that could not be reached is a 503. When the request may have
   * arrived, the sentence says so, because "nothing has been charged" could be
   * false.
   */
  async beginForRegistrationFee(args: {
    invoiceId: string;
    workspaceId: string;
    registrantUserId: string;
    amountRwf: number;
    legalName: string;
    instrument: PaymentInstrument;
    attemptToken: string;
  }): Promise<Omit<RegistrationFeeAttemptStatus, 'registration'>> {
    const idempotencyKey = registrationFeeKeyFor(args.workspaceId, args.attemptToken);
    const { instrument } = args;
    const network = instrument.kind === 'mobile_money' ? instrument.network : null;
    const payerMasked =
      instrument.kind === 'mobile_money' ? maskDestination(instrument.msisdn) : null;

    const known = await this.attempts.findByKey(idempotencyKey);
    if (known && known.state !== 'prompting') return this.presentFeeAttempt(known);

    let receipt: PaymentReceipt;
    try {
      receipt = await this.payments.chargeOneTimeFee({
        kind: 'one_time_fee',
        purpose: 'registration_fee',
        feeCode: 'registration_fee',
        idempotencyKey,
        amountRwf: args.amountRwf,
        currency: 'RWF',
        workspaceId: args.workspaceId,
        instrument,
        memo: `Registration fee, ${args.legalName}`,
      });
    } catch (err) {
      if (err instanceof PaymentDeclinedError) {
        return {
          attemptToken: args.attemptToken,
          state: 'refused',
          network,
          payerMasked,
          amountRwf: args.amountRwf,
          expiresAt: new Date().toISOString(),
          failureReason: DECLINED,
        };
      }
      if (err instanceof PaymentUnavailableError) {
        throw new ServiceUnavailableException(
          err.delivered === 'no'
            ? 'We could not reach the payment service. Nothing has been charged. Please try again.'
            : 'We could not confirm whether the payment request reached your phone. Do not approve a second prompt; check this page again in a minute.',
        );
      }
      throw err;
    }

    const expiresAt = new Date(Date.now() + PAYMENT_PROMPT_TTL_SECONDS * 1_000);
    const attemptId = await this.attempts.record({
      purpose: 'registration_fee',
      subscriptionInvoiceId: args.invoiceId,
      attemptToken: args.attemptToken,
      idempotencyKey,
      guestUserId: args.registrantUserId,
      workspaceId: args.workspaceId,
      attemptFingerprint: `registration-fee:${args.invoiceId}:${args.amountRwf}`,
      amountRwf: args.amountRwf,
      adapterRef: receipt.adapterRef,
      adapterMode: receipt.mode,
      instrumentKind: instrument.kind,
      network,
      payerMasked,
      expiresAt,
    });
    await this.transactions.linkAttempt(idempotencyKey, attemptId);

    const row = await this.attempts.findByKey(idempotencyKey);
    if (!row) throw new Error(`Payment attempt ${idempotencyKey} was written and could not be read back.`);
    if (receipt.settlement === 'settled') {
      const done = await this.completeRegistrationFee(row);
      return this.presentFeeAttempt({ ...row, state: done.state, failureReason: done.failureReason });
    }
    return this.presentFeeAttempt(row);
  }

  /**
   * Where did my registration fee get to? The booking poll's rules: the
   * provider first, an outage is not an answer. Scoped to the registrant who
   * pressed pay; anyone else's token is a 404. Answers with the org it pays
   * for, so the caller can attach the registration as it stands.
   */
  async pollRegistrationFee(
    attemptToken: string,
    registrantUserId: string,
  ): Promise<{ status: Omit<RegistrationFeeAttemptStatus, 'registration'>; invoiceId: string }> {
    const row = await this.attempts.findForGuest(attemptToken, registrantUserId, 'registration_fee');
    if (!row?.subscriptionInvoiceId) throw new NotFoundException('No such payment attempt.');

    let { state, failureReason } = row;
    if (row.state === 'prompting') {
      const step = await this.resolve(row, 'poll');
      state = step.state;
      failureReason = step.failureReason;
    }
    return {
      status: this.presentFeeAttempt({ ...row, state, failureReason }),
      invoiceId: row.subscriptionInvoiceId,
    };
  }

  /**
   * A settled fee, completed once. The attempt is claimed FIRST (guarded on
   * `prompting`), so a poll and the sweep reaching the same settled prompt can
   * never both complete it, and the one that loses never reads the registration
   * it just watched settle as a second payment.
   */
  private async completeRegistrationFee(row: PaymentAttemptRow): Promise<Resolution> {
    if (!(await this.attempts.claimConfirmed(row.id))) {
      const now = await this.attempts.findByKey(row.idempotencyKey);
      return {
        state: now?.state ?? row.state,
        failureReason: now?.failureReason ?? row.failureReason,
        booking: null,
      };
    }
    return this.settleFee(row);
  }

  /**
   * Settle the registration this claimed fee pays for. A fee that pays for
   * nothing (the invoice was already paid by another press, or the
   * registration can no longer take one) goes back in full on its own derived
   * key, once.
   */
  private async settleFee(row: PaymentAttemptRow): Promise<Resolution> {
    const orgId = row.subscriptionInvoiceId
      ? await this.registrations.orgOfRegistrationInvoice(row.subscriptionInvoiceId)
      : null;
    const outcome = orgId ? await this.registrations.settleFeeFromPayment(orgId) : 'not_payable';
    if (outcome === 'settled') {
      this.log.log(`Registration fee attempt ${row.attemptToken} settled its registration.`);
      return { state: 'confirmed', failureReason: null, booking: null };
    }

    const reason = outcome === 'already_settled' ? FEE_ALREADY_PAID : FEE_NOT_PAYABLE;
    if ((await this.attempts.markDuplicateFee(row.id, reason)) && row.adapterRef && row.amountRwf != null) {
      await this.compensations.enqueue({
        kind: 'refund',
        idempotencyKey: feeDuplicateKeyFor(row.idempotencyKey),
        workspaceId: row.workspaceId,
        originalRef: row.adapterRef,
        amountRwf: row.amountRwf,
        memo: `Registration fee paid for nothing (${outcome}); refunded in full`,
      });
      this.log.warn(`Registration fee attempt ${row.attemptToken} paid for nothing (${outcome}); refund queued.`);
    }
    return { state: 'refused', failureReason: reason, booking: null };
  }

  private presentFeeAttempt(row: PaymentAttemptRow): Omit<RegistrationFeeAttemptStatus, 'registration'> {
    return {
      attemptToken: row.attemptToken,
      state: row.state,
      network: row.network,
      payerMasked: row.payerMasked,
      amountRwf: row.amountRwf,
      expiresAt: row.expiresAt.toISOString(),
      failureReason: row.failureReason,
    };
  }

  /**
   * ONE STEP OF A PROMPTING ATTEMPT, for a booking or an order, from a poll or
   * from the sweep.
   *
   * ## The provider is asked FIRST (booking audit, 2026-09-13)
   *
   * This ladder used to check the deadline before anything else. A guest who
   * approved on their handset inside the three minutes, and whose next poll
   * arrived after them (a slow network, a phone locked mid-approval, a tab left
   * in the background), was answered "timed out, nothing has been charged" and
   * had the capture voided. The money had landed. Only the provider knows
   * whether it has, so it is asked before the clock is believed: a settled
   * capture completes whenever it is found, and the deadline only ends a
   * prompt the provider still calls pending.
   *
   * ## Poll and sweep differ in patience, not in rules
   *
   * - A pending prompt past its deadline is ended at once for a poll, because a
   *   guest is looking at the screen. The sweep gives the provider a short grace
   *   first, since an approval can land a little after our window.
   * - A provider that cannot be reached is never an answer. The sweep gives up
   *   and voids only long after the deadline, so a row cannot wait for ever.
   * - A hold with no reference is a capture still being asked for; it is left
   *   alone while that request can still be running.
   */
  private async resolve(
    row: PaymentAttemptRow,
    mode: 'poll' | 'sweep',
    now: number = Date.now(),
  ): Promise<Resolution> {
    const waiting: Resolution = { state: 'prompting', failureReason: null, booking: null };
    const overdueMs = now - row.expiresAt.getTime();

    if (!row.adapterRef) {
      if (now - row.createdAt.getTime() < CAPTURE_IN_FLIGHT_MS) return waiting;
      // The request that claimed this hold died between the claim and the
      // provider's answer. There is no reference to void by, so a person has
      // to look: the key is the only thread to the provider's record.
      this.log.error(
        `UNRESOLVED HOLD: payment attempt ${row.idempotencyKey} (workspace ${row.workspaceId}) ` +
          `never recorded a provider reference. Check the provider for a capture on that key.`,
      );
      reportAlarm('UNRESOLVED_HOLD', 'A payment hold never recorded a provider reference.', {
        idempotencyKey: row.idempotencyKey,
        workspaceId: row.workspaceId,
        amountRwf: row.amountRwf,
      });
      // Its bank row, if one was written, may have reached the provider: parked
      // for a pull or a person, never sent again (073 AC-9).
      await this.transactions.markParked(row.idempotencyKey, 'the request never recorded an answer');
      return this.end(row, 'refused', UNREACHABLE);
    }

    let receipt: PaymentReceipt | null;
    try {
      receipt = await this.payments.fetchTransaction(row.workspaceId, row.adapterRef);
    } catch {
      /*
       * We could not ask. That is NOT an answer.
       *
       * Leaving the attempt `prompting` is mobile's second obligation: a client
       * that cannot confirm says "still confirming" and offers to check again.
       * Treating an outage as a refusal would tell a guest their payment failed
       * while it was quietly settling.
       */
      if (mode === 'sweep' && overdueMs > UNREACHABLE_GIVE_UP_MS) {
        return this.end(row, 'expired', UNANSWERED);
      }
      return waiting;
    }

    if (!receipt) {
      // The provider has no record of a capture we hold a reference for. That
      // is a genuine dead end rather than an outage: nothing to wait for.
      return this.end(row, 'refused', LOST);
    }

    if (receipt.settlement !== 'settled') {
      if (overdueMs < 0) return waiting;
      if (mode === 'sweep' && overdueMs < SWEEP_PENDING_GRACE_MS) return waiting;
      return this.end(row, 'expired', UNANSWERED);
    }

    // --- It landed, whatever the clock says. Hand it to what it paid for. ---
    if (row.purpose === 'registration_fee') return this.completeRegistrationFee(row);
    if (row.purpose === 'service_order') {
      return (await this.completeOrder(row))
        ? { state: 'confirmed', failureReason: null, booking: null }
        : { state: 'refused', failureReason: ORDER_GONE, booking: null };
    }
    return this.complete(row, receipt);
  }

  /**
   * End an attempt and report what it now is. When the guarded update moved
   * nothing, someone else (a poll racing the sweep) already answered it, and
   * that answer is read back rather than contradicted.
   */
  private async end(
    row: PaymentAttemptRow,
    state: 'refused' | 'expired',
    reason: string,
  ): Promise<Resolution> {
    if (await this.abandon(row, state, reason)) {
      return { state, failureReason: reason, booking: null };
    }
    const now = await this.attempts.findByKey(row.idempotencyKey);
    if (!now) return { state, failureReason: reason, booking: null };
    return {
      state: now.state,
      failureReason: now.failureReason,
      booking: now.state === 'confirmed' ? await this.bookingFor(now) : null,
    };
  }

  /** The reservation a confirmed booking attempt produced, read off the booking row. */
  private async bookingFor(row: PaymentAttemptRow): Promise<BookingResult | null> {
    if (row.purpose !== 'booking') return null;
    return this.bookings.settledForAttempt(row.idempotencyKey, row.guestUserId);
  }

  /**
   * Hand a settled attempt to its order. Returns false when the order was no
   * longer waiting (the guest cancelled it while approving), in which case the
   * money goes straight back, because it pays for nothing.
   */
  private async completeOrder(row: PaymentAttemptRow): Promise<boolean> {
    if (!row.serviceOrderId) return false;
    const outcome = await this.orderPayments.settle(row.serviceOrderId, {
      method: '06',
      markedByUserId: null,
      paymentAttemptId: row.id,
    });
    if (outcome.kind === 'not_pending') {
      const moved = await this.attempts.markEnded(row.id, 'refused', ORDER_GONE);
      if (moved && row.adapterRef && row.amountRwf != null) {
        await this.compensations.enqueue({
          kind: 'void-pending',
          idempotencyKey: voidKeyFor(row.idempotencyKey),
          workspaceId: row.workspaceId,
          originalRef: row.adapterRef,
          amountRwf: row.amountRwf,
          memo: `Order payment settled after the order was ${outcome.status}`,
        });
      }
      return false;
    }
    await this.attempts.markConfirmed(row.id, null);
    return true;
  }

  private presentOrderAttempt(row: PaymentAttemptRow): Omit<OrderPaymentAttemptStatus, 'order'> {
    return {
      attemptToken: row.attemptToken,
      state: row.state,
      network: row.network,
      payerMasked: row.payerMasked,
      amountRwf: row.amountRwf,
      expiresAt: row.expiresAt.toISOString(),
      failureReason: row.failureReason,
    };
  }

  /**
   * HOLD THE ROOM for one press of confirm, before the capture is asked for.
   *
   * Called from `BookingService.create` after the stay is validated and before
   * any money moves (booking audit, 2026-09-13). The attempt row is the hold:
   * while it is `prompting` and inside its window, no other press can claim the
   * same unit, so two guests can no longer both be charged for the last room.
   *
   * - `sold_out`: every unit is booked or held. Nothing was written.
   * - `held`: the row to capture against, new or this press's own earlier one.
   * - `ended`: this press already finished without a booking (it expired, or
   *   lost the room). Its status is final and is answered as it stands.
   */
  async claimHold(args: {
    input: CreateBookingInput;
    guestUserId: string;
    roomType: { id: string; workspaceId: string };
    idempotencyKey: string;
    fingerprint: string;
    amountRwf: number;
    nonRefundable: boolean;
  }): Promise<
    | { kind: 'sold_out' }
    | { kind: 'held'; row: PaymentAttemptRow }
    | { kind: 'ended'; status: PaymentAttemptStatus }
  > {
    const { input } = args;
    const instrument = input.instrument;
    const now = new Date();

    const claim = await this.attempts.claimBookingHold({
      // The token is the client's when it sent one, and the server's otherwise —
      // the same value the capture key was derived from, so a poll can find this.
      attemptToken: input.attemptToken ?? tokenFromKey(args.idempotencyKey),
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
      instrumentKind: instrument.kind,
      network: instrument.kind === 'mobile_money' ? instrument.network : null,
      // Masked at the boundary, never stored whole. Enough for support to match
      // a person to an attempt; never enough to charge anybody.
      payerMasked: instrument.kind === 'mobile_money' ? maskDestination(instrument.msisdn) : null,
      expiresAt: new Date(now.getTime() + PAYMENT_PROMPT_TTL_SECONDS * 1_000),
      now,
    });

    if (claim.kind === 'ended') return { kind: 'ended', status: this.present(claim.row, null) };
    return claim.kind === 'sold_out' ? claim : { kind: 'held', row: claim.row };
  }

  /** The provider answered the capture; the hold now names it. */
  async attachCapture(row: PaymentAttemptRow, receipt: PaymentReceipt): Promise<PaymentAttemptRow> {
    await this.attempts.attachCapture(row.id, receipt.adapterRef, receipt.mode);
    await this.transactions.linkAttempt(row.idempotencyKey, row.id);
    return { ...row, adapterRef: receipt.adapterRef };
  }

  /** No money moved (a decline, an unreachable provider): give the room back. */
  releaseHold(row: PaymentAttemptRow): Promise<void> {
    return this.attempts.releaseHold(row.id);
  }

  /** A card capture settled inside the request and its booking is written. */
  markBooked(row: PaymentAttemptRow, bookingId: string): Promise<void> {
    return this.attempts.markConfirmed(row.id, bookingId);
  }

  /**
   * The booking could not be written after the money was taken. `writeBooking`
   * has already refunded it, so the attempt only records the sentence; queuing
   * a void as well would reverse the same money twice.
   */
  async markRefunded(row: PaymentAttemptRow, reason: string = WITHDRAWN): Promise<void> {
    await this.attempts.markEnded(row.id, 'refused', reason);
  }

  /** A hold, as the wire says it, for the guest to watch. */
  statusOf(row: PaymentAttemptRow): PaymentAttemptStatus {
    return this.present(row, null);
  }

  /**
   * Where did my payment get to?
   *
   * Guest-scoped by the repository, so an attempt token guessed by a stranger
   * finds nothing. Safe to call in a loop: a finished attempt answers from its
   * own rows rather than re-asking the provider, and completing is idempotent
   * through the escrow constraint underneath it.
   *
   * A confirmed attempt answers WITH its booking every time, not only on the
   * poll that completed it. The contract says `booking` is present exactly when
   * `state` is `confirmed`; a repeated poll (a second tab, a reload, a retry
   * after a dropped response) used to get `booking: null` and a checkout with no
   * reference to show (booking audit, 2026-09-13).
   */
  async poll(
    attemptToken: string,
    guestUserId: string,
  ): Promise<PaymentAttemptStatus> {
    const row = await this.attempts.findForGuest(attemptToken, guestUserId);
    if (!row) throw new NotFoundException('No such payment attempt.');

    if (row.state === 'confirmed') return this.present(row, await this.bookingFor(row));
    if (row.state !== 'prompting') return this.present(row, null);

    const step = await this.resolve(row, 'poll');
    return this.present(
      { ...row, state: step.state, failureReason: step.failureReason },
      step.booking,
    );
  }

  /**
   * Turn a settled attempt into the reservation the guest asked for.
   *
   * The stay is read off the ATTEMPT ROW, not from a client — the browser may
   * be closed, and this same path is what the sweep and a provider callback
   * use. The room type is re-resolved because its rate, capacity and mode may
   * have moved in the minutes the prompt was open, and the booking must be
   * written against what is true now.
   *
   * THE LOSER OF A RACE IS TOLD, NOT THROWN AT. When the room went to somebody
   * else (a hold that lapsed before the money landed), `writeBooking` refunds
   * the capture and raises `SoldOutAfterCaptureError`. That used to escape as a
   * raw 409 from a GET, and the attempt stayed `prompting` for ever. It now
   * ends `refused` with the sentence that says the guest was refunded in full,
   * and the poll answers 200.
   */
  private async complete(
    row: PaymentAttemptRow,
    receipt: PaymentReceipt,
  ): Promise<Resolution> {
    const refused = (reason: string): Resolution => ({ state: 'refused', failureReason: reason, booking: null });

    // The purpose shape check makes a booking attempt always carry its stay;
    // this is the same fact said to the compiler, and a refund if it ever lies.
    const { roomTypeId, checkIn, checkOut, guests } = row;
    if (row.purpose !== 'booking' || !roomTypeId || !checkIn || !checkOut || guests == null) {
      return this.end(row, 'refused', WITHDRAWN);
    }

    const roomType = await this.listings.findBookableRoomType(roomTypeId);
    if (!roomType || roomType.nightlyRateRwf == null || roomType.bookingMode == null) {
      // The room stopped being sellable while the guest was approving. Their
      // money goes back; a reservation against inventory that no longer exists
      // would be worse than the refund.
      return this.end(row, 'refused', WITHDRAWN);
    }

    const nights = nightsBetween(checkIn, checkOut);
    const breakdown = computeBreakdown({
      nightlyRateRwf: roomType.nightlyRateRwf,
      nights,
      nonRefundable: row.nonRefundable,
      guests,
    });

    let booking: BookingResult;
    try {
      booking = await this.bookings.writeBooking({
        input: {
          roomTypeId,
          checkIn,
          checkOut,
          guests,
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
        expiresAt: approvalExpiresAt(roomType.bookingMode, checkIn, new Date()),
      });
    } catch (err) {
      if (!(err instanceof SoldOutAfterCaptureError)) throw err;
      // Refunded inside `writeBooking` already, on the refund key. No void.
      await this.attempts.markEnded(row.id, 'refused', WITHDRAWN);
      this.log.warn(
        `Payment attempt ${row.attemptToken} settled after its room was taken; refunded in full.`,
      );
      return refused(WITHDRAWN);
    }

    await this.attempts.markConfirmed(row.id, booking.id);
    this.log.log(
      `Payment attempt ${row.attemptToken} settled into booking ${booking.reference}.`,
    );
    return { state: 'confirmed', failureReason: null, booking };
  }

  /**
   * End an attempt, and make sure the money does not stay taken.
   *
   * The void goes on the compensation queue rather than being called inline:
   * this runs inside a guest's own poll, and a provider round trip there would
   * hold their request open for the length of somebody else's outage. The queue
   * is the durable half, and it runs on the capture's derived void key so a
   * repeat is a replay rather than a second reversal.
   *
   * Only the caller whose guarded update actually ended the attempt queues the
   * void, and it says so by returning true.
   */
  private async abandon(
    row: PaymentAttemptRow,
    state: 'refused' | 'expired',
    reason: string,
  ): Promise<boolean> {
    const moved = await this.attempts.markEnded(row.id, state, reason);
    if (!moved) return false;
    // The bank row says the prompt was abandoned; a late approval may still
    // settle it inside the late window (073 AC-9a).
    if (state === 'expired') await this.transactions.markExpired(row.idempotencyKey);
    // An order attempt that ends badly ends its order's wait too (D-n). Only a
    // still pending order moves, so this can never undo a settled one.
    if (row.purpose === 'service_order' && row.serviceOrderId) {
      await this.orderPayments.fail(row.serviceOrderId, reason);
    }

    if (!row.adapterRef || row.amountRwf == null) return true;
    await this.compensations.enqueue({
      kind: 'void-pending',
      idempotencyKey: voidKeyFor(row.idempotencyKey),
      workspaceId: row.workspaceId,
      originalRef: row.adapterRef,
      amountRwf: row.amountRwf,
      memo: `Payment attempt ${state}: ${reason}`,
    });
    return true;
  }

  /** The row, as the wire says it. */
  private present(
    row: PaymentAttemptRow,
    booking: BookingResult | null,
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
   * Resolve every prompt still waiting. Run from the worker once a minute.
   *
   * It used to void only the prompts past their deadline, and never asked the
   * provider. So a guest who approved on the handset and closed the tab got no
   * booking, and a late approval was voided unread. It now runs the same ladder
   * a poll does, with the sweep's patience: a settled capture becomes its
   * booking (or its order's payment) whether or not anyone is watching.
   *
   * Bounded per run, and it never throws for one bad row: a single attempt that
   * cannot be resolved must not stop the others, because each one is somebody's
   * money in limbo. Answers how many attempts it finished, either way.
   */
  async sweep(now: Date = new Date()): Promise<number> {
    const waiting = await this.attempts.findPrompting(now, SWEEP_MIN_AGE_MS);
    let completed = 0;
    let ended = 0;
    for (const row of waiting) {
      try {
        const step = await this.resolve(row, 'sweep', now.getTime());
        if (step.state === 'confirmed') completed += 1;
        else if (step.state !== 'prompting') ended += 1;
      } catch (error) {
        this.log.error(
          `Could not resolve payment attempt ${row.attemptToken}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    // A registration fee claimed but not settled (a completion interrupted
    // between the claim and the settle) is settled again; settling is idempotent.
    for (const row of await this.attempts.findUnsettledFees()) {
      try {
        await this.settleFee(row);
      } catch (error) {
        this.log.error(
          `Could not settle the registration fee for attempt ${row.attemptToken}.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    if (completed + ended > 0) {
      this.log.log(`Payment sweep: ${completed} completed, ${ended} ended.`);
    }
    return completed + ended;
  }
}

type Resolution = {
  state: PaymentAttemptRow['state'];
  failureReason: string | null;
  booking: BookingResult | null;
};

/** How long a hold with no provider reference is left to the request writing it. */
const CAPTURE_IN_FLIGHT_MS = 60_000;
/** Past its deadline, how long the sweep still waits on a provider that says pending. */
const SWEEP_PENDING_GRACE_MS = 60_000;
/** Past its deadline, how long an unreachable provider is waited on before voiding. */
const UNREACHABLE_GIVE_UP_MS = 30 * 60_000;
/** The sweep leaves attempts younger than this to the request still answering. */
const SWEEP_MIN_AGE_MS = 15_000;

/* The three sentences a guest can be shown. Written for a person, not a log. */
const UNANSWERED =
  'The payment request timed out before it was approved. Nothing has been charged.';
const UNREACHABLE =
  'We could not confirm this payment with the provider. Nothing has been charged.';
const LOST =
  'The payment provider has no record of this request. Nothing has been charged.';
const WITHDRAWN =
  'That room stopped being available while the payment was being approved, so your payment is being refunded in full.';
const DECLINED = 'That payment was declined. Nothing has been charged.';
const ORDER_GONE =
  'This order was cancelled while the payment was being approved, so your payment is being refunded in full.';
const FEE_ALREADY_PAID =
  'This registration fee was already paid, so this payment is being refunded in full.';
const FEE_NOT_PAYABLE =
  'This registration can no longer take a fee, so this payment is being refunded in full.';

/** `<workspace>:booking-capture:<token>` → `<token>`. */
function tokenFromKey(idempotencyKey: string): string {
  return idempotencyKey.slice(idempotencyKey.lastIndexOf(':') + 1);
}
