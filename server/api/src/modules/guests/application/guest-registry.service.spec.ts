import { describe, expect, it, type Mock, vi } from 'vitest';

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { type LandlordGuestRequest, type TenantGuestRequest, normaliseGuestPhone } from '@injishi/contracts';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { GuestRegistryRepository, RegistrationRow, TenancyHome } from '../infrastructure/guest-registry.repository';
import { GuestRegistryService } from './guest-registry.service';
import type { GuestRoutingService } from './guest-routing.service';

// Kigali 24 October 2026, morning.
const NOW = new Date('2026-10-24T06:00:00Z');
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LEASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REG = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PROPERTY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const WS = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

class Pinned extends GuestRegistryService {
  protected override now(): Date {
    return NOW;
  }
}

const HOME: TenancyHome = {
  leaseId: LEASE,
  status: 'active',
  tenantId: 't1',
  tenantUserId: USER,
  tenantName: 'Aline Uwera',
  start: '2026-09-01',
  end: '2026-11-30',
  workspaceId: WS,
  orgId: 'o1',
  propertyId: PROPERTY,
  propertyName: 'Kacyiru Court',
  unitId: 'u1',
  unitLabel: 'A-01',
  addressText: 'KG 7 Ave',
  villageId: 1101,
  cellId: 110,
  sectorId: 11,
  districtId: 1,
  villageName: 'Urugwiro',
  cellName: 'Kamatamu',
  sectorName: 'Kacyiru',
  districtName: 'Gasabo',
};

/** A request as the validation pipe hands it over (built, not parsed: the pipe checks dates on the real clock). */
function body(over: Partial<TenantGuestRequest> = {}): TenantGuestRequest {
  return {
    fullName: 'Grace Mutoni',
    phone: normaliseGuestPhone('0788 123 456') as string,
    relationship: 'friend',
    origin: { kind: 'country', countryCode: 'KE' },
    nationality: 'KE',
    arrivalOn: '2026-10-25',
    departureOn: '2026-10-30',
    ...over,
  };
}

type RepoMocks = Record<
  | 'tenancyHome' | 'countryName' | 'relationship' | 'villagePath' | 'transaction' | 'insertRegistration' | 'insertRoutes'
  | 'audit' | 'outbox' | 'find' | 'routesFor' | 'hostList' | 'cancel' | 'updateRegistration' | 'buildingHome' | 'buildings',
  Mock
>;

function setup(home: TenancyHome | null = HOME): {
  repo: RepoMocks;
  routing: { plan: Mock; notify: Mock };
  service: GuestRegistryService;
  tx: { tag: string };
} {
  const tx = { tag: 'tx' };
  const repo: RepoMocks = {
    tenancyHome: vi.fn(async () => home),
    countryName: vi.fn(async (code: string) => ({ RW: 'Rwanda', KE: 'Kenya', UG: 'Uganda' })[code] ?? null),
    relationship: vi.fn(async (code: string) =>
      code === 'friend' ? { code, label: 'Friend', needsDetail: false } : code === 'other' ? { code, label: 'Other', needsDetail: true } : null,
    ),
    villagePath: vi.fn(async (id: number) => (id === 2202 ? 'Rugando, Kimihurura, Kimihurura, Gasabo' : null)),
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    insertRegistration: vi.fn(async () => REG),
    insertRoutes: vi.fn(async () => undefined),
    audit: vi.fn(async () => undefined),
    outbox: vi.fn(async () => undefined),
    find: vi.fn(async () => null as RegistrationRow | null),
    routesFor: vi.fn(async () => []),
    hostList: vi.fn(async () => [] as RegistrationRow[]),
    cancel: vi.fn(async () => true),
    updateRegistration: vi.fn(async () => undefined),
    buildingHome: vi.fn(async () => ({ ...HOME, unitId: null, unitLabel: null })),
    buildings: vi.fn(async () => []),
  };
  const routing = {
    plan: vi.fn(async () => [
      { role: 'village_leader', step: 1, area: HOME, assignmentId: 'v' },
      { role: 'dasso', step: 2, area: HOME, assignmentId: null },
      { role: 'cell_executive', step: 3, area: HOME, assignmentId: null },
      { role: 'district_immigration', step: 4, area: HOME, assignmentId: null },
    ]),
    notify: vi.fn(async () => 1),
  };
  const service = new Pinned(repo as unknown as GuestRegistryRepository, routing as unknown as GuestRoutingService);
  return { repo, routing, service, tx };
}

function issuePath(e: unknown): unknown {
  return ((e as BadRequestException).getResponse() as { issues: { path: string[] }[] }).issues[0]?.path;
}

