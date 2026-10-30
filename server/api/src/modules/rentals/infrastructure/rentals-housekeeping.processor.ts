import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { QUEUES } from '../../../shared/queues/queues.module';
import { RentalsHousekeepingService } from '../application/rentals-housekeeping.service';

/** The single job name this processor handles on the RentalsHousekeeping queue. */
export const RENTALS_HOUSEKEEPING_JOB = 'rentals-housekeeping';

/** Hourly; the reminders themselves go out only between 08:00 and 18:00 Kigali. */
const EVERY_MS = 60 * 60_000;

/**
 * The RentalsHousekeeping queue (blueprint 2.6; WP 4.4), in the worker
 * process only: expired invitations and signing codes, lease filing
 * reminders, and the January rental income tax nudges.
 */
@Processor(QUEUES.rentalsHousekeeping)
export class RentalsHousekeepingProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(RentalsHousekeepingProcessor.name);

  constructor(
    @InjectQueue(QUEUES.rentalsHousekeeping) private readonly queue: Queue,
    private readonly housekeeping: RentalsHousekeepingService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(RENTALS_HOUSEKEEPING_JOB, { every: EVERY_MS }, { name: RENTALS_HOUSEKEEPING_JOB });
    this.logger.log(`Scheduled ${RENTALS_HOUSEKEEPING_JOB} every ${EVERY_MS / 60_000}m`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== RENTALS_HOUSEKEEPING_JOB) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.rentalsHousekeeping}`);
      return;
    }
    await this.housekeeping.run();
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.rentalsHousekeeping, job, error);
  }
}
