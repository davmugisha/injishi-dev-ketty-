import {
  AccommodationClass,
  ACCOMMODATION_CLASS_LABEL,
} from "@injishi/contracts";
import { ALL_PROPERTIES } from "@/data/catalogue";

/**
 * Options offered by the hero search bar and the explore filter rail.
 *
 * **Both option lists are computed from the CATALOGUE, never written down.**
 * They used to be hand-maintained arrays and they drifted three separate times:
 * the rail offered `guesthouse` and `apartment` when no property was either, it
 * offered `huye` when no property was there, and it silently omitted
 * `tented_camp`, `nyagatare` and `rusizi` when properties were. Five live
 * filter bugs, all of one kind. Removing the hand is the fix (ADR-011 call 4).
 *
 * A consequence worth knowing before you write a test: the rail's contents
 * depend on the content. Adding a property in a new district changes what this
 * module returns, by design, so this is not a stable thing to assert on.
 */

/**
 * The districts the property fixtures actually use.
 *
 * This is a **facet list**, not the geography entity. `District` in
 * `@injishi/contracts` is a row with a numeric id and there are 30 of them; the
 * two were sharing a name and meaning unrelated things, so this one is
 * `DistrictSlug` and can never again be mistaken for the other (ADR-011 call 2).
 *
 * The declaration order below is the rail's order. Membership is not decided
 * here: a slug with no property behind it is filtered out below.
 *
 * `data/destinations.ts` keeps its own wider `string` vocabulary on purpose. It
 * indexes *places* for a typeahead, so it legitimately carries landmarks and
 * pre-1994 names that have no properties behind them.
 */
export const DISTRICT_SLUGS = [
  "kigali",
  "musanze",
  "nyagatare",
  "rusizi",
  "karongi",
  "rubavu",
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
};

export interface PropertyKindOption {
  value: AccommodationClass;
  label: string;
}

/**
 * The classes that have at least one property, in `AccommodationClass`'s own
 * declaration order so the rail's order is stable and canonical rather than
 * whatever order the fixtures happen to sit in.
 *
 * Every label comes from `ACCOMMODATION_CLASS_LABEL`. No class label string is
 * written by hand anywhere in this app (ADR-011 call 6).
 */
export const PROPERTY_KIND_OPTIONS: PropertyKindOption[] =
  AccommodationClass.options
    .filter((value) => ALL_PROPERTIES.some((property) => property.kind === value))
    .map((value) => ({ value, label: ACCOMMODATION_CLASS_LABEL[value] }));

export interface SearchDistrictOption {
  slug: DistrictSlug;
  name: string;
}

/** The districts that have at least one property, in declaration order. */
export const SEARCH_DISTRICTS: SearchDistrictOption[] = DISTRICT_SLUGS.filter(
  (slug) => ALL_PROPERTIES.some((property) => property.district === slug),
).map((slug) => ({ slug, name: DISTRICT_NAME[slug] }));

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
