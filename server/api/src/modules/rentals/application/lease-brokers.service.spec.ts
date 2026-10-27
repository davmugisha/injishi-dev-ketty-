import { BrokerRatingRequest, brokerFeeAmount, brokerFeeWords, type BrokerFeeTerms } from '@injishi/contracts';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { LeaseBrokerRow, LeaseBrokersRepository, PlacementRow } from '../infrastructure/lease-brokers.repository';
import type { LeasesRepository } from '../infrastructure/leases.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import { LeaseBrokersService, type LeaseBrokerContext } from './lease-brokers.service';

/**
 * The broker on a lease (2026-10-25): the fee is a RECORD of what was agreed
 * (the one sent, else the placement's, else the unit's, else the landlord's
 * default), owed until the landlord marks it paid; a percent follows the
 * rent while the lease is a draft; the landlord and the tenant rate the
 * broker once the tenancy has started.
 */
const WS = '11111111-1111-1111-1111-111111111111';
const LEASE = '22222222-2222-2222-2222-222222222222';
const BROKER = '33333333-3333-3333-3333-333333333333';
const UNIT = '44444444-4444-4444-4444-444444444444';
const PLACEMENT = '55555555-5555-5555-5555-555555555555';
const TENANT = '66666666-6666-6666-6666-666666666666';
const ws = {
  workspaceId: WS,
  orgId: 'org',
  kind: 'business',
  domain: 'residence',
  permissions: ['lease.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
} as unknown as ScopedWorkspace;

interface Fee {
  terms: BrokerFeeTerms;
  amountRwf: number;
  status: 'pending' | 'disbursed';
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a fixture's shape is what it builds
function build(opts: { leaseStatus?: string; placement?: Partial<PlacementRow> | null } = {}) {
  const lease = { id: LEASE, workspaceId: WS, propertyId: 'prop', brokerId: BROKER as string | null, status: opts.leaseStatus ?? 'draft', tenantId: TENANT };
  const fees = new Map<string, Fee>();
  const ratings: { role: string; stars: number }[] = [];
  const converted: string[] = [];
  const placement: PlacementRow | null =
    opts.placement === null
      ? null
      : { id: PLACEMENT, brokerId: BROKER, unitId: UNIT, workspaceId: WS, status: 'initiated', leaseId: null, feeKind: 'fixed', feePercent: null, feeRwf: 80_000, ...(opts.placement ?? {}) };
  const repo = {
    activeBroker: async (id: string) => id === BROKER,
    placement: async (id: string) => (placement && id === placement.id ? placement : null),
    openPlacement: async (brokerId: string, unitId: string) => (placement && placement.brokerId === brokerId && placement.unitId === unitId ? placement : null),
    convert: async (_tx: unknown, id: string) => converted.push(id),
    release: async () => undefined,
    upsertFee: async (_tx: unknown, input: { leaseId: string; terms: BrokerFeeTerms; amountRwf: number }) => {
      const before = fees.get(input.leaseId);
      if (before?.status === 'disbursed') return;
      fees.set(input.leaseId, { terms: input.terms, amountRwf: input.amountRwf, status: 'pending' });
    },
    fee: async (leaseId: string) => {
      const f = fees.get(leaseId);
      return f ? { kind: f.terms.kind, percent: f.terms.kind === 'percent' ? f.terms.percent : null, amountRwf: f.amountRwf, status: f.status } : null;
    },
    removeFee: async (_tx: unknown, leaseId: string) => fees.delete(leaseId),
    setPaid: async (_tx: unknown, leaseId: string, paid: boolean) => {
      const f = fees.get(leaseId);
      if (!f) return false;
      f.status = paid ? 'disbursed' : 'pending';
      return true;
    },
    rate: async (_tx: unknown, input: { role: string; stars: number }) => {
      const i = ratings.findIndex((r) => r.role === input.role);
      if (i >= 0) ratings.splice(i, 1);
      ratings.push({ role: input.role, stars: input.stars });
    },
    forLease: async (leaseId: string, role: 'landlord' | 'tenant'): Promise<LeaseBrokerRow | null> => {
      if (!lease.brokerId) return null;
      const f = fees.get(leaseId);
      const r = ratings.find((x) => x.role === role);
      return {
        leaseId,
        leaseStatus: lease.status,
        brokerId: lease.brokerId,
        name: 'Eric',
        phone: '+250788000111',
        placementId: converted[0] ?? null,
        feeKind: f?.terms.kind ?? null,
        feePercent: f?.terms.kind === 'percent' ? f.terms.percent : null,
        feeRwf: f?.amountRwf ?? null,
        feeStatus: f?.status ?? null,
        disbursedAt: f?.status === 'disbursed' ? new Date() : null,
        stars: r?.stars ?? null,
        comment: null,
        ratedAt: r ? new Date() : null,
      };
    },
  } as unknown as LeaseBrokersRepository;
  const leases = { lock: async (_tx: unknown, id: string) => (id === LEASE ? lease : null) } as unknown as LeasesRepository;
  const events = { write: async () => undefined } as unknown as LeaseEventsWriter;
  const audit = { write: async () => undefined } as unknown as RentalsAuditWriter;
  const db = { transaction: async <T>(work: (tx: unknown) => Promise<T>) => work({}) };
  const service = new LeaseBrokersService(db as never, repo, leases, events, audit);
  const ctx = (rent = 300_000, unitFee: BrokerFeeTerms | null = { kind: 'percent', percent: 50 }, defaultFee: BrokerFeeTerms | null = null): LeaseBrokerContext => ({
    leaseId: LEASE,
    workspaceId: WS,
    unitId: UNIT,
    monthlyRentRwf: rent,
    unitFee,
    defaultFee,
  });
  return { service, lease, fees, ratings, converted, ctx };
}

describe('the broker fee on a lease is a record', () => {
  it('works out a percent of the first month, rounding down, or takes a fixed amount', () => {
    expect(brokerFeeAmount({ kind: 'percent', percent: 50 }, 300_001)).toBe(150_000);
    expect(brokerFeeAmount({ kind: 'fixed', amountRwf: 70_000 }, 300_000)).toBe(70_000);
    expect(brokerFeeWords({ kind: 'percent', percent: 50 })).toBe('50% of the first month');
    expect(brokerFeeWords({ kind: 'fixed', amountRwf: 70_000 })).toBe('RWF 70,000');
  });

  it("takes the placement's fee when the broker started one on the unit, and converts it", async () => {
    const { service, fees, converted, ctx } = build();
    const { placementId } = await service.attach({} as never, ctx(), { brokerId: BROKER });
    expect(placementId).toBe(PLACEMENT);
    expect(converted).toEqual([PLACEMENT]);
    expect(fees.get(LEASE)).toEqual({ terms: { kind: 'fixed', amountRwf: 80_000 }, amountRwf: 80_000, status: 'pending' });
  });

  it("falls back to the unit's fee, then the landlord's default; a fee sent wins", async () => {
    const a = build({ placement: null });
    await a.service.attach({} as never, a.ctx(), { brokerId: BROKER });
    expect(a.fees.get(LEASE)?.amountRwf).toBe(150_000);

    const b = build({ placement: null });
    await b.service.attach({} as never, b.ctx(300_000, null, { kind: 'fixed', amountRwf: 50_000 }), { brokerId: BROKER });
    expect(b.fees.get(LEASE)?.amountRwf).toBe(50_000);

    const c = build();
    await c.service.attach({} as never, c.ctx(), { brokerId: BROKER, brokerFee: { kind: 'percent', percent: 100 } });
    expect(c.fees.get(LEASE)?.amountRwf).toBe(300_000);

    const d = build({ placement: null });
    await d.service.attach({} as never, d.ctx(300_000, null, null), { brokerId: BROKER });
    expect(d.fees.has(LEASE)).toBe(false);
  });

  it("refuses another broker's placement", async () => {
    const { service, ctx } = build({ placement: { brokerId: 'someone-else' } });
    await expect(service.attach({} as never, ctx(), { brokerId: BROKER, placementId: PLACEMENT })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a percent follows the rent while owed; a paid fee keeps its amount', async () => {
    const { service, fees, ctx } = build({ placement: null });
    await service.attach({} as never, ctx(), { brokerId: BROKER });
    await service.rentChanged({} as never, LEASE, BROKER, WS, 400_000);
    expect(fees.get(LEASE)?.amountRwf).toBe(200_000);
    (fees.get(LEASE) as Fee).status = 'disbursed';
    await service.rentChanged({} as never, LEASE, BROKER, WS, 500_000);
    expect(fees.get(LEASE)?.amountRwf).toBe(200_000);
  });

  it('the landlord marks it paid and owed again; the lease view shows Owed, Paid, and Void once cancelled', async () => {
    const { service, lease, ctx } = build({ placement: null, leaseStatus: 'active' });
    await service.attach({} as never, ctx(), { brokerId: BROKER });
    expect((await service.landlordView(LEASE))?.fee).toMatchObject({ status: 'owed', amountRwf: 150_000, terms: { kind: 'percent', percent: 50 } });
    expect((await service.setFeePaid(ws, 'u1', LEASE, true)).fee?.status).toBe('paid');
    expect((await service.setFeePaid(ws, 'u1', LEASE, false)).fee?.status).toBe('owed');
    lease.status = 'cancelled';
    expect((await service.landlordView(LEASE))?.fee?.status).toBe('void');
    await expect(service.setFeePaid(ws, 'u1', LEASE, true)).rejects.toBeInstanceOf(ConflictException);
  });

  it('taking the broker off a draft drops an unpaid fee and refuses while it is marked paid', async () => {
    const { service, fees, ctx } = build({ placement: null });
    await service.attach({} as never, ctx(), { brokerId: BROKER });
    (fees.get(LEASE) as Fee).status = 'disbursed';
    await expect(service.detach({} as never, LEASE)).rejects.toBeInstanceOf(ConflictException);
    (fees.get(LEASE) as Fee).status = 'pending';
    await service.detach({} as never, LEASE);
    expect(fees.has(LEASE)).toBe(false);
  });

  it('refuses a broker who is not active', async () => {
    const { service } = build();
    await expect(service.assertBroker('nobody')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('rating the broker', () => {
  it('waits for the tenancy to start', async () => {
    const { service } = build({ leaseStatus: 'signed' });
    await expect(service.rateAsLandlord(ws, 'u1', LEASE, BrokerRatingRequest.parse({ stars: 5 }))).rejects.toThrow('once the tenancy has started');
  });

  it('the landlord and the tenant each rate once; rating again replaces it', async () => {
    const { service, ratings } = build({ leaseStatus: 'active' });
    expect((await service.rateAsLandlord(ws, 'u1', LEASE, BrokerRatingRequest.parse({ stars: 4 }))).rating?.stars).toBe(4);
    expect((await service.rateAsLandlord(ws, 'u1', LEASE, BrokerRatingRequest.parse({ stars: 5 }))).rating?.stars).toBe(5);
    const tenant = await service.rateAsTenant({ leaseId: LEASE, tenantId: TENANT, userId: 'u2' } as never, BrokerRatingRequest.parse({ stars: 3, comment: 'Quick' }));
    expect(tenant).toMatchObject({ canRate: true, rating: { stars: 3 } });
    expect(ratings).toHaveLength(2);
  });

  it("a tenant cannot rate on another tenant's lease, and a landlord not on another business's", async () => {
    const { service } = build({ leaseStatus: 'active' });
    await expect(service.rateAsTenant({ leaseId: LEASE, tenantId: 'other', userId: 'u2' } as never, { stars: 5 })).rejects.toBeInstanceOf(NotFoundException);
    const otherWs = { ...ws, workspaceId: 'other' } as unknown as ScopedWorkspace;
    await expect(service.rateAsLandlord(otherWs, 'u1', LEASE, { stars: 5 })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('checks the stars', () => {
    expect(BrokerRatingRequest.safeParse({ stars: 0 }).success).toBe(false);
    expect(BrokerRatingRequest.safeParse({ stars: 6 }).success).toBe(false);
    expect(BrokerRatingRequest.safeParse({ stars: 5, comment: 'Good' }).success).toBe(true);
  });
});
