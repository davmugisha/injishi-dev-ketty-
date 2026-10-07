/**
 * The Guest search: the filter, the sort, and the two derivations the screen
 * would otherwise have to keep in sync by hand.
 *
 * The assertions worth reading are the ones about the DERIVATIONS, because they
 * are the ones that stop a class of bug rather than a case:
 *
 *   - the facet lists come from the catalogue, so a filter that matches nothing
 *     can never reach the rail;
 *   - `activeQuick` reads the chip off the search, so the rail and the sheet
 *     cannot disagree about which place is selected;
 *   - `emptyReason` returns a filter that, cleared, actually brings results
 *     back — which is the whole promise the empty state makes to the reader.
 *
 * The catalogue is content and content changes, so nothing here asserts a
 * particular count. Every case is written against a property of the result.
 */
import { translate } from '@/i18n/i18n';
import { EXPLORABLE_STAYS, STAYS, type Stay } from './stays';
import {
  CLASSES,
  DEFAULT_PARTY,
  DEFAULT_SEARCH,
  DISTRICTS,
  PARTY_MAX,
  PRICE_BANDS,
  QUICK_FILTERS,
  SORTS,
  activeFilterCount,
  activeQuick,
  billableGuests,
  emptyReason,
  isDefaultSearch,
  priceBand,
  removableFilters,
  sameSearch,
  searchStays,
  summariseSearch,
  type StaySearch,
} from './search';

const t = (key: Parameters<typeof translate>[0], values?: Record<string, string | number>) =>
  translate(key, values, 'en');

const withSearch = (patch: Partial<StaySearch>): StaySearch => ({ ...DEFAULT_SEARCH, ...patch });
const ids = (stays: Stay[]) => stays.map((s) => s.id);

describe('the facet lists', () => {
  it('offers no district that has nothing behind it', () => {
    // `apps/web` shipped three filters no property could satisfy because its
    // option list was written by hand. This is the assertion that stops it.
    for (const facet of DISTRICTS) {
      expect(EXPLORABLE_STAYS.some((s) => s.district === facet.slug)).toBe(true);
      expect(facet.count).toBe(EXPLORABLE_STAYS.filter((s) => s.district === facet.slug).length);
    }
  });

  it('offers no property class that has nothing behind it', () => {
    for (const facet of CLASSES) {
      expect(EXPLORABLE_STAYS.some((s) => s.class === facet.value)).toBe(true);
      expect(facet.count).toBe(EXPLORABLE_STAYS.filter((s) => s.class === facet.value).length);
    }
  });

  it('omits no class or district that a stay is sitting behind', () => {
    // The other half of the same bug: silently dropping a facet properties use.
    for (const stay of EXPLORABLE_STAYS) {
      expect(DISTRICTS.some((d) => d.slug === stay.district)).toBe(true);
      expect(CLASSES.some((c) => c.value === stay.class)).toBe(true);
    }
  });

  it('caps the party at the largest room anyone actually lists', () => {
    expect(PARTY_MAX).toBe(Math.max(...EXPLORABLE_STAYS.map((s) => s.maxGuests)));
  });
});

describe('the catalogue Explore reads', () => {
  it('leaves out a property with no published listing', () => {
    const closed = STAYS.filter((s) => !s.active);
    expect(closed.length).toBeGreaterThan(0);
    for (const stay of closed) expect(ids(EXPLORABLE_STAYS)).not.toContain(stay.id);
  });

  it('returns the whole catalogue for an untouched search', () => {
    expect(ids(searchStays(DEFAULT_SEARCH))).toHaveLength(EXPLORABLE_STAYS.length);
    expect(isDefaultSearch(DEFAULT_SEARCH)).toBe(true);
    expect(activeFilterCount(DEFAULT_SEARCH)).toBe(0);
  });
});

