import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { reportAlarm } from '../../../shared/observability/error-reporter';
import { queueJobId } from '../../../shared/queues/job-id';
import { QUEUES } from '../../../shared/queues/queues.module';
import { PaymentCompensationService } from '../../payments/application/payment-compensation.service';
import { PAYOUT_ATTEMPTS, SEND_PAYOUT, type SendPayoutJob } from '../../rentals/infrastructure/rentals-money.queue';
import { FolioRepository } from '../infrastructure/folio.repository';
import { type CompletedStay, StayCompletionRepository } from '../infrastructure/stay-completion.repository';

/**
 * Check out ends the booking and pays the host (0116).
 *
 * **It never throws.** The guest has left, the room is dirty and the bill is
 * signing: a payout that cannot be written now is logged and alarmed, and the
 * check out still answers 200. Nothing is lost by waiting, because the escrow
 * stays `held` and the booking uncompleted until this runs again.
 */
@Injectable()
export class StayCompletionService {
  private readonly log = new Logger(StayCompletionService.name);

  constructor(
    private readonly repo: StayCompletionRepository,
    @InjectQueue(QUEUES.payouts) private readonly payouts: Queue,
    private readonly compensations: PaymentCompensationService,
    private readonly folios: FolioRepository,
  ) {}

  async completeBooking(bookingId: string): Promise<CompletedStay | null> {
    try {
      const done = await this.repo.complete(bookingId);
      if (done?.payout) {
        this.log.log(
          `Booking ${done.reference} completed; RWF ${done.payout.amountRwf} ${
            done.payout.status === 'queued' ? `queued to ${done.payout.destinationMasked}` : 'held: no payout account'
          }.`,
        );
        // Send it now. Without this the payout sat `queued` until the hourly pass took it for lost,
        // ten minutes to an hour after the guest left.
        if (done.payout.status === 'queued') await this.sendPayout(done.payout.id);
      }
      if (done?.changeCredit) await this.refundChangeCredit(bookingId, done.reference, done.changeCredit);
      return done;
    } catch (cause) {
      this.log.error(
        `Booking ${bookingId} checked out but was not completed: ${cause instanceof Error ? cause.message : 'unknown failure'}.`,
      );
      reportAlarm('STAY_COMPLETION_FAILED', 'A checked-out booking was not completed or paid out.', { bookingId }, cause);
      return null;
    }
  }

  /**
   * Credit a cheaper desk change left on the bill, which the stay did not spend (0120, the owner's
   * decision: what is left is refunded at check out). Durable through the compensation queue, against the
   * booking's own capture, on a key of the booking, so a second check out never pays it twice. A positive
   * `refund` line takes it off the bill, which then balances and can close. Never throws: the guest has
   * left either way, and a failure is for the Bills screen.
   */
  private async refundChangeCredit(
    bookingId: string,
    reference: string,
    credit: NonNullable<CompletedStay['changeCredit']>,
  ): Promise<void> {
    try {
      await this.compensations.enqueue({
        kind: 'refund',
        idempotencyKey: `${credit.workspaceId}:change-credit:${bookingId}`,
        workspaceId: credit.workspaceId,
        originalRef: credit.originalRef,
        amountRwf: credit.amountRwf,
        memo: `Unspent credit from a change to booking ${reference}`,
      });
      if (credit.folioId) {
        await this.folios.postCharges({
          folioId: credit.folioId,
          workspaceId: credit.workspaceId,
          drafts: [
            {
              chargeType: 'refund',
              description: `Credit from the booking change refunded (${reference})`,
              departmentId: null,
              quantity: 1,
              unitPriceRwf: credit.amountRwf,
              amountRwf: credit.amountRwf,
              taxCode: null,
              taxRate: null,
              taxAmountRwf: null,
              sourceRefType: 'booking',
              sourceRefId: bookingId,
              postedByUserId: null,
              businessDate: null,
              idempotencyKey: `${credit.workspaceId}:change-credit:${bookingId}`,
              accountCode: 'REFUNDS_PAID',
            },
          ],
          onLocked: 'open_next',
        });
      }
      this.log.log(`Booking ${reference}: RWF ${credit.amountRwf} of unspent change credit refunded to the guest.`);
    } catch (cause) {
      this.log.error(
        `Booking ${reference} left RWF ${credit.amountRwf} of change credit that was not refunded: ${
          cause instanceof Error ? cause.message : 'unknown failure'
        }.`,
      );
      reportAlarm('CHANGE_CREDIT_REFUND_FAILED', 'A booking change credit was not refunded at check out.', { bookingId }, cause);
    }
  }

  /** The job `RentalsMoneyQueue.sendPayout` queues for rent. Redis down is not an error: the hourly pass sends it. */
  private async sendPayout(payoutId: string): Promise<void> {
    try {
      await this.payouts.add(SEND_PAYOUT, { payoutId } satisfies SendPayoutJob, {
        jobId: queueJobId(`payout:${payoutId}:${Date.now()}`),
        attempts: PAYOUT_ATTEMPTS,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: 500,
      });
    } catch (cause) {
      this.log.warn(
        `Could not queue payout ${payoutId}: ${cause instanceof Error ? cause.message : 'queue unavailable'}. The hourly pass sends it.`,
      );
    }
  }
}
