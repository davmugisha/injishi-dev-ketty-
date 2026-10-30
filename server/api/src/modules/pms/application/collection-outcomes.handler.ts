import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { type CollectionOutcome, PaymentOutcomes } from '../../pay/application/payment-outcomes';
import { RefundsOwedService } from '../../pay/application/refunds-owed.service';
import { REGISTRATION_FEES, type RegistrationFees } from '../domain/registration-fees';
import { BookingRepository } from '../infrastructure/booking.repository';
import { PaymentAttemptRepository } from '../infrastructure/payment-attempt.repository';
import { BookingNotificationsService } from './booking-notifications.service';

/**
 * What two people deciding about a collection means for what it paid for
 * (073-gtbank-payments AC-20, AC-21).
 *
 * - **Confirmed received**: the money is ours after all. An attempt still
 *   waiting is left to its poll and the sweep, which complete it. One that
 *   already ended bought nothing, so the money is owed back in full, exactly
 *   as a capture that settles after its refusal is (ADR-051).
 * - **Cancel the service**: the bank took a payment back and the business
 *   will not carry it. A booking is cancelled with no refund (the guest has
 *   the money through the reversal) and the property is told; a registration
 *   fee's invoice is reopened, to be paid again.
 */
@Injectable()
export class CollectionOutcomesHandler implements OnModuleInit {
  private readonly log = new Logger(CollectionOutcomesHandler.name);

  constructor(
    private readonly outcomes: PaymentOutcomes,
    private readonly attempts: PaymentAttemptRepository,
    private readonly bookings: BookingRepository,
    private readonly refunds: RefundsOwedService,
    private readonly notifications: BookingNotificationsService,
    @Inject(REGISTRATION_FEES) private readonly registrations: RegistrationFees,
  ) {}

  onModuleInit(): void {
    this.outcomes.onCollection((outcome) => this.handle(outcome));
  }

  async handle(outcome: CollectionOutcome): Promise<void> {
    const attempt = await this.attempts.findByKey(outcome.idempotencyKey);

    if (outcome.status === 'confirmed_received') {
      // Still waiting with a provider reference: its poll or the sweep reads
      // it settled and completes it. Without one it can never complete (the
      // sweep refuses it), so it is treated as ended. A capture that failed
      // before its attempt was written has no attempt at all; only a booking
      // standing on its key can have used the money.
      if (attempt?.state === 'prompting' && attempt.adapterRef) return;
      const consumed =
        !attempt || attempt.purpose === 'booking'
          ? await this.bookings.escrowExistsForCaptureKey(outcome.idempotencyKey)
          : attempt.state === 'confirmed';
      if (consumed) return;
      const prepared = await this.refunds.prepareCollection(
        outcome.transactionId,
        `payments: payee details for refund of payment ${outcome.reference}`,
      );
      if (!prepared || !outcome.workspaceId) return;
      await this.refunds.owe(prepared, {
        idempotencyKey: `refund:${outcome.idempotencyKey}`,
        workspaceId: outcome.workspaceId,
        operation: 'refund',
        amountRwf: outcome.amountRwf,
        fit: 'cap',
      });
      this.log.log(`Collection ${outcome.reference} was confirmed after its attempt ended; owed back in full.`);
      return;
    }

    // cancel_service
    if (!attempt) {
      this.log.warn(`Collection ${outcome.reference} has no payment attempt; a person must settle what it paid for.`);
      return;
    }
    if (attempt.purpose === 'booking' && attempt.bookingId) {
      const cancelled = await this.bookings.cancelForReversal(attempt.bookingId);
      if (cancelled) {
        await this.notifications.notify(attempt.bookingId, 'host_payment_reversed');
        this.log.warn(`Booking ${cancelled.reference} cancelled: its payment was reversed and two people chose not to carry it.`);
      }
      return;
    }
    if (attempt.purpose === 'registration_fee' && attempt.subscriptionInvoiceId) {
      if (await this.registrations.reopenFeeAfterReversal(attempt.subscriptionInvoiceId)) {
        this.log.warn(`Registration invoice ${attempt.subscriptionInvoiceId} reopened: its fee was reversed.`);
      }
      return;
    }
    this.log.warn(`Collection ${outcome.reference} paid for a ${attempt.purpose}; nothing here cancels that, a person must.`);
  }
}
