/**
 * The Guest search: one state shape, the facet lists, and the pure filter.
 *
 * Session 2 owns this. Explore reads it, `app/search.tsx` writes it, and both
 * go through the fixture store so the sheet and the tab are never two copies of
 * one search.
 *
 * ## Four decisions worth knowing before editing
 *
 * **1. The facet lists are COMPUTED from the catalogue, never written down.**
 * `apps/web` hand-maintained its option arrays and they drifted three separate
 * ways: the rail offered `guesthouse` and `apartment` when no property was
 * either, offered a district nothing was in, and silently omitted three classes
 * that properties were sitting behind. Five live filter bugs, all of one kind,
 * and removing the hand is the fix (ADR-011 call 4). So `DISTRICTS` and
 * `CLASSES` here are derived from `EXPLORABLE_STAYS`. A consequence worth
 * knowing before writing a test: what the rail offers depends on the content,
 * by design, so the list is not a stable thing to assert on.
 *
 * **2. The quick chips write the same fields the sheet writes.** The artboard
 * draws a five-chip rail — Anywhere, Kigali, Lakeside, Parks, Under 100K — and
 * the search sheet offers districts and price bands in full. Those are two
 * controls over ONE state: a quick chip sets `districts` or `band`, and which
 * chip reads as selected is DERIVED by comparing the current search against
 * what each chip would set (`activeQuick`). A separate `quick` field would be a
 * third source of truth for a fact two controls already hold, and the day the
 * sheet set Rubavu the rail would still be lit on Lakeside.
 *
 * **3. Dates narrow nothing, and the sheet says so out loud.** The fixtures
 * carry no availability calendar, so a range cannot be honoured against them.
 * It is carried so it reaches the listing and the booking stepper without being
 * asked for twice — `apps/web` took the same position for the same reason, and
 * filtering silently on a date nobody checked would be the worse lie.
 *
 * **4. Infants do not occupy.** `billableGuests` is adults plus children, which
 * is what a room capacity is quoted against and what `apps/web` already means
 * by the word.
 */
import { useCallback, useEffect, useState } from 'react';
import type { AccommodationClass } from '@injishi/contracts';
import type { DateRange } from '@/components';
import type { MessageKey, Translate } from '@/i18n/i18n';
import { useFixtureMutation, useFixtureValue } from './use-fixture-mutation';
import { EXPLORABLE_STAYS, type DistrictSlug, type Stay } from './stays';

/* --------------------------------------------------------------- the party */

export interface GuestParty {
  adults: number;
  children: number;
  infants: number;
}

/** Per-field floors and ceilings, as `apps/web`'s `GUEST_LIMITS` sets them. */
export const GUEST_LIMITS: Record<keyof GuestParty, { min: number; max: number }> = {
  adults: { min: 1, max: 16 },
  children: { min: 0, max: 10 },
  infants: { min: 0, max: 5 },
};

export const GUEST_FIELDS: (keyof GuestParty)[] = ['adults', 'children', 'infants'];

export const DEFAULT_PARTY: GuestParty = { adults: 2, children: 0, infants: 0 };

/** Adults plus children. An infant shares a bed and does not occupy one. */
export function billableGuests(party: GuestParty): number {
  return party.adults + party.children;
}

/**
 * The largest room type anything in the catalogue offers.
 *
 * This is the ceiling the steppers stop at, and it is derived rather than
 * chosen: a party the whole country cannot sleep is a party that returns an
 * empty list with no filter to blame, which is the one empty state that reads
 * as a bug.
 */
export const PARTY_MAX = EXPLORABLE_STAYS.reduce((most, s) => Math.max(most, s.maxGuests), 1);

/* --------------------------------------------------------------- the state */

/**
 * No "Guest score" sort, and nothing here ranks by score.
 *
 * Reviews are hidden in v1 and no endpoint serves a review aggregate, so a
 * score is a fixture number with nothing behind it; sorting on it would order
 * real stays by an invented opinion (mobile audit 2026-10-05, GB-07). The sort
 * comes back with the review feature, and with data.
 */
