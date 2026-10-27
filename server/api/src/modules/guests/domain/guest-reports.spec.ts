import {
  type ReportRow,
  TOP_HOMES,
  arrivalSeries,
  averageNights,
  byArea,
  byNationality,
  byRelationship,
  bucketsBetween,
  reportBucket,
  reportFigures,
  topHomes,
  weekStart,
} from './guest-reports';

function row(over: Partial<ReportRow> = {}): ReportRow {
  return {
    arrivalOn: '2026-10-05',
    departureOn: '2026-10-08',
    nationality: 'RW',
    nationalityName: 'Rwanda',
    fromAbroad: false,
    relationship: 'friend',
    relationshipLabel: 'Friend',
    sectorId: 11,
    sectorName: 'Kacyiru',
    cellId: 110,
    cellName: 'Kamatamu',
    villageId: 1101,
    villageName: 'Urugwiro',
    propertyId: 'p1',
    unitId: 'u1',
    homeAddress: 'KG 7 Ave, Urugwiro village',
    unitLabel: 'A-01',
    flagged: false,
    ...over,
  };
}

describe('guest reports: buckets', () => {
  it('a month or less is by day, up to half a year by week, longer by month', () => {
    expect(reportBucket('2026-10-01', '2026-10-31')).toBe('day');
    expect(reportBucket('2026-10-01', '2026-11-01')).toBe('week');
    expect(reportBucket('2026-05-01', '2026-10-30')).toBe('week');
    expect(reportBucket('2026-01-01', '2026-12-31')).toBe('month');
  });

  it('weeks start on Monday', () => {
    expect(weekStart('2026-10-24')).toBe('2026-10-19'); // a Saturday
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // a Monday
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // a Sunday
  });

  it('every bucket of the period is present, with its label', () => {
    expect(bucketsBetween('2026-10-30', '2026-11-02', 'day').map((b) => b.label)).toEqual(['30 Oct', '31 Oct', '1 Nov', '2 Nov']);
    expect(bucketsBetween('2026-11-15', '2027-01-10', 'month').map((b) => [b.start, b.label])).toEqual([
      ['2026-11-01', 'Nov 2026'],
      ['2026-12-01', 'Dec 2026'],
      ['2027-01-01', 'Jan 2027'],
    ]);
  });

  it('counts arrivals per bucket and fills the empty ones with 0', () => {
    const series = arrivalSeries([row({ arrivalOn: '2026-10-02' }), row({ arrivalOn: '2026-10-02' }), row({ arrivalOn: '2026-10-04' })], '2026-10-01', '2026-10-04');
    expect(series.bucket).toBe('day');
    expect(series.points.map((p) => p.count)).toEqual([0, 2, 0, 1]);
  });
});

describe('guest reports: figures', () => {
  it('averages nights to one decimal; a same-day stay is 0 nights; no guests is null', () => {
    expect(averageNights([row({ arrivalOn: '2026-10-01', departureOn: '2026-10-04' }), row({ arrivalOn: '2026-10-01', departureOn: '2026-10-01' })])).toBe(1.5);
    expect(averageNights([row({ arrivalOn: '2026-10-01', departureOn: '2026-10-03' }), row({ arrivalOn: '2026-10-01', departureOn: '2026-10-02' }), row({ arrivalOn: '2026-10-01', departureOn: '2026-10-02' })])).toBe(1.3);
    expect(averageNights([])).toBeNull();
  });

  it('breaks down by area, guests with no place at that level in one row', () => {
    const table = byArea([row(), row({ fromAbroad: true, flagged: true }), row({ villageId: null, villageName: null })], 'village');
    expect(table).toEqual([
      { id: 1101, name: 'Urugwiro', registered: 2, fromAbroad: 1, flagged: 1 },
      { id: 0, name: 'No village on record', registered: 1, fromAbroad: 0, flagged: 0 },
    ]);
  });

  it('names the ten largest nationalities and folds the rest into Other countries', () => {
    const rows = Array.from({ length: 12 }, (_, i) => Array.from({ length: 12 - i }, () => row({ nationality: `C${i}`, nationalityName: `Country ${i}` }))).flat();
    const table = byNationality(rows);
    expect(table).toHaveLength(10);
    expect(table[0]).toEqual({ code: 'C0', name: 'Country 0', count: 12 });
    expect(table[9]).toEqual({ code: 'other', name: 'Other countries', count: 3 + 2 + 1 });
    expect(table.reduce((n, t) => n + t.count, 0)).toBe(rows.length);
  });

  it('counts relationships, most first', () => {
    expect(byRelationship([row(), row({ relationship: 'mother', relationshipLabel: 'Mother' }), row()])).toEqual([
      { code: 'friend', label: 'Friend', count: 2 },
      { code: 'mother', label: 'Mother', count: 1 },
    ]);
  });

  it('lists homes by address and unit, never by person, at most ten', () => {
    const rows = [row(), row(), row({ unitId: 'u2', unitLabel: 'A-02' }), ...Array.from({ length: 12 }, (_, i) => row({ propertyId: `p${i + 2}`, unitId: null, unitLabel: null, homeAddress: `Street ${i}` }))];
    const homes = topHomes(rows);
    expect(homes).toHaveLength(TOP_HOMES);
    expect(homes[0]).toEqual({ address: 'KG 7 Ave, Urugwiro village', unitLabel: 'A-01', guests: 2 });
    expect(Object.keys(homes[0]!)).toEqual(['address', 'unitLabel', 'guests']);
  });

  it('totals the period, keeps staying-now as given and adds the purged counts', () => {
    const figures = reportFigures({
      rows: [row(), row({ fromAbroad: true, nationality: 'KE', nationalityName: 'Kenya' }), row({ flagged: true }), row({ arrivalOn: '2026-09-30' })],
      from: '2026-10-01',
      to: '2026-10-31',
      stayingNow: 7,
      areaLevel: 'village',
      purged: { before: '2025-10-24', registered: 5, fromAbroad: 2, flagged: 1 },
    });
    expect(figures.totals).toEqual({ registered: 3 + 5, stayingNow: 7, fromAbroad: 1 + 2, flagged: 1 + 1, averageNights: 3 });
    expect(figures.arrivals.points).toHaveLength(31);
    expect(figures.purged).toEqual({ before: '2025-10-24', registered: 5, fromAbroad: 2, flagged: 1 });
    expect(reportFigures({ rows: [], from: '2026-10-01', to: '2026-10-31', stayingNow: 0, areaLevel: 'sector', purged: { before: 'x', registered: 0, fromAbroad: 0, flagged: 0 } }).purged).toBeNull();
  });
});
