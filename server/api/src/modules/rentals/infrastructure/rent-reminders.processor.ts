import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { QUEUES } from '../../../shared/queues/queues.module';
import { RentRemindersService } from '../application/rent-reminders.service';

/** The single job name this processor handles on the RentReminders queue. */
export const RENT_REMINDERS_JOB = 'rent-reminders';

/** Hourly; the service itself sends only between 08:00 and 18:00 Kigali. */
const EVERY_MS = 60 * 60_000;

/** The RentReminders queue (blueprint 2.6; WP 1.6a), in the worker process only. */
@Processor(QUEUES.rentReminders)
export class RentRemindersProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(RentRemindersProcessor.name);

  constructor(
    @InjectQueue(QUEUES.rentReminders) private readonly queue: Queue,
    private readonly reminders: RentRemindersService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(RENT_REMINDERS_JOB, { every: EVERY_MS }, { name: RENT_REMINDERS_JOB });
    this.logger.log(`Scheduled ${RENT_REMINDERS_JOB} every ${EVERY_MS / 60_000}m`);
  }

  async process(job: Job): Promise<void> {
    if (job.name !== RENT_REMINDERS_JOB) {
      this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.rentReminders}`);
      return;
    }
    await this.reminders.run();
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.rentReminders, job, error);
  }
}
