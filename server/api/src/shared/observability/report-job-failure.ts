import type { Job } from 'bullmq';

import { reportException } from './error-reporter';

/**
 * A worker job failing its LAST attempt (ADR-063 AC-12), called from each
 * processor's `@OnWorkerEvent('failed')` listener.
 *
 * BullMQ emits `failed` after every failed attempt, and an attempt that will be
 * retried is not a fault yet: the retry is the design working. So only the
 * attempt that leaves the job failed for good is reported, with the queue and
 * the job's name. Never the job's data or id: data carries emails, names and
 * booking details, and an id is a thread back to a person.
 */
export function reportJobFailure(queue: string, job: Job | undefined, error: unknown): void {
  if (!job) return;
  const attempts = job.opts?.attempts ?? 1;
  if (job.attemptsMade < attempts) return;
  reportException(error, { queue, job: job.name, attemptsMade: job.attemptsMade });
}