export const SORTS = ['recommended', 'price_low', 'price_high'] as const;
export type StaySort = (typeof SORTS)[number];

export const SORT_LABEL: Record<StaySort, MessageKey> = {
  recommended: 'search.sortRecommended',
  price_low: 'search.sortPriceLow',
  price_high: 'search.sortPriceHigh',
};

export interface PriceBand {
  id: string;
  label: MessageKey;
  min: number;
  /** `null` is open-ended. */
  max: number | null;
}

/**
 * Three bands. The first is the artboard's "Under 100K" chip, which is why the
 * boundary is 100,000 rather than the web rail's 40,000 — one number, two
 * controls, and a chip that disagreed with the band under it would be worse
 * than either bound being wrong.
 */
export const PRICE_BANDS: PriceBand[] = [
  { id: 'under-100k', label: 'search.bandUnder100k', min: 0, max: 100_000 },
  { id: '100k-200k', label: 'search.band100kTo200k', min: 100_000, max: 200_000 },
  { id: 'over-200k', label: 'search.bandOver200k', min: 200_000, max: null },
];

export function priceBand(id: string | null): PriceBand | undefined {
  return id ? PRICE_BANDS.find((b) => b.id === id) : undefined;
}

/**
 * Everything a search says. One object, because the sheet edits a draft of it
 * and the tab renders the committed one, and a shape split across five state
 * variables cannot be drafted.
 */
export interface StaySearch {
  /** Free text over the title and the place. */
  where: string;
  districts: DistrictSlug[];
  dates: DateRange;
  guests: GuestParty;
  classes: AccommodationClass[];
  /** A `PriceBand` id, or `null` for any price. */
  band: string | null;
  instantBook: boolean;
  sort: StaySort;
}

export const DEFAULT_SEARCH: StaySearch = {
  where: '',
  districts: [],
  dates: { start: null, end: null },
  guests: DEFAULT_PARTY,
  classes: [],
  band: null,
  instantBook: false,
  sort: 'recommended',
};

/** The fixture-store key both the sheet and Explore read and write. */
export const SEARCH_KEY = 'guest.search';

/* -------------------------------------------------------------- the facets */

export interface DistrictFacet {
  slug: DistrictSlug;
  label: MessageKey;
  count: number;
}

/**
 * Declaration order is the rail's order; membership is decided by the
 * catalogue. A slug with no stay behind it never reaches the rail.
 */
const DISTRICT_ORDER: DistrictSlug[] = [
  'kigali',
  'rubavu',
  'karongi',
  'rusizi',
  'musanze',
  'nyamasheke',
  'nyagatare',
];

const DISTRICT_LABEL: Record<DistrictSlug, MessageKey> = {
  kigali: 'search.districtKigali',
  rubavu: 'search.districtRubavu',
  karongi: 'search.districtKarongi',
  rusizi: 'search.districtRusizi',
  musanze: 'search.districtMusanze',
  nyamasheke: 'search.districtNyamasheke',
  nyagatare: 'search.districtNyagatare',
};

export const DISTRICTS: DistrictFacet[] = DISTRICT_ORDER.map((slug) => ({
  slug,
  label: DISTRICT_LABEL[slug],
  count: EXPLORABLE_STAYS.filter((s) => s.district === slug).length,
})).filter((facet) => facet.count > 0);

export interface ClassFacet {
  value: AccommodationClass;
  label: MessageKey;
  count: number;
}

/**
 * The class labels are keys here, not `ACCOMMODATION_CLASS_LABEL`.
 *
 * The contract ships a label map and `apps/web` uses it, correctly — but its
 * values are English strings, and code-standards forbids a display string that
 * has no Kinyarwanda beside it. The contract owns the VALUES, which is where
 * drift actually happens; the catalogue owns how they are spelled to a reader.
 */
const CLASS_LABEL: Record<AccommodationClass, MessageKey> = {
  hotel: 'search.classHotel',
  motel: 'search.classMotel',
  tented_camp: 'search.classTentedCamp',
  guest_house: 'search.classGuestHouse',
  apartment: 'search.classApartment',
  lodge: 'search.classLodge',
  villa: 'search.classVilla',
  other: 'search.classOther',
};