describe('GuestRegistryService · a tenant registers a guest', () => {
  it('another person or a draft lease is a 404 in the tenancy words', async () => {
    const { service } = setup(null);
    await expect(service.tenantRegister(USER, LEASE, body())).rejects.toThrow(NotFoundException);
    await expect(service.tenantList(USER, LEASE, {})).rejects.toThrow("We couldn't find this lease on your account.");
  });

  it('refuses before both have signed and after the lease ended', async () => {
    for (const status of ['pending_signature', 'ended']) {
      const { service } = setup({ ...HOME, status });
      await expect(service.tenantRegister(USER, LEASE, body())).rejects.toThrow(ConflictException);
    }
  });

  it('files with its routes, audit and outbox in one transaction, then tells the leaders', async () => {
    const { service, repo, routing, tx } = setup();
    repo.find.mockResolvedValue({ id: REG, status: 'submitted', arrivalOn: '2026-10-25', departureOn: '2026-10-30', createdAt: NOW, changedAt: null } as unknown as RegistrationRow);
    await service.tenantRegister(USER, LEASE, body());
    expect(repo.insertRegistration).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        hostKind: 'tenant',
        leaseId: LEASE,
        propertyId: PROPERTY,
        unitId: 'u1',
        phone: '+250788123456',
        nationality: 'KE',
        idKind: null,
        idNumber: null,
        originCountry: 'KE',
        originVillageId: null,
        area: { villageId: 1101, cellId: 110, sectorId: 11, districtId: 1, provinceId: null },
      }),
    );
    expect(routing.plan).toHaveBeenCalledWith({ villageId: 1101, cellId: 110, sectorId: 11, districtId: 1, provinceId: null }, 'KE', tx);
    expect(repo.insertRoutes).toHaveBeenCalledWith(tx, REG, expect.any(Array), NOW);
    expect(repo.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: 'guest_registration.filed', registrationId: REG }));
    expect(repo.outbox).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: 'guest.registered', registrationId: REG }));
    // The audit row carries no name, phone or ID number.
    const diff = JSON.stringify(repo.audit.mock.calls[0]);
    expect(diff).not.toMatch(/Grace|788123456/);
    expect(routing.notify).toHaveBeenCalledWith(REG, false);
  });

  it('keeps the stay inside the lease, from today, at most 90 days', async () => {
    const { service } = setup();
    const past = await service.tenantRegister(USER, LEASE, { ...body(), arrivalOn: '2026-10-23' }).catch((e: unknown) => e);
    expect(issuePath(past)).toEqual(['arrivalOn']);
    const afterLease = await service.tenantRegister(USER, LEASE, { ...body(), arrivalOn: '2026-11-25', departureOn: '2026-12-02' }).catch((e: unknown) => e);
    expect(issuePath(afterLease)).toEqual(['departureOn']);
    const { service: longLease } = setup({ ...HOME, end: '2027-12-31' });
    const tooLong = await longLease.tenantRegister(USER, LEASE, { ...body(), arrivalOn: '2026-10-25', departureOn: '2027-01-24' }).catch((e: unknown) => e);
    expect((tooLong as BadRequestException).getResponse()).toMatchObject({ issues: [{ path: ['departureOn'], message: 'A stay can be at most 90 days.' }] });
  });

  it('takes no ID, a passport for a foreigner, and refuses a national ID for one', async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValue({ id: REG, status: 'submitted', arrivalOn: '2026-10-25', departureOn: '2026-10-30', createdAt: NOW, changedAt: null } as unknown as RegistrationRow);
    await service.tenantRegister(USER, LEASE, { ...body(), idNumber: 'pa 123-456' });
    expect(repo.insertRegistration).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ idKind: 'passport', idNumber: 'PA123456' }));
    const wrong = await service.tenantRegister(USER, LEASE, { ...body(), idKind: 'national_id', idNumber: '1199080012345012' }).catch((e: unknown) => e);
    expect(issuePath(wrong)).toEqual(['idKind']);
    await service.tenantRegister(USER, LEASE, { ...body(), nationality: 'RW', idNumber: '1 1990 8 0012345 0 12' });
    expect(repo.insertRegistration).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ idKind: 'national_id', idNumber: '1199080012345012' }));
    const short = await service.tenantRegister(USER, LEASE, { ...body(), nationality: 'RW', idNumber: '12345' }).catch((e: unknown) => e);
    expect((short as BadRequestException).getResponse()).toMatchObject({ issues: [{ path: ['idNumber'], message: 'A Rwandan ID number has 16 digits.' }] });
  });

  it('asks a few words for Other, and a real village for somewhere in Rwanda', async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValue({ id: REG, status: 'submitted', arrivalOn: '2026-10-25', departureOn: '2026-10-30', createdAt: NOW, changedAt: null } as unknown as RegistrationRow);
    const other = await service.tenantRegister(USER, LEASE, { ...body(), relationship: 'other', relationshipOther: '' }).catch((e: unknown) => e);
    expect(issuePath(other)).toEqual(['relationshipOther']);
    const village = await service.tenantRegister(USER, LEASE, { ...body(), origin: { kind: 'village', villageId: 9999 } }).catch((e: unknown) => e);
    expect(issuePath(village)).toEqual(['origin']);
    await service.tenantRegister(USER, LEASE, { ...body(), origin: { kind: 'village', villageId: 2202 } });
    expect(repo.insertRegistration).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ originCountry: 'RW', originVillageId: 2202 }));
  });

  it('a guest who has arrived can no longer be changed or cancelled', async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValue({ id: REG, hostKind: 'tenant', leaseId: LEASE, status: 'submitted', arrivalOn: '2026-10-20' } as unknown as RegistrationRow);
    await expect(service.tenantCancel(USER, LEASE, REG)).rejects.toThrow('This guest has already arrived');
    await expect(service.tenantUpdate(USER, LEASE, REG, body())).rejects.toThrow(ConflictException);
  });

  it('another lease’s guest is a 404 to this tenant', async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValue({ id: REG, hostKind: 'tenant', leaseId: 'another', status: 'submitted', arrivalOn: '2026-10-30' } as unknown as RegistrationRow);
    await expect(service.tenantCancel(USER, LEASE, REG)).rejects.toThrow(NotFoundException);
  });
});

