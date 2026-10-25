import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { queueJobId } from '../../../shared/queues/job-id';
import { QUEUES } from '../../../shared/queues/queues.module';
import type { CallbackEvent } from '../../payments/domain/payment-port';

/** PaymentSettlement: the minute sweep, one payment to settle, a provider's callback. */
export const SETTLEMENT_SWEEP = 'settlement-sweep';
export const SETTLE_PAYMENT = 'settle-payment';
export const WEBHOOK_EVENT = 'webhook-event';

/** PaymentSettlement: one payment to a fault's fixer to settle (WP 4.3). */
export const SETTLE_VENDOR_PAYOUT = 'settle-vendor-payout';

export interface SettleVendorPayoutJob {
  payoutId: string;
}

/** Payouts: the hourly pass over held and lost ones, and one payout to send. */
export const PAYOUTS_SWEEP = 'payouts-sweep';
export const SEND_PAYOUT = 'send-payout';

export interface SettlePaymentJob {
  paymentId: string;
}

export interface WebhookJob {
  event: CallbackEvent;
}

export interface SendPayoutJob {
  payoutId: string;
}

/** How many times a payout is tried before it is left for the hourly pass. */
export const PAYOUT_ATTEMPTS = 8;

/**
 * Queues the money jobs from the HTTP process (blueprint 2.6; WP 1.6b).
 * Never throws: Redis being down must not undo a payment the provider was
 * asked for, and each queue's sweep picks up what was never queued.
 */
@Injectable()
export class RentalsMoneyQueue {
  private readonly log = new Logger(RentalsMoneyQueue.name);

  constructor(
    @InjectQueue(QUEUES.paymentSettlement) private readonly settlement: Queue,
    @InjectQueue(QUEUES.payouts) private readonly payouts: Queue,
  ) {}

  /** Look at one pending payment after `delayMs`: the mock customer approves in a few seconds. */
  async settleLater(paymentId: string, delayMs: number): Promise<boolean> {
    try {
      await this.settlement.add(
        SETTLE_PAYMENT,
        { paymentId } satisfies SettlePaymentJob,
        { jobId: queueJobId(`settle:${paymentId}:${Math.round(delayMs / 1000)}`), delay: delayMs, attempts: 3, backoff: { type: 'fixed', delay: 5_000 }, removeOnComplete: true, removeOnFail: 200 },
      );
      return true;
    } catch (cause) {
      this.log.warn(`Could not queue settlement of payment ${paymentId}: ${cause instanceof Error ? cause.message : 'queue unavailable'}. The sweep looks at it.`);
      return false;
    }
  }

  /** Look at one payment to a fault's fixer after `delayMs`: the landlord approves the prompt on their phone. */
  async settleVendorPayoutLater(payoutId: string, delayMs: number): Promise<boolean> {
    try {
      await this.settlement.add(
        SETTLE_VENDOR_PAYOUT,
        { payoutId } satisfies SettleVendorPayoutJob,
        { jobId: queueJobId(`vendor:${payoutId}:${Math.round(delayMs / 1000)}`), delay: delayMs, attempts: 3, backoff: { type: 'fixed', delay: 5_000 }, removeOnComplete: true, removeOnFail: 200 },
      );
      return true;
    } catch (cause) {
      this.log.warn(`Could not queue settlement of repair payout ${payoutId}: ${cause instanceof Error ? cause.message : 'queue unavailable'}. The sweep looks at it.`);
      return false;
    }
  }

  /** One job per provider event: a replay is the same job id and BullMQ keeps one. */
  async webhook(event: CallbackEvent): Promise<boolean> {
    try {
      await this.settlement.add(WEBHOOK_EVENT, { event } satisfies WebhookJob, {
        jobId: queueJobId(`webhook:${event.provider}:${event.eventId}`),
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: 500,
      });
      return true;
    } catch (cause) {
      this.log.warn(`Could not queue callback ${event.provider}/${event.eventId}: ${cause instanceof Error ? cause.message : 'queue unavailable'}. The sweep reads the transaction back.`);
      return false;
    }
  }

  /** Send one payout, with backoff while the provider does not answer. Job id is the payout id. */
  async sendPayout(payoutId: string): Promise<boolean> {
    try {
      await this.payouts.add(SEND_PAYOUT, { payoutId } satisfies SendPayoutJob, {
        jobId: queueJobId(`payout:${payoutId}:${Date.now()}`),
        attempts: PAYOUT_ATTEMPTS,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: 500,
      });
      return true;
    } catch (cause) {
      this.log.warn(`Could not queue payout ${payoutId}: ${cause instanceof Error ? cause.message : 'queue unavailable'}. The hourly pass sends it.`);
      return false;
    }
  }
}
