import { describe, expect, it, vi } from 'vitest';

import type { OversightGrant } from '@injishi/contracts';

import type { GuestRegistryRepository, ReportRowRaw } from '../infrastructure/guest-registry.repository';
import { GuestReportsService } from './guest-reports.service';
import type { LeaderConsoleService } from './leader-console.service';

const base: ReportRowRaw = {
  arrivalOn: '2026-10-10',
  departureOn: '2026-10-14',
  reportedOn: '2026-10-09',
  hostKind: 'tenant',
  businessKind: 'residence',
  propertyName: 'Amani Residences',
  nationality: 'RW',
  nationalityName: 'Rwanda',
  relationship: 'friend',
  relationshipLabel: 'Friend',
  sectorId: 10207,
  sectorName: 'Kacyiru',
  cellId: 1020701,
  cellName: 'Kamatamu',
  villageId: 102070111,
  villageName: 'Urugwiro',
  districtName: 'Gasabo',
  propertyId: 'p1',
  unitId: 'u1',
  addressText: 'KG 7 Ave',
  unitLabel: 'A-01',
  flagged: false,
};
const ROWS: ReportRowRaw[] = [
  base,
  { ...base, nationality: 'KE', nationalityName: 'Kenya', relationship: 'cousin', relationshipLabel: 'Cousin' },
  { ...base, nationality: 'KE', nationalityName: 'Kenya', flagged: true },
];

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function harness() {
  const guests = {
    reportRows: vi.fn(async () => ROWS),
    reportChain: vi.fn(async () => [
      { role: 'village_leader', step: 1, guests: 3, delivered: 3, opened: 2, flagged: 1, waiting: 0 },
      { role: 'cell_executive', step: 3, guests: 3, delivered: 0, opened: 0, flagged: 0, waiting: 3 },
    ]),
    stayingNow: vi.fn(async () => 0),
    presentByDay: vi.fn(async () => [
      { day: '2026-10-10', total: 3, fromAbroad: 2 },
      { day: '2026-10-11', total: 1, fromAbroad: 0 },
    ]),
    purgedCounts: vi.fn(async () => ({ registered: 0, fromAbroad: 0, flagged: 0 })),
    leader: vi.fn(async () => ({ name: 'Jeanne', email: 'leader@injishi.test' })),
    placeIn: vi.fn(async () => null),
    areaNames: vi.fn(async () => ({})),
  };
  const console = {
    posts: vi.fn(() => [{ oversightRole: 'village_leader', scopeLevel: 'village', villageId: 102070111 }]),
    scopes: vi.fn(async () => []),
    audience: vi.fn((): 'local' | 'dgie' => 'local'),
    narrowedWords: vi.fn(async () => null),
  };
  const service = new GuestReportsService(guests as unknown as GuestRegistryRepository, console as unknown as LeaderConsoleService);
  return { service, guests, console };
}

const grants: OversightGrant[] = [];
const period = { from: '2026-10-01', to: '2026-10-31' };

describe('GuestReportsService filters', () => {
  it('with no filter counts every guest and offers every nationality and relationship', async () => {
    const r = await harness().service.report('me', grants, period);
    expect(r.totals.registered).toBe(3);
    expect(r.totals.fromAbroad).toBe(2);
    expect(r.filteredBy).toEqual([]);
    expect(r.choices.nationalities).toEqual([
      { code: 'KE', name: 'Kenya', count: 2 },
      { code: 'RW', name: 'Rwanda', count: 1 },
    ]);
    expect(r.choices.relationships.map((x) => x.code)).toEqual(['friend', 'cousin']);
    expect(r.chain.map((c) => [c.label, c.opened, c.waiting])).toEqual([
      ['Village leader (Umudugudu)', 2, 0],
      ['Cell executive secretary', 0, 3],
    ]);
  });

  it('narrows every figure to foreign, one nationality, one relationship or the flagged, and names the filter', async () => {
    const h = harness();
    expect((await h.service.report('me', grants, { ...period, origin: 'nationals' })).totals.registered).toBe(1);
    expect((await h.service.report('me', grants, { ...period, origin: 'international' })).totals.registered).toBe(2);
    const kenya = await h.service.report('me', grants, { ...period, nationality: 'KE' });
    expect(kenya.totals.registered).toBe(2);
    expect(kenya.filteredBy).toEqual(['Kenya']);
    // The choices stay whole, so the filter can be changed without clearing it first.
    expect(kenya.choices.nationalities).toHaveLength(2);
    expect((await h.service.report('me', grants, { ...period, relationship: 'cousin' })).totals.registered).toBe(1);
    const flagged = await h.service.report('me', grants, { ...period, flagged: 'only' });
    expect(flagged.totals.registered).toBe(1);
    expect(flagged.filteredBy).toEqual(['Flagged only']);
  });

  it('leaves purged months out when a filter they cannot answer is on', async () => {
    const h = harness();
    await h.service.report('me', grants, { from: '2024-01-01', to: '2024-12-31', nationality: 'KE' });
    expect(h.guests.purgedCounts).not.toHaveBeenCalled();
    await h.service.report('me', grants, { from: '2024-01-01', to: '2024-12-31', origin: 'international' });
    expect(h.guests.purgedCounts).toHaveBeenCalledTimes(1);
  });
});

