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

  private async cancel(row: CancellableBooking, party: CancellationParty): Promise<BookingCancellationResult> {
    const refusal = refusalFor(row);
    if (refusal) throw new ConflictException(refusal);

    const refund = this.refundFor(row, party);
    const outcome =
      refund.percent === 100 ? 'refunded_full' : refund.refundRwf > 0 ? 'refunded_partial' : 'forfeited';

    // --- 1. The provider, first. -------------------------------------------
    if (refund.refundRwf > 0) {
      const { adapterRef, escrowAmountRwf, escrowId } = row;
      if (!adapterRef || escrowAmountRwf == null || !escrowId) {
        this.log.error(`Cannot refund ${row.reference}: its escrow carries no provider reference or amount.`);
        throw new ServiceUnavailableException(
          'We could not refund this booking automatically, so it has not been cancelled. Please contact support.',
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
            memo: `${party === 'host' ? 'Host' : 'Guest'} cancelled ${row.reference}: full refund`,
          });
        } else {
          await this.payments.refund({
            kind: 'refund',
            idempotencyKey: `cancel-refund:${captureKey}`,
            originalRef: adapterRef,
            amountRwf: refund.refundRwf,
            currency: 'RWF',
            workspaceId: row.workspaceId,
            memo: `Guest cancelled ${row.reference}: ${refund.percent}% refund`,
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

    // --- 2. The ledger, recording what the provider confirmed. -------------
    const recorded = await this.bookings.recordCancellation({
      bookingId: row.bookingId,
      party,
      refundRwf: refund.refundRwf,
      outcome,
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
