import {
  AccommodationClass,
  ACCOMMODATION_CLASS_LABEL,
} from "@injishi/contracts";

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

export interface PropertyKindOption {
  value: AccommodationClass;
  label: string;
}

/**
 * Every class, in `AccommodationClass`'s own declaration order so the order is
 * stable and canonical. Which of them have a stay behind them is a fact about
 * the database, read at runtime: the filter rail drops an option nobody can
 * pick (`data/explore-facets.ts`).
 *
 * Every label comes from `ACCOMMODATION_CLASS_LABEL`. No class label string is
 * written by hand anywhere in this app (ADR-011 call 6).
 */
export const PROPERTY_KIND_OPTIONS: PropertyKindOption[] =
  AccommodationClass.options.map((value) => ({ value, label: ACCOMMODATION_CLASS_LABEL[value] }));

export interface SearchDistrictOption {
  slug: DistrictSlug;
  name: string;
}

/** Every district the search knows, in declaration order. */
export const SEARCH_DISTRICTS: SearchDistrictOption[] = DISTRICT_SLUGS.map((slug) => ({
  slug,
  name: DISTRICT_NAME[slug],
}));

/**
 * A canonical label, respelled for a slot that reads as a sentence rather than
 * as a heading.
 *
 * `ACCOMMODATION_CLASS_LABEL` is title case, which is right for the filter rail
 * and for the registration wizard's cards. It is wrong in the home deck's chip,
 * where the class sits beside a district in the same row: "Guest House in
 * Kimihurura" reads like a headline fragment where "Guest house in Kimihurura"
 * reads like a fact.
 *
 * Derived rather than retyped, so a label change reaches both surfaces
 * (ADR-011 call 6).
 */
export function toSentenceCase(label: string): string {
  return label
    .split(" ")
    .map((word, index) => (index === 0 ? word : word.toLowerCase()))
    .join(" ");
}

/** The three budget bands the explore filter offers. `max: null` is open-ended. */
export const BUDGET_BANDS = [
  { id: "under-40k", label: "Under RWF 40k", min: 0, max: 40_000 },
  { id: "40k-120k", label: "RWF 40k-120k", min: 40_000, max: 120_000 },
  { id: "over-120k", label: "Over RWF 120k", min: 120_000, max: null },
] as const;

export type BudgetBandId = (typeof BUDGET_BANDS)[number]["id"];

/**
 * Bedroom counts offered as "N+" options in the refinement pill.
 *
 * `GUEST_OPTIONS` and `BED_OPTIONS` used to sit beside this and are gone.
 * The guest count is no longer a radio list of three: the explore rail mounts
 * the same `GuestPanel` stepper the hero does, so a party is described once, in
 * one vocabulary, and carries through the funnel. `BED_OPTIONS` fed a control
 * that read `listing.bedrooms`, the same field the bedrooms control reads, and
 * the fixtures carry no bed count at all.
 */
export const BEDROOM_OPTIONS = [1, 2, 3, 4] as const;