describe('filtering', () => {
  it('matches a name or a place, case-insensitively', () => {
    const byName = searchStays(withSearch({ where: 'umurage' }));
    expect(ids(byName)).toEqual(['umurage-guesthouse']);
    const byPlace = searchStays(withSearch({ where: 'nyamirambo' }));
    expect(ids(byPlace)).toContain('nyamirambo-townhouse');
  });

  it('ORs within the district group, so two places mean either', () => {
    const both = searchStays(withSearch({ districts: ['rubavu', 'musanze'] }));
    expect(both.length).toBeGreaterThan(1);
    for (const stay of both) expect(['rubavu', 'musanze']).toContain(stay.district);
  });

  it('ORs within the class group too', () => {
    const kinds = searchStays(withSearch({ classes: ['hotel', 'lodge'] }));
    for (const stay of kinds) expect(['hotel', 'lodge']).toContain(stay.class);
  });

  it('ANDs across groups, so a district and a class mean both', () => {
    const narrow = searchStays(withSearch({ districts: ['kigali'], classes: ['apartment'] }));
    for (const stay of narrow) {
      expect(stay.district).toBe('kigali');
      expect(stay.class).toBe('apartment');
    }
  });

  it('puts every stay in exactly one price band', () => {
    // The bands are a partition, not three overlapping ranges: min inclusive,
    // max exclusive. A stay landing in two would be double counted on the rail.
    for (const stay of EXPLORABLE_STAYS) {
      const hits = PRICE_BANDS.filter(
        (b) => stay.price >= b.min && (b.max === null || stay.price < b.max),
      );
      expect(hits).toHaveLength(1);
    }
  });

  it('honours the band bounds it advertises', () => {
    const band = priceBand('under-100k');
    expect(band).toBeDefined();
    for (const stay of searchStays(withSearch({ band: 'under-100k' }))) {
      expect(stay.price).toBeLessThan(band!.max!);
    }
  });

  it('returns only instant-book stays when instant book is on', () => {
    const instant = searchStays(withSearch({ instantBook: true }));
    expect(instant.length).toBeGreaterThan(0);
    for (const stay of instant) expect(stay.bookingMode).toBe('instant_book');
  });

  it('drops a stay whose largest room cannot sleep the party', () => {
    const big = searchStays(withSearch({ guests: { ...DEFAULT_PARTY, adults: PARTY_MAX } }));
    expect(big.length).toBeGreaterThan(0);
    for (const stay of big) expect(stay.maxGuests).toBeGreaterThanOrEqual(PARTY_MAX);
  });

  it('does not count an infant against a room, because an infant takes no bed', () => {
    const withInfant = withSearch({ guests: { adults: 2, children: 0, infants: 2 } });
    expect(billableGuests(withInfant.guests)).toBe(2);
    expect(ids(searchStays(withInfant))).toEqual(ids(searchStays(DEFAULT_SEARCH)));
  });

  it('treats the default party as no filter at all', () => {
    // Two adults is the stepper's own starting value. Counting it would
    // silently exclude every single room before the reader touched anything.
    expect(activeFilterCount(withSearch({ guests: DEFAULT_PARTY }))).toBe(0);
  });

  it('narrows nothing on dates, which is what the sheet says it does', () => {
    const dated = withSearch({ dates: { start: '2026-09-04', end: '2026-09-07' } });
    expect(ids(searchStays(dated))).toEqual(ids(searchStays(DEFAULT_SEARCH)));
  });
});

describe('sorting', () => {
  const sorted = (sort: StaySearch['sort']) => searchStays(withSearch({ sort }));

  it('runs price ascending and descending', () => {
    const low = sorted('price_low').map((s) => s.price);
    expect([...low]).toEqual([...low].sort((a, b) => a - b));
    const high = sorted('price_high').map((s) => s.price);
    expect([...high]).toEqual([...high].sort((a, b) => b - a));
  });

  /**
   * Reviews are hidden in v1 and no endpoint serves a score, so nothing may be
   * ordered by one (mobile audit 2026-10-05, GB-07).
   */
  it('offers no guest-score sort', () => {
    expect(SORTS).toEqual(['recommended', 'price_low', 'price_high']);
  });

  it('keeps the catalogue order for recommended, ranking nothing by score', () => {
    expect(ids(sorted('recommended'))).toEqual(ids(EXPLORABLE_STAYS));
    // And a filtered list keeps that order too.
    const instant = searchStays(withSearch({ instantBook: true }));
    expect(ids(instant)).toEqual(
      ids(EXPLORABLE_STAYS.filter((s) => s.bookingMode === 'instant_book')),
    );
  });
});

