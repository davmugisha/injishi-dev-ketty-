// The guest's real reads (mobile spec 0005, cross child contract "Query keys"): the public search, its
// place suggestions and a property's page, and the account's own trips, checked against their contracts
// as they arrive. They are the `api` side of `data.ts`'s hooks; the sample data answers in mock mode.

import { ExplorePage, ExplorePlaces, ExploreSearchResult, type ExploreMode, MyTrips } from "@injishi/contracts";
import { getParsed } from "@/data/fetch";
import { type ExploreIntent, searchPath } from "./intent";

/** One page of 20 for this search intent (AC-4, D-al); the first page when `cursor` is null. */
export function fetchExploreSearch(intent: ExploreIntent, cursor: string | null = null) {
  return getParsed(ExploreSearchResult, searchPath(intent, cursor));
}

/** Districts, sectors and properties for two letters or more (AC-5). */
export function fetchPlaces(mode: ExploreMode, text: string) {
  return getParsed(ExplorePlaces, `/api/v1/explore/places?${new URLSearchParams({ q: text, mode }).toString()}`);
}

/** One property page, a stay or a home (AC-7). A hidden or unknown property is a 404 refusal. */
export function fetchExplorePage(slug: string) {
  return getParsed(ExplorePage, `/api/v1/explore/properties/${encodeURIComponent(slug)}`);
}

/** The signed in account's bookings, newest stay first (AC-2). */
export function fetchMyTrips() {
  return getParsed(MyTrips, "/api/v1/me/trips");
}
