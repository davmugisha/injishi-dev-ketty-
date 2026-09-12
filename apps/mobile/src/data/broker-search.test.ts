/**
 * The Directory search: the facets, the filter, and the sentence the field
 * prints.
 *
 * The facets are derived from the catalogue by design (ADR-011 call 4), so the
 * assertions below are about the DERIVATION rather than about a fixed list — a
 * test that asserted "there are eight districts" would fail the day somebody
 * added a unit, which is the opposite of what it should do.
 *
 * `translate` from the real catalogue rather than a stub `t`, so every sentence
 * these functions build is checked against a key that actually exists, in both
 * columns.
 */
import {
  BEDROOM_STEPS,
  DEFAULT_UNIT_SEARCH,
  RENT_CEILINGS,
  UNIT_DIMENSIONS,
  UNIT_DISTRICTS,
  activeUnitFilterCount,
  searchUnits,
  shortRwf,
  sameUnitSearch,
  summariseUnitSearch,
  unitEmptyReason,
  type UnitSearch,
} from './broker-search';
import { DIRECTORY_UNITS } from './broker';
import { en, rw } from '@/i18n/messages';
import type { MessageKey } from '@/i18n/i18n';

/** The provider-free `t`, bound to one catalogue. */
const tr =
  (catalogue: Record<MessageKey, string>) =>
  (key: MessageKey, values?: Record<string, string | number>) =>
    (catalogue[key] ?? key).replace(/\{(\w+)\}/g, (whole, name: string) =>
      values && name in values ? String(values[name]) : whole,
    );

const t = tr(en);
const search = (over: Partial<UnitSearch> = {}): UnitSearch => ({ ...DEFAULT_UNIT_SEARCH, ...over });

describe('the facets', () => {
  it('offers a district only where a unit is in it', () => {
    const districts = new Set(DIRECTORY_UNITS.map((u) => u.district));
    expect(UNIT_DISTRICTS.map((d) => d.name).sort()).toEqual([...districts].sort());
    for (const facet of UNIT_DISTRICTS) expect(facet.count).toBeGreaterThan(0);
  });

  it('counts each district against the catalogue rather than against a hand-kept number', () => {
    for (const facet of UNIT_DISTRICTS) {
      expect(facet.count).toBe(DIRECTORY_UNITS.filter((u) => u.district === facet.name).length);
    }
  });

  it('orders districts busiest first, so the useful chip is the reachable one', () => {
    const counts = UNIT_DISTRICTS.map((d) => d.count);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });

  it('offers a bedroom step only where a unit has that many', () => {
    const sizes = new Set(DIRECTORY_UNITS.map((u) => u.bedrooms));
    expect(BEDROOM_STEPS).toEqual([...sizes].sort((a, b) => a - b));
  });

  /**
   * The property that makes a ceiling chip worth drawing: it has to both keep
   * something and exclude something. A ceiling above the priciest unit narrows
   * nothing; one below the cheapest empties the list with no filter to blame.
   */
  it('offers a ceiling only where it both keeps and excludes a unit', () => {
    expect(RENT_CEILINGS.length).toBeGreaterThan(0);
    for (const ceiling of RENT_CEILINGS) {
      expect(DIRECTORY_UNITS.some((u) => u.rent <= ceiling)).toBe(true);
      expect(DIRECTORY_UNITS.some((u) => u.rent > ceiling)).toBe(true);
    }
  });
});

