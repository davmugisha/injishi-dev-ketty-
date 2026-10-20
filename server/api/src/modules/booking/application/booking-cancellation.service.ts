import {
  cancellationRefund,
  type BookingCancellationResult,
  type CancellationParty,
  type CancellationQuote,
  type CancellationRefund,
} from '@injishi/contracts';
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { releaseKeyFor } from '../../payments/domain/keys';
import { PAYMENT_PORT, type PaymentPort } from '../../payments/domain/payment-port';
import { noShowRefund } from '../domain/no-show';
import { localToday } from '../domain/pricing';
import {
  BookingRepository,
  type CancellableBooking,
} from '../infrastructure/booking.repository';
import { BookingNotificationsService } from './booking-notifications.service';

/** A reference as it is printed: `BK-XXXX-XXXX`. Anything else is not a booking. */
const REFERENCE = /^BK-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
/** When a property states no check-in time, the hour a stay is taken to start. */
const DEFAULT_CHECK_IN_TIME = '14:00:00';

/**
 * CANCELLING A BOOKING, and the money that follows it (F-B11, ADR-051).
 *
 * ## The refund is decided once, by one function
 *
 * `cancellationRefund` in `@injishi/contracts` holds the tiers the checkout
 * promised. The quote a guest reads and the cancellation that follows call it
 * with the same inputs, so the number on the confirm screen is the number
 * refunded. Values locked on the booking (the tier, the rate, the non-refundable
 * choice, the captured total) are the only ones read; today's listing is never
 * consulted.
 *
 * ## Provider first, ledger second (ADR-020 D-h)
 *
 * Exactly the order a host decline uses. The refund is instructed on a key
 * derived from the capture's, so a retried cancellation replays rather than
 * pays twice. If the provider does not confirm, nothing is recorded and the
 * booking stands, which is the truthful state; the guest is told to try again.
 * A full refund ends the hold with the guest as beneficiary; a partial one
 * refunds that amount against the capture and leaves the rest held for the
 * host; a forfeit moves no money at all.
 *
 * ## What is refused
 *
 * A booking that is not pending or confirmed (so a second cancel is a 409), one
 * the guest has already checked in to, one whose stay is over, and one whose
 * escrow is no longer held (it was already paid out or released).
 *
 * ## What this does NOT do yet (recorded in ADR-051)
 *
 * It does not raise the RRA credit note for an instant booking that was already
 * certified as a sale, and it does not close a pre-arrival folio. Both are owed.
 */
@Injectable()
export class BookingCancellationService {
  private readonly log = new Logger(BookingCancellationService.name);

  constructor(
    private readonly bookings: BookingRepository,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    private readonly notifications: BookingNotificationsService,
  ) {}

  /** What cancelling would refund, before anything is committed. Guest scoped. */
  async quoteForGuest(reference: string, guestUserId: string): Promise<CancellationQuote> {
    const row = await this.guestBooking(reference, guestUserId);
    const refusal = refusalFor(row);
    const refund = this.refundFor(row, 'guest');
    return {
      reference: row.reference,
      cancellable: refusal === null,
      refusal,
      ...refund,
    };
  }

  /** The guest cancels their own booking, on the tier it locked. */
  async cancelByGuest(reference: string, guestUserId: string): Promise<BookingCancellationResult> {
    return this.cancel(await this.guestBooking(reference, guestUserId), 'guest');
  }

  /**
   * The property cancels. Always a full refund. `WorkspaceGuard` has proved the
   * caller holds the workspace and `reservation.approve` in it (ADR-053, AC-A5);
   * `assertOwned` proves the booking sits in that workspace, answering 404
   * otherwise.
   */
  async cancelByHost(
    bookingId: string,
    ws: Pick<ScopedWorkspace, 'workspaceId' | 'branchScope'>,
  ): Promise<BookingCancellationResult> {
    const row = assertOwned(await this.bookings.findForCancellation({ bookingId }), ws);
    assertInBranchScope(ws, row.propertyId);
    return this.cancel(row, 'host');
  }

  /**
   * The desk cancels because the GUEST asked to (`POST /ops/reservations/:id/cancel`).
   *
   * Not `cancelByHost`: a guest who phones to say their plans changed is
   * cancelling, and the refund is the tier the booking locked, exactly what the
   * guest would get pressing cancel in their own app. The property cancelling
   * (an overbooking, a closed room) is `cancelByHost` and refunds in full.
   * Same containment as every operator command: another workspace's or
   * another branch's booking is a 404. The reason is the desk's words, kept on
   * the booking with the cancellation.
   */
  async cancelAtGuestRequest(
    bookingId: string,
    ws: Pick<ScopedWorkspace, 'workspaceId' | 'branchScope'>,
    reason: string | null,
  ): Promise<BookingCancellationResult> {
    const row = assertOwned(await this.bookings.findForCancellation({ bookingId }), ws);
    assertInBranchScope(ws, row.propertyId);
    return this.cancel(row, 'guest', reason);
  }

