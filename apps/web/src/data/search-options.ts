/**
 * Options offered by the hero search bar and the explore filter rail.
 *
 * The vocabulary only. Which options have a stay behind them is decided at
 * runtime against the published properties: the filter rail counts each option
 * over the listings and drops the ones at zero (`data/explore-facets.ts`), so
 * nothing here can offer a district or class that no stay has. These lists used
 * to be filtered against a fictional catalogue kept in this app, removed on
 * 2026-10-08.
 */

/**
 * The districts the search files stays under.
 *
 * This is a **facet list**, not the geography entity. `District` in
 * `@injishi/contracts` is a row with a numeric id and there are 30 of them; the
 * two were sharing a name and meaning unrelated things, so this one is
 * `DistrictSlug` and can never again be mistaken for the other (ADR-011 call 2).
 *
 * The declaration order below is the rail's order.
 *
 * `data/destinations.ts` keeps its own wider `string` vocabulary on purpose. It
 * indexes *places* for a typeahead, so it legitimately carries landmarks and
 * pre-1994 names that have no properties behind them.
 */
/*
 * `huye` and `kayonza` joined on 2026-10-21. The typeahead already resolved
 * "Huye", "Butare" and "Nyungwe" to `huye` and "Akagera" to `kayonza`
 * (`data/destinations.ts`), but neither was a facet, so those searches could
 * never match a stay, and a property in either district was filed under Kigali
 * by `districtSlug` in `data/discovery.ts`: an Akagera lodge listed as a
 * Kigali stay. A slug here must be a district's own name, lowercased, because
 * that is how a property's `districtName` is matched to it.
 */
export const DISTRICT_SLUGS = [
  "kigali",
  "musanze",
  "nyagatare",
  "rusizi",
  "karongi",
  "rubavu",
  "huye",
  "kayonza",
] as const;

export type DistrictSlug = (typeof DISTRICT_SLUGS)[number];

/** How each slug is spelled for a reader, as `data/destinations.ts` spells it. */
const DISTRICT_NAME: Readonly<Record<DistrictSlug, string>> = {
  kigali: "Kigali",
  musanze: "Musanze",
  nyagatare: "Nyagatare",
  rusizi: "Rusizi",
  karongi: "Karongi",
  rubavu: "Rubavu",
  huye: "Huye",
  kayonza: "Kayonza",
};

interface SearchDistrictOption {
  slug: DistrictSlug;
  name: string;
}

/** Every district the search knows, in declaration order. */
export const SEARCH_DISTRICTS: SearchDistrictOption[] = DISTRICT_SLUGS.map((slug) => ({
  slug,
  name: DISTRICT_NAME[slug],
}));

/** The three budget bands the explore filter offers. `max: null` is open-ended. */
export const BUDGET_BANDS = [
  { id: "under-40k", label: "Under RWF 40k", min: 0, max: 40_000 },
  { id: "40k-120k", label: "RWF 40k-120k", min: 40_000, max: 120_000 },
  { id: "over-120k", label: "Over RWF 120k", min: 120_000, max: null },
] as const;

export type BudgetBandId = (typeof BUDGET_BANDS)[number]["id"];

