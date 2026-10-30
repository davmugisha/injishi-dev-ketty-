import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import {
  BOOKING_MAIL_JOB,
  bookingMailJobId,
  type BookingMailEvent,
} from '../domain/booking-mail';
import {
  REFUND_MAIL_JOB,
  refundMailJobId,
  type RefundMailEvent,
} from '../domain/refund-mail';

/**
 * The one way a booking tells its guest something (ADR-047).
 *
 * ## Why it queues, and why that is not a detail
 *
 * Every caller of this service has ALREADY COMMITTED something. `BookingService`
 * has taken money and written a booking; `BookingDecisionService` has flipped a
 * status and instructed a refund; the expiry sweep has released a hold. If
 * sending mail could fail those operations, an unreachable SMTP relay would
 * start rolling back paid reservations — which is a far worse outcome than a
 * late email.
 *
 * So the send is queued and this method NEVER THROWS. It is the same shape
 * `BookingService` already uses for `EbmSaleTrigger.saleConfirmed`, and for the
 * same stated reason: the reservation is committed, and a failure here must be
 * loud in the logs rather than fatal to the caller.
 *
 * ## Why there is no `sendNow`
 *
 * There is deliberately no synchronous path. A foreground send on the booking
 * request would put an outbound SMTP round trip inside the one request a guest
 * is watching with their money on it — the thing `OtpMailer` needs a timeout to
 * survive on sign-in, on a screen where the stakes are higher.
 */
@Injectable()
export class BookingNotificationsService {
  private readonly log = new Logger(BookingNotificationsService.name);

  constructor(
    @InjectQueue(QUEUES.email) private readonly email: Queue,
  ) {}

  /**
   * Tell the guest what happened to their booking.
   *
   * Idempotent by job id, so a caller that raises the same event twice for one
   * booking queues one mail. Safe to call from inside a `try` that must not
   * fail — it swallows its own errors by design.
   */
  /** Tell the guest the desk changed their booking (0120): one mail per change, never deduplicated away. */
  async notifyChange(bookingId: string, changeId: string): Promise<void> {
    await this.notify(bookingId, 'changed', changeId);
  }

  async notify(bookingId: string, event: BookingMailEvent, changeId?: string): Promise<void> {
    const job = { bookingId, event, ...(changeId ? { changeId } : {}) };
    try {
      await this.email.add(BOOKING_MAIL_JOB, job, {
        jobId: bookingMailJobId(job),
        // A mail worth sending is worth retrying; a relay is commonly down for
        // seconds, not days. Exponential from 30s gives roughly 30s, 1m, 2m,
        // 4m, 8m — inside the 24-hour window an approval decision lives in.
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: false,
      });
    } catch (error) {
      // Redis is down, or the queue refused. The booking stands either way.
      this.log.error(
        `Could not queue the "${event}" mail for booking ${bookingId}. ` +
          'The booking is unaffected; the guest has not been told.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Tell the payer about a refund owed to them (073-gtbank-payments AC-12,
   * AC-12a). Same rules as `notify`: queued, one job per refund per event, and
   * never throws. The refund is owed either way; `/account/refunds` shows it.
   */
  async notifyRefund(transactionId: string, event: RefundMailEvent): Promise<void> {
    const job = { transactionId, event };
    try {
      await this.email.add(REFUND_MAIL_JOB, job, {
        jobId: refundMailJobId(job),
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: false,
      });
    } catch (error) {
      this.log.error(
        `Could not queue the "${event}" mail for refund ${transactionId}. The refund is unaffected.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
