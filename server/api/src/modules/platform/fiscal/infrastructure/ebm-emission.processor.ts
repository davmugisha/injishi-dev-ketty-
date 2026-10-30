import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { PLATFORM, type Platform } from '../../../../shared/config/platform';
import { QUEUES } from '../../../../shared/queues/queues.module';
import { EbmEmissionService } from '../application/ebm-emission.service';
import { EMIT_JOB, EbmSaleTrigger } from '../application/ebm-sale-trigger.service';
import { EBM_LIVE, type EbmLive } from '../domain/ebm-live';
import { EbmConnectionRepository } from './ebm-connection.repository';
import { EbmEmissionRepository } from './ebm-emission.repository';
import { reportJobFailure } from '../../../../shared/observability/report-job-failure';

export const EBM_DRAIN = 'ebm-drain';
const DRAIN_EVERY_MS = 60_000;
/** How long a dead OAuth consent row is kept before the drain deletes it. */
const STATE_RETENTION_MS = 24 * 60 * 60_000;

/**
 * The EBM worker (ADR-041). Registered only in the worker process and only in
 * live mode.
 *
 * One at a time. Certifying a sale is a single round trip and the backlog is
 * never large; serialising keeps two jobs from refreshing the same taxpayer's
 * rotating refresh token at once, and keeps the provider's per-taxpayer invoice
 * numbering in the order the sales were confirmed.
 *
 * The drain runs every minute and does two things, in this order:
 *
 * 1. RECONCILE — confirmed sales since `EBM_LIVE_SINCE` with no emission row
 *    get one. This is what makes "never silently skipped" (F-B13) true even
 *    when the request path died between confirming the booking and recording
 *    the sale.
 * 2. WAKE — every row due now gets a job for its current attempt.
 */
@Processor(QUEUES.ebmEmission, { concurrency: 1 })
export class EbmEmissionProcessor extends WorkerHost implements OnModuleInit {
  private readonly log = new Logger(EbmEmissionProcessor.name);

  constructor(
    @InjectQueue(QUEUES.ebmEmission) private readonly queue: Queue,
    private readonly emissions: EbmEmissionRepository,
    private readonly connections: EbmConnectionRepository,
    private readonly emitter: EbmEmissionService,
    private readonly trigger: EbmSaleTrigger,
    @Inject(EBM_LIVE) private readonly live: EbmLive | null,
    @Inject(PLATFORM)
    private readonly platform: Platform,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      EBM_DRAIN,
      { every: DRAIN_EVERY_MS },
      { name: EBM_DRAIN },
    );
  }

  async process(job: Job<{ emissionId?: string }>): Promise<void> {
    if (job.name === EBM_DRAIN) {
      await this.drain();
      return;
    }
    if (job.name === EMIT_JOB && job.data.emissionId) {
      const outcome = await this.emitter.emit(job.data.emissionId);
      if (outcome !== 'not_due') {
        this.log.log(`EBM emission ${job.data.emissionId}: ${outcome}`);
      }
      return;
    }
    this.log.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.ebmEmission}`);
  }

  private async drain(): Promise<void> {
    // A demo worker never sweeps: nothing in the demo database is a sale.
    if (!this.live || this.platform.environment === 'demo') return;

    const missing = await this.emissions.confirmedSalesWithoutEmission(
      this.live.config.liveSince,
    );
    for (const { bookingId } of missing) {
      const recorded = await this.trigger.record(bookingId);
      if (recorded?.created) {
        this.log.warn(
          `Reconcile: booking ${bookingId} was confirmed with no EBM sale recorded; recorded it now`,
        );
      }
    }

    const due = await this.emissions.findDue(new Date());
    let woken = 0;
    for (const row of due) {
      if (await this.trigger.wake(row.id, row.attempts)) woken += 1;
    }
    if (woken > 0) this.log.log(`EBM drain woke ${woken} sale(s)`);

    // Housekeeping, last: a failure here must not cost a sale its wake-up.
    try {
      await this.connections.pruneStates(new Date(Date.now() - STATE_RETENTION_MS));
    } catch (error) {
      this.log.warn(`EBM consent-state prune failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.ebmEmission, job, error);
  }
}
