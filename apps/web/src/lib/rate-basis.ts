/**
 * Whether a rate is quoted per person ("per person, per night", "per guest"),
 * read from the listing's basis text.
 *
 * This module imports NOTHING, and must keep importing nothing. It used to
 * live in `lib/party-price.ts`, which imports `lib/search-params.ts`, which
 * imports `data/search-options.ts`, which reads the whole catalogue at module
 * load. `lib/booking-unit.ts` needs only this one test, and the catalogue's
 * own fixtures (`data/filler-properties.ts`) import `booking-unit`, so
 * reaching it through `party-price` closed a loop: the catalogue started
 * loading, asked for `booking-unit`, which asked for the search options, which
 * read the catalogue before it existed. `next build` then failed collecting
 * `/saved` with "Cannot access 'i' before initialization" (main, 2026-10-05).
 * `tests/rate-basis-leaf.test.mjs` fails if an import appears here again.
 */
export function isPerPerson(basis: string): boolean {
  return /person|guest/i.test(basis);
}
