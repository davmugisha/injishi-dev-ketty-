import { describe, expect, it, type Mock, vi } from 'vitest';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CreateLeaseRequest, addDays, addMonths, kigaliToday, type LeaseStatus } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { LeaseRecord, LeaseRow, LeasesRepository } from '../infrastructure/leases.repository';
import type { RentalsContextRepository } from '../infrastructure/rentals-context.repository';
import type { LeaseEventsWriter, RentalsAuditWriter } from '../infrastructure/rentals-writers';
import type { TenantRow, TenantsRepository } from '../infrastructure/tenants.repository';
import type { UnitListRow, UnitsRepository } from '../infrastructure/units.repository';
import type { LeaseContractService } from './lease-contract.service';
import { LeaseDraftingService } from './lease-drafting.service';
import type { LeaseReadsService } from './lease-reads.service';

/**
 * Drafting a lease: what the service decides, with every collaborator doubled.
 *
 * Pinned here: a draft fills grace, notice and the due day from the landlord's
 * defaults; a tenant is linked by email within the business (and refused when
 * a signed contract names them differently); dates that meet a live lease on
 * the unit are refused in words; editing a lease out for signature voids the
 * landlord's signature, withdraws the invitation and returns it to draft; a
 * signed lease cannot be edited; and a business that is not a residence is
 * answered 404 before anything is read. Cancelling is `LeaseLifecycleService`'s.
 */
const WS = '11111111-1111-4111-8111-111111111111';
const ORG = '22222222-2222-4222-8222-222222222222';
const PROPERTY = '33333333-3333-4333-8333-333333333333';
const UNIT = '44444444-4444-4444-8444-444444444444';
const TENANT = '55555555-5555-4555-8555-555555555555';
const LEASE = '66666666-6666-4666-8666-666666666666';
const USER = '77777777-7777-4777-8777-777777777777';

const ws = {
  workspaceId: WS,
  kind: 'business',
  orgId: ORG,
  domain: 'residence',
  orgRole: 'owner',
  registrationStatus: 'active',
  permissions: ['lease.manage'],
  branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [PROPERTY], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const today = kigaliToday();
const start = addDays(today, 7);
const end = addDays(addMonths(start, 12), -1);

const unit: UnitListRow = {
  id: UNIT,
  workspaceId: WS,
  propertyId: PROPERTY,
  blockId: null,
  label: 'B-07',
  bedrooms: 2,
  bathrooms: 1,
  kitchen: 'own',
  furnished: false,
  floor: 1,
  sizeSqm: null,
  askingRentRwf: 400_000,
  brokerOffer: false,
  brokerFeeKind: null,
  brokerFeePercent: null,
  brokerFeeRwf: null,
  askingDepositRwf: 800_000,
  state: 'active',
  listed: false,
  availableFrom: null,
  note: null,
  retiredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  propertyName: 'Kacyiru Court',
  blockCode: null,
  blockName: null,
};

const tenantRow = (over: Partial<TenantRow> = {}): TenantRow => ({
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
  ...over,
});

const leaseRow = (over: Partial<LeaseRow> = {}): LeaseRow =>
  ({
    id: LEASE,
    orgId: ORG,
    workspaceId: WS,
    reference: 'L-0001',
    propertyId: PROPERTY,
    unitId: UNIT,
    tenantId: TENANT,
    brokerId: null,
    placementId: null,
    status: 'draft' as LeaseStatus,
    startDate: start,
    endDate: end,
    billingStartsOn: start,
    monthlyRentRwf: 400_000,
    currency: 'RWF',
    depositRwf: 800_000,
    rentDueDay: 5,
    graceDays: 5,
    noticeDays: 15,
    occupants: [],
    otherTerms: null,
    supersedesLeaseId: null,
    currentVersionId: null,
    version: 0,
    ...over,
  }) as LeaseRow;

// The doubles' types are what the test reads back; they are inferred.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness(opts: { lease?: LeaseRow; existingTenant?: TenantRow | null; signed?: boolean; overlap?: boolean } = {}) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
  };
  const tx = {};
  const db = { transaction: async <T>(cb: (t: unknown) => Promise<T>): Promise<T> => cb(tx) };
  const leases = {
    lock: vi.fn(async () => opts.lease ?? null),
    find: vi.fn(async (): Promise<LeaseRecord> => ({
      lease: opts.lease ?? leaseRow(),
      tenant: tenantRow(),
      unitLabel: 'B-07',
      blockId: null,
      blockCode: null,
      blockName: null,
      propertyName: 'Kacyiru Court',
      brokerName: null,
    })),
    liveOverlap: vi.fn(async () =>
      opts.overlap
        ? { id: 'x', reference: 'L-0003', status: 'active', tenantName: 'Eric Nkusi', startDate: '2026-01-01', endsOn: addDays(start, 30) }
        : null,
    ),
    references: vi.fn(async () => ['L-0001', 'L-0002']),
    insert: vi.fn(async (_tx: unknown, values: Record<string, unknown>) => {
      record('insertLease')(values);
      return LEASE;
    }),
    update: vi.fn(async (_tx: unknown, id: string, values: Record<string, unknown>) => {
      record('updateLease')(id, values);
    }),
    voidLandlordSignatures: vi.fn(async () => ['sig-1']),
    revokeLiveInvitation: vi.fn(async () => 'inv-1'),
  };
  const tenants = {
    find: vi.fn(async () => opts.existingTenant ?? tenantRow()),
    findByEmail: vi.fn(async () => (opts.existingTenant === undefined ? null : opts.existingTenant)),
    insert: vi.fn(async (_tx: unknown, values: Record<string, unknown>) => {
      record('insertTenant')(values);
      return TENANT;
    }),
    update: vi.fn(async (_tx: unknown, id: string, values: Record<string, unknown>) => {
      record('updateTenant')(id, values);
    }),
    signedTenantIds: vi.fn(async () => new Set(opts.signed ? [TENANT] : [])),
    draftLeaseIds: vi.fn(async () => []),
  };
  const units = { find: vi.fn(async () => unit) };
  const context = {
    ensureProfile: vi.fn(async () => ({ defaultGraceDays: 7, defaultNoticeDays: 30, defaultRentDueDay: 1 })),
  };
  const contracts = {
    freeze: vi.fn(async () => ({ versionId: 'v-2', version: 2, hash: 'h', created: true })),
    refreshDrafts: vi.fn(async () => 0),
  };
  const events = { write: vi.fn(async (_tx: unknown, e: unknown) => record('event')(e)) };
  const audit = { write: vi.fn(async (_tx: unknown, e: unknown) => record('audit')(e)) };
  const reads = { detail: vi.fn(async () => ({ id: LEASE }) as never) };
  const service = new LeaseDraftingService(
    db as never,
    leases as unknown as LeasesRepository,
    tenants as unknown as TenantsRepository,
    units as unknown as UnitsRepository,
    context as unknown as RentalsContextRepository,
    contracts as unknown as LeaseContractService,
    events as unknown as LeaseEventsWriter,
    audit as unknown as RentalsAuditWriter,
    reads as unknown as LeaseReadsService,
  );
  return { service, calls, leases, tenants, contracts, reads };
}

