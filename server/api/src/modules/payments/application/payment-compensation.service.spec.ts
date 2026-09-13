import type { Queue } from 'bullmq';

import type { Database } from '../../../shared/database/database.module';
import { queueJobId } from '../../../shared/queues/job-id';
import {
  PaymentCompensationService,
  type CompensationJob,
} from './payment-compensation.service';

/**
 * The table is the truth and the queue is the wake-up. The row is written
 * before the job is queued, and the job carries the idempotency key as its id,
 * so a compensation enqueued twice is one row and one job.
 *
 * This spec used to prove the job followed the request's environment onto the
 * demo or the production queue. A process has one environment and one Redis
 * now (ADR-043), so the queue is simply the injected one.
 */
describe('PaymentCompensationService', () => {
  const job: CompensationJob = {
    kind: 'refund',
    idempotencyKey: 'refund:ws-1:booking:tok',
    workspaceId: 'ws-1',
    originalRef: 'mock_capture_ws-1:booking:tok',
    amountRwf: 246_000,
    memo: 'Guest cancelled inside the free window',
  };

  function build(): {
    service: PaymentCompensationService;
    queue: { add: jest.Mock; getJob: jest.Mock };
    order: string[];
  } {
    const order: string[] = [];
    const queue = {
      add: jest.fn(async () => {
        order.push('queued');
      }),
      getJob: jest.fn().mockResolvedValue(undefined),
    };
    const db = {
      insert: jest.fn(() => ({
        values: jest.fn(() => {
          order.push('recorded');
          return { onConflictDoNothing: jest.fn().mockResolvedValue(undefined) };
        }),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({ where: jest.fn().mockResolvedValue(undefined) })),
      })),
    };
    const service = new PaymentCompensationService(
      queue as unknown as Queue,
      db as unknown as Database,
    );
    return { service, queue, order };
  }

  it('records the compensation before it wakes the worker', async () => {
    const { service, queue, order } = build();

    await service.enqueue(job);

    expect(order).toEqual(['recorded', 'queued']);
    expect(queue.add).toHaveBeenCalledWith(
      job.kind,
      job,
      expect.objectContaining({ jobId: queueJobId(job.idempotencyKey) }),
    );
  });

  it('never hands BullMQ the raw four part key as a job id', async () => {
    const { service, queue } = build();

    await service.enqueue(job);

    const { jobId } = queue.add.mock.calls[0]![2] as { jobId: string };
    expect(jobId).not.toContain(':');
    expect(jobId).not.toBe(job.idempotencyKey);
  });

  it('withdraws a cancelled job by the id it was queued under', async () => {
    const { service, queue } = build();

    await service.cancel(job.idempotencyKey);

    expect(queue.getJob).toHaveBeenCalledWith(queueJobId(job.idempotencyKey));
  });
});
