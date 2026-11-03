// Explore's reads (mobile spec 0005, cross child contract "Query keys"): public reads under `["pub", …]`,
// checked against their contracts as they arrive. Nothing here is kept on the phone yet; the last
// search and the last pages opened are kept in milestone 4 (D-ab).

import { ExplorePage, ExplorePlaces, ExploreSearchResult, type ExploreMode } from "@injishi/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getParsed } from "@/data/fetch";
import { type ExploreIntent, searchKey, searchPath } from "./intent";

/** Suggestions wait this long after the last letter, so typing a word asks once (D-g). */
const PLACES_DEBOUNCE_MS = 250;

/** Pages of 20, the next one when the list nears its end (AC-4, D-al). */
export function useExploreSearch(intent: ExploreIntent) {
  return useInfiniteQuery({
    queryKey: ["pub", "search", searchKey(intent)],
    queryFn: ({ pageParam }) => getParsed(ExploreSearchResult, searchPath(intent, pageParam)),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** The words, once typing pauses. */
function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** Districts, sectors and properties for two letters or more, kept five minutes (AC-5). */
export function usePlaces(mode: ExploreMode, typed: string) {
  const text = useDebounced(typed.trim(), PLACES_DEBOUNCE_MS);
  return useQuery({
    queryKey: ["pub", "places", mode, text.toLowerCase()],
    queryFn: () =>
      getParsed(ExplorePlaces, `/api/v1/explore/places?${new URLSearchParams({ q: text, mode }).toString()}`),
    enabled: text.length >= 2,
    staleTime: 5 * 60_000,
  });
}

/** One property page, a stay or a home (AC-7). */
export function useExplorePage(slug: string) {
  return useQuery({
    queryKey: ["pub", "page", slug],
    queryFn: () => getParsed(ExplorePage, `/api/v1/explore/properties/${encodeURIComponent(slug)}`),
    enabled: slug.length > 0,
  });
}
