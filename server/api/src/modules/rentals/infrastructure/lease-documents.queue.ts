import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { queueJobId } from '../../../shared/queues/job-id';
import { QUEUES } from '../../../shared/queues/queues.module';

/** The job that makes, keeps and sends one version's signed copy. */
export const SIGNED_COPY_JOB = 'signed-copy';
/** The scheduler's job: versions whose copy job was lost. */
export const LEASE_DOCUMENTS_SWEEP = 'lease-documents-sweep';

export interface SignedCopyJob {
  leaseId: string;
  versionId: string;
}

/** One job per version: queued twice, BullMQ keeps one. */
export function signedCopyJobId(versionId: string): string {
  return queueJobId(`lease-documents:signed-copy:${versionId}`);
}

/**
 * Queues the LeaseDocuments job from the request that made the second
 * signature (blueprint 2.6). Never throws: Redis being down must not undo a
 * signature. The worker's sweep finds a version whose job was never queued.
 */
@Injectable()
export class LeaseDocumentsQueue {
  private readonly log = new Logger(LeaseDocumentsQueue.name);

  constructor(@InjectQueue(QUEUES.leaseDocuments) private readonly queue: Queue) {}

  async signedCopy(job: SignedCopyJob): Promise<boolean> {
    try {
      await this.queue.add(SIGNED_COPY_JOB, job, {
        jobId: signedCopyJobId(job.versionId),
        attempts: 6,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: 500,
      });
      return true;
    } catch (cause) {
      this.log.error(
        `Could not queue the signed copy of lease ${job.leaseId} (version ${job.versionId}): ${
          cause instanceof Error ? cause.message : 'queue unavailable'
        }. The sweep makes it later.`,
      );
      return false;
    }
  }
}
