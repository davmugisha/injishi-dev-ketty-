import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { QUEUES } from '../../../shared/queues/queues.module';
import { PaymentSettlementService } from '../application/payment-settlement.service';
import { SETTLEMENT_SWEEP, SETTLE_PAYMENT, WEBHOOK_EVENT, type SettlePaymentJob, type WebhookJob } from './rentals-money.queue';

/** Every minute: a prompt approved on a phone is noticed within a minute even when every other wake up is lost. */
const SWEEP_EVERY_MS = 60_000;

/**
 * The PaymentSettlement queue (blueprint 2.6; WP 1.6b), in the worker process
 * only: the minute sweep over pending payments, the delayed look at one
 * payment queued when the prompt went out, and a provider's callback. All
 * three end in the same guarded settle, so seeing one payment three times
 * writes it once.
 */
@Processor(QUEUES.paymentSettlement, { concurrency: 4 })
export class PaymentSettlementProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PaymentSettlementProcessor.name);

  constructor(
    @InjectQueue(QUEUES.paymentSettlement) private readonly queue: Queue,
    private readonly settlement: PaymentSettlementService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(SETTLEMENT_SWEEP, { every: SWEEP_EVERY_MS }, { name: SETTLEMENT_SWEEP });
    this.logger.log(`Scheduled ${SETTLEMENT_SWEEP} every ${SWEEP_EVERY_MS / 1000}s`);
  }

  async process(job: Job): Promise<void> {
    if (job.name === SETTLEMENT_SWEEP) {
      await this.settlement.sweep();
      return;
    }
    if (job.name === SETTLE_PAYMENT) {
      const { paymentId } = job.data as SettlePaymentJob;
      await this.settlement.sweepOne(paymentId);
      return;
    }
    if (job.name === WEBHOOK_EVENT) {
      await this.settlement.handleCallback((job.data as WebhookJob).event);
      return;
    }
    this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.paymentSettlement}`);
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.paymentSettlement, job, error);
  }
}
