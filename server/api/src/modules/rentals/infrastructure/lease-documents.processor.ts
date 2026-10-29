import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';

import { reportJobFailure } from '../../../shared/observability/report-job-failure';
import { QUEUES } from '../../../shared/queues/queues.module';
import { LeaseDocumentsService } from '../application/lease-documents.service';
import { LEASE_DOCUMENTS_SWEEP, SIGNED_COPY_JOB, type SignedCopyJob } from './lease-documents.queue';

/** How often the sweep looks for signed versions whose copy job was lost. */
const SWEEP_EVERY_MS = 15 * 60_000;

/**
 * The LeaseDocuments queue (blueprint 2.6), in the worker process only.
 *
 * `signed-copy` is queued by the tenant's signature, one per version: it makes
 * the signed PDF with its audit trail page, keeps it under legal hold and
 * emails it to both sides. On boot a repeatable sweep is upserted (idempotent
 * by scheduler id, like the night audit), which finds a version whose job was
 * never queued. Both are safe to repeat: the version's `signed_copy_ready`
 * row records the copy and who was sent it.
 */
@Processor(QUEUES.leaseDocuments)
export class LeaseDocumentsProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(LeaseDocumentsProcessor.name);

  constructor(
    @InjectQueue(QUEUES.leaseDocuments) private readonly queue: Queue,
    private readonly documents: LeaseDocumentsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(LEASE_DOCUMENTS_SWEEP, { every: SWEEP_EVERY_MS }, { name: LEASE_DOCUMENTS_SWEEP });
    this.logger.log(`Scheduled ${LEASE_DOCUMENTS_SWEEP} every ${SWEEP_EVERY_MS / 60_000}m`);
  }

  async process(job: Job): Promise<void> {
    if (job.name === SIGNED_COPY_JOB) {
      await this.documents.deliverSignedCopy((job.data as SignedCopyJob).versionId);
      return;
    }
    if (job.name === LEASE_DOCUMENTS_SWEEP) {
      await this.documents.sweep();
      return;
    }
    this.logger.warn(`Ignoring unknown job "${job.name}" on ${QUEUES.leaseDocuments}`);
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.leaseDocuments, job, error);
  }
}
