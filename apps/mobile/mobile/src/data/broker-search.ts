/**
 * The Directory search — the residence half of what `./search.ts` does for
 * Explore. Frame B21's field reads "Kimihurura · 2 bed · ≤ 350K", and those
 * three are the whole of it: where, how big, how much at most.
 *
 * ## Why it is a second module rather than a mode of the first
 *
 * `StaySearch` asks for nights, a party and an accommodation class. None of
 * those exist on a tenancy: nobody rents a flat for two adults and an infant
 * over a weekend. Bending one shape across both would give every screen a set
 * of fields that are meaningless half the time, which is how a filter ends up
 * silently narrowing on a value nobody set. Two shapes, one pattern.
 *
 * The pattern is deliberately Session 2's, so the two read as one system:
 *
 *   - **Facets are COMPUTED from the catalogue, never written down.** A
 *     district chip exists because a unit is in that district (ADR-011 call 4,
 *     and the five live filter bugs `apps/web` got from hand-maintained option
 *     arrays).
 *   - **Dimensions are a table, not a chain of `if`s**, so the empty state can
 *     answer "which of these emptied the list" and offer to lift exactly that
 *     one. "Nothing matches" with a Clear all button is a dead end when the
 *     reader only needed the ceiling raised.
 *   - **The committed search lives in the fixture store**, because the sheet is
 *     an overlay with its own lifetime and a search held in the tab's state
 *     would be gone the moment the reader dismissed it mid-choice.
 *
 * One thing this adds that Explore does not need: **a ceiling is not a band.**
 * A broker with a client on RWF 350,000 wants everything at or under it, not a
 * bracket. So `ceiling` is a single upper bound and the chips are cut points
 * derived from the rents that actually exist.
 */
import { useCallback, useEffect, useState } from 'react';
import type { MessageKey, Translate } from '@/i18n/i18n';
import { DIRECTORY_UNITS, type DirectoryUnit } from './broker';
import { useFixtureMutation, useFixtureValue } from './use-fixture-mutation';

/* ---------------------------------------------------------------- the state */

/** Which units the vacancy rail is asking for. */
export type VacancyFilter = 'any' | 'now' | 'soon';

/** Which tenure the rail is asking for. */
export type TenureFilter = 'any' | 'long_term' | 'short_term';

export interface UnitSearch {
  /** Free text over the property name and the district. */
  where: string;
  /** District names, as they appear on a unit. Empty means anywhere. */
  districts: string[];
  /** Minimum bedrooms. `0` means any size. */
  bedrooms: number;
  /** Maximum rent, inclusive. `null` means any rent. */
  ceiling: number | null;
  vacancy: VacancyFilter;
  tenure: TenureFilter;
}

export const DEFAULT_UNIT_SEARCH: UnitSearch = {
  where: '',
  districts: [],
  bedrooms: 0,
  ceiling: null,
  vacancy: 'any',
  tenure: 'any',
};

/** The fixture-store key the tab and the sheet both read and write. */
export const UNIT_SEARCH_KEY = 'broker.search';

/* --------------------------------------------------------------- the facets */

export interface DistrictFacet {
  name: string;
  count: number;
}

/** Every district with a unit behind it, busiest first, then alphabetical. */
export const UNIT_DISTRICTS: DistrictFacet[] = Object.entries(
  DIRECTORY_UNITS.reduce<Record<string, number>>(
    (all, u) => ({ ...all, [u.district]: (all[u.district] ?? 0) + 1 }),
    {},
  ),
)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

/** The bedroom counts a "N+" chip can usefully ask for. */
export const BEDROOM_STEPS: number[] = Array.from(
  new Set(DIRECTORY_UNITS.map((u) => u.bedrooms)),
).sort((a, b) => a - b);

/**
 * The ceilings worth offering, in RWF.
 *
 * Filtered against the catalogue so every chip both keeps something and
 * excludes something: a ceiling above the priciest unit narrows nothing, and
 * one below the cheapest empties the list with no filter worth blaming.
 */