const draft = (over: Record<string, unknown> = {}): CreateLeaseRequest =>
  CreateLeaseRequest.parse({
    unitId: UNIT,
    tenant: {
      fullName: 'Aline Uwera',
      email: 'aline@example.rw',
      phone: '0788 123 456',
      idKind: 'national_id',
      idNumber: '1199080012345012',
      nationality: 'RW',
    },
    terms: { startDate: start, endDate: end, monthlyRentRwf: 400_000, depositRwf: 800_000 },
    ...over,
  });

describe('LeaseDraftingService.create', () => {
  it('drafts a lease, fills the landlord defaults, makes the tenant, freezes version 1 and writes the event', async () => {
    const h = harness();
    await h.service.create(ws, USER, draft());
    const lease = h.calls.insertLease?.[0]?.[0] as Record<string, unknown>;
    expect(lease).toMatchObject({
      reference: 'L-0003',
      status: 'draft',
      unitId: UNIT,
      propertyId: PROPERTY,
      graceDays: 7,
      noticeDays: 30,
      rentDueDay: 1,
      billingStartsOn: start,
    });
    expect(h.calls.insertTenant?.[0]?.[0]).toMatchObject({ email: 'aline@example.rw', phone: '+250788123456', orgId: ORG });
    expect(h.contracts.freeze).toHaveBeenCalledTimes(1);
    expect(h.calls.event?.[0]?.[0]).toMatchObject({ kind: 'created', actorRole: 'landlord' });
    // A draft is the landlord's alone until it is sent.
    expect((h.calls.event?.[0]?.[0] as { visibleToTenant?: boolean }).visibleToTenant ?? false).toBe(false);
    expect(h.reads.detail).toHaveBeenCalledWith(ws, LEASE);
  });

  it('links the tenant the business already has by email, bringing their record up to date', async () => {
    const h = harness({ existingTenant: tenantRow({ fullName: 'Aline Uwera', phone: '+250788000000' }) });
    await h.service.create(ws, USER, draft());
    expect(h.calls.insertTenant).toBeUndefined();
    expect(h.calls.updateTenant?.[0]?.[1]).toMatchObject({ phone: '+250788123456' });
    expect(h.calls.event?.[0]?.[0]).toMatchObject({ payload: expect.objectContaining({ tenant: 'linked' }) });
    expect(h.calls.audit?.[0]?.[0]).toMatchObject({ subjectType: 'tenant', eventType: 'tenant.updated' });
  });

  it('refuses to change a tenant a signed contract names', async () => {
    const h = harness({ existingTenant: tenantRow({ fullName: 'Aline U.' }), signed: true });
    await expect(h.service.create(ws, USER, draft())).rejects.toThrow(/has signed a lease/);
    expect(h.calls.insertLease).toBeUndefined();
  });

  it('refuses dates that meet a live lease on the unit, saying whose and until when', async () => {
    const h = harness({ overlap: true });
    const err = await h.service.create(ws, USER, draft()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({
      code: 'unit_taken',
      message: expect.stringMatching(/^Unit B-07 is let to Eric Nkusi from .* \(lease L-0003\)\. Pick dates from .* on, or another unit\.$/),
    });
    expect(h.calls.insertLease).toBeUndefined();
  });

  it('answers 404 for a business that is not a residence, before reading anything', async () => {
    const h = harness();
    const hotel = { ...ws, domain: 'hospitality' } as ScopedWorkspace;
    await expect(h.service.create(hotel, USER, draft())).rejects.toBeInstanceOf(NotFoundException);
    expect(h.leases.liveOverlap).not.toHaveBeenCalled();
  });

  it('answers 404 for a unit of another business', async () => {
    const h = harness();
    (h.service as unknown as { units: { find: Mock } }).units.find.mockResolvedValueOnce({ ...unit, workspaceId: 'other' });
    await expect(h.service.create(ws, USER, draft())).rejects.toThrow('Unit not found.');
  });
});

describe('LeaseDraftingService.edit', () => {
  it('editing a lease out for signature voids the landlord signature, withdraws the invitation and returns it to draft', async () => {
    const h = harness({ lease: leaseRow({ status: 'pending_signature' }) });
    await h.service.edit(ws, USER, LEASE, { terms: { monthlyRentRwf: 420_000 } });
    expect(h.leases.voidLandlordSignatures).toHaveBeenCalled();
    expect(h.leases.revokeLiveInvitation).toHaveBeenCalled();
    expect(h.calls.updateLease?.[0]?.[1]).toMatchObject({ monthlyRentRwf: 420_000, status: 'draft' });
    const kinds = (h.calls.event ?? []).map((c) => (c[0] as { kind: string }).kind);
    expect(kinds).toEqual(['landlord_signature_voided', 'terms_edited']);
    expect(h.calls.audit?.[0]?.[0]).toMatchObject({ subjectType: 'lease', eventType: 'lease.signature_voided' });
    expect(h.contracts.freeze).toHaveBeenCalledTimes(1);
  });

  it('a draft edit keeps it a draft and voids nothing', async () => {
    const h = harness({ lease: leaseRow({ status: 'draft' }) });
    await h.service.edit(ws, USER, LEASE, { terms: { graceDays: 3 } });
    expect(h.leases.voidLandlordSignatures).not.toHaveBeenCalled();
    expect(h.calls.updateLease?.[0]?.[1]).not.toHaveProperty('status');
    expect((h.calls.event ?? []).map((c) => (c[0] as { kind: string }).kind)).toEqual(['terms_edited']);
  });

  it('an edit that changes nothing writes nothing', async () => {
    const h = harness({ lease: leaseRow({ status: 'draft', monthlyRentRwf: 400_000 }) });
    await h.service.edit(ws, USER, LEASE, { terms: { monthlyRentRwf: 400_000 } });
    expect(h.calls.updateLease).toBeUndefined();
    expect(h.contracts.freeze).not.toHaveBeenCalled();
  });

  it.each(['signed', 'active', 'ending', 'ended', 'cancelled'] as const)('refuses to edit a %s lease, saying where it stands', async (status) => {
    const h = harness({ lease: leaseRow({ status }) });
    const err = await h.service.edit(ws, USER, LEASE, { terms: { graceDays: 3 } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toMatchObject({ code: 'lease_state', current: status });
  });

  it('checks the merged dates with the contracts rules', async () => {
    const h = harness({ lease: leaseRow() });
    const err = await h.service.edit(ws, USER, LEASE, { terms: { endDate: addDays(start, 10) } }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(JSON.stringify((err as BadRequestException).getResponse())).toContain('A lease runs for at least one month.');
  });

  it('billing that followed the start date follows a new start date', async () => {
    const h = harness({ lease: leaseRow() });
    const later = addDays(start, 3);
    await h.service.edit(ws, USER, LEASE, { terms: { startDate: later } });
    expect(h.calls.updateLease?.[0]?.[1]).toMatchObject({ startDate: later, billingStartsOn: later });
  });

  it('a lease of another business is 404', async () => {
    const h = harness({ lease: leaseRow({ workspaceId: 'someone-else' }) });
    await expect(h.service.edit(ws, USER, LEASE, { terms: { graceDays: 3 } })).rejects.toThrow('Lease not found.');
  });
});
