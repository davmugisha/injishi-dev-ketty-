import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';

import { paymentCompensations } from '../../../database/drizzle/schema';
import { DRIZZLE, type Database } from '../../../shared/database/database.module';
import { QUEUES } from '../../../shared/queues/queues.module';

export type CompensationJob =
  | {
      kind: 'refund';
      idempotencyKey: string;
      workspaceId: string;
      originalRef: string;
      amountRwf: number;
      memo: string;
    }
  | {
      kind: 'void-pending';
      idempotencyKey: string;
      workspaceId: string;
      originalRef: string;
      amountRwf: number;
      memo: string;
    }
  | {
      kind: 'release-escrow';
      idempotencyKey: string;
      workspaceId: string;
      originalRef: string;
      amountRwf: number;
      bookingId: string;
      memo: string;
    };

export const COMPENSATION_JOBS = {
  refund: 'refund',
  voidPending: 'void-pending',
  releaseEscrow: 'release-escrow',
} as const;

const ATTEMPTS = 10;
const BACKOFF_MS = 10_000;

/**
 * Money that still has to move, and the record that it must (review 3.3).
 *
 * THE TABLE IS THE TRUTH; REDIS IS THE WAKE-UP. Every compensation is written
 * to `payment_compensations` before it is queued, so a queue outage — most
 * likely exactly when compensations spike — loses nothing but time. If the
 * queue refuses the job, the row still sits due, and the worker's one-minute
 * drain re-queues it. Nothing about a refund ever exists only in stdout.
 *
 * Idempotent on the key, both here and in the queue: a compensation enqueued
 * twice is one row and one job.
 *
 * The row and the job live in the same environment because the whole process
 * does: one database and one Redis per stack (ADR-043).
 */
@Injectable()
export class PaymentCompensationService {
  private readonly log = new Logger(PaymentCompensationService.name);

  constructor(
    @InjectQueue(QUEUES.paymentCompensation) private readonly queue: Queue,
    @Inject(DRIZZLE) private readonly db: Database,
  ) {}

  async enqueue(job: CompensationJob): Promise<void> {
    // 1. Durable first. A conflict on the key means it is already recorded,
    //    which is the answer we want, not an error.
    try {
      await this.db
        .insert(paymentCompensations)
        .values({
          kind: job.kind,
          idempotencyKey: job.idempotencyKey,
          workspaceId: job.workspaceId,
          originalRef: job.originalRef,
          amountRwf: job.amountRwf,
          bookingId: job.kind === 'release-escrow' ? job.bookingId : null,
          memo: job.memo,
        })
        .onConflictDoNothing({ target: paymentCompensations.idempotencyKey });
    } catch (err) {
      // The database refused a row that says money must move. That is the one
      // failure this design cannot absorb, and it is shouted, not swallowed.
      this.log.error(
        `UNRECORDED COMPENSATION: could not write ${job.kind} on key ` +
          `${job.idempotencyKey} (ref ${job.originalRef}, ${job.amountRwf} RWF, ` +
          `workspace ${job.workspaceId}). Replay the operation on that key.`,
        err instanceof Error ? err.stack : undefined,
      );
    }

    // 2. Then the wake-up. Failing here costs at most one drain interval.
    await this.wake(job);
  }

  /**
   * Withdraw a queued compensation that no longer applies (review 3.2): a
   * void for a capture that a booking now stands on. The row is marked done
   * with the reason, so the drain does not resurrect it.
   */
  async cancel(idempotencyKey: string): Promise<void> {
    await this.db
      .update(paymentCompensations)
      .set({
        doneAt: new Date(),
        lastError: 'cancelled: the capture was claimed by a booking',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentCompensations.idempotencyKey, idempotencyKey),
          isNull(paymentCompensations.doneAt),
        ),
      );
    try {
      const job = await this.queue.getJob(idempotencyKey);
      if (job) await job.remove();
    } catch {
      // Already running or already gone; the processor's escrow check is
      // the referee either way.
    }
  }

  /** The provider confirmed. Nothing left to chase on this key. */
  async markDone(idempotencyKey: string): Promise<void> {
    await this.db
      .update(paymentCompensations)
      .set({ doneAt: new Date(), lastError: null, updatedAt: new Date() })
      .where(eq(paymentCompensations.idempotencyKey, idempotencyKey));
  }

  /** The provider did not confirm; count it and push the next try out. */
  async markFailed(
    idempotencyKey: string,
    error: string,
    nextAt: Date,
  ): Promise<void> {
    await this.db
      .update(paymentCompensations)
      .set({
        attempts: sql`${paymentCompensations.attempts} + 1`,
        lastError: error.slice(0, 500),
        nextAt,
        updatedAt: new Date(),
      })
      .where(eq(paymentCompensations.idempotencyKey, idempotencyKey));
  }

  /**
   * Re-queue everything due and undone. Called by the worker's drain sweep;
   * safe to run at any frequency because the queue deduplicates on job id.
   */
  async drain(now: Date = new Date(), limit = 50): Promise<number> {
    const due = await this.db
      .select()
      .from(paymentCompensations)
      .where(
        and(
          isNull(paymentCompensations.doneAt),
          lte(paymentCompensations.nextAt, now),
        ),
      )
      .orderBy(paymentCompensations.nextAt)
      .limit(limit);

    let woken = 0;
    for (const row of due) {
      const job = rowToJob(row);
      if (!job) continue;
      if (await this.wake(job)) woken += 1;
    }
    return woken;
  }

  private async wake(job: CompensationJob): Promise<boolean> {
    try {
      await this.queue.add(job.kind, job, {
        jobId: job.idempotencyKey,
        attempts: ATTEMPTS,
        backoff: { type: 'exponential', delay: BACKOFF_MS },
        removeOnComplete: false,
        removeOnFail: false,
      });
      this.log.log(
        `Queued ${job.kind} compensation on key ${job.idempotencyKey} ` +
          `(ref ${job.originalRef}, ${job.amountRwf} RWF, workspace ${job.workspaceId})`,
      );
      return true;
    } catch (err) {
      this.log.warn(
        `Could not wake ${job.kind} on key ${job.idempotencyKey}; the row is ` +
          'recorded and the drain will retry. ' +
          (err instanceof Error ? err.message : String(err)),
      );
      return false;
    }
  }
}

function rowToJob(
  row: typeof paymentCompensations.$inferSelect,
): CompensationJob | null {
  const base = {
    idempotencyKey: row.idempotencyKey,
    workspaceId: row.workspaceId,
    originalRef: row.originalRef,
    amountRwf: row.amountRwf,
    memo: row.memo,
  };
  switch (row.kind) {
    case COMPENSATION_JOBS.refund:
      return { kind: 'refund', ...base };
    case COMPENSATION_JOBS.voidPending:
      return { kind: 'void-pending', ...base };
    case COMPENSATION_JOBS.releaseEscrow:
      return row.bookingId
        ? { kind: 'release-escrow', bookingId: row.bookingId, ...base }
        : null;
    default:
      return null;
  }
}
