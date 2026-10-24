import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { RENTALS_QUEUES } from '../../../shared/queues/queues.module';
import { GuestHousekeepingService } from '../application/guest-housekeeping.service';
import { GuestRoutingService } from '../application/guest-routing.service';

export const GUEST_ROUTING_SWEEP = 'guest-routing-sweep';
export const GUEST_RETENTION_PURGE = 'guest-retention-purge';

/**
 * The guest jobs (P5, blueprint 2.6 `GuestRouting`), worker only.
 *
 * Hourly: deliver what waited for a leader, where the building's village was
 * set since or someone now holds the post (an appointment hands over at once;
 * this catches the rest). Daily at 03:00 Kigali: purge guest records 12 months
 * after departure, keeping counts. Both are guarded updates, so a rerun does
 * nothing twice.
 */
@Processor(RENTALS_QUEUES.guestRouting)
export class GuestRoutingProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(GuestRoutingProcessor.name);

  constructor(
    @InjectQueue(RENTALS_QUEUES.guestRouting) private readonly queue: Queue,
    private readonly routing: GuestRoutingService,
    private readonly housekeeping: GuestHousekeepingService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      GUEST_ROUTING_SWEEP,
      { pattern: '7 * * * *', tz: 'Africa/Kigali' },
      { name: GUEST_ROUTING_SWEEP },
    );
    await this.queue.upsertJobScheduler(
      GUEST_RETENTION_PURGE,
      { pattern: '0 3 * * *', tz: 'Africa/Kigali' },
      { name: GUEST_RETENTION_PURGE },
    );
    this.logger.log(`Scheduled ${GUEST_ROUTING_SWEEP} hourly and ${GUEST_RETENTION_PURGE} daily at 03:00 Africa/Kigali`);
  }

  async process(job: Job): Promise<void> {
    if (job.name === GUEST_ROUTING_SWEEP) {
      await this.routing.sweep();
      return;
    }
    if (job.name === GUEST_RETENTION_PURGE) {
      await this.housekeeping.purge();
      return;
    }
    this.logger.warn(`Ignoring unknown job "${job.name}" on ${RENTALS_QUEUES.guestRouting}`);
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(RENTALS_QUEUES.guestRouting, job, error);
  }
}
