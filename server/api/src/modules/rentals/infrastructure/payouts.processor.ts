import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { QUEUES } from '../../../shared/queues/queues.module';
import { PayoutsService } from '../application/payouts.service';
import { PAYOUTS_SWEEP, SEND_PAYOUT, type SendPayoutJob } from './rentals-money.queue';

/** Hourly: held payouts go out once an account exists; a queued one whose job was lost is sent. */
const SWEEP_EVERY_MS = 60 * 60_000;

/**
 * The Payouts queue (blueprint 2.6; WP 1.6b), in the worker process only.
 * `send-payout` is queued when a payment settles (one job per payout) and
 * backs off while the provider does not answer; a declined transfer fails the
 * payout for the landlord to retry and does not retry the job.
 */
@Processor(QUEUES.payouts, { concurrency: 2 })
export class PayoutsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PayoutsProcessor.name);

  constructor(
    @InjectQueue(QUEUES.payouts) private readonly queue: Queue,
    private readonly payouts: PayoutsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(PAYOUTS_SWEEP, { every: SWEEP_EVERY_MS }, { name: PAYOUTS_SWEEP });
    this.logger.log(`Scheduled ${PAYOUTS_SWEEP} every ${SWEEP_EVERY_MS / 60_000}m`);
  }

  async process(job: Job): Promise<void> {
    if (job.name === PAYOUTS_SWEEP) {
      await this.payouts.sweep();
      return;
    }
    if (job.name === SEND_PAYOUT) {
      await this.payouts.send((job.data as SendPayoutJob).payoutId);
      return;
    }
    this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.payouts}`);
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.payouts, job, error);
  }
}
