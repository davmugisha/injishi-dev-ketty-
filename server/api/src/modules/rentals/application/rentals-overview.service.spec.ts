import { NotFoundException } from '@nestjs/common';
import type { RentalsSetupView } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { attentionItems, buildingIdsOf } from '../domain/attention';
import type { RentalsOverviewRepository } from '../infrastructure/rentals-overview.repository';
import { RentalsOverviewService } from './rentals-overview.service';
import type { RentalsProfileService } from './rentals-profile.service';

const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';

const residence = (branchScope: Record<string, unknown> = {}): ScopedWorkspace =>
  ({
    workspaceId: WS,
    kind: 'business',
    orgId: ORG,
    domain: 'residence',
    orgRole: 'owner',
    registrationStatus: 'active',
    permissions: ['money.view'],
    branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true, ...branchScope },
  }) as unknown as ScopedWorkspace;

// 2026-10-24 12:00 in Kigali.
const NOW = new Date('2026-10-24T10:00:00Z');

function setupView(done: Record<string, boolean>): RentalsSetupView {
  const steps = (['location', 'units', 'getting_paid', 'lease_defaults', 'signatory'] as const).map((step) => ({
    step,
    done: done[step] ?? false,
    detail: '',
  }));
  const next = steps.find((s) => !s.done)?.step ?? null;
  return { steps, next, complete: next === null, setupCompletedAt: null };
}

// The doubles' types are what the test reads back; they are inferred.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: { setup?: Record<string, boolean> } = {}) {
  const reads = {
    unitCounts: jest.fn(async () => ({ units: 10, occupied: 6, reserved: 1, vacant: 2, offMarket: 1 })),
    buildingCount: jest.fn(async () => 2),
    liveTenants: jest.fn(async () => 5),
    leaseStatusCounts: jest.fn(async () => ({ draft: 2, pending_signature: 1, signed: 1, active: 5, ending: 1, ended: 3 })),
    overdue: jest.fn(async () => ({ charges: 3, leases: 2, amountRwf: 450_000 })),
    expectedByMonth: jest.fn(async () => [
      { month: '2026-09', amountRwf: 1_000_000 },
      { month: '2026-10', amountRwf: 1_200_000 },
    ]),
    collectedByMonth: jest.fn(async () => [
      { month: '2026-09', amountRwf: 800_000 },
      { month: '2026-10', amountRwf: 1_000_000 },
    ]),
    spentByMonth: jest.fn(async () => [{ month: '2026-10', amountRwf: 150_000 }]),
    noticesToAcknowledge: jest.fn(async () => 1),
    filingsDue: jest.fn(async () => ({ due: 2, late: 1 })),
  };
  const profiles = { setup: jest.fn(async () => setupView(opts.setup ?? {})) };
  const service = new RentalsOverviewService(
    reads as unknown as RentalsOverviewRepository,
    profiles as unknown as RentalsProfileService,
  );
  return { service, reads, profiles };
}