const CLASS_ORDER: AccommodationClass[] = [
  'hotel',
  'guest_house',
  'apartment',
  'villa',
  'lodge',
  'tented_camp',
  'motel',
  'other',
];

export const CLASSES: ClassFacet[] = CLASS_ORDER.map((value) => ({
  value,
  label: CLASS_LABEL[value],
  count: EXPLORABLE_STAYS.filter((s) => s.class === value).length,
})).filter((facet) => facet.count > 0);

/* ---------------------------------------------------------- the quick rail */

export interface QuickFilter {
  id: string;
  label: MessageKey;
  /** What choosing it sets. Everything it does not name is left alone. */
  patch: Partial<Pick<StaySearch, 'districts' | 'band'>>;
}

/**
 * The artboard's five chips, in its order. Each is a shortcut into the same
 * two fields the sheet edits — see decision 2 in the file header.
 */
export const QUICK_FILTERS: QuickFilter[] = [
  { id: 'anywhere', label: 'explore.filterAnywhere', patch: { districts: [], band: null } },
  { id: 'kigali', label: 'explore.filterKigali', patch: { districts: ['kigali'], band: null } },
  {
    id: 'lakeside',
    label: 'explore.filterLakeside',
    patch: { districts: ['rubavu', 'karongi', 'rusizi'], band: null },
  },
  {
    id: 'parks',
    label: 'explore.filterParks',
    patch: { districts: ['musanze', 'nyamasheke', 'nyagatare'], band: null },
  },
  {
    id: 'under100k',
    label: 'explore.filterUnder100k',
    patch: { districts: [], band: 'under-100k' },
  },
];

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

/**
 * Which quick chip the current search reads as, or `null` when the search says
 * something no chip can express. Derived rather than stored, so the rail and
 * the sheet can never disagree.
 */
export function activeQuick(search: StaySearch): string | null {
  const match = QUICK_FILTERS.find(
    (q) =>
      sameSet(q.patch.districts ?? [], search.districts) &&
      (q.patch.band ?? null) === search.band,
  );
  return match?.id ?? null;
}

/* -------------------------------------------------------------- the filter */

/**
 * Every dimension a search can narrow on, and the predicate for each.
 *
 * Kept as a table rather than as a chain of `if`s because the empty state needs
 * to answer "which of these emptied the list", and it can only do that if the
 * dimensions are enumerable. `active` says whether the reader has asked for
 * anything on that axis at all.
 */
export interface Dimension {
  id: string;
  /** What the empty state and the removable chips call it. */
  label: MessageKey;
  active: (s: StaySearch) => boolean;
  matches: (stay: Stay, s: StaySearch) => boolean;
  /**
   * The search with this one axis relaxed and everything else untouched.
   *
   * It exists so the empty state can offer to clear exactly the filter it just
   * blamed. "Widen the price band" with no control attached is advice; a button
   * that widens it is a way out.
   */
  clear: (s: StaySearch) => StaySearch;
}

export const DIMENSIONS: Dimension[] = [
  {
    id: 'where',
    label: 'search.dimWhere',
    active: (s) => s.where.trim().length > 0,
    matches: (stay, s) => {
      const needle = s.where.trim().toLowerCase();
      return `${stay.title} ${stay.place} ${stay.location}`.toLowerCase().includes(needle);
    },
    clear: (s) => ({ ...s, where: '' }),
  },
  {
    id: 'districts',
    label: 'search.dimDistrict',
    active: (s) => s.districts.length > 0,
    // OR within the group, the way every booking site behaves and the way a
    // guest ticking two places expects: both, never neither.
    matches: (stay, s) => s.districts.includes(stay.district),
    clear: (s) => ({ ...s, districts: [] }),
  },
  {
    id: 'classes',
    label: 'search.dimClass',
    active: (s) => s.classes.length > 0,
    matches: (stay, s) => s.classes.includes(stay.class),
    clear: (s) => ({ ...s, classes: [] }),
  },
  {
    id: 'band',
    label: 'search.dimPrice',
    active: (s) => s.band !== null,
    matches: (stay, s) => {
      const band = priceBand(s.band);
      if (!band) return true;
      return stay.price >= band.min && (band.max === null || stay.price < band.max);
    },
    clear: (s) => ({ ...s, band: null }),
  },
  {
    id: 'instantBook',
    label: 'search.dimInstant',
    active: (s) => s.instantBook,
    matches: (stay) => stay.bookingMode === 'instant_book',
    clear: (s) => ({ ...s, instantBook: false }),
  },
  {
    id: 'guests',
    label: 'search.dimGuests',
    // Only counts as asked-for once the party exceeds the default two, or the
    // stepper's own default would silently exclude every single room.
    active: (s) => billableGuests(s.guests) > billableGuests(DEFAULT_PARTY),
    matches: (stay, s) => stay.maxGuests >= billableGuests(s.guests),
    clear: (s) => ({ ...s, guests: DEFAULT_PARTY }),
  },
];

