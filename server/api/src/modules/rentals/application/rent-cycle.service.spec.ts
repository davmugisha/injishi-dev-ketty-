import { addDays } from '@injishi/contracts';

import type { LeaseChargesRepository } from '../infrastructure/lease-charges.repository';
import type { LeasePaymentsRepository } from '../infrastructure/lease-payments.repository';
import type { LeaseRow, LeasesRepository } from '../infrastructure/leases.repository';
import type { CycleLease, RentCycleRepository } from '../infrastructure/rent-cycle.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { LeaseLifecycleService } from './lease-lifecycle.service';
import { RentCycleService } from './rent-cycle.service';

/**
 * The RentCycle job with every collaborator doubled (WP 1.6a). Pinned here:
 * a charge is raised 7 days before it falls due and not before, a late run
 * catches up the months it missed, a repeat raises nothing, the tenant's
 * credit goes on what was raised, signed leases are started through the
 * lifecycle hook, an active lease moves to ending inside 30 days of its end
 * and not before, and a lease past its end is flagged, never ended.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const LEASE = '66666666-6666-4666-8666-666666666666';

const lease = (over: Partial<CycleLease> = {}): CycleLease => ({
  id: LEASE,
  workspaceId: WS,
  reference: 'L-0001',
  status: 'active',
  startDate: '2026-10-24',
  endDate: '2027-10-23',
  billingStartsOn: '2026-10-24',
  monthlyRentRwf: 350_000,
  rentDueDay: 5,
  ...over,
});

interface Opts {
  live?: CycleLease[];
  raised?: string[];
  credit?: { allocatedRwf: number; allocations: { chargeId: string; amountRwf: number }[] };
  dueToStart?: string[];
  nearEnd?: { id: string; workspaceId: string; reference: string; endDate: string }[];
  pastEnd?: { id: string; workspaceId: string; reference: string; endDate: string; status: string }[];
  row?: Partial<LeaseRow>;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: Opts = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const live = opts.live ?? [lease()];
  const raisedPeriods = new Set(opts.raised ?? []);
  const db = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb({}) };
  const cycle = {
    live: jest.fn(async () => live),
    activeEndingBy: jest.fn(async () => opts.nearEnd ?? []),
    pastEnd: jest.fn(async () => opts.pastEnd ?? []),
  };
  const row = { id: LEASE, workspaceId: WS, status: 'active', endDate: '2027-10-23', reference: 'L-0001', ...opts.row } as LeaseRow;
  const leases = {
    lock: jest.fn(async () => row),
    update: jest.fn(async (_tx: unknown, id: string, values: unknown) => record('updateLease')(id, values)),
  };
  const charges = {
    rentPeriodsRaised: jest.fn(async () => [...raisedPeriods]),
    raiseRent: jest.fn(async (_tx: unknown, input: { periodStart: string; dueOn: string; amountRwf: number }) => {
      record('raise')(input);
      if (raisedPeriods.has(input.periodStart)) return null;
      raisedPeriods.add(input.periodStart);
      return { id: `charge-${input.periodStart}`, kind: 'rent', periodEnd: null, ...input };
    }),
  };
  const payments = {
    applyCredit: jest.fn(async (_tx: unknown, input: { chargeIds: string[] }) => {
      record('credit')(input);
      return { allocations: [], allocatedRwf: 0, creditRwf: 0, paidChargeIds: [], depositPaid: false, ...(opts.credit ?? {}) };
    }),
  };
  const lifecycle = {
    leasesDueToStart: jest.fn(async () => opts.dueToStart ?? []),
    startOnSchedule: jest.fn(async (id: string) => (record('start')(id), true)),
  };
  const events = { write: jest.fn(async (_tx: unknown, e: unknown) => record('event')(e)) };
  const audit = { write: jest.fn(async (_tx: unknown, e: unknown) => record('audit')(e)) };
  const service = new RentCycleService(
    db as never,
    cycle as unknown as RentCycleRepository,
    leases as unknown as LeasesRepository,
    charges as unknown as LeaseChargesRepository,
    payments as unknown as LeasePaymentsRepository,
    lifecycle as unknown as LeaseLifecycleService,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
  );
  const kinds = (): string[] => (calls.event ?? []).map((c) => (c[0] as { kind: string }).kind);
  return { service, calls, kinds, charges, leases, lifecycle };
}

describe('RentCycleService', () => {
  describe('raising rent', () => {
    it('raises November 7 days before its due day, and not the day before', async () => {
      // November's rent falls due on the 5th: raised on 29 October, not on the 28th.
      const early = harness({ raised: ['2026-10-24'] });
      expect((await early.service.run('2026-10-28')).raised).toEqual([]);
      const onTime = harness({ raised: ['2026-10-24'] });
      const run = await onTime.service.run('2026-10-29');
      expect(run.raised).toEqual(['charge-2026-11-01']);
      expect(onTime.charges.raiseRent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ periodStart: '2026-11-01', periodEnd: '2026-11-30', dueOn: '2026-11-05', amountRwf: 350_000 }));
      expect(onTime.kinds()).toEqual(['charge_raised']);
    });

    it('catches up the months a late run missed, oldest first', async () => {
      const h = harness({ raised: ['2026-10-24'] });
      const run = await h.service.run('2027-01-10');
      expect(run.raised).toEqual(['charge-2026-11-01', 'charge-2026-12-01', 'charge-2027-01-01']);
    });

    it('raises nothing twice: a repeat run finds the periods already charged', async () => {
      const h = harness({ raised: ['2026-10-24'] });
      await h.service.run('2026-10-29');
      const again = await h.service.run('2026-10-29');
      expect(again.raised).toEqual([]);
      expect(h.kinds()).toEqual(['charge_raised']);
    });

    it('uses the tenant credit on what it raised and says so on the timeline', async () => {
      const h = harness({ raised: ['2026-10-24'], credit: { allocatedRwf: 100_000, allocations: [{ chargeId: 'charge-2026-11-01', amountRwf: 100_000 }] } });
      const run = await h.service.run('2026-10-29');
      expect(run.creditAppliedRwf).toBe(100_000);
      expect(h.calls.credit?.[0]?.[0]).toEqual(expect.objectContaining({ chargeIds: ['charge-2026-11-01'] }));
      expect(h.kinds()).toEqual(['charge_raised', 'payment_received']);
      expect(h.calls.event?.[1]?.[0]).toMatchObject({ kind: 'payment_received', actorRole: 'system', payload: expect.objectContaining({ fromCredit: true, allocatedRwf: 100_000 }) });
    });

    it('does not touch credit when nothing was raised', async () => {
      const h = harness({ raised: ['2026-10-24', '2026-11-01'] });
      await h.service.run('2026-11-01');
      expect(h.calls.credit).toBeUndefined();
    });

    it('leaves a lease alone that stopped being live between the look and the lock', async () => {
      const h = harness({ raised: ['2026-10-24'], row: { status: 'ended' } });
      const run = await h.service.run('2026-10-29');
      expect(run.raised).toEqual([]);
    });

    it('carries on past a lease that fails and reports it', async () => {
      const h = harness({ live: [lease({ id: 'bad', billingStartsOn: '1999-01-01' }), lease()], raised: ['2026-10-24'] });
      const run = await h.service.run('2026-10-29');
      expect(run.errors).toEqual([expect.objectContaining({ leaseId: 'bad', step: 'raise' })]);
      expect(run.raised).toEqual(['charge-2026-11-01']);
    });
  });

  describe('starting and ending', () => {
    it('starts the signed leases whose start date has come, through the lifecycle hook', async () => {
      const h = harness({ live: [], dueToStart: ['s-1', 's-2'] });
      const run = await h.service.run('2026-10-24');
      expect(run.started).toEqual(['s-1', 's-2']);
      expect(h.lifecycle.startOnSchedule).toHaveBeenCalledWith('s-1', '2026-10-24');
    });

    it('moves an active lease to ending inside 30 days of its end, with the timeline and audit', async () => {
      const h = harness({ live: [], nearEnd: [{ id: LEASE, workspaceId: WS, reference: 'L-0001', endDate: '2027-10-23' }], row: { endDate: '2027-10-23' } });
      const run = await h.service.run('2027-09-25');
      expect(run.ending).toEqual([LEASE]);
      expect(h.leases.update).toHaveBeenCalledWith(expect.anything(), LEASE, expect.objectContaining({ status: 'ending', endingSince: expect.any(Date) }));
      expect(h.kinds()).toEqual(['ending']);
      expect(h.calls.audit?.[0]?.[0]).toMatchObject({ eventType: 'lease.ending', diff: expect.objectContaining({ from: 'active', to: 'ending' }) });
    });

    it('does not move a lease whose end is further than 30 days, whatever the list said', async () => {
      const h = harness({ live: [], nearEnd: [{ id: LEASE, workspaceId: WS, reference: 'L-0001', endDate: '2027-10-23' }], row: { endDate: '2027-10-23' } });
      const run = await h.service.run('2027-08-01');
      expect(run.ending).toEqual([]);
      expect(h.leases.update).not.toHaveBeenCalled();
    });

    it('flags a lease past its end date and leaves its status alone', async () => {
      const h = harness({ live: [], pastEnd: [{ id: LEASE, workspaceId: WS, reference: 'L-0001', endDate: '2027-10-23', status: 'ending' }] });
      const run = await h.service.run('2027-10-30');
      expect(run.pastEnd).toEqual([{ leaseId: LEASE, reference: 'L-0001', endDate: '2027-10-23', status: 'ending' }]);
      expect(h.leases.update).not.toHaveBeenCalled();
    });

    it('answers the day it ran for', async () => {
      const h = harness({ live: [] });
      expect((await h.service.run(addDays('2026-10-24', 1))).today).toBe('2026-10-25');
    });
  });
});
