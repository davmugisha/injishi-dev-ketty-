import { PROPERTIES, type PropertyDetail } from "@/data/properties";
import { FILLER_PROPERTIES, FILLER_SLUGS } from "@/data/filler-properties";

/**
 * The whole catalogue: the thirty full records, then the twenty-two sample seeds.
 *
 * This module exists to be the ONE place the two halves are joined. Both
 * `data/listings.ts` (which builds the explore cards) and
 * `data/search-options.ts` (which builds the facet vocabulary from whatever is
 * in the catalogue) need the joined set, and joining it in each of them is
 * exactly how the rail came to offer districts no property was in — the bug
 * `search-options.ts` was rewritten to make impossible.
 *
 * The thirty fuller records come first, so a surface that shows the top of the
 * catalogue without sorting shows the most complete pages. All fifty-two are
 * fictional.
 */
export const ALL_PROPERTIES: PropertyDetail[] = [...PROPERTIES, ...FILLER_PROPERTIES];

/** True for a fictional entry. `data/filler-properties.ts` owns the list. */
export function isSampleListing(slug: string): boolean {
  return FILLER_SLUGS.has(slug);
}

/**
 * Look a slug up across the WHOLE catalogue.
 *
 * This is the lookup every route must use, and `findProperty` in
 * `data/properties.ts` — which searches the real half only — is the one it
 * replaced. The reason is the defect `data/listings.ts` records in its own
 * header: the explore list and the property pages were built from different
 * sets, so every card pointed at a page that did not exist and the whole grid
 * 404ed. Adding a second, larger listing source without moving the lookup with
 * it would reintroduce exactly that bug, for the twenty-two sample stays.
 */
export function findCatalogueProperty(slug: string): PropertyDetail | undefined {
  return ALL_PROPERTIES.find((property) => property.slug === slug);
}

/** Every slug in the catalogue, for `generateStaticParams`. */
export function catalogueStaticParams(): { slug: string }[] {
  return ALL_PROPERTIES.map((property) => ({ slug: property.slug }));
}