/** How many axes the reader has narrowed on. Drives the Filters chip's count. */
export function activeFilterCount(search: StaySearch): number {
  return DIMENSIONS.filter((d) => d.active(search)).length;
}

export function isDefaultSearch(search: StaySearch): boolean {
  return (
    activeFilterCount(search) === 0 &&
    search.dates.start === null &&
    search.sort === 'recommended'
  );
}

function compare(a: Stay, b: Stay, sort: Exclude<StaySort, 'recommended'>): number {
  switch (sort) {
    case 'price_low':
      return a.price - b.price;
    case 'price_high':
      return b.price - a.price;
  }
}

/**
 * Filter, then sort. Pure; `EXPLORABLE_STAYS` is the default catalogue.
 *
 * "Recommended" is the catalogue's own order, untouched. It used to rank by
 * score first, and the score has no source in v1 (GB-07); the filter keeps the
 * order it was given, so nothing is weighted that nobody can explain.
 */
export function searchStays(search: StaySearch, catalogue: Stay[] = EXPLORABLE_STAYS): Stay[] {
  const kept = catalogue.filter((stay) =>
    DIMENSIONS.every((d) => !d.active(search) || d.matches(stay, search)),
  );
  if (search.sort === 'recommended') return kept;
  const sort = search.sort;
  return [...kept].sort((a, b) => compare(a, b, sort));
}

/**
 * Why the list came back empty, as the key of the ONE filter that emptied it.
 *
 * Found by dropping each active dimension in turn and seeing which one, alone,
 * brings a result back. `null` means either nothing is filtered (the catalogue
 * itself is empty) or no single relaxation is enough, and the caller says so in
 * different words — "widen this filter" is useless advice when widening one
 * would not help.
 */
export function emptyReason(
  search: StaySearch,
  catalogue: Stay[] = EXPLORABLE_STAYS,
): Dimension | null {
  const active = DIMENSIONS.filter((d) => d.active(search));
  if (active.length === 0) return null;
  for (const dropped of active) {
    const relaxed = catalogue.filter((stay) =>
      active.every((d) => d.id === dropped.id || d.matches(stay, search)),
    );
    if (relaxed.length > 0) return dropped;
  }
  return null;
}

/**
 * The narrowings that get a removable chip under the rail, because nothing else
 * on Explore shows them.
 *
 * The rail already carries instant book as its own toggle, and carries the
 * districts and the price band whenever the two of them happen to spell a quick
 * chip. The pill carries the free text and the party. What is left is the class
 * filter, which lives only in the sheet, and a district or price choice the
 * rail cannot express — a guest who ticked Rubavu and Musanze would otherwise
 * see a filtered list with no visible reason for it.
 */
export function removableFilters(search: StaySearch): Dimension[] {
  const railShowsThePlace = activeQuick(search) !== null;
  return DIMENSIONS.filter((d) => {
    if (!d.active(search)) return false;
    if (d.id === 'classes') return true;
    if (d.id === 'districts' || d.id === 'band') return !railShowsThePlace;
    return false;
  });
}

/* --------------------------------------------------------------- the hook */

