import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { type DisbursementOutcome, PaymentOutcomes } from '../../pay/application/payment-outcomes';
import { RefundLedgerRepository } from '../infrastructure/refund-ledger.repository';
import { BookingNotificationsService } from './booking-notifications.service';

/** The disbursements that pay a guest back, as opposed to paying a host. */
const GUEST_REFUNDS = new Set(['refund', 'escrow_release_guest']);

/**
 * What a refund's outcome means for a booking and its payer
 * (073-gtbank-payments AC-12, AC-12a, AC-13, AC-18).
 *
 * Subscribed in both processes, so whichever process applied the bank's
 * verdict applies its consequences. The payments module fires this only when
 * its conditional update changed a row, so each consequence happens once:
 *
 * - waiting on the payer's name and ID: the payer is asked, by mail;
 * - paid, or written off by two people: the booking reads refunded once every
 *   refund it owes is settled;
 * - refused, or above the limit: the payer is told it is delayed;
 * - came back after it was paid: the booking owes it again.
 */
@Injectable()
export class RefundOutcomesHandler implements OnModuleInit {
  private readonly log = new Logger(RefundOutcomesHandler.name);

  constructor(
    private readonly outcomes: PaymentOutcomes,
    private readonly ledger: RefundLedgerRepository,
    private readonly notifications: BookingNotificationsService,
  ) {}

  onModuleInit(): void {
    this.outcomes.onDisbursement((outcome) => this.handle(outcome));
  }

  async handle(outcome: DisbursementOutcome): Promise<void> {
    if (!GUEST_REFUNDS.has(outcome.operation)) return;
    switch (outcome.status) {
      case 'needs_details':
        await this.notifications.notifyRefund(outcome.transactionId, 'refund_details_needed');
        return;
      case 'failed':
      case 'over_limit':
        await this.notifications.notifyRefund(outcome.transactionId, 'refund_delayed');
        return;
      case 'successful':
      // Two people wrote it off (AC-20): it is no longer owed, so the booking
      // settles on what the bank did pay.
      case 'written_off': {
        if (!outcome.bookingId) return;
        const settled = await this.ledger.settleRefunded(outcome.bookingId);
        if (settled) {
          this.log.log(
            `Booking ${outcome.bookingId} reads ${settled}: refund ${outcome.reference} was ${outcome.status === 'successful' ? 'paid' : 'written off'}.`,
          );
        }
        return;
      }
      case 'reversed':
        if (outcome.bookingId && (await this.ledger.reopenRefund(outcome.bookingId))) {
          this.log.warn(`Refund ${outcome.reference} came back; booking ${outcome.bookingId} owes it again.`);
        }
        return;
      default:
        return;
    }
  }
}