describe('GuestRegistryService · a landlord’s own guests', () => {
  const ws = {
    workspaceId: WS,
    kind: 'business',
    domain: 'residence',
    orgId: 'o1',
    branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
  } as unknown as ScopedWorkspace;
  const landlordBody: LandlordGuestRequest = {
    fullName: 'Eric Habimana',
    phone: normaliseGuestPhone('+256 772 123 456') as string,
    relationship: 'friend',
    origin: { kind: 'country', countryCode: 'UG' },
    nationality: 'UG',
    arrivalOn: '2026-10-24',
    departureOn: '2026-10-24',
    propertyId: PROPERTY,
  };

  it('a hotel or any business that is not a residence is a 404', async () => {
    const { service } = setup();
    await expect(service.landlordList({ ...ws, domain: 'hospitality' } as ScopedWorkspace, {})).rejects.toThrow(NotFoundException);
  });

  it('a tenant’s guest answers a landlord exactly like an id that does not exist', async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValue({ id: REG, hostKind: 'tenant', workspaceId: WS, propertyId: PROPERTY, status: 'submitted', arrivalOn: '2026-10-30' } as unknown as RegistrationRow);
    const tenantGuest = await service.landlordCancel(ws, USER, REG).catch((e: unknown) => e);
    repo.find.mockResolvedValue(null);
    const missing = await service.landlordCancel(ws, USER, REG).catch((e: unknown) => e);
    expect(tenantGuest).toBeInstanceOf(NotFoundException);
    expect((tenantGuest as NotFoundException).message).toBe((missing as NotFoundException).message);
  });

  it('only lists the landlord’s own guests', async () => {
    const { service, repo } = setup();
    await service.landlordList(ws, {});
    expect(repo.hostList).toHaveBeenCalledWith({ workspaceId: WS, propertyIds: null });
  });

  it('registers a same-day stay with an international phone, outside any lease window', async () => {
    const { service, repo } = setup();
    repo.find.mockResolvedValue({ id: REG, status: 'submitted', arrivalOn: '2026-10-24', departureOn: '2026-10-24', createdAt: NOW, changedAt: null } as unknown as RegistrationRow);
    await service.landlordRegister(ws, USER, landlordBody);
    expect(repo.insertRegistration).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ hostKind: 'landlord', leaseId: null, phone: '+256772123456', propertyId: PROPERTY }),
    );
  });

  it('refuses a building outside the member’s branches', async () => {
    const { service } = setup();
    const limited = { ...ws, branchScope: { coverage: 'limited', selectedPropertyId: null, propertyIds: ['other'], includesUnbranched: false } } as unknown as ScopedWorkspace;
    const e = await service.landlordRegister(limited, USER, landlordBody).catch((x: unknown) => x);
    expect(issuePath(e)).toEqual(['propertyId']);
  });
});