/** Field-by-field, because the arrays are sets and order is not meaning. */
export function sameSearch(a: StaySearch, b: StaySearch): boolean {
  return (
    a.where === b.where &&
    sameSet(a.districts, b.districts) &&
    sameSet(a.classes, b.classes) &&
    a.dates.start === b.dates.start &&
    a.dates.end === b.dates.end &&
    a.guests.adults === b.guests.adults &&
    a.guests.children === b.guests.children &&
    a.guests.infants === b.guests.infants &&
    a.band === b.band &&
    a.instantBook === b.instantBook &&
    a.sort === b.sort
  );
}

export interface StaySearchState {
  search: StaySearch;
  setSearch: (next: StaySearch) => void;
  /** `saving` while the write is in flight, for the sheet's footer. */
  status: ReturnType<typeof useFixtureMutation<StaySearch, StaySearch>>['status'];
}

/**
 * The committed search, shared by Explore and the sheet.
 *
 * It lives in the fixture store rather than in either screen because they are
 * two ROUTES: a sheet that dismisses takes its component state with it, and a
 * tab that held the search would have nothing to hand the sheet on the way in.
 * The store is also what makes the swap to TanStack Query a hook change.
 *
 * **The write is optimistic for the same reason the heart's is.**
 * `useFixtureMutation` simulates 300ms so a pending state is real, and that is
 * right for the sheet's Search button — it is wrong for a filter chip, where a
 * third of a second of nothing reads as a chip that did not register. So a
 * change is shown immediately and the local copy is dropped once the store
 * agrees, which is what `onMutate` will do when this becomes `useMutation`.
 */
export function useStaySearch(): StaySearchState {
  const stored = useFixtureValue<StaySearch>(SEARCH_KEY, () => DEFAULT_SEARCH);
  const { mutate, status } = useFixtureMutation<StaySearch, StaySearch>(
    SEARCH_KEY,
    (_current, next) => next,
    () => DEFAULT_SEARCH,
  );

  const [pending, setPending] = useState<StaySearch | null>(null);

  useEffect(() => {
    setPending((now) => (now && sameSearch(now, stored) ? null : now));
  }, [stored]);

  const setSearch = useCallback(
    (next: StaySearch) => {
      setPending(next);
      void mutate(next);
    },
    [mutate],
  );

  return { search: pending ?? stored, setSearch, status };
}

/* ------------------------------------------------------------ the summary */

/** `2026-09-04` -> `4 Sep`, in the reader's own month names. */
export function formatDay(iso: string, t: Translate): string {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  const name = t(`calendar.m${month}` as MessageKey);
  return `${day} ${name.slice(0, 3)}`;
}

export function formatDates(dates: DateRange, t: Translate): string | null {
  if (!dates.start) return null;
  if (!dates.end) return formatDay(dates.start, t);
  return `${formatDay(dates.start, t)} – ${formatDay(dates.end, t)}`;
}

/**
 * What the search pill says. Three slots in the artboard's own order — where,
 * when, who — joined by the middle dot the rest of the app uses, and falling
 * back to the placeholder when the search is untouched.
 *
 * It takes `t` rather than reaching for the locale, so it stays pure and a test
 * can assert the sentence in either catalogue.
 */
export function summariseSearch(search: StaySearch, t: Translate): string {
  const parts: string[] = [];

  const where = search.where.trim();
  if (where) {
    parts.push(where);
  } else if (search.districts.length === 1) {
    const only = DISTRICTS.find((d) => d.slug === search.districts[0]);
    if (only) parts.push(t(only.label));
  } else if (search.districts.length > 1) {
    const quick = QUICK_FILTERS.find((q) => q.id === activeQuick(search));
    parts.push(quick ? t(quick.label) : t('search.placesCount', { count: search.districts.length }));
  }

  const when = formatDates(search.dates, t);
  if (when) parts.push(when);

  const heads = billableGuests(search.guests);
  if (heads !== billableGuests(DEFAULT_PARTY) || parts.length > 0) {
    parts.push(heads === 1 ? t('search.oneGuest') : t('search.guestCount', { count: heads }));
  }

  return parts.length > 0 ? parts.join(' · ') : t('explore.searchPlaceholder');
}
