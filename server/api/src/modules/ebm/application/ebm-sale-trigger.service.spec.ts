import type { Queue } from 'bullmq';

import type { EbmLive } from '../domain/ebm-live';
import type {
  BookingForReceipt,
  EbmBookingRepository,
} from '../infrastructure/ebm-booking.repository';
import type { EbmEmissionRepository } from '../infrastructure/ebm-emission.repository';
import {
  EMIT_JOB,
  EbmSaleTrigger,
  emissionKeyFor,
  emitJobId,
} from './ebm-sale-trigger.service';

/**
 * The trigger is where a confirmed sale enters the pipeline. It must record the
 * sale exactly once however many times it is called, must never fail the
 * booking that called it, and must do nothing at all in mock mode.
 */
describe('EbmSaleTrigger', () => {
  const BOOKING = 'b0000000-0000-0000-0000-000000000001';
  const ORG = '44444444-4444-4444-4444-444444444444';

  interface Harness {
    trigger: EbmSaleTrigger;
    table: Map<string, { id: string; bookingId: string; orgId: string; tin: string | null }>;
    emissions: { insertHeld: jest.Mock };
    add: jest.Mock;
  }

  function harness(
    opts: {
      live?: boolean;
      orgId?: string | null;
      queueFails?: boolean;
      insertFails?: boolean;
      environment?: 'production' | 'demo';
    } = {},
  ): Harness {
    /** A table keyed by idempotency key, like the real unique constraint. */
    const table = new Map<string, { id: string; bookingId: string; orgId: string; tin: string | null }>();
    const emissions = {
      insertHeld: jest.fn(async (input: { bookingId: string; orgId: string; tin: string | null; idempotencyKey: string }) => {
        if (opts.insertFails) throw new Error('db down');
        const existing = table.get(input.idempotencyKey);
        if (existing) return { id: existing.id, created: false };
        const id = `e-${table.size + 1}`;
        table.set(input.idempotencyKey, { id, bookingId: input.bookingId, orgId: input.orgId, tin: input.tin });
        return { id, created: true };
      }),
    };
    const bookings = {
      findForEmission: jest.fn(async () =>
        ({ orgId: opts.orgId === undefined ? ORG : opts.orgId, sellerTin: '102938475' }) as BookingForReceipt,
      ),
    };
    const add = jest.fn(async () => {
      if (opts.queueFails) throw new Error('redis down');
      return {};
    });
    const trigger = new EbmSaleTrigger(
      emissions as unknown as EbmEmissionRepository,
      bookings as unknown as EbmBookingRepository,
      { add } as unknown as Queue,
      { environment: opts.environment ?? 'production', sampleData: false },
      opts.live === false ? null : ({} as EbmLive),
    );
    return { trigger, table, emissions, add };
  }

  it('writes one held emission for a captured booking', async () => {
    const h = harness();
    await h.trigger.saleConfirmed(BOOKING);

    expect(h.table.size).toBe(1);
    const row = h.table.get(emissionKeyFor(BOOKING))!;
    expect(row).toMatchObject({ bookingId: BOOKING, orgId: ORG, tin: '102938475' });
    // And wakes the worker for attempt 0, with no BullMQ-side retries.
    expect(h.add).toHaveBeenCalledWith(EMIT_JOB, { emissionId: row.id }, expect.objectContaining({
      jobId: emitJobId(row.id, 0),
      attempts: 1,
    }));
  });

  it('writes nothing twice for the same booking', async () => {
    const h = harness();
    await h.trigger.saleConfirmed(BOOKING);
    await h.trigger.saleConfirmed(BOOKING);
    await h.trigger.saleConfirmed(BOOKING);

    expect(h.table.size).toBe(1);
    // The second and third calls found the row and did not wake it again: the
    // first wake-up, or the drain, owns it.
    expect(h.add).toHaveBeenCalledTimes(1);
  });

  it('keys the sale by booking and receipt type', () => {
    expect(emissionKeyFor(BOOKING)).toBe(`ebm:booking:${BOOKING}:NS`);
  });

  it('gives each attempt its own job id, so a finished job cannot swallow a retry', () => {
    expect(emitJobId('e-1', 0)).not.toBe(emitJobId('e-1', 1));
  });

  it('makes job ids BullMQ accepts: no colon, not an integer', () => {
    // BullMQ 5 throws "Custom Id cannot contain :" on add; the fake queue in
    // this spec would not, so the rule is pinned on the id itself.
    const id = emitJobId('e0000000-0000-0000-0000-000000000001', 3);
    expect(id).not.toContain(':');
    expect(Number.isInteger(Number(id))).toBe(false);
  });

  it('records nothing in mock mode', async () => {
    const h = harness({ live: false });
    await h.trigger.saleConfirmed(BOOKING);
    expect(h.emissions.insertHeld).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
  });

  it('records nothing from the demo environment, even in live mode', async () => {
    const h = harness({ environment: 'demo' });
    await h.trigger.saleConfirmed(BOOKING);
    expect(await h.trigger.record(BOOKING)).toBeNull();
    expect(h.emissions.insertHeld).not.toHaveBeenCalled();
    expect(h.add).not.toHaveBeenCalled();
  });

  it('records nothing for a booking with no business behind it', async () => {
    const h = harness({ orgId: null });
    await h.trigger.saleConfirmed(BOOKING);
    expect(h.table.size).toBe(0);
  });

  it('never throws into the booking, even when the database or the queue is down', async () => {
    await expect(harness({ insertFails: true }).trigger.saleConfirmed(BOOKING)).resolves.toBeUndefined();
    const redisDown = harness({ queueFails: true });
    await expect(redisDown.trigger.saleConfirmed(BOOKING)).resolves.toBeUndefined();
    // The row is still written: the drain picks it up.
    expect(redisDown.table.size).toBe(1);
  });
});
