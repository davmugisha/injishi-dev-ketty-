import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { OversightGrant } from '@injishi/contracts';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { GuestRegistryRepository, RegistrationRow } from '../infrastructure/guest-registry.repository';
import { TALLY_COLUMNS, scopeSql, unseenSql } from '../infrastructure/leader-scope';
import { GuestHousekeepingService, retentionCutoff } from './guest-housekeeping.service';
import { LeaderConsoleService, narrowSql, tabSql } from './leader-console.service';

const NOW = new Date('2026-10-24T08:00:00Z');
const REG = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';
const dialect = new PgDialect();
const render = (q: SQL): { sql: string; params: unknown[] } => dialect.sqlToQuery(q);

class Pinned extends LeaderConsoleService {
  protected override now(): Date {
    return NOW;
  }
}

function grant(role: OversightGrant['oversightRole'], area: Partial<OversightGrant> = {}): OversightGrant {
  return {
    assignmentId: `as-${role}`,
    oversightRole: role,
    governmentBodyCode: role === 'district_immigration' ? 'DGIE' : 'MINALOC',
    governmentTitle: null,
    scopeLevel: 'district',
    provinceId: null,
    districtId: 1,
    sectorId: null,
    cellId: null,
    villageId: null,
    ...area,
  };
}

function guest(over: Partial<RegistrationRow> = {}): RegistrationRow {
  return {
    id: REG,
    orgId: 'o1',
    workspaceId: 'w1',
    hostKind: 'tenant',
    leaseId: 'l1',
    propertyId: 'p1',
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
    registeredByUserId: 'host',
    fullName: 'Grace Mutoni',
    phone: '+254712345678',
    nationality: 'KE',
    nationalityName: 'Kenya',
    idKind: 'passport',
    idNumber: 'PA123456',
    relationship: 'friend',
    relationshipLabel: 'Friend',
    relationshipOther: null,
    originCountry: 'KE',
    originCountryName: 'Kenya',
    originVillageId: null,
    originVillageName: null,
    originCellName: null,
    originSectorName: null,
    originDistrictName: null,
    arrivalOn: '2026-10-25',
    departureOn: '2026-10-30',
    status: 'submitted',
    hostName: 'Aline Uwera',
    hostPhone: '+250788123456',
    changedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    ...over,
  };
}

type RepoMocks = Record<'leaderFind' | 'routesFor' | 'markSeen' | 'transaction' | 'flag' | 'audit' | 'outbox', jest.Mock>;

function setup(found: RegistrationRow | null): { repo: RepoMocks; service: LeaderConsoleService } {
  const repo: RepoMocks = {
    leaderFind: jest.fn(async () => found),
    routesFor: jest.fn(async () => []),
    markSeen: jest.fn(async () => 1),
    transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({ tx: true })),
    flag: jest.fn(async () => 'route-1'),
    audit: jest.fn(async () => undefined),
    outbox: jest.fn(async () => undefined),
  };
  return { repo, service: new Pinned(repo as unknown as GuestRegistryRepository) };
}