  /**
   * THE GUEST NEVER CAME (`POST /ops/reservations/:id/no-show`).
   *
   * A no-show is a cancellation that happened after the window closed: the
   * guest did not cancel in time, so the money follows the tier the booking
   * locked, read as a guest cancelling after check-in time. That is the
   * `after` percent of `CANCELLATION_TIERS` (nothing on `flexible`, half on
   * `moderate`), decided by `cancellationRefund`, the one function every
   * refund here goes through. Nothing new is decided about money here.
   *
   * Refused: anything but a confirmed booking (a request is declined, not
   * no-showed), a booking somebody checked in against, and one whose arrival
   * day has not come yet. The guard on the write repeats the first two, so a
   * check in racing the press loses cleanly.
   *
   * Provider first, then the record, exactly as `cancel` orders it. A booking
   * that took no money moves none and keeps its null payment status.
   */
  async markNoShow(
    bookingId: string,
    ws: Pick<ScopedWorkspace, 'workspaceId' | 'branchScope'>,
    input: { reason: string | null; byUserId: string },
  ): Promise<{ refundRwf: number; forfeitRwf: number; rule: string }> {
    const row = assertOwned(await this.bookings.findForCancellation({ bookingId }), ws);
    assertInBranchScope(ws, row.propertyId);

    if (row.status === 'no_show') throw new ConflictException('This booking is already a no-show.');
    if (row.status === 'pending_approval') {
      throw new ConflictException('This is still a request. Decline it instead of recording a no-show.');
    }
    if (row.status !== 'confirmed') throw new ConflictException('This booking is closed.');
    if (row.stays > 0) throw new ConflictException('This guest checked in, so the booking is not a no-show.');
    if (row.checkIn > localToday()) {
      throw new ConflictException(`The guest is due on ${row.checkIn}. A no-show is recorded on the arrival day or after.`);
    }
    if (row.escrowId && row.escrowStatus !== 'held') {
      throw new ConflictException('The payment for this booking has already been settled. Please contact support.');
    }

    // The same function the desk's board quotes with, so the number on the
    // confirm card is the number refunded.
    const refund: CancellationRefund = noShowRefund({
      capturedRwf: row.escrowId ? (row.escrowAmountRwf ?? 0) : null,
      tier: row.tier,
      nonRefundable: row.nonRefundable,
      hoursBeforeCheckIn: hoursUntilCheckIn(row, new Date()),
    });
    const outcome =
      refund.percent === 100 ? 'refunded_full' : refund.refundRwf > 0 ? 'refunded_partial' : 'forfeited';

    if (row.escrowId) {
      await this.instructRefund(row, refund, outcome, {
        full: `No-show ${row.reference}: full refund`,
        partial: `No-show ${row.reference}: ${refund.percent}% refund`,
        // Cancellation and a no-show settle the same captured booking. A competing
        // press must reach the provider on the same key, never issue a second refund.
        keyPrefix: 'cancel-refund',
        what: 'marked as a no-show',
      });
    }

    const recorded = await this.bookings.recordNoShow({
      bookingId: row.bookingId,
      outcome: row.escrowId ? outcome : null,
      refundRwf: row.escrowId ? refund.refundRwf : null,
      reason: input.reason,
      byUserId: input.byUserId,
    });
    if (!recorded) {
      throw new ConflictException('This booking was just changed. Refresh to see where it stands.');
    }
    this.log.log(`${row.reference} recorded as a no-show: ${refund.refundRwf} RWF refunded, ${refund.forfeitRwf} RWF kept.`);
    return { refundRwf: refund.refundRwf, forfeitRwf: refund.forfeitRwf, rule: refund.rule };
  }

  /**
   * Instruct the provider to give money back, before anything is recorded
   * (ADR-020 D-h). A full refund ends the hold with the guest as beneficiary; a
   * partial one refunds that amount against the capture. Keys are derived from
   * the capture's, so a retry replays rather than pays twice. A failure
   * records nothing and answers 503, so the booking stands as it was.
   */
  private async instructRefund(
    row: CancellableBooking,
    refund: CancellationRefund,
    outcome: 'refunded_full' | 'refunded_partial' | 'forfeited',
    words: { full: string; partial: string; keyPrefix: string; what: string },
  ): Promise<void> {
    if (refund.refundRwf <= 0) return;
    const { adapterRef, escrowAmountRwf, escrowId } = row;
    if (!adapterRef || escrowAmountRwf == null || !escrowId) {
      this.log.error(`Cannot refund ${row.reference}: its escrow carries no provider reference or amount.`);
      throw new ServiceUnavailableException(
        `We could not refund this booking automatically, so it has not been ${words.what}. Please contact support.`,
      );
    }
    const captureKey = row.idempotencyKey ?? `${row.workspaceId}:booking:${row.bookingId}`;
    try {
      if (outcome === 'refunded_full') {
        await this.payments.releaseEscrow({
          kind: 'escrow_release',
          beneficiary: 'guest',
          idempotencyKey: releaseKeyFor({ idempotencyKey: row.idempotencyKey, workspaceId: row.workspaceId, escrowId }),
          originalRef: adapterRef,
          amountRwf: escrowAmountRwf,
          currency: 'RWF',
          workspaceId: row.workspaceId,
          memo: words.full,
        });
      } else {
        await this.payments.refund({
          kind: 'refund',
          idempotencyKey: `${words.keyPrefix}:${captureKey}`,
          originalRef: adapterRef,
          amountRwf: refund.refundRwf,
          currency: 'RWF',
          workspaceId: row.workspaceId,
          memo: words.partial,
        });
      }
    } catch (err) {
      this.log.warn(
        `Refund not confirmed for ${row.reference}; nothing recorded. ` +
          (err instanceof Error ? err.message : String(err)),
      );
      throw new ServiceUnavailableException(
        'We could not reach the payment service to refund you, so the booking is unchanged. Please try again.',
      );
    }
  }

