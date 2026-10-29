import { describe, expect, it, vi } from 'vitest';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateUnitRequest, UpdateTenantRequest } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { TenantRow, TenantsRepository } from '../infrastructure/tenants.repository';
import type { UnitListRow, UnitsRepository } from '../infrastructure/units.repository';
import type { LeaseContractService } from './lease-contract.service';
import { RentalsProfileService } from './rentals-profile.service';
import { TenantsService } from './tenants.service';
import { UnitsService } from './units.service';

const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const TENANT = '55555555-5555-4555-8555-555555555555';
const USER = '77777777-7777-4777-8777-777777777777';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  registrationStatus: 'active',
  permissions: ['unit.manage', 'lease.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const db = { transaction: async <T>(cb: (tx: unknown) => Promise<T>): Promise<T> => cb({}) };
const audit = { write: vi.fn(async () => undefined) } as unknown as RentalsAuditWriter;

describe('UnitsService: a unit stands alone', () => {

  // The doubles' types are what the test reads back; they are inferred.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function harness(opts: { buildings?: { id: string; name: string }[]; taken?: string[] } = {}) {
    const inserted: Record<string, unknown>[] = [];
    const unitRow = { id: 'u-1', workspaceId: WS, propertyId: PROPERTY, label: 'A-01', state: 'active', createdAt: new Date(), updatedAt: new Date() } as UnitListRow;
    const units = {
      labelsTaken: vi.fn(async () => opts.taken ?? []),
      insertMany: vi.fn(async (_tx: unknown, values: Record<string, unknown>[]) => {
        inserted.push(...values);
        return values.map((_, i) => `u-${i + 1}`);
      }),
      find: vi.fn(async () => unitRow),
      leaseFacts: vi.fn(async () => new Map()),
      openLeases: vi.fn(async () => [{ id: 'l', reference: 'L-0004', status: 'active' }]),
      findBlock: vi.fn(async () => null),
    };
    const context = {
      buildings: vi.fn(async () => opts.buildings ?? []),
      ensureBuilding: vi.fn(async () => ({ id: PROPERTY, name: 'Kacyiru Court Ltd' })),
    };
    const contracts = { refreshDrafts: vi.fn(async () => 0) };
    const service = new UnitsService(
      db as never,
      units as unknown as UnitsRepository,
      context as unknown as RentalsContextRepository,
      contracts as unknown as LeaseContractService,
      audit,
    );
    return { service, inserted, units, context };
  }

  it('the first unit makes the business its first building, and no hotel room', async () => {
    const h = harness();
    await h.service.create(ws, USER, CreateUnitRequest.parse({ label: ' A-01 ', bedrooms: 2 }));
    expect(h.context.ensureBuilding).toHaveBeenCalledWith({ workspaceId: WS, orgId: ORG });
    expect(h.inserted[0]).toMatchObject({ propertyId: PROPERTY, label: 'A-01', bedrooms: 2, askingRentRwf: null, state: 'active' });
    expect(Object.keys(h.inserted[0] ?? {})).not.toContain('roomId');
  });

  it('with several buildings the request names one', async () => {
    const h = harness({ buildings: [{ id: PROPERTY, name: 'Kacyiru Court' }, { id: 'p-2', name: 'Rebero Heights' }] });
    await expect(h.service.create(ws, USER, CreateUnitRequest.parse({ label: 'A-01' }))).rejects.toThrow('Validation failed');
  });

  it('a name already used in the building is refused in words', async () => {
    const h = harness({ buildings: [{ id: PROPERTY, name: 'Kacyiru Court' }], taken: ['A-01'] });
    await expect(h.service.create(ws, USER, CreateUnitRequest.parse({ label: 'a-01' }))).rejects.toThrow(
      'There is already a unit A-01 in Kacyiru Court.',
    );
  });

  it('a unit with a lease cannot be retired', async () => {
    const h = harness();
    await expect(h.service.retire(ws, USER, 'u-1')).rejects.toThrow(
      "Unit A-01 has lease L-0004. A unit with a lease can't be retired until the tenancy ends.",
    );
  });

  it('a hotel has no rental units: 404', async () => {
    const h = harness();
    await expect(h.service.list({ ...ws, domain: 'hospitality' } as ScopedWorkspace, {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('brokers may offer a unit only with an asking rent and a fee (2026-10-25)', async () => {
    const h = harness();
    await expect(h.service.create(ws, USER, CreateUnitRequest.parse({ label: 'A-02', brokerOffer: true }))).rejects.toThrow('before brokers can offer it');
    await h.service.create(
      ws,
      USER,
      CreateUnitRequest.parse({ label: 'A-02', askingRentRwf: 300_000, brokerOffer: true, brokerFee: { kind: 'percent', percent: 50 } }),
    );
    expect(h.inserted[0]).toMatchObject({ brokerOffer: true, brokerFeeKind: 'percent', brokerFeePercent: 50, brokerFeeRwf: null });
    await h.service.create(ws, USER, CreateUnitRequest.parse({ label: 'A-03', askingRentRwf: 300_000, brokerOffer: true, brokerFee: { kind: 'fixed', amountRwf: 90_000 } }));
    expect(h.inserted[1]).toMatchObject({ brokerFeeKind: 'fixed', brokerFeePercent: null, brokerFeeRwf: 90_000 });
  });
});

describe('TenantsService: a record changes until a signed contract names the person', () => {
  const row: TenantRow = {
    id: TENANT,
    workspaceId: WS,
    orgId: ORG,
    userId: null,
    fullName: 'Aline Uwera',
    email: 'aline@example.rw',
    phone: '+250788123456',
    idKind: 'national_id',
    idNumber: '1199080012345012',
    nationality: 'RW',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // The doubles' types are what the test reads back; they are inferred.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function harness(opts: { signed?: boolean; other?: TenantRow | null } = {}) {
    const updates: Record<string, unknown>[] = [];
    const tenants = {
      find: vi.fn(async () => row),
      findByEmail: vi.fn(async () => opts.other ?? null),
      signedTenantIds: vi.fn(async () => new Set(opts.signed ? [TENANT] : [])),
      update: vi.fn(async (_tx: unknown, _id: string, v: Record<string, unknown>) => void updates.push(v)),
      draftLeaseIds: vi.fn(async () => ['draft-1']),
      leasesOf: vi.fn(async () => []),
    };
    const contracts = { refreshDrafts: vi.fn(async () => 1) };
    const events = { write: vi.fn(async () => undefined) };
    const service = new TenantsService(
      db as never,
      tenants as unknown as TenantsRepository,
      contracts as unknown as LeaseContractService,
      events as unknown as LeaseEventsWriter,
      audit,
    );
    return { service, updates, contracts, events };
  }

  it('changes only what was sent and rebuilds the drafts that name them', async () => {
    const h = harness();
    await h.service.update(ws, USER, TENANT, UpdateTenantRequest.parse({ phone: '0788 999 888' }));
    expect(h.updates).toEqual([{ phone: '+250788999888' }]);
    expect(h.events.write).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: 'tenant_updated', leaseId: 'draft-1' }));
    expect(h.contracts.refreshDrafts).toHaveBeenCalledWith(['draft-1'], USER);
  });

  it('refuses once a contract naming them was signed', async () => {
    const h = harness({ signed: true });
    const err = await h.service.update(ws, USER, TENANT, UpdateTenantRequest.parse({ fullName: 'Aline U.' })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(String((err as ConflictException).message)).toContain("has a signed lease with you, so their details can't change");
    expect(h.updates).toEqual([]);
  });

  it('refuses an email another tenant of the business has', async () => {
    const h = harness({ other: { ...row, id: 'other', fullName: 'Eric Nkusi' } });
    await expect(h.service.update(ws, USER, TENANT, UpdateTenantRequest.parse({ email: 'eric@example.rw' }))).rejects.toThrow(
      'Eric Nkusi is already a tenant of yours with this email.',
    );
  });

  it('checks a new ID number against the kind on file', async () => {
    const h = harness();
    await expect(h.service.update(ws, USER, TENANT, UpdateTenantRequest.parse({ idNumber: '12345' }))).rejects.toThrow('Validation failed');
  });
});

describe('RentalsProfileService.setup', () => {

  // The doubles' types are what the test reads back; they are inferred.
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  function harness(opts: { village?: number | null; units?: number; primary?: boolean; defaults?: boolean; signatory?: boolean }) {
    const marked = vi.fn(async () => new Date('2026-10-24T10:00:00Z'));
    const context = {
      ensureProfile: vi.fn(async () => ({
        defaultGraceDays: 5,
        defaultNoticeDays: 15,
        leaseDefaultsSetAt: opts.defaults ? new Date() : null,
        signatoryName: opts.signatory ? 'Jean Mugabo' : null,
        signatoryIdNumber: opts.signatory ? '1198080012345012' : null,
        contactPhone: opts.signatory ? '+250788000111' : null,
        contactEmail: opts.signatory ? 'jean@kacyiru.rw' : null,
        setupCompletedAt: null,
      })),
      buildings: vi.fn(async () => [{ id: PROPERTY, name: 'Kacyiru Court', villageId: opts.village ?? null }]),
      buildingPlace: vi.fn(async () => ({ village: 'Rebero', district: 'Kicukiro' })),
      unitCount: vi.fn(async () => opts.units ?? 0),
      primaryPayoutAccount: vi.fn(async () =>
        opts.primary ? { kind: 'momo', bankName: null, momoNetwork: 'mtn', momoPhone: '+250788123456', merchantCode: null } : null,
      ),
      markSetupComplete: marked,
    };
    const service = new RentalsProfileService(db as never, context as unknown as RentalsContextRepository, {} as LeaseContractService);
    return { service, marked };
  }

  it('says what is left, in order', async () => {
    const h = harness({ units: 3 });
    const setup = await h.service.setup(ws);
    expect(setup.steps.map((s) => [s.step, s.done, s.detail])).toEqual([
      ['location', false, 'Add the village your homes are in.'],
      ['units', true, '3 units'],
      ['getting_paid', false, 'Add where rent is paid out.'],
      ['lease_defaults', false, 'Check the lease defaults.'],
      ['signatory', false, 'Say who signs leases for the business.'],
    ]);
    expect(setup).toMatchObject({ next: 'location', complete: false, setupCompletedAt: null });
    expect(h.marked).not.toHaveBeenCalled();
  });

  it('records when every step is done', async () => {
    const h = harness({ village: 42, units: 1, primary: true, defaults: true, signatory: true });
    const setup = await h.service.setup(ws);
    expect(setup.complete).toBe(true);
    expect(setup.steps.find((s) => s.step === 'getting_paid')?.detail).toBe('MTN MoMo 078••••456');
    expect(setup.steps.find((s) => s.step === 'location')?.detail).toBe('Rebero village, Kicukiro');
    expect(setup.setupCompletedAt).toBe('2026-10-24T10:00:00.000Z');
  });
});
