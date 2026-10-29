import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { EbmSaleTrigger } from '../../ebm/application/ebm-sale-trigger.service';
import { BookingNotificationsService } from './booking-notifications.service';
import { BookingRefunds } from './booking-refunds';
import { FolioService } from './folio.service';
import { releaseKeyFor } from '../../payments/domain/keys';
import {
  PAYMENT_PORT,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import {
  type ApprovalOutcome,
  BookingRepository,
} from '../infrastructure/booking.repository';

/**
 * The ONE place a pending request becomes confirmed or declined (review 1.1).
 *
 * Two callers reach this: the guest-facing `/bookings/:id/*`, authorised by org
 * membership, and the operator desk `/ops/reservations/:id/*`, authorised by
 * workspace permission. Each keeps its own authorisation and its own read-back
 * shape; the transition itself is here and nowhere else.
 *
 * It exists because the two paths had drifted. The operator's Decline marked
 * the escrow refunded without instructing the provider — the ledger said the
 * guest had their money back and the provider still held it (review 3.1). A
 * transition that moves money must have exactly one implementation.
 *
 * ORDER, ON DECLINE. Provider first, ledger second. A release that fails leaves
 * the request pending and the escrow held, which is the truthful state; a
 * ledger that said "refunded" ahead of the provider would be the bug again.
 *
 * ORDER, ON APPROVE. Ledger first, then the folio as a best effort. A bill
 * that failed to open is reopened by the next check-in, and refusing to
 * confirm a guest's reservation over it would be the worse failure by a wide
 * margin (ADR-016 D-k).
 */
export interface DecisionActor {
  kind: 'guest_host' | 'operator';
  workspaceId: string | null;
}

@Injectable()
export class BookingDecisionService {
  private readonly log = new Logger(BookingDecisionService.name);

  constructor(
    private readonly bookings: BookingRepository,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    private readonly folios: FolioService,
    private readonly ebm: EbmSaleTrigger,
    private readonly notifications: BookingNotificationsService,
    private readonly refunds: BookingRefunds,
  ) {}

  async approve(
    bookingId: string,
    actor: DecisionActor,
  ): Promise<ApprovalOutcome> {
    const outcome = await this.bookings.approve(bookingId);
    if (!outcome) throw raceLost();

    // The request is now a sale: record it for RRA certification (F-B13,
    // ADR-041). Never throws; the reconcile sweep backs it up.
    await this.ebm.saleConfirmed(bookingId);

    try {
      const property = await this.bookings.propertyForBooking(bookingId);
      const workspaceId = actor.workspaceId ?? (await this.workspaceOf(bookingId));
      if (property && workspaceId) {
        await this.folios.openForBooking({
          bookingId,
          workspaceId,
          propertyId: property.propertyId,
          guestUserId: property.guestUserId,
        });
      }
    } catch (err) {
      // Not fatal, but never silent (review 4.4): the next check-in reopens
      // the bill, and someone should be able to see that it needed to.
      this.log.warn(
        `Folio not opened for booking ${bookingId} on approve: ` +
          (err instanceof Error ? err.message : String(err)),
      );
    }

    /*
     * The guest has been waiting on this answer, possibly for a day (ADR-047).
     *
     * Queued after the transition rather than before it, so a mail cannot go
     * out for an approval that then failed to commit — and it cannot throw,
     * because the booking is confirmed either way and a mail relay must never
     * un-confirm it.
     */
    await this.notifications.notify(bookingId, 'approved');

    return outcome;
  }

  async decline(
    bookingId: string,
    actor: DecisionActor,
  ): Promise<ApprovalOutcome> {
    const escrow = await this.bookings.findHeldEscrow(bookingId);
    if (!escrow) {
      // Nothing held to release: it was resolved between the caller's guard
      // and here. Same answer the guard gives, for the same reason.
      throw new ConflictException(
        'This request was already approved, declined or expired.',
      );
    }
    if (!escrow.adapterRef || escrow.amountRwf == null) {
      this.log.error(
        `Cannot release escrow ${escrow.escrowId} for ${escrow.reference}: ` +
          'the row carries no adapter reference or no amount.',
      );
      throw new ServiceUnavailableException(
        'We could not return this guest their money. Nothing has changed. Please contact support.',
      );
    }

    const releaseKey = releaseKeyFor(escrow);

    // Decline now, refund owed (073-gtbank-payments AC-13): the booking is
    // declined and the release written in one transaction, and the dispatcher
    // sends it. A payment from before the bank record keeps the provider first.
    const plan = await this.refunds.plan({
      reference: escrow.reference,
      bookingId,
      workspaceId: escrow.workspaceId,
      adapterRef: escrow.adapterRef,
      idempotencyKey: releaseKey,
      operation: 'escrow_release_guest',
    });
    if (plan) {
      const owed = await this.bookings.decline(bookingId, { owe: plan.oweTx, amountRwf: escrow.amountRwf });
      if (!owed) throw raceLost();
      await plan.announce();
      await this.notifications.notify(bookingId, 'declined');
      return owed;
    }

    try {
      await this.payments.releaseEscrow({
        kind: 'escrow_release',
        beneficiary: 'guest',
        idempotencyKey: releaseKey,
        originalRef: escrow.adapterRef,
        amountRwf: escrow.amountRwf,
        currency: 'RWF',
        workspaceId: escrow.workspaceId,
        memo:
          actor.kind === 'operator'
            ? 'Operator declined the request'
            : 'Host declined the request',
      });
    } catch (err) {
      this.log.warn(
        `Release not confirmed for ${escrow.reference} (escrow ` +
          `${escrow.escrowId}, key ${releaseKey}). Nothing recorded. ` +
          (err instanceof Error ? err.message : String(err)),
      );
      throw new ServiceUnavailableException(
        'We could not return the guest their money, so the request is unchanged. Please try again.',
      );
    }

    const outcome = await this.bookings.decline(bookingId);
    if (!outcome) throw raceLost();

    /*
     * A refusal is the one message a guest MUST receive (ADR-047).
     *
     * Their plans have just stopped being real and their money is on its way
     * back; being told neither is the worst silence in the product. Queued
     * after the release is confirmed and the row is flipped, so the mail's
     * promise that a refund is under way is one the provider already accepted.
     */
    await this.notifications.notify(bookingId, 'declined');

    return outcome;
  }

  private async workspaceOf(bookingId: string): Promise<string | null> {
    const owner = await this.bookings.findReservationOwner(bookingId);
    return owner?.workspaceId ?? null;
  }
}

function raceLost(): ConflictException {
  return new ConflictException(
    'This request was just resolved. Refresh to see its current state.',
  );
}