describe('the quick rail', () => {
  it('reads its selected chip off the search rather than storing one', () => {
    for (const chip of QUICK_FILTERS) {
      expect(activeQuick({ ...DEFAULT_SEARCH, ...chip.patch })).toBe(chip.id);
    }
  });

  it('reads as nothing selected when the sheet said something no chip can say', () => {
    expect(activeQuick(withSearch({ districts: ['rubavu', 'musanze'] }))).toBeNull();
  });

  it('gives a district choice the rail cannot show a chip of its own', () => {
    const offRail = withSearch({ districts: ['rubavu', 'musanze'] });
    expect(removableFilters(offRail).map((d) => d.id)).toContain('districts');
    // Lakeside IS on the rail, so it does not need a second control.
    const onRail = { ...DEFAULT_SEARCH, ...QUICK_FILTERS[2].patch };
    expect(removableFilters(onRail).map((d) => d.id)).not.toContain('districts');
  });

  it('always gives the class filter a chip, because only the sheet can set it', () => {
    expect(removableFilters(withSearch({ classes: ['hotel'] })).map((d) => d.id)).toContain(
      'classes',
    );
  });
});

describe('the empty state', () => {
  it('blames a filter that, cleared, actually brings the list back', () => {
    // The promise the empty state makes. Naming a filter whose removal changes
    // nothing would be worse than saying nothing.
    const impossible = withSearch({ classes: ['tented_camp'], band: 'under-100k' });
    expect(searchStays(impossible)).toHaveLength(0);

    const reason = emptyReason(impossible);
    expect(reason).not.toBeNull();
    expect(searchStays(reason!.clear(impossible)).length).toBeGreaterThan(0);
  });

  it('blames nothing when no single filter explains it', () => {
    // Two filters that each empty the list on their own. There is no one
    // control to point at, and the screen says so in different words.
    const irreducible = withSearch({ where: 'zzzz', classes: ['other'] });
    expect(searchStays(irreducible)).toHaveLength(0);
    expect(emptyReason(irreducible)).toBeNull();
  });

  it('blames nothing when nothing is filtered', () => {
    expect(emptyReason(DEFAULT_SEARCH, [])).toBeNull();
  });
});

describe('the pill summary', () => {
  it('falls back to the placeholder on an untouched search', () => {
    expect(summariseSearch(DEFAULT_SEARCH, t)).toBe(t('explore.searchPlaceholder'));
  });

  it('names a single district, the dates and the party, in that order', () => {
    const summary = summariseSearch(
      withSearch({
        districts: ['kigali'],
        dates: { start: '2026-09-04', end: '2026-09-07' },
        guests: { adults: 2, children: 1, infants: 0 },
      }),
      t,
    );
    expect(summary).toBe('Kigali · 4 Sep – 7 Sep · 3 guests');
  });

  it('names the quick chip rather than counting districts when one fits', () => {
    expect(summariseSearch({ ...DEFAULT_SEARCH, ...QUICK_FILTERS[2].patch }, t)).toContain(
      t('explore.filterLakeside'),
    );
  });

  it('prefers what the reader typed over the districts they ticked', () => {
    expect(summariseSearch(withSearch({ where: 'Umurage', districts: ['kigali'] }), t)).toContain(
      'Umurage',
    );
  });
});

describe('sameSearch', () => {
  it('ignores the order two districts were ticked in', () => {
    expect(
      sameSearch(
        withSearch({ districts: ['kigali', 'rubavu'] }),
        withSearch({ districts: ['rubavu', 'kigali'] }),
      ),
    ).toBe(true);
  });

  it('sees a real difference', () => {
    expect(sameSearch(DEFAULT_SEARCH, withSearch({ instantBook: true }))).toBe(false);
    expect(sameSearch(DEFAULT_SEARCH, withSearch({ sort: 'price_low' }))).toBe(false);
  });
});