describe('LeaderConsoleService · scope', () => {
  it('a person with no leader post is refused', () => {
    const { service } = setup(null);
    expect(() => service.posts([grant('business_approver')])).toThrow(ForbiddenException);
  });

  it('a guest outside the area answers 404', async () => {
    const { service } = setup(null);
    await expect(service.one([grant('village_leader', { scopeLevel: 'village', villageId: 9999, cellId: 1, sectorId: 1 })], REG)).rejects.toThrow(NotFoundException);
  });

  it('immigration never reads a Rwandan guest, even if a query let one through', async () => {
    const { service } = setup(guest({ nationality: 'RW', nationalityName: 'Rwanda' }));
    await expect(service.one([grant('district_immigration')], REG)).rejects.toThrow('That guest was not found.');
    const { service: forAbroad } = setup(guest());
    await expect(forAbroad.one([grant('district_immigration')], REG)).resolves.toMatchObject({ id: REG, fromAbroad: true, idNumber: 'PA123456' });
  });

  it('the district officer (local government) reads guests from abroad too', async () => {
    const { service } = setup(guest());
    await expect(service.one([grant('district_officer')], REG)).resolves.toMatchObject({ id: REG, fromAbroad: true });
  });

  it('writes the area as SQL: one clause per post, immigration with the abroad test', () => {
    const q = render(
      scopeSql([
        { assignmentId: 'a', oversightRole: 'village_leader', districtId: 1, sectorId: 11, cellId: 110, villageId: 1101 },
        { assignmentId: 'b', oversightRole: 'district_immigration', districtId: 1, sectorId: null, cellId: null, villageId: null },
        { assignmentId: 'c', oversightRole: 'district_officer', districtId: 2, sectorId: null, cellId: null, villageId: null },
        { assignmentId: 'e', oversightRole: 'dgie_province', provinceId: 5, districtId: null, sectorId: null, cellId: null, villageId: null },
        { assignmentId: 'f', oversightRole: 'dgie_national', districtId: null, sectorId: null, cellId: null, villageId: null },
      ]),
    );
    expect(q.sql).toBe(
      "(g.village_id = $1 or (g.district_id = $2 and (g.nationality <> 'RW')) or g.district_id = $3 or (g.district_id in (select pd.id from districts pd where pd.province_id = $4) and (g.nationality <> 'RW')) or (g.nationality <> 'RW'))",
    );
    expect(q.params).toEqual([1101, 1, 2, 5]);
    expect(render(scopeSql([])).sql).toBe('false');
    expect(render(scopeSql([{ assignmentId: 'b', oversightRole: 'district_immigration', districtId: 1, sectorId: null, cellId: null, villageId: null }], TALLY_COLUMNS)).sql).toBe(
      '((t.district_id = $1 and t.from_abroad))',
    );
    expect(render(unseenSql([{ assignmentId: 'd', oversightRole: 'dasso', districtId: 1, sectorId: 11, cellId: null, villageId: null }])).sql).toContain("ur.recipient_role::text = $2 and ur.seen_at is null");
  });

  it('narrows and tabs inside the area, never instead of it', () => {
    expect(render(narrowSql({ sectorId: 11, villageId: 1101 })).sql).toBe('(g.sector_id = $1 and g.village_id = $2)');
    expect(render(narrowSql({})).sql).toBe('true');
    const soon = render(tabSql({ tab: 'arriving', when: 'soon' }, '2026-10-24').where);
    expect(soon.params).toEqual(['2026-10-24', '2026-10-31']);
    const later = render(tabSql({ tab: 'arriving', when: 'later' }, '2026-10-24').where);
    expect(later.sql).toBe('(g.arrival_on > $1::date)');
    expect(render(tabSql({ tab: 'staying', when: 'soon', q: 'grace' }, '2026-10-24').where).params).toEqual(['2026-10-24', '2026-10-24', '%grace%', '%grace%', '%grace%']);
  });
});

describe('LeaderConsoleService · opening and flagging', () => {
  it('opening marks seen on each covering post only', async () => {
    const { service, repo } = setup(guest());
    await service.seen(USER, [grant('dasso', { scopeLevel: 'sector', sectorId: 11 }), grant('district_immigration'), grant('village_leader', { scopeLevel: 'village', villageId: 5555, cellId: 1, sectorId: 1 })], REG);
    expect(repo.markSeen).toHaveBeenCalledWith(REG, ['dasso', 'district_immigration'], USER, NOW);
  });

  it('flags on the leader’s own step, audits with the note as the reason, and writes the outbox', async () => {
    const { service, repo } = setup(guest());
    await service.flag(USER, [grant('cell_executive', { scopeLevel: 'cell', sectorId: 11, cellId: 110 })], REG, { note: 'Stays longer than said' });
    expect(repo.flag).toHaveBeenCalledWith({ tx: true }, REG, 'cell_executive', USER, 'Stays longer than said', NOW);
    expect(repo.audit).toHaveBeenCalledWith({ tx: true }, expect.objectContaining({ eventType: 'guest_registration.flagged', reason: 'Stays longer than said' }));
    expect(repo.outbox).toHaveBeenCalledWith({ tx: true }, expect.objectContaining({ eventType: 'guest.flagged', registrationId: REG }));
    expect(repo.markSeen).toHaveBeenCalledWith(REG, ['cell_executive'], USER, NOW);
  });
});

describe('GuestHousekeepingService · the 12 month purge', () => {
  it('purges what left more than 12 months ago and reports the counts kept', async () => {
    const repo = { purge: jest.fn(async () => ({ purged: 3, tallies: 2 })) };
    class PinnedHousekeeping extends GuestHousekeepingService {
      protected override now(): Date {
        return NOW;
      }
    }
    const result = await new PinnedHousekeeping(repo as unknown as GuestRegistryRepository).purge();
    expect(repo.purge).toHaveBeenCalledWith('2025-10-24');
    expect(result).toEqual({ cutoff: '2025-10-24', purged: 3, tallies: 2 });
    expect(retentionCutoff('2026-02-28')).toBe('2025-02-28');
  });
});