export const RENT_CEILINGS: number[] = [200_000, 350_000, 500_000, 800_000].filter(
  (ceiling) =>
    DIRECTORY_UNITS.some((u) => u.rent <= ceiling) &&
    DIRECTORY_UNITS.some((u) => u.rent > ceiling),
);

/* --------------------------------------------------------------- the filter */

export interface UnitDimension {
  id: string;
  /** What the empty state and the removable chips call it. */
  label: MessageKey;
  active: (s: UnitSearch) => boolean;
  matches: (u: DirectoryUnit, s: UnitSearch) => boolean;
  /** The search with this one axis relaxed and everything else untouched. */
  clear: (s: UnitSearch) => UnitSearch;
}

export const UNIT_DIMENSIONS: UnitDimension[] = [
  {
    id: 'where',
    label: 'directory.dimWhere',
    active: (s) => s.where.trim().length > 0,
    matches: (u, s) =>
      `${u.property} ${u.unit} ${u.district}`.toLowerCase().includes(s.where.trim().toLowerCase()),
    clear: (s) => ({ ...s, where: '' }),
  },
  {
    id: 'districts',
    label: 'directory.dimDistrict',
    active: (s) => s.districts.length > 0,
    // OR within the group: ticking two districts means either, never both.
    matches: (u, s) => s.districts.includes(u.district),
    clear: (s) => ({ ...s, districts: [] }),
  },
  {
    id: 'bedrooms',
    label: 'directory.dimBedrooms',
    active: (s) => s.bedrooms > 0,
    // "2 bed" in this market means at least two, which is what a broker with a
    // family on their books is asking for.
    matches: (u, s) => u.bedrooms >= s.bedrooms,
    clear: (s) => ({ ...s, bedrooms: 0 }),
  },
  {
    id: 'ceiling',
    label: 'directory.dimCeiling',
    active: (s) => s.ceiling !== null,
    matches: (u, s) => s.ceiling === null || u.rent <= s.ceiling,
    clear: (s) => ({ ...s, ceiling: null }),
  },
  {
    id: 'vacancy',
    label: 'directory.dimVacancy',
    active: (s) => s.vacancy !== 'any',
    matches: (u, s) => {
      if (s.vacancy === 'now') return u.vacancy.state === 'now';
      // "Soon" is anything a client could actually move into, which includes a
      // unit free today — a broker filtering for soon has not stopped wanting
      // the ones that are ready.
      return u.vacancy.state !== 'leased';
    },
    clear: (s) => ({ ...s, vacancy: 'any' }),
  },
  {
    id: 'tenure',
    label: 'directory.dimTenure',
    active: (s) => s.tenure !== 'any',
    matches: (u, s) => u.tenure === s.tenure,
    clear: (s) => ({ ...s, tenure: 'any' }),
  },
];

/** How many axes the reader has narrowed on. Drives the Filters chip's dot. */
export function activeUnitFilterCount(search: UnitSearch): number {
  return UNIT_DIMENSIONS.filter((d) => d.active(search)).length;
}

/** Filter, then order: soonest available first, then the cheaper of two. */
export function searchUnits(
  search: UnitSearch,
  catalogue: readonly DirectoryUnit[] = DIRECTORY_UNITS,
): DirectoryUnit[] {
  const kept = catalogue.filter((u) =>
    UNIT_DIMENSIONS.every((d) => !d.active(search) || d.matches(u, search)),
  );
  return [...kept].sort((a, b) => vacancyRank(a) - vacancyRank(b) || a.rent - b.rent);
}

/** Ready now, then dated, then let. A let unit is last because it cannot be placed. */
function vacancyRank(u: DirectoryUnit): number {
  if (u.vacancy.state === 'now') return 0;
  if (u.vacancy.state === 'from') return 1;
  return 2;
}

/**
 * Why the list came back empty, as the ONE filter that emptied it — found by
 * dropping each active axis in turn and seeing which one, alone, brings a
 * result back. `null` means nothing is filtered, or no single relaxation is
 * enough, and the caller says so in different words.
 */
