import type { WorkspaceAccess } from '@injishi/contracts';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import type { StorageService } from '../../storage/application/storage.service';
import { scopeSql, type ListingScope } from '../domain/broker-scope';
import { BrokersRepository, type HomeRow, type RevealRow } from '../infrastructure/brokers.repository';
import type { BrokerPlansService } from './broker-plans.service';
import { BrokerHomesService } from './broker-homes.service';

/**
 * Every broker read and command is cut to the broker's plan (2026-10-25):
 * District shows the home district, Province one province, Country all of
 * Rwanda; and only units the landlord switched on for brokers. A unit outside
 * either is a 404, never a 403.
 */
const WS = '11111111-1111-1111-1111-111111111111';
const BROKER = '22222222-2222-2222-2222-222222222222';
const IN_GASABO = '33333333-3333-3333-3333-333333333333';
const IN_MUSANZE = '44444444-4444-4444-4444-444444444444';
const NOT_OFFERED = '55555555-5555-5555-5555-555555555555';
const ORG = '66666666-6666-6666-6666-666666666666';
const ws = { workspaceId: WS, kind: 'broker' } as unknown as WorkspaceAccess;

/** Gasabo (102) is in Kigali (1), Musanze (403) in the North (4). The third unit is not switched on. */
const UNITS = [
  { id: IN_GASABO, districtId: 102, provinceId: 1, offered: true },
  { id: IN_MUSANZE, districtId: 403, provinceId: 4, offered: true },
  { id: NOT_OFFERED, districtId: 102, provinceId: 1, offered: false },
];

function visible(scope: ListingScope, u: (typeof UNITS)[number]): boolean {
  if (!u.offered) return false;
  if (scope.plan === 'country') return true;
  if (scope.plan === 'province') return u.provinceId === scope.provinceId;
  return scope.districtId !== null && u.districtId === scope.districtId;
}

