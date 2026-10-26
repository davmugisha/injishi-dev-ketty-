import type { OversightGrant } from '@injishi/contracts';

import type { GuestRegistryRepository, ReportRowRaw } from '../infrastructure/guest-registry.repository';
import { GuestReportsService } from './guest-reports.service';
import type { LeaderConsoleService } from './leader-console.service';

const base: ReportRowRaw = {
  arrivalOn: '2026-10-10',
  departureOn: '2026-10-14',
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
    reportRows: jest.fn(async () => ROWS),
    stayingNow: jest.fn(async () => 0),
    purgedCounts: jest.fn(async () => ({ registered: 0, fromAbroad: 0, flagged: 0 })),
    leader: jest.fn(async () => ({ name: 'Jeanne', email: 'leader@injishi.test' })),
    placeIn: jest.fn(async () => null),
    areaNames: jest.fn(async () => ({})),
  };
  const console = {
    posts: jest.fn(() => [{ oversightRole: 'village_leader', scopeLevel: 'village', villageId: 102070111 }]),
    scopes: jest.fn(async () => []),
  };
  const service = new GuestReportsService(guests as unknown as GuestRegistryRepository, console as unknown as LeaderConsoleService);
  return { service, guests };
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
