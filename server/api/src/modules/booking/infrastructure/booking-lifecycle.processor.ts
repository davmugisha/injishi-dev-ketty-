import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import { BookingLifecycleService } from '../application/booking-lifecycle.service';
import { PaymentAttemptService } from '../application/payment-attempt.service';

/** The single job name this processor handles on the BookingLifecycle queue. */
export const EXPIRE_STALE_REQUESTS = 'expire-stale-requests';

/**
 * How often the auto-decline sweep runs. The window it enforces is 24h/check-in,
 * so a 5-minute cadence bounds how long an expired request keeps its hold. The
 * sweep is idempotent, so a tighter cadence would be safe too.
 */
const SWEEP_EVERY_MS = 5 * 60_000;

/**
 * First processor on the BookingLifecycle queue (QUEUES.bookingLifecycle).
 *
 * Registered only in the worker process (see BookingModule), so the HTTP process
 * never consumes jobs. On boot it upserts a repeatable job scheduler — idempotent
 * by scheduler id — that fires the auto-decline sweep on a fixed interval.
 */
@Processor(QUEUES.bookingLifecycle)
export class BookingLifecycleProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(BookingLifecycleProcessor.name);

  constructor(
    @InjectQueue(QUEUES.bookingLifecycle) private readonly queue: Queue,
    private readonly lifecycle: BookingLifecycleService,
    private readonly attempts: PaymentAttemptService,
  ) {
    super();
  }

  /**
   * Upsert the repeatable sweep. `upsertJobScheduler` is idempotent by its
   * scheduler id, so restarts and multiple worker replicas converge on one
   * schedule rather than stacking duplicates.
   */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      EXPIRE_STALE_REQUESTS,
      { every: SWEEP_EVERY_MS },
      { name: EXPIRE_STALE_REQUESTS },
    );
    this.logger.log(
      `Scheduled ${EXPIRE_STALE_REQUESTS} every ${SWEEP_EVERY_MS / 60_000}m`,
    );
  }

  async process(job: Job): Promise<void> {
    if (job.name !== EXPIRE_STALE_REQUESTS) {
      this.logger.warn(
        `Ignoring unknown job "${job.name}" on ${QUEUES.bookingLifecycle}`,
      );
      return;
    }

    const now = new Date();

    /*
     * Two things expire on this sweep, and they are different clocks.
     *
     * A request-to-book HOLD expires after 24 hours because a host never
     * answered. A payment PROMPT expires after three minutes because a guest
     * never approved it on their handset (ADR-047 D-j). They share a sweep
     * because they share a shape — money held for an answer nobody gave — and
     * separating them would mean a second scheduler for the shorter one.
     *
     * The prompts go first. They are the newer money and the shorter window, so
     * a backlog of holds must not delay giving somebody their francs back.
     */
    await this.attempts.expireStale(now);
    await this.lifecycle.expireStaleRequests(now);
  }
}
