import type { Queue } from 'bullmq';

import type { EbmLive } from '../domain/ebm-live';
import type { SignPoint } from '../domain/sign-point';
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
    stamps: Map<string, SignPoint>;
    bookings: { stampSignPoint: jest.Mock };
  }

  function harness(
    opts: {
      live?: boolean;
      orgId?: string | null;
      queueFails?: boolean;
      insertFails?: boolean;
      environment?: 'production' | 'demo';
      signPoint?: SignPoint;
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
    /** What the booking row was stamped with, keyed by booking id. */
    const stamps = new Map<string, SignPoint>();
    const bookings = {
      findForEmission: jest.fn(async () =>
        ({ orgId: opts.orgId === undefined ? ORG : opts.orgId, sellerTin: '102938475' }) as BookingForReceipt,
      ),
      // Mirrors the real `IS NULL` guard: a booking keeps the rule it was
      // confirmed under, whatever the flag says later.
      stampSignPoint: jest.fn(async (id: string, point: SignPoint) => {
        if (!stamps.has(id)) stamps.set(id, point);
      }),
      signPointFor: jest.fn(async (id: string): Promise<SignPoint> => stamps.get(id) ?? 'booking'),
    };
    const add = jest.fn(async () => {
      if (opts.queueFails) throw new Error('redis down');
      return {};
    });
    const trigger = new EbmSaleTrigger(
      emissions as unknown as EbmEmissionRepository,
      bookings as unknown as EbmBookingRepository,
      { add } as unknown as Queue,
      { environment: opts.environment ?? 'production', sampleData: false, commit: null },
      opts.live === false ? null : ({} as EbmLive),
      opts.signPoint ?? 'booking',
    );
    return { trigger, table, emissions, add, stamps, bookings };
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

  /**
   * ADR-050 D-a. The sign point is read ONCE, at confirmation, and stamped onto
   * the booking, because reading the flag again at close is how a booking ends
   * up with money taken and nothing declared.
   */
  describe('the sign point (ADR-050 D-a)', () => {
    it('stamps the booking with the rule it was confirmed under', async () => {
      const h = harness({ signPoint: 'checkout' });
      await h.trigger.saleConfirmed(BOOKING);
      expect(h.stamps.get(BOOKING)).toBe('checkout');
    });

    it('stamps in mock mode too, where nothing is declared at all', async () => {
      // The stamp records the RULE, not the declaration, so it is not the
      // adapter's business. A booking confirmed in mock and closed after a
      // switch to live still has to know which rule it was made under.
      const h = harness({ live: false, signPoint: 'checkout' });
      await h.trigger.saleConfirmed(BOOKING);
      expect(h.stamps.get(BOOKING)).toBe('checkout');
      expect(h.table.size).toBe(0);
    });

    it('raises a PROFORMA and never a sale when the rule is checkout (AC-1)', async () => {
      const h = harness({ signPoint: 'checkout' });
      await h.trigger.saleConfirmed(BOOKING);

      expect(h.table.has(emissionKeyFor(BOOKING, 'PS'))).toBe(true);
      expect(h.table.has(emissionKeyFor(BOOKING, 'NS'))).toBe(false);
      expect(h.emissions.insertHeld).toHaveBeenCalledWith(
        expect.objectContaining({ receiptType: 'proforma', source: 'booking' }),
      );
    });

    it('still raises the sale at confirmation under the old rule', async () => {
      const h = harness({ signPoint: 'booking' });
      await h.trigger.saleConfirmed(BOOKING);

      expect(h.table.has(emissionKeyFor(BOOKING, 'NS'))).toBe(true);
      expect(h.emissions.insertHeld).toHaveBeenCalledWith(
        expect.objectContaining({ receiptType: 'normal' }),
      );
    });

    it('keeps the first stamp when the flag is rolled back under it', async () => {
      // The rollback case the fiscal child names: a booking confirmed under
      // `checkout` must still sign its `NS` at close even after the flag flips
      // back, which only works because the rule travels with the booking.
      const h = harness({ signPoint: 'checkout' });
      await h.trigger.saleConfirmed(BOOKING);
      await h.bookings.stampSignPoint(BOOKING, 'booking');
      expect(h.stamps.get(BOOKING)).toBe('checkout');
    });

    it('lets the reconcile sweep raise the document the STAMP names, not the current flag', async () => {
      // Confirmed under `checkout`, first write lost, flag rolled back to
      // `booking` before the sweep ran. The sweep must still raise the `PS`.
      const h = harness({ signPoint: 'booking' });
      h.stamps.set(BOOKING, 'checkout');
      await h.trigger.record(BOOKING);
      expect(h.table.has(emissionKeyFor(BOOKING, 'PS'))).toBe(true);
      expect(h.table.has(emissionKeyFor(BOOKING, 'NS'))).toBe(false);
    });

    it('records the sale even when the booking could not be stamped', async () => {
      // A failed stamp must not swallow the declaration: the reconcile sweep
      // and the migration backfill both read `booking` for an absent stamp,
      // which is the answer that cannot declare a room twice.
      const h = harness();
      h.bookings.stampSignPoint.mockRejectedValueOnce(new Error('db down'));
      await expect(h.trigger.saleConfirmed(BOOKING)).resolves.toBeUndefined();
      expect(h.table.size).toBe(1);
    });
  });
});