export function unitEmptyReason(
  search: UnitSearch,
  catalogue: readonly DirectoryUnit[] = DIRECTORY_UNITS,
): UnitDimension | null {
  const active = UNIT_DIMENSIONS.filter((d) => d.active(search));
  if (active.length === 0) return null;
  for (const dropped of active) {
    const relaxed = catalogue.filter((u) =>
      active.every((d) => d.id === dropped.id || d.matches(u, search)),
    );
    if (relaxed.length > 0) return dropped;
  }
  return null;
}

/* -------------------------------------------------------------- the summary */

/**
 * What the search field says: frame B21's "Kimihurura · 2 bed · ≤ 350K", in the
 * frame's own order. Takes `t` rather than reaching for the locale, so it stays
 * pure and a test can assert the sentence in either catalogue.
 */
export function summariseUnitSearch(search: UnitSearch, t: Translate): string {
  const parts: string[] = [];

  const where = search.where.trim();
  if (where) parts.push(where);
  else if (search.districts.length === 1) parts.push(search.districts[0]);
  else if (search.districts.length > 1)
    parts.push(t('directory.districtCount', { count: search.districts.length }));

  if (search.bedrooms > 0) parts.push(t('directory.bedPlus', { count: search.bedrooms }));
  if (search.ceiling !== null)
    parts.push(t('directory.ceilingShort', { amount: shortRwf(search.ceiling) }));
  if (search.vacancy === 'now' && parts.length === 0) parts.push(t('directory.chipVacantNow'));

  return parts.length > 0 ? parts.join(' · ') : t('directory.searchPlaceholder');
}

/**
 * `350000` → `350K`. Only for the search field and the ceiling chips, where the
 * number is a bound the reader chose rather than a sum they are owed —
 * everywhere money is stated it goes through `MoneyAmount` (RWF 350,000).
 */
export function shortRwf(amount: number): string {
  if (amount >= 1_000_000) return `${amount / 1_000_000}M`;
  return `${Math.round(amount / 1000)}K`;
}

/* ----------------------------------------------------------------- the hook */

export function sameUnitSearch(a: UnitSearch, b: UnitSearch): boolean {
  return (
    a.where === b.where &&
    a.bedrooms === b.bedrooms &&
    a.ceiling === b.ceiling &&
    a.vacancy === b.vacancy &&
    a.tenure === b.tenure &&
    a.districts.length === b.districts.length &&
    [...a.districts].sort().join() === [...b.districts].sort().join()
  );
}

export interface UnitSearchState {
  search: UnitSearch;
  setSearch: (next: UnitSearch) => void;
}

/**
 * The committed search, shared by the Directory tab and its sheet.
 *
 * Optimistic for the reason Session 2 gives: `useFixtureMutation` simulates
 * 300ms so a pending state is real, which is right for a Search button and
 * wrong for a filter chip, where a third of a second of nothing reads as a chip
 * that did not register. So the change shows immediately and the local copy is
 * dropped once the store agrees.
 */
export function useUnitSearch(): UnitSearchState {
  const stored = useFixtureValue<UnitSearch>(UNIT_SEARCH_KEY, () => DEFAULT_UNIT_SEARCH);
  const { mutate } = useFixtureMutation<UnitSearch, UnitSearch>(
    UNIT_SEARCH_KEY,
    (_current, next) => next,
    () => DEFAULT_UNIT_SEARCH,
  );

  const [pending, setPending] = useState<UnitSearch | null>(null);

  // Drop the local copy once the store has caught up with it, which is what
  // `onMutate` will do when this becomes a real `useMutation`.
  useEffect(() => {
    setPending((now) => (now && sameUnitSearch(now, stored) ? null : now));
  }, [stored]);

  const setSearch = useCallback(
    (next: UnitSearch) => {
      setPending(next);
      void mutate(next);
    },
    [mutate],
  );

  return { search: pending ?? stored, setSearch };
}
