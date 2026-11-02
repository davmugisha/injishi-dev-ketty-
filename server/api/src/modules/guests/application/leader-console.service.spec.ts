import { describe, expect, it, type Mock, vi } from 'vitest';

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { OversightGrant } from '@injishi/contracts';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

import type { GuestRegistryRepository, RegistrationRow } from '../infrastructure/guest-registry.repository';
import { TALLY_COLUMNS, scopeSql, unseenSql } from '../infrastructure/leader-scope';
import { GuestHousekeepingService, retentionCutoff } from './guest-housekeeping.service';
import { LeaderConsoleService, arrivedWindow, guestFilterSql, listFilterWords, narrowSql, tabSql } from './leader-console.service';

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
    businessKind: 'residence',
    roomLabel: null,
    checkedInAt: null,
    changedAt: null,
    cancelledAt: null,
    createdAt: NOW,
    ...over,
  };
}

type RepoMocks = Record<'leaderFind' | 'routesFor' | 'markSeen' | 'transaction' | 'flag' | 'audit' | 'outbox', Mock>;

function setup(found: RegistrationRow | null): { repo: RepoMocks; service: LeaderConsoleService } {
  const repo: RepoMocks = {
    leaderFind: vi.fn(async () => found),
    routesFor: vi.fn(async () => []),
    markSeen: vi.fn(async () => 1),
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn({ tx: true })),
    flag: vi.fn(async () => 'route-1'),
    audit: vi.fn(async () => undefined),
    outbox: vi.fn(async () => undefined),
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
    // Nothing chosen: every guest, only the search narrows it.
    expect(render(tabSql({ tab: 'all', when: 'soon' }, '2026-10-24').where).params).toEqual([]);
    expect(render(tabSql({ tab: 'all', when: 'soon', q: 'ana' }, '2026-10-24').where).params).toEqual(['%ana%', '%ana%', '%ana%']);
    const later = render(tabSql({ tab: 'arriving', when: 'later' }, '2026-10-24').where);
    expect(later.sql).toBe('(g.arrival_on > $1::date)');
    expect(render(tabSql({ tab: 'staying', when: 'soon', q: 'grace' }, '2026-10-24').where).params).toEqual(['2026-10-24', '2026-10-24', '%grace%', '%grace%', '%grace%']);
  });
});

describe('LeaderConsoleService · the guest filters, on the server', () => {
  const today = '2026-11-02';

  it('nothing chosen narrows nothing', () => {
    expect(render(guestFilterSql({}, today)).sql).toBe('true');
  });

  it('arrived: a preset reads from the Kigali day, a custom range as given', () => {
    expect(arrivedWindow({ arrived: 'today' }, today)).toEqual({ from: today, to: today });
    expect(arrivedWindow({ arrived: 'yesterday' }, today)).toEqual({ from: '2026-11-01', to: '2026-11-01' });
    expect(arrivedWindow({ arrived: 'last_7_days' }, today)).toEqual({ from: '2026-10-27', to: today });
    expect(arrivedWindow({ arrived: 'this_month' }, today)).toEqual({ from: '2026-11-01', to: today });
    expect(arrivedWindow({ arrivedFrom: '2026-10-01', arrivedTo: '2026-10-15' }, today)).toEqual({ from: '2026-10-01', to: '2026-10-15' });
    const q = render(guestFilterSql({ arrived: 'last_7_days' }, today));
    expect(q.sql).toBe('(g.arrival_on >= $1::date and g.arrival_on <= $2::date)');
    expect(q.params).toEqual(['2026-10-27', today]);
  });

  it('present on a day, leaving today or within 7 days', () => {
    const present = render(guestFilterSql({ presentOn: '2026-10-28' }, today));
    expect(present.sql).toBe('((g.arrival_on <= $1::date and g.departure_on >= $2::date))');
    expect(render(guestFilterSql({ leaving: 'today' }, today)).params).toEqual([today]);
    expect(render(guestFilterSql({ leaving: 'next_7_days' }, today)).params).toEqual([today, '2026-11-09']);
  });

  it('length of stay in nights', () => {
    expect(render(guestFilterSql({ length: 'under_3' }, today))).toMatchObject({ sql: '((g.departure_on - g.arrival_on) <= $1)', params: [2] });
    expect(render(guestFilterSql({ length: 'week' }, today))).toMatchObject({ sql: '((g.departure_on - g.arrival_on) >= $1)', params: [7] });
    expect(render(guestFilterSql({ length: 'month' }, today)).params).toEqual([30]);
  });

  it('type of place: a residence is any tenant or landlord, a hotel the business kinds it covers', () => {
    expect(render(guestFilterSql({ placeType: 'residence' }, today)).sql).toBe("(g.host_kind::text <> 'hotel')");
    const hotel = render(guestFilterSql({ placeType: 'hotel' }, today));
    expect(hotel.sql).toContain("g.host_kind::text = 'hotel' and (select po.business_kind::text from orgs po where po.id = g.org_id) in ($1, $2)");
    expect(hotel.params).toEqual(['hotel', 'motel']);
    expect(render(guestFilterSql({ placeType: 'other' }, today)).sql).toContain('not in');
  });

  it('every filter together is one predicate, and says itself in words for a file', () => {
    const q = render(guestFilterSql({ nationality: 'KE', placeType: 'guest_house', length: 'week', leaving: 'today' }, today));
    expect(q.params).toEqual(['KE', 'guest_house', 7, today]);
    const words = listFilterWords(
      { tab: 'staying', arrived: 'yesterday', placeType: 'lodge', length: 'month', nationality: 'KE', presentOn: '2026-10-30' },
      today,
      { nationalities: [{ code: 'KE', name: 'Kenya', count: 1 }], relationships: [] },
    );
    expect(words).toEqual(['Staying now', 'Arrived yesterday (2026-11-01)', 'Present on 2026-10-30', '1 month or more', 'Lodge', 'Kenya']);
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
    const repo = { purge: vi.fn(async () => ({ purged: 3, tallies: 2 })) };
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
