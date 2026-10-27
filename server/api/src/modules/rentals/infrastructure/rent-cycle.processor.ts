import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { QUEUES } from '../../../shared/queues/queues.module';
import { RentCycleService } from '../application/rent-cycle.service';

/** The single job name this processor handles on the RentCycle queue. */
export const RENT_CYCLE_JOB = 'rent-cycle';

/**
 * Hourly, for the reason the night audit gives: a once a day job that misses
 * its window skips a day silently, and this one is idempotent per lease per
 * period, so running it often costs nothing and cannot charge twice.
 */
const EVERY_MS = 60 * 60_000;

/** The RentCycle queue (blueprint 2.6; WP 1.6a), in the worker process only. */
@Processor(QUEUES.rentCycle)
export class RentCycleProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(RentCycleProcessor.name);

  constructor(
    @InjectQueue(QUEUES.rentCycle) private readonly queue: Queue,
    private readonly cycle: RentCycleService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(RENT_CYCLE_JOB, { every: EVERY_MS }, { name: RENT_CYCLE_JOB });
    this.logger.log(`Scheduled ${RENT_CYCLE_JOB} every ${EVERY_MS / 60_000}m`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== RENT_CYCLE_JOB) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.rentCycle}`);
      return;
    }
    await this.cycle.run();
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.rentCycle, job, error);
  }
}
