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

  /**
   * BullMQ, as it behaves: an add under an id the queue still holds, in any
   * state, is ignored. A job that spent its attempts is held in `failed`
   * because we keep failures (`removeOnFail: false`).
   */
  function bullLikeQueue(initial: Record<string, string> = {}): {
    queue: Record<string, jest.Mock>;
    states: Map<string, string>;
  } {
    const states = new Map(Object.entries(initial));
    const queue = {
      add: jest.fn(async (_name: string, _data: unknown, opts: { jobId: string }) => {
        if (!states.has(opts.jobId)) states.set(opts.jobId, 'waiting');
      }),
      getJob: jest.fn(async (id: string) =>
        states.has(id)
          ? { getState: async () => states.get(id), remove: async () => void states.delete(id) }
          : undefined,
      ),
    };
    return { queue, states };
  }

  function drainingService(queue: Record<string, jest.Mock>): PaymentCompensationService {
    const due = [
      {
        kind: 'refund',
        idempotencyKey: job.idempotencyKey,
        workspaceId: job.workspaceId,
        originalRef: job.originalRef,
        amountRwf: job.amountRwf,
        bookingId: null,
        memo: job.memo,
      },
    ];
    const db = {
      select: jest.fn(() => ({
        from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => due }) }) }),
      })),
    };
    return new PaymentCompensationService(queue as unknown as Queue, db as unknown as Database);
  }

  it('runs again a job that spent its attempts: the drain removes the spent job before it adds (073 AC-25)', async () => {
    const id = queueJobId(job.idempotencyKey);
    const { queue, states } = bullLikeQueue({ [id]: 'failed' });

    const woken = await drainingService(queue).drain();

    expect(woken).toBe(1);
    expect(states.get(id)).toBe('waiting');
  });

  it('leaves a job that is still waiting or running alone: that is the deduplication working', async () => {
    const id = queueJobId(job.idempotencyKey);
    const { queue, states } = bullLikeQueue({ [id]: 'active' });

    await drainingService(queue).drain();

    expect(states.get(id)).toBe('active');
  });

  it('withdraws a cancelled job by the id it was queued under', async () => {
    const { service, queue } = build();

    await service.cancel(job.idempotencyKey);

    expect(queue.getJob).toHaveBeenCalledWith(queueJobId(job.idempotencyKey));
  });
});