describe('RentalsOverviewService: the landlord home', () => {
  it('a hotel is answered 404, before anything is read', async () => {
    const h = harness();
    const hotel = { ...residence(), domain: 'hospitality' } as unknown as ScopedWorkspace;
    await expect(h.service.summary(hotel)).rejects.toBeInstanceOf(NotFoundException);
    await expect(h.service.overview(hotel)).rejects.toBeInstanceOf(NotFoundException);
    expect(h.reads.unitCounts).not.toHaveBeenCalled();
  });

  it('the summary counts leases by tab and lists what needs attention', async () => {
    const h = harness({ setup: { location: true, units: true } });
    const s = await h.service.summary(residence(), NOW);
    expect(s.counts).toEqual({
      units: 10,
      vacantUnits: 2,
      leasesToSign: 2,
      waitingForTenant: 1,
      readyToStart: 1,
      liveLeases: 6,
      overdueCharges: 3,
      overdueRwf: 450_000,
      noticesToAcknowledge: 1,
      filingsDue: 2,
      filingsLate: 1,
    });
    expect(s.setup).toEqual({ complete: false, done: 2, total: 5, next: 'getting_paid' });
    expect(s.hasPayoutAccount).toBe(false);
    expect(s.attention.map((a) => a.kind)).toEqual([
      'setup_incomplete',
      'no_payout_account',
      'overdue_rent',
      'filings_due',
      'leases_to_sign',
      'ready_to_start',
      'notices_to_acknowledge',
      'waiting_for_tenant',
    ]);
    expect(h.reads.overdue).toHaveBeenCalledWith(WS, null, '2026-10-24');
  });

  it('the overview gives this month against last, a year of months and the occupancy', async () => {
    const h = harness();
    const o = await h.service.overview(residence(), NOW);
    expect(o.month).toBe('2026-10');
    expect(o.months).toHaveLength(12);
    expect(o.months[0]).toEqual({ month: '2025-11', expectedRwf: 0, collectedRwf: 0, spentRwf: 0 });
    expect(o.months[11]).toEqual({
      month: '2026-10',
      expectedRwf: 1_200_000,
      collectedRwf: 1_000_000,
      spentRwf: 150_000,
    });
    expect(o.rent).toEqual({
      expectedThisMonthRwf: 1_200_000,
      collectedThisMonthRwf: 1_000_000,
      expectedLastMonthRwf: 1_000_000,
      collectedLastMonthRwf: 800_000,
      collectedChangePercent: 25,
    });
    // 6 occupied of 9 let or lettable (the off market unit does not count).
    expect(o.occupancyPercent).toBe(66.7);
    expect(o).toMatchObject({ properties: 2, units: 10, occupiedUnits: 6, vacantUnits: 2, reservedUnits: 1, tenants: 5 });
    expect(o.overdue).toEqual({ amountRwf: 450_000, charges: 3, leases: 2 });
    expect(h.reads.expectedByMonth).toHaveBeenCalledWith(WS, null, '2025-11-01', '2026-10-31');
  });

  it('a person limited to one building reads that building only', async () => {
    const h = harness();
    await h.service.overview(residence({ coverage: 'limited', propertyIds: [PROPERTY] }), NOW);
    expect(h.reads.unitCounts).toHaveBeenCalledWith(WS, [PROPERTY]);
    expect(buildingIdsOf(residence({ selectedPropertyId: PROPERTY }).branchScope)).toEqual([PROPERTY]);
  });

  it('with no units the occupancy is unknown, not 0%', async () => {
    const h = harness();
    h.reads.unitCounts.mockResolvedValueOnce({ units: 0, occupied: 0, reserved: 0, vacant: 0, offMarket: 0 });
    h.reads.collectedByMonth.mockResolvedValueOnce([]);
    const o = await h.service.overview(residence(), NOW);
    expect(o.occupancyPercent).toBeNull();
    expect(o.rent.collectedChangePercent).toBeNull();
  });
});

describe('attentionItems', () => {
  const quiet = {
    units: 3,
    vacantUnits: 0,
    leasesToSign: 0,
    waitingForTenant: 0,
    readyToStart: 0,
    liveLeases: 3,
    overdueCharges: 0,
    overdueRwf: 0,
    noticesToAcknowledge: 0,
    filingsDue: 0,
    filingsLate: 0,
  };

  it('is empty when nothing waits', () => {
    expect(attentionItems(quiet, { complete: true, done: 5, total: 5, next: null }, true)).toEqual([]);
  });

  it('words each line plainly, with the money where there is some', () => {
    const items = attentionItems(
      { ...quiet, overdueCharges: 1, overdueRwf: 250_000, leasesToSign: 1, filingsDue: 1 },
      { complete: true, done: 5, total: 5, next: null },
      true,
    );
    expect(items.map((i) => [i.title, i.tone, i.amountRwf])).toEqual([
      ['RWF 250,000 of rent is overdue', 'danger', 250_000],
      ['1 lease to file with RRA', 'warning', null],
      ['1 lease waits for your signature', 'warning', null],
    ]);
    for (const i of items) expect(i.title).not.toMatch(/—/);
  });
});