describe('the filter', () => {
  it('returns everything when nothing is asked for', () => {
    expect(searchUnits(DEFAULT_UNIT_SEARCH)).toHaveLength(DIRECTORY_UNITS.length);
    expect(activeUnitFilterCount(DEFAULT_UNIT_SEARCH)).toBe(0);
  });

  it('reads a bedroom count as "at least", which is what a broker is asking', () => {
    const two = searchUnits(search({ bedrooms: 2 }));
    expect(two.every((u) => u.bedrooms >= 2)).toBe(true);
    expect(two.some((u) => u.bedrooms > 2)).toBe(true);
  });

  it('treats the ceiling as inclusive, so a unit exactly on budget survives', () => {
    const onTheNose = DIRECTORY_UNITS[0].rent;
    expect(searchUnits(search({ ceiling: onTheNose })).map((u) => u.id)).toContain(
      DIRECTORY_UNITS[0].id,
    );
  });

  it('means EITHER district when two are ticked, never both', () => {
    const [a, b] = UNIT_DISTRICTS;
    const hits = searchUnits(search({ districts: [a.name, b.name] }));
    expect(hits).toHaveLength(a.count + b.count);
  });

  it('matches free text against the property, the unit and the district', () => {
    expect(searchUnits(search({ where: 'umurava' })).map((u) => u.id)).toContain(
      'umurava-heights-b4',
    );
    expect(searchUnits(search({ where: 'Kimihurura' })).length).toBeGreaterThan(1);
  });

  it('keeps a unit free today inside "vacant soon" — soon has not stopped meaning now', () => {
    const soon = searchUnits(search({ vacancy: 'soon' }));
    expect(soon.some((u) => u.vacancy.state === 'now')).toBe(true);
    expect(soon.every((u) => u.vacancy.state !== 'leased')).toBe(true);
  });

  it('orders ready first, then dated, then let — a let unit cannot be placed', () => {
    const rank = (state: string) => (state === 'now' ? 0 : state === 'from' ? 1 : 2);
    const order = searchUnits(DEFAULT_UNIT_SEARCH).map((u) => rank(u.vacancy.state));
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('names one filter per axis the reader has narrowed on', () => {
    expect(activeUnitFilterCount(search({ bedrooms: 2, ceiling: 500000 }))).toBe(2);
    expect(activeUnitFilterCount(search({ where: '   ' }))).toBe(0);
  });
});

describe('why the list came back empty', () => {
  it('blames the one filter that, lifted alone, brings results back', () => {
    // Nothing in Kimihurura has four bedrooms, but four-bedroom units exist and
    // Kimihurura units exist — so exactly one of the two is liftable.
    const impossible = search({ districts: ['Kimihurura'], bedrooms: 4 });
    expect(searchUnits(impossible)).toHaveLength(0);
    const reason = unitEmptyReason(impossible);
    expect(reason).not.toBeNull();
    expect(searchUnits(reason!.clear(impossible)).length).toBeGreaterThan(0);
  });

  it('offers a clear that lifts one axis and leaves the rest of the search alone', () => {
    const narrow = search({ districts: ['Kimihurura'], bedrooms: 4, tenure: 'long_term' });
    const reason = unitEmptyReason(narrow);
    expect(reason!.clear(narrow).tenure).toBe('long_term');
  });

  it('says nothing when nothing is filtered — there is no filter to blame', () => {
    expect(unitEmptyReason(DEFAULT_UNIT_SEARCH)).toBeNull();
  });

  it('gives every dimension a label that exists in BOTH catalogues', () => {
    for (const d of UNIT_DIMENSIONS) {
      expect(en[d.label]).toBeTruthy();
      expect(rw[d.label]).toBeTruthy();
    }
  });
});

describe('the search summary', () => {
  it('falls back to the placeholder on an untouched search', () => {
    expect(summariseUnitSearch(DEFAULT_UNIT_SEARCH, t)).toBe(en['directory.searchPlaceholder']);
  });

  it('prints frame B21’s own sentence, in the frame’s order', () => {
    const summary = summariseUnitSearch(
      search({ districts: ['Kimihurura'], bedrooms: 2, ceiling: 350000 }),
      t,
    );
    expect(summary).toBe('Kimihurura · 2 bed + · ≤ 350K');
  });

  it('collapses several districts into a count rather than a list that overflows', () => {
    const summary = summariseUnitSearch(search({ districts: ['Kimihurura', 'Remera'] }), t);
    expect(summary).toBe('2 districts');
  });

  it('reads in Kinyarwanda too, which is what stresses the field’s width', () => {
    const summary = summariseUnitSearch(search({ bedrooms: 3 }), tr(rw));
    expect(summary).toBe(rw['directory.bedPlus'].replace('{count}', '3'));
  });

  it('compacts a ceiling and only a ceiling', () => {
    expect(shortRwf(350000)).toBe('350K');
    expect(shortRwf(1500000)).toBe('1.5M');
  });
});

describe('comparing two searches', () => {
  it('ignores the order districts were ticked in — a set is not a list', () => {
    expect(
      sameUnitSearch(search({ districts: ['A', 'B'] }), search({ districts: ['B', 'A'] })),
    ).toBe(true);
  });

  it('notices a change on every axis', () => {
    expect(sameUnitSearch(DEFAULT_UNIT_SEARCH, search({ bedrooms: 1 }))).toBe(false);
    expect(sameUnitSearch(DEFAULT_UNIT_SEARCH, search({ ceiling: 1 }))).toBe(false);
    expect(sameUnitSearch(DEFAULT_UNIT_SEARCH, search({ vacancy: 'now' }))).toBe(false);
    expect(sameUnitSearch(DEFAULT_UNIT_SEARCH, search({ tenure: 'short_term' }))).toBe(false);
    expect(sameUnitSearch(DEFAULT_UNIT_SEARCH, search({ where: 'x' }))).toBe(false);
  });
});