  private async guestBooking(reference: string, guestUserId: string): Promise<CancellableBooking> {
    const normalised = reference.trim().toUpperCase();
    // A malformed reference is the same 404 as an unknown or foreign one, so the
    // route cannot be used to tell them apart.
    const row = REFERENCE.test(normalised)
      ? await this.bookings.findForCancellation({ reference: normalised, guestUserId })
      : null;
    if (!row) throw new NotFoundException('Booking not found.');
    return row;
  }

  private refundFor(row: CancellableBooking, party: CancellationParty): CancellationRefund {
    return cancellationRefund({
      party,
      status: row.status,
      tier: row.tier,
      nonRefundable: row.nonRefundable,
      // What was captured, never a recomputation at today's rate.
      grossRwf: row.escrowAmountRwf ?? row.grossRwf ?? 0,
      hoursBeforeCheckIn: hoursUntilCheckIn(row, new Date()),
    });
  }

  private async cancel(
    row: CancellableBooking,
    party: CancellationParty,
    reason: string | null = null,
  ): Promise<BookingCancellationResult> {
    const refusal = refusalFor(row);
    if (refusal) throw new ConflictException(refusal);

    const refund = this.refundFor(row, party);
    const outcome =
      refund.percent === 100 ? 'refunded_full' : refund.refundRwf > 0 ? 'refunded_partial' : 'forfeited';

    // --- 1. The provider, first. -------------------------------------------
    await this.instructRefund(row, refund, outcome, {
      full: `${party === 'host' ? 'Host' : 'Guest'} cancelled ${row.reference}: full refund`,
      partial: `Guest cancelled ${row.reference}: ${refund.percent}% refund`,
      keyPrefix: 'cancel-refund',
      what: 'cancelled',
    });

    // --- 2. The ledger, recording what the provider confirmed. -------------
    const recorded = await this.bookings.recordCancellation({
      bookingId: row.bookingId,
      party,
      refundRwf: refund.refundRwf,
      outcome,
      reason,
    });
    if (!recorded) {
      // Resolved by someone else between the read and here. The refund key is
      // derived, so a second instruction for the same booking was a replay.
      throw new ConflictException('This booking was just changed. Refresh to see where it stands.');
    }
    this.log.log(`${row.reference} cancelled by ${party}: ${refund.percent}% (${refund.refundRwf} RWF) refunded.`);

    // --- 3. Tell both sides. Queued; never throws. ---------------------------
    await this.notifications.notify(row.bookingId, 'cancelled');
    if (party === 'guest') await this.notifications.notify(row.bookingId, 'host_guest_cancelled');

    return {
      id: row.bookingId,
      reference: row.reference,
      status: 'cancelled',
      cancelledBy: party,
      paymentStatus: outcome,
      escrowStatus: row.escrowId ? outcome : null,
      refundRwf: refund.refundRwf,
      forfeitRwf: refund.forfeitRwf,
      rule: refund.rule,
    };
  }
}

/** Why this booking cannot be cancelled now, or null when it can. */
function refusalFor(row: CancellableBooking): string | null {
  if (row.status === 'cancelled') return 'This booking is already cancelled.';
  if (row.status === 'declined') return 'This request was declined and has already been refunded.';
  if (row.status !== 'confirmed' && row.status !== 'pending_approval') return 'This booking is closed.';
  if (row.stays > 0) return 'You have already checked in, so this booking can no longer be cancelled here.';
  if (row.checkOut <= localToday()) return 'This stay has ended.';
  if (row.escrowId && row.escrowStatus !== 'held') {
    return 'The payment for this booking has already been settled. Please contact support.';
  }
  return null;
}

/**
 * Hours from now until the stay begins: the check-in date at the property's
 * check-in time, in Kigali. Rwanda keeps one zone with no daylight saving, so
 * the offset is fixed. Negative once check-in has passed.
 */
export function hoursUntilCheckIn(
  row: Pick<CancellableBooking, 'checkIn' | 'checkInTime'>,
  now: Date,
): number {
  const time = /^\d{2}:\d{2}(:\d{2})?$/.test(row.checkInTime ?? '') ? row.checkInTime! : DEFAULT_CHECK_IN_TIME;
  const startsAt = Date.parse(`${row.checkIn}T${time.length === 5 ? `${time}:00` : time}+02:00`);
  return (startsAt - now.getTime()) / 3_600_000;
}
