import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, OnModuleInit } from '@nestjs/common';
import { DelayedError, type Job, type Queue } from 'bullmq';

import {
  COMPENSATION_JOBS,
  PaymentCompensationService,
  type CompensationJob,
} from '../../payments/application/payment-compensation.service';
import { captureKeyOfVoid } from '../../payments/domain/keys';
import {
  PAYMENT_PORT,
  PaymentRateLimitedError,
  PaymentUnavailableError,
  type PaymentPort,
} from '../../payments/domain/payment-port';
import { QUEUES } from '../../../shared/queues/queues.module';
import { BookingRepository } from './booking.repository';
import { reportJobFailure } from '../../../shared/observability/report-job-failure';

export const DRAIN_OUTBOX = 'drain-outbox';
const DRAIN_EVERY_MS = 60_000;

/**
 * Chases money the request path could not settle (ADR-020 D-f, review 3.3).
 *
 * Four at a time (review 2.7): a backlog of refunds after a provider incident
 * should not drain one at a time behind a 10-second backoff. Every job marks
 * its row done on success and records the failure otherwise, so the table and
 * the queue never disagree for longer than one attempt.
 */
@Processor(QUEUES.paymentCompensation, { concurrency: 4 })
export class PaymentCompensationProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly log = new Logger(PaymentCompensationProcessor.name);

  constructor(
    @InjectQueue(QUEUES.paymentCompensation) private readonly queue: Queue,
    @Inject(PAYMENT_PORT) private readonly payments: PaymentPort,
    private readonly bookings: BookingRepository,
    private readonly compensations: PaymentCompensationService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // The drain: anything recorded but not woken (a queue outage at enqueue
    // time) is re-queued from the table once a minute.
    await this.queue.upsertJobScheduler(
      DRAIN_OUTBOX,
      { every: DRAIN_EVERY_MS },
      { name: DRAIN_OUTBOX },
    );
  }

  async process(job: Job<CompensationJob>, token?: string): Promise<void> {
    if (job.name === DRAIN_OUTBOX) {
      const woken = await this.compensations.drain();
      if (woken > 0) this.log.log(`Drain re-queued ${woken} compensation(s)`);
      return;
    }

    const data = job.data;
    try {
      switch (data.kind) {
        case COMPENSATION_JOBS.refund:
          await this.chaseRefund(data);
          break;
        case COMPENSATION_JOBS.voidPending:
          await this.chasePending(data);
          break;
        case COMPENSATION_JOBS.releaseEscrow:
          await this.chaseRelease(data);
          break;
        default:
          // Not thrown: an unknown name is a deploy-shape problem, and failing
          // it forever would keep a job nobody can handle at the head of the
          // queue.
          this.log.warn(
            `Ignoring unknown job "${job.name}" on ${QUEUES.paymentCompensation}`,
          );
          return;
      }
      await this.compensations.markDone(data.idempotencyKey);
    } catch (err) {
      if (err instanceof PaymentRateLimitedError && token) {
        // Wait exactly as long as the provider said (review 3.8), not the
        // generic backoff that would amplify the limit we just hit.
        const until = Date.now() + err.retryAfterMs;
        await this.compensations.markFailed(
          data.idempotencyKey,
          err.message,
          new Date(until),
        );
        await job.moveToDelayed(until, token);
        throw new DelayedError();
      }
      await this.compensations.markFailed(
        data.idempotencyKey,
        err instanceof Error ? err.message : String(err),
        new Date(Date.now() + 60_000),
      );
      throw err;
    }
  }

  private async chaseRefund(
    data: Extract<CompensationJob, { kind: 'refund' }>,
  ): Promise<void> {
    await this.payments.refund({
      kind: 'refund',
      idempotencyKey: data.idempotencyKey,
      originalRef: data.originalRef,
      amountRwf: data.amountRwf,
      currency: 'RWF',
      workspaceId: data.workspaceId,
      memo: data.memo,
    });
    this.log.log(
      `Compensating refund landed on key ${data.idempotencyKey} (ref ${data.originalRef})`,
    );
  }

  private async chasePending(
    data: Extract<CompensationJob, { kind: 'void-pending' }>,
  ): Promise<void> {
    // THE REFEREE (review 3.2). The guest was told to retry, and may have: if
    // an escrow row now stands on this capture, a booking is backed by the
    // money and it must not go back. The table decides, not the timing.
    const captureKey = captureKeyOfVoid(data.idempotencyKey);
    if (captureKey && (await this.bookings.escrowExistsForCaptureKey(captureKey))) {
      this.log.log(
        `Capture ${data.originalRef} was claimed by a booking after settling; nothing to void or refund`,
      );
      return;
    }

    try {
      await this.payments.voidPending({
        kind: 'void_pending',
        idempotencyKey: data.idempotencyKey,
        originalRef: data.originalRef,
        amountRwf: data.amountRwf,
        currency: 'RWF',
        workspaceId: data.workspaceId,
        memo: data.memo,
      });
      this.log.log(
        `Voided unsettled capture ${data.originalRef} on key ${data.idempotencyKey}`,
      );
      return;
    } catch (err) {
      if (!(err instanceof PaymentUnavailableError)) throw err;
      // The provider cannot void, or could not be asked. Fall through and read.
    }

    const current = await this.payments.fetchTransaction(
      data.workspaceId,
      data.originalRef,
    );
    if (!current) {
      this.log.log(
        `Unsettled capture ${data.originalRef} does not exist at the provider; nothing to chase`,
      );
      return;
    }
    if (current.settlement === 'pending') {
      // Still out on a handset. Throwing puts it back on the backoff rather
      // than refunding money that has not arrived.
      throw new PaymentUnavailableError(
        `Capture ${data.originalRef} has still not settled`,
        data.idempotencyKey,
      );
    }

    // It settled after the refusal. Check the referee once more — the retry
    // may have landed while we were asking — then return the money.
    if (captureKey && (await this.bookings.escrowExistsForCaptureKey(captureKey))) {
      this.log.log(
        `Capture ${data.originalRef} settled and was then claimed by a booking; nothing to refund`,
      );
      return;
    }
    await this.payments.refund({
      kind: 'refund',
      idempotencyKey: `refund:${data.idempotencyKey}`,
      originalRef: data.originalRef,
      amountRwf: current.amountRwf,
      currency: 'RWF',
      workspaceId: data.workspaceId,
      memo: `${data.memo} (settled after refusal)`,
    });
    this.log.log(
      `Refunded late-settling capture ${data.originalRef} on key refund:${data.idempotencyKey}`,
    );
  }

  private async chaseRelease(
    data: Extract<CompensationJob, { kind: 'release-escrow' }>,
  ): Promise<void> {
    await this.payments.releaseEscrow({
      kind: 'escrow_release',
      beneficiary: 'guest',
      idempotencyKey: data.idempotencyKey,
      originalRef: data.originalRef,
      amountRwf: data.amountRwf,
      currency: 'RWF',
      workspaceId: data.workspaceId,
      memo: data.memo,
    });
    const recorded = await this.bookings.recordExpiredDeclines([data.bookingId]);
    this.log.log(
      recorded.length > 0
        ? `Released and declined ${recorded[0]?.reference} on key ${data.idempotencyKey}`
        : `Released ${data.originalRef}; booking ${data.bookingId} was already resolved`,
    );
  }

  /** A job failing its last attempt is reported (ADR-063 AC-12). Earlier attempts are retries. */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error): void {
    reportJobFailure(QUEUES.paymentCompensation, job, error);
  }
}
