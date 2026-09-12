import type { Job, Queue } from 'bullmq';

import type { EbmEmissionService } from '../application/ebm-emission.service';
import { EMIT_JOB, type EbmSaleTrigger } from '../application/ebm-sale-trigger.service';
import type { EbmLive } from '../domain/ebm-live';
import type { EbmConnectionRepository } from './ebm-connection.repository';
import { EBM_DRAIN, EbmEmissionProcessor } from './ebm-emission.processor';
import type { EbmEmissionRepository } from './ebm-emission.repository';

/**
 * The drain is what makes "never silently skipped" true when the request path
 * failed: it finds confirmed sales with no row, then wakes everything due. It
 * must never run for the demo, and its housekeeping must never cost a sale.
 */
describe('EbmEmissionProcessor', () => {
  const LIVE_SINCE = new Date('2026-09-10T22:00:00.000Z');

  interface Harness {
    processor: EbmEmissionProcessor;
    emissions: { confirmedSalesWithoutEmission: jest.Mock; findDue: jest.Mock };
    connections: { pruneStates: jest.Mock };
    trigger: { record: jest.Mock; wake: jest.Mock };
    emitter: { emit: jest.Mock };
    order: string[];
  }

  function harness(opts: { environment?: 'production' | 'demo'; live?: boolean; pruneFails?: boolean } = {}): Harness {
    const order: string[] = [];
    const emissions = {
      confirmedSalesWithoutEmission: jest.fn(async () => {
        order.push('reconcile');
        return [{ bookingId: 'b-1' }, { bookingId: 'b-2' }];
      }),
      findDue: jest.fn(async () => {
        order.push('findDue');
        return [
          { id: 'e-1', attempts: 0 },
          { id: 'e-2', attempts: 3 },
        ];
      }),
    };
    const connections = {
      pruneStates: jest.fn(async () => {
        if (opts.pruneFails) throw new Error('prune broke');
        return 0;
      }),
    };
    const trigger = {
      record: jest.fn(async (bookingId: string) => ({ id: `row-${bookingId}`, created: bookingId === 'b-1' })),
      wake: jest.fn(async () => true),
    };
    const emitter = { emit: jest.fn(async () => 'emitted') };
    const live = opts.live === false ? null : ({ config: { liveSince: LIVE_SINCE } } as EbmLive);
    const processor = new EbmEmissionProcessor(
      { upsertJobScheduler: jest.fn() } as unknown as Queue,
      emissions as unknown as EbmEmissionRepository,
      connections as unknown as EbmConnectionRepository,
      emitter as unknown as EbmEmissionService,
      trigger as unknown as EbmSaleTrigger,
      live,
      { environment: opts.environment ?? 'production', sampleData: false },
    );
    return { processor, emissions, connections, trigger, emitter, order };
  }

  const drainJob = { name: EBM_DRAIN, data: {} } as Job<{ emissionId?: string }>;

  it('reconciles confirmed sales with no row before waking what is due', async () => {
    const h = harness();
    await h.processor.process(drainJob);

    expect(h.emissions.confirmedSalesWithoutEmission).toHaveBeenCalledWith(LIVE_SINCE);
    expect(h.trigger.record).toHaveBeenCalledWith('b-1');
    expect(h.trigger.record).toHaveBeenCalledWith('b-2');
    expect(h.order).toEqual(['reconcile', 'findDue']);
    // Each due row is woken for ITS current attempt.
    expect(h.trigger.wake).toHaveBeenCalledWith('e-1', 0);
    expect(h.trigger.wake).toHaveBeenCalledWith('e-2', 3);
    expect(h.connections.pruneStates).toHaveBeenCalledTimes(1);
  });

  it('sweeps nothing in the demo environment', async () => {
    const h = harness({ environment: 'demo' });
    await h.processor.process(drainJob);
    expect(h.emissions.confirmedSalesWithoutEmission).not.toHaveBeenCalled();
    expect(h.emissions.findDue).not.toHaveBeenCalled();
    expect(h.trigger.wake).not.toHaveBeenCalled();
  });

  it('does not fail the drain when the consent-state prune fails', async () => {
    const h = harness({ pruneFails: true });
    await expect(h.processor.process(drainJob)).resolves.toBeUndefined();
    expect(h.trigger.wake).toHaveBeenCalledTimes(2);
  });

  it('hands an emit job to the emission service', async () => {
    const h = harness();
    await h.processor.process({ name: EMIT_JOB, data: { emissionId: 'e-9' } } as Job<{ emissionId?: string }>);
    expect(h.emitter.emit).toHaveBeenCalledWith('e-9');
  });
});