describe('GuestReportsService figures', () => {
  it('counts Rwandan and foreign guests, the types of place, the stays and when they were reported', async () => {
    const h = harness();
    h.guests.reportRows.mockResolvedValueOnce([
      ...ROWS,
      { ...base, hostKind: 'hotel', businessKind: 'motel', propertyName: 'Urugwiro Motel', nationality: 'FR', nationalityName: 'France', reportedOn: '2026-10-10', departureOn: '2026-11-20' },
    ]);
    const r = await h.service.report('me', grants, period);
    expect(r.totals).toMatchObject({ registered: 4, nationals: 1, fromAbroad: 3, nationalities: 3 });
    expect(r.byPlaceType.map((p) => [p.type, p.count, p.fromAbroad])).toEqual([
      ['residence', 3, 2],
      ['hotel', 1, 1],
    ]);
    expect(r.stayBands.find((b) => b.band === 'month')?.count).toBe(1);
    expect(r.timing.map((t) => [t.timing, t.count])).toEqual([
      ['before', 3],
      ['same_day', 1],
      ['after', 0],
    ]);
    expect(r.topHomes[0]).toMatchObject({ name: 'Amani Residences', placeLabel: 'Residence', unitLabel: 'A-01', guests: 3, fromAbroad: 2 });
    expect(r.topHomes[1]).toMatchObject({ name: 'Urugwiro Motel', placeLabel: 'Motel', unitLabel: null });
    expect(r.presentByDay.map((d) => [d.label, d.total])).toEqual([
      ['10 Oct', 3],
      ['11 Oct', 1],
    ]);
  });

  it('filters by type of place and length of stay, and names them', async () => {
    const h = harness();
    h.guests.reportRows.mockResolvedValue([
      ...ROWS,
      { ...base, hostKind: 'hotel', businessKind: 'lodge', propertyName: 'Hill Lodge', departureOn: '2026-10-11' },
    ]);
    const lodges = await h.service.report('me', grants, { ...period, placeType: 'lodge' });
    expect(lodges.totals.registered).toBe(1);
    expect(lodges.filteredBy).toEqual(['Lodge']);
    const short = await h.service.report('me', grants, { ...period, length: 'under_3' });
    expect(short.totals.registered).toBe(1);
    expect(short.filteredBy).toEqual(['Under 3 nights']);
  });

  it('gives DGIE its own chain and leaves local government its own', async () => {
    const h = harness();
    h.guests.reportChain.mockResolvedValue([
      { role: 'village_leader', step: 1, guests: 2, delivered: 2, opened: 1, flagged: 0, waiting: 0 },
      { role: 'dgie_village', step: 4, guests: 2, delivered: 2, opened: 2, flagged: 0, waiting: 0 },
    ]);
    h.console.audience.mockReturnValue('dgie');
    const dgie = await h.service.report('me', grants, period);
    expect(dgie.audience).toBe('dgie');
    expect(dgie.chain.map((c) => c.role)).toEqual(['dgie_village']);
    h.console.audience.mockReturnValue('local');
    expect((await h.service.report('me', grants, period)).chain.map((c) => c.role)).toEqual(['village_leader']);
  });
});
