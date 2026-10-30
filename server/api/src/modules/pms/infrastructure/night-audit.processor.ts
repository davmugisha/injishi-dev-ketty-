import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import { NightAuditService } from '../application/night-audit.service';
import { reportJobFailure } from '../../../shared/observability/report-job-failure';

/** The single job name this processor handles on the NightAudit queue. */
export const POST_ROOM_CHARGES = 'post-room-charges';

/**
 * Hourly, not nightly, and the reason is worth writing down.
 *
 * A once-a-day schedule that misses its window (a deploy, a restart, a Redis
 * blip at 03:00) silently skips a night, and nobody finds out until a guest
 * checks out one night short. The job is idempotent per folio per night, so
 * running it twenty four times a day costs almost nothing and cannot double
 * charge: the unique index on `(folio_id, business_date)` refuses the second.
 */
const SWEEP_EVERY_MS = 60 * 60_000;

/**
 * The night audit (ADR-016 slice 3, AC-15).
 *
 * Registered only in the worker process, so the HTTP process serves requests
 * and never consumes jobs. On boot it upserts a repeatable scheduler, which is
 * idempotent by scheduler id, so restarts and several worker replicas converge
 * on one schedule rather than stacking duplicates.
 */
@Processor(QUEUES.nightAudit)
export class NightAuditProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(NightAuditProcessor.name);

  constructor(
    @InjectQueue(QUEUES.nightAudit) private readonly queue: Queue,
    private readonly nightAudit: NightAuditService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      POST_ROOM_CHARGES,
      { every: SWEEP_EVERY_MS },
      { name: POST_ROOM_CHARGES },
    );
    this.logger.log(
      `Scheduled ${POST_ROOM_CHARGES} every ${SWEEP_EVERY_MS / 60_000}m`,
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== POST_ROOM_CHARGES) {
      this.logger.warn(
        `Ignoring unknown job "${job.name}" on ${QUEUES.nightAudit}`,
      );
      return;
    }
    await this.nightAudit.postRoomCharges();
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.nightAudit, job, error);
  }
}
