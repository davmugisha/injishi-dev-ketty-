import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { QUEUES } from '../../../shared/queues/queues.module';
import { BookingLifecycleService } from '../application/booking-lifecycle.service';
import { PaymentAttemptService } from '../application/payment-attempt.service';
import { DeskReservationService } from '../application/desk-reservation.service';
import { reportJobFailure } from '../../../shared/observability/report-job-failure';

/** The request-to-book auto-decline sweep on the BookingLifecycle queue. */
export const EXPIRE_STALE_REQUESTS = 'expire-stale-requests';

/** The payment prompt sweep, on its own faster schedule. */
export const SWEEP_PAYMENT_ATTEMPTS = 'sweep-payment-attempts';

/**
 * How often the auto-decline sweep runs. The window it enforces is 24h/check-in,
 * so a 5-minute cadence bounds how long an expired request keeps its hold. The
 * sweep is idempotent, so a tighter cadence would be safe too.
 */
const SWEEP_EVERY_MS = 5 * 60_000;

/**
 * How often waiting payment prompts are resolved. A minute, not five: this is
 * what hands a guest who approved and then closed the tab their booking, and
 * what ends a dead prompt promptly (booking audit, 2026-09-13).
 */
const PAYMENT_SWEEP_EVERY_MS = 60_000;

/**
 * First processor on the BookingLifecycle queue (QUEUES.bookingLifecycle).
 *
 * Registered only in the worker process (see BookingModule), so the HTTP process
 * never consumes jobs. On boot it upserts two repeatable job schedulers —
 * idempotent by scheduler id — one per sweep.
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
    /** Desk holds that ran out (0124) ride the same five-minute sweep. */
    private readonly desk: DeskReservationService,
  ) {
    super();
  }

  /**
   * Upsert the repeatable sweeps. `upsertJobScheduler` is idempotent by its
   * scheduler id, so restarts and multiple worker replicas converge on one
   * schedule each rather than stacking duplicates.
   */
  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      EXPIRE_STALE_REQUESTS,
      { every: SWEEP_EVERY_MS },
      { name: EXPIRE_STALE_REQUESTS },
    );
    await this.queue.upsertJobScheduler(
      SWEEP_PAYMENT_ATTEMPTS,
      { every: PAYMENT_SWEEP_EVERY_MS },
      { name: SWEEP_PAYMENT_ATTEMPTS },
    );
    this.logger.log(
      `Scheduled ${EXPIRE_STALE_REQUESTS} every ${SWEEP_EVERY_MS / 60_000}m and ` +
        `${SWEEP_PAYMENT_ATTEMPTS} every ${PAYMENT_SWEEP_EVERY_MS / 1_000}s`,
    );
  }

  async process(job: Job): Promise<void> {
    /*
     * Two things expire on this queue, and they are different clocks.
     *
     * A request-to-book HOLD expires after 24 hours because a host never
     * answered. A payment PROMPT expires after three minutes because a guest
     * never approved it on their handset (ADR-047 D-j), and that sweep also
     * completes the prompts that were approved with nobody left watching. They
     * share a queue because they share a shape, money held for an answer, and
     * run on separate schedules because their windows are so different.
     */
    if (job.name === SWEEP_PAYMENT_ATTEMPTS) {
      await this.attempts.sweep(new Date());
      return;
    }
    if (job.name === EXPIRE_STALE_REQUESTS) {
      await this.lifecycle.expireStaleRequests(new Date());
      await this.desk.releaseExpiredHolds(new Date());
      return;
    }
    this.logger.warn(
      `Ignoring unknown job "${job.name}" on ${QUEUES.bookingLifecycle}`,
    );
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.bookingLifecycle, job, error);
  }
}