function homeRow(u: (typeof UNITS)[number]): HomeRow {
  return {
    unitId: u.id,
    unitLabel: 'A-02',
    propertyName: 'Amani Residences',
    landlordName: 'Amani Residences',
    orgId: ORG,
    workspaceId: 'ws-landlord',
    districtId: u.districtId,
    district: u.districtId === 102 ? 'Gasabo' : 'Musanze',
    sector: null,
    bedrooms: 2,
    bathrooms: 1,
    kitchen: 'own',
    furnished: false,
    sizeSqm: null,
    rentRwf: 300_000,
    depositRwf: 300_000,
    feeKind: 'percent',
    feePercent: 50,
    feeRwf: null,
    photoKeys: ['a.jpg', 'b.jpg'],
    videoKey: null,
    videoPosterKey: null,
    videoDurationS: null,
    availableFrom: null,
    latitude: null,
    longitude: null,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- a fixture's shape is what it builds
function build(scope: ListingScope, opts: { status?: 'active' | 'suspended'; contact?: { phone: string | null; email: string | null } } = {}) {
  const reveals: RevealRow[] = [];
  const placements: { id: string; unitId: string; status: 'initiated' }[] = [];
  const seen: ListingScope[] = [];
  const mails: string[] = [];
  const repo = {
    brokerForWorkspace: async (id: string) => (id === WS ? { id: BROKER, userId: 'u', name: 'Eric', status: opts.status ?? 'active' } : null),
    homes: async (f: { scope: ListingScope }) => {
      seen.push(f.scope);
      return UNITS.filter((u) => visible(f.scope, u)).map(homeRow);
    },
    home: async (unitId: string, s: ListingScope) => {
      seen.push(s);
      const u = UNITS.find((x) => x.id === unitId);
      return u && visible(s, u) ? homeRow(u) : null;
    },
    homeDistricts: async () => [],
    reveals: async () => reveals,
    unitPlacements: async () => new Map(placements.map((p) => [p.unitId, { id: p.id, status: p.status }])),
    withBrokerLock: async <T>(_id: string, work: (tx: unknown) => Promise<T>) => work({}),
    landlordContact: async () => ({ orgId: ORG, workspaceId: 'ws-landlord', name: 'Amani', ...(opts.contact ?? { phone: '+250788111222', email: 'amani@example.com' }) }),
    insertReveal: async (_tx: unknown, input: { contact: { orgId: string; name: string | null; phone: string | null; email: string | null } }) => {
      const r = { id: `r${reveals.length + 1}`, orgId: input.contact.orgId, name: input.contact.name, phone: input.contact.phone, email: input.contact.email, revealedAt: new Date() };
      reveals.push(r);
      return r;
    },
    openPlacementOn: async (_tx: unknown, _b: string, unitId: string) => placements.find((p) => p.unitId === unitId)?.id ?? null,
    insertPlacement: async (_tx: unknown, input: { home: HomeRow }) => {
      const id = `p${placements.length + 1}`;
      placements.push({ id, unitId: input.home.unitId, status: 'initiated' });
      return id;
    },
    placementNotice: async () => ({ email: 'amani@example.com', landlordName: 'Amani', unitLabel: 'A-02', propertyName: 'Amani Residences', brokerName: 'Eric', brokerPhone: null }),
    placements: async () =>
      placements.map((p) => ({
        id: p.id,
        status: p.status,
        initiatedAt: new Date(),
        unitId: p.unitId,
        unitLabel: 'A-02',
        propertyName: 'Amani Residences',
        district: 'Gasabo',
        landlordName: 'Amani Residences',
        tenantName: null,
        note: null,
        feeKind: 'percent',
        feePercent: 50,
        feeRwf: null,
        leaseId: null,
        leaseReference: null,
        leaseTenantName: null,
        leaseStatus: null,
        leaseStartDate: null,
        recordKind: null,
        recordPercent: null,
        recordRwf: null,
        recordStatus: null,
        disbursedAt: null,
      })),
  } as unknown as BrokersRepository;
  const plans = {
    scopeFor: async () => scope,
    describeScope: async () => ({ plan: scope.plan, area: 'Gasabo', districtId: null, provinceId: null, needsDistrict: false, upgrade: null }),
  } as unknown as BrokerPlansService;
  const storage = { signedUrl: async (k: string) => `https://files.test/${k}` } as unknown as StorageService;
  const mailer = {
    appUrl: 'https://app.injishi.test',
    send: async (_ref: string, _to: string, m: { subject: string }) => {
      mails.push(m.subject);
      return true;
    },
  };
  const service = new BrokerHomesService(repo, plans, storage, mailer as never);
  return { service, seen, reveals, placements, mails };
}

describe('BrokerHomesService: the plan decides what a broker sees', () => {
  it('District shows the opted-in homes of the home district only', async () => {
    const { service, seen } = build({ plan: 'district', districtId: 102 });
    const list = await service.homes(ws, {});
    expect(list.homes.map((h) => h.unitId)).toEqual([IN_GASABO]);
    expect(seen[0]).toEqual({ plan: 'district', districtId: 102 });
  });

  it('Province shows its province, Country shows Rwanda; a unit not switched on never shows', async () => {
    expect((await build({ plan: 'province', provinceId: 4 }).service.homes(ws, {})).homes.map((h) => h.unitId)).toEqual([IN_MUSANZE]);
    expect((await build({ plan: 'country' }).service.homes(ws, {})).homes.map((h) => h.unitId).sort()).toEqual([IN_GASABO, IN_MUSANZE].sort());
  });

  it('a free broker with no district yet sees nothing', async () => {
    expect((await build({ plan: 'district', districtId: null }).service.homes(ws, {})).homes).toEqual([]);
  });

  it('the fee is shown: the landlord set terms and what they come to on the asking rent', async () => {
    const home = (await build({ plan: 'country' }).service.homes(ws, {})).homes[0];
    expect(home?.fee).toEqual({ kind: 'percent', percent: 50 });
    expect(home?.feeRwf).toBe(150_000);
    expect(home?.photos).toEqual(['https://files.test/a.jpg', 'https://files.test/b.jpg']);
    expect(home?.contact).toBeNull();
  });

  it.each([
    ['outside the district', { plan: 'district', districtId: 102 } as ListingScope, IN_MUSANZE],
    ['outside the province', { plan: 'province', provinceId: 1 } as ListingScope, IN_MUSANZE],
    ['not switched on by its landlord', { plan: 'country' } as ListingScope, NOT_OFFERED],
  ])('a home %s is 404 on read, reveal and placement', async (_what, scope, unitId) => {
    const { service } = build(scope);
    await expect(service.home(ws, unitId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.reveal(ws, unitId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.startPlacement(ws, unitId, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reveal is free, logged once per landlord, and shown on every home of theirs after', async () => {
    const { service, reveals } = build({ plan: 'country' });
    const first = await service.reveal(ws, IN_GASABO);
    expect(first).toMatchObject({ first: true, contact: { phone: '+250788111222', email: 'amani@example.com', name: 'Amani' } });
    const again = await service.reveal(ws, IN_MUSANZE);
    expect(again.first).toBe(false);
    expect(reveals).toHaveLength(1);
    const list = await service.homes(ws, {});
    expect(list.homes.every((h) => h.contact?.phone === '+250788111222')).toBe(true);
  });

  it('refuses a reveal when the landlord left no phone or email', async () => {
    const { service } = build({ plan: 'country' }, { contact: { phone: null, email: null } });
    await expect(service.reveal(ws, IN_GASABO)).rejects.toBeInstanceOf(ConflictException);
  });

  it('a placement needs the landlord revealed, tells the landlord once, and a second press is the same placement', async () => {
    const { service, placements, mails } = build({ plan: 'country' });
    await expect(service.startPlacement(ws, IN_GASABO, {})).rejects.toThrow('Reveal the landlord first');
    await service.reveal(ws, IN_GASABO);
    const placement = await service.startPlacement(ws, IN_GASABO, { tenantName: 'Ines' });
    expect(placement).toMatchObject({ status: 'initiated', terms: { kind: 'percent', percent: 50 } });
    const again = await service.startPlacement(ws, IN_GASABO, {});
    expect(again.id).toBe(placement.id);
    expect(placements).toHaveLength(1);
    await new Promise((r) => setImmediate(r));
    expect(mails).toEqual(['Eric has a tenant for A-02']);
  });

  it('only a broker workspace with an active broker acts; a suspended one only reads', async () => {
    const landlord = { workspaceId: WS, kind: 'business' } as unknown as WorkspaceAccess;
    await expect(build({ plan: 'country' }).service.homes(landlord, {})).rejects.toBeInstanceOf(ForbiddenException);
    const stranger = { workspaceId: 'other', kind: 'broker' } as unknown as WorkspaceAccess;
    await expect(build({ plan: 'country' }).service.homes(stranger, {})).rejects.toBeInstanceOf(NotFoundException);
    const suspended = build({ plan: 'country' }, { status: 'suspended' });
    expect((await suspended.service.homes(ws, {})).homes).toHaveLength(2);
    await expect(suspended.service.reveal(ws, IN_GASABO)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});

describe('the SQL every broker read carries', () => {
  const dialect = new PgDialect();
  const render = (scope: ListingScope): { sql: string; params: unknown[] } => dialect.sqlToQuery(scopeSql(scope));

  it('scopes District to one district, Province to its districts, Country to all, and no district to nothing', () => {
    expect(render({ plan: 'district', districtId: 102 })).toMatchObject({ sql: 'p.district_id = $1', params: [102] });
    expect(render({ plan: 'province', provinceId: 4 }).sql).toBe('p.district_id in (select sd.id from districts sd where sd.province_id = $1)');
    expect(render({ plan: 'country' }).sql).toBe('true');
    expect(render({ plan: 'district', districtId: null }).sql).toBe('false');
  });

  it('reads only units the landlord switched on, can be let, priced, with a fee and no lease holding them', () => {
    const repo = new BrokersRepository({} as never);
    const where = (repo as unknown as { homeWhere: (s: ListingScope) => ReturnType<typeof sql>[] }).homeWhere({ plan: 'district', districtId: 102 });
    const text = dialect.sqlToQuery(sql.join(where, sql` and `)).sql;
    expect(text).toContain('u.broker_offer');
    expect(text).toContain("u.state = 'active'");
    expect(text).toContain('u.asking_rent_rwf is not null');
    expect(text).toContain('u.broker_fee_kind is not null');
    expect(text).toContain("o.registration_status = 'active'");
    expect(text).toContain("le.status in ('pending_signature', 'signed', 'active')");
    expect(text).toContain('p.district_id = $1');
  });
});
