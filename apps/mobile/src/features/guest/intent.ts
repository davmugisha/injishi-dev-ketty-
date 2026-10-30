// The search intent (mobile spec 0005, cross child contract "The search intent"): one choice of place,
// mode and sort, held in the Explore route's search params, so back, sign in and the property page
// all read the same search. Pure: no React Native import. Dates, party and filters join it in
// milestone 3.

import { ExploreMode, ExplorePlaceRef, ExploreSort } from "@injishi/contracts";

export interface ExploreIntent {
  mode: ExploreMode;
  /** Typed words, when no suggestion was picked. */
  q: string;
  /** A picked suggestion (`sector:10201`), which wins over `q`. */
  place: string | null;
  /** The picked suggestion's label, for the search bar. Display only: never sent. */
  placeLabel: string | null;
  sort: ExploreSort;
}

export const EMPTY_INTENT: ExploreIntent = { mode: "stays", q: "", place: null, placeLabel: null, sort: "top_rated" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The intent in a route's params; anything unreadable falls back to the default, never throws. */
export function intentFrom(params: Params): ExploreIntent {
  const mode = ExploreMode.safeParse(one(params.mode));
  const sort = ExploreSort.safeParse(one(params.sort));
  const place = ExplorePlaceRef.safeParse(one(params.place));
  const q = (one(params.q) ?? "").slice(0, 80);
  return {
    mode: mode.success ? mode.data : "stays",
    q,
    place: place.success ? place.data : null,
    placeLabel: place.success ? (one(params.placeLabel) ?? null) : null,
    sort: sort.success ? sort.data : "top_rated",
  };
}

/** The params that carry an intent, the defaults left out so a plain Explore stays `/guest/explore`. */
export function intentParams(intent: ExploreIntent): Record<string, string> {
  const params: Record<string, string> = {};
  if (intent.mode !== "stays") params.mode = intent.mode;
  if (intent.place) {
    params.place = intent.place;
    if (intent.placeLabel) params.placeLabel = intent.placeLabel;
  } else if (intent.q.trim()) {
    params.q = intent.q.trim();
  }
  if (intent.sort !== "top_rated") params.sort = intent.sort;
  return params;
}

/** What the API is asked, and the cache key: the place wins over the words, the label is not sent. */
export function searchKey(intent: ExploreIntent): {
  mode: ExploreMode;
  place: string | null;
  q: string;
  sort: ExploreSort;
} {
  return {
    mode: intent.mode,
    place: intent.place,
    q: intent.place ? "" : intent.q.trim(),
    sort: intent.sort,
  };
}

/** `/api/v1/explore/search?…` for one page of this intent. */
export function searchPath(intent: ExploreIntent, cursor: string | null): string {
  const key = searchKey(intent);
  const query = new URLSearchParams({ mode: key.mode, sort: key.sort });
  if (key.place) query.set("place", key.place);
  else if (key.q) query.set("q", key.q);
  if (cursor) query.set("cursor", cursor);
  return `/api/v1/explore/search?${query.toString()}`;
}

/** The intent has a search narrower than everywhere, so an empty result can offer to clear it. */
export function isNarrowed(intent: ExploreIntent): boolean {
  return !!intent.place || !!intent.q.trim();
}
