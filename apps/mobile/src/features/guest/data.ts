// The guest's reads and writes through the seam (proto-ui, PLAN.md "Data seam"). Mock mode answers
// from `mock-data.ts` and its writes change that sample data, so Pay leads to the wait, the wait to
// the booking, and a heart shows on every screen. Api mode keeps the reads that exist today (`queries.ts`,
// mapped by `api-map.ts`): Explore with its further pages and place suggestions, the property page, the
// account's trips, and the signed in account on Me. Everything else here has no real call yet and says
// so ("Not connected yet").

import type { ExploreMode } from "@injishi/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/data/fetch";
import { useAction, useSource } from "@/data/source";
import { isMock } from "@/lib/data-mode";
import { kigaliDate } from "@/lib/kigali";
import { useSession } from "@/lib/session";
import { toExploreData, toMeData, toMoreStays, toPlaceSuggestions, toStayDetail, toTripsData } from "./api-map";
import { type ExploreIntent, searchKey } from "./intent";
import {
  addToCalendar,
  chooseStay,
  confirmPayment,
  mockBadges,
  mockBooked,
  mockCheckout,
  mockDates,
  mockExplore,
  mockExploreEmpty,
  mockHome,
  mockMe,
  mockPayment,
  mockPlaces,
  mockSaved,
  mockSavedEmpty,
  mockStay,
  mockTrips,
  mockTripsEmpty,
  resendPrompt,
  setSearch,
  startPayment,
  toggleSaved,
} from "./mock-data";
import { fetchExplorePage, fetchExploreSearch, fetchMyTrips, fetchPlaces } from "./queries";
import type { DatesChoice, ExploreData, HomePhase, PayMethodId, StayDetail } from "./types";

/** Every write refreshes every guest read: the sample data is small and answers at once. */
const GUEST: readonly (readonly unknown[])[] = [["guest"]];

/** The tab bar's badges. Sample data only: in api mode the inbox has no count yet, so no badge. */
export function useGuestBadges() {
  return useSource(["guest", "badges"], { mock: mockBadges, empty: () => ({}) }, { enabled: isMock });
}

/** Home, before, during or after the stay. */
export function useGuestHome(phase: HomePhase) {
  return useSource(["guest", "home", phase], { mock: () => mockHome(phase) });
}

/**
 * Explore's stays for the search intent its route holds (`intent.ts`: place, words, mode and sort; see
 * `explore-intent.ts`). Api mode reads the first page of the public search, as the screen before this
 * one did; the sample data narrows its stays to a picked place or typed words.
 */
export function useExplore(intent: ExploreIntent) {
  return useSource(["guest", "explore", searchKey(intent)], {
    mock: () => mockExplore(intent),
    empty: () => mockExploreEmpty(intent),
    api: () => fetchExploreSearch(intent).then((result) => toExploreData(result, intent)),
  });
}

/**
 * Api mode: the search's pages after the first, from the first page's cursor on (AC-4, D-al). Nothing
 * is read until the list nears its end and asks (`fetchNextPage`), page by page, as the infinite query
 * before this port did. The sample data has one page (no cursor), so it never asks.
 */
function useLaterPages(intent: ExploreIntent, after: string | null) {
  return useInfiniteQuery({
    queryKey: ["source", "guest", "explore", searchKey(intent), "after", after],
    queryFn: ({ pageParam }) => fetchExploreSearch(intent, pageParam),
    initialPageParam: after,
    getNextPageParam: (last) => last.nextCursor,
    enabled: false,
  });
}

/** The list's end: another page loading, or what failed, and the calls the list makes. */
export interface ExploreMore {
  loading: boolean;
  error: Error | null;
  /** Load the next page, when there is one and nothing is loading or failed. */
  load: () => void;
  /** After a failure: ask again. */
  retry: () => void;
}

/**
 * Explore's list: the first page through the seam (`useExplore`), then, in api mode, each further page
 * as the list nears its end. `data` holds every stay loaded so far; the sample data's is its one page.
 */
export function useExploreList(intent: ExploreIntent) {
  const query = useExplore(intent);
  const first = query.data;
  const later = useLaterPages(intent, first?.next ?? null);
  const pages = later.data?.pages;
  const data = useMemo<ExploreData | undefined>(() => {
    if (!first || !pages?.length) return first;
    // A stay that moved from one page to the next while they loaded shows once.
    const seen = new Set(first.stays.map((s) => s.slug));
    const stays = [...first.stays];
    for (const stay of pages.flatMap(toMoreStays)) {
      if (seen.has(stay.slug)) continue;
      seen.add(stay.slug);
      stays.push(stay);
    }
    return { ...first, stays, next: pages[pages.length - 1]?.nextCursor ?? null };
  }, [first, pages]);

  const hasMore = later.data ? later.hasNextPage : (first?.next ?? null) !== null;
  const { isFetching, isError, error, fetchNextPage } = later;
  const load = useCallback(() => {
    if (hasMore && !isFetching && !isError) void fetchNextPage();
  }, [hasMore, isFetching, isError, fetchNextPage]);
  const retry = useCallback(() => void fetchNextPage(), [fetchNextPage]);
  const more: ExploreMore = { loading: isFetching, error: isError ? error : null, load, retry };
  return { query, data, more };
}

/** Suggestions wait this long after the last letter, so typing a word asks once (D-g). */
const PLACES_DEBOUNCE_MS = 250;

/** The words, once typing pauses. */
function useDebounced(value: string, ms: number): string {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * The dates sheet's "Where": districts, sectors and stays for two letters or more (AC-5). Api mode asks
 * `GET /explore/places`; the sample data offers the prototype's places and stays.
 */
export function usePlaceSuggestions(typed: string, mode: ExploreMode) {
  const text = useDebounced(typed.trim(), PLACES_DEBOUNCE_MS);
  return useSource(
    ["guest", "places", mode, text.toLowerCase()],
    { mock: () => mockPlaces(text), api: () => fetchPlaces(mode, text).then(toPlaceSuggestions) },
    { enabled: text.length >= 2 },
  );
}

/** A stay's page; null when it is not (or no longer) public, which the API answers with a 404. */
export function useStay(slug: string) {
  return useSource<StayDetail | null>(["guest", "stay", slug], {
    mock: () => mockStay(slug),
    api: () =>
      fetchExplorePage(slug)
        .then(toStayDetail)
        .catch((error: unknown) => {
          if (error instanceof ApiError && error.httpStatus === 404) return null;
          throw error;
        }),
  });
}

/**
 * The dates sheet: a stay's rooms and nights (the stay being booked when no slug is given), or the
 * search on Explore.
 */
export function useDates(input: { explore: boolean; slug: string | null; roomId: string | null }) {
  return useSource(["guest", "dates", input.explore, input.slug, input.roomId], { mock: () => mockDates(input) });
}

export function useCheckout() {
  return useSource(["guest", "checkout"], { mock: mockCheckout });
}

export function usePayment() {
  return useSource(["guest", "payment"], { mock: mockPayment });
}

export function useBooked() {
  return useSource(["guest", "booked"], { mock: mockBooked });
}

/**
 * Trips. Api mode reads the signed in account's bookings (`GET /me/trips`), keyed by the account so
 * one person never sees another's; signed out, nothing is asked and the screen offers sign in.
 */
export function useTrips() {
  const userId = useSession().account?.userId ?? null;
  return useSource(
    ["guest", "trips", userId],
    {
      mock: mockTrips,
      empty: mockTripsEmpty,
      api: () => fetchMyTrips().then((mine) => toTripsData(mine, kigaliDate(Date.now()))),
    },
    { enabled: isMock || userId !== null },
  );
}

export function useSaved() {
  return useSource(["guest", "saved"], { mock: mockSaved, empty: mockSavedEmpty });
}

/**
 * Me. Api mode answers with the signed in account as the session holds it (its name and email) and
 * Sign out; rewards, the saved ID and payment numbers have no read yet and are left out. Signed out,
 * nothing is asked and the screen offers sign in.
 */
export function useMe() {
  const { account } = useSession();
  return useSource(
    ["guest", "me", account?.userId ?? null, account?.name, account?.email],
    {
      mock: mockMe,
      api: () => (account ? Promise.resolve(toMeData(account)) : Promise.reject(new ApiError("signedOut"))),
    },
    { enabled: isMock || account !== null },
  );
}

/** The heart on a stay. Resolves to whether it is saved now. */
export function useToggleSaved() {
  return useAction<string, boolean>({ mock: toggleSaved, invalidates: GUEST });
}

/** Dates and guests for Explore's search. */
export function useSetSearch() {
  return useAction<DatesChoice>({ mock: setSearch, invalidates: GUEST });
}

/** A stay, room and dates chosen: what checkout prices. */
export function useChooseStay() {
  return useAction<DatesChoice>({ mock: chooseStay, invalidates: GUEST });
}

/** Pay: the prompt goes to the wallet. */
export function useStartPayment() {
  return useAction<PayMethodId, unknown>({ mock: startPayment, invalidates: GUEST });
}

export function useResendPrompt() {
  return useAction<void, unknown>({ mock: resendPrompt, invalidates: GUEST });
}

/** "I've approved, check now": confirmed, the room is booked. */
export function useConfirmPayment() {
  return useAction<void, unknown>({ mock: confirmPayment, invalidates: GUEST });
}

export function useAddToCalendar() {
  return useAction<void, unknown>({ mock: addToCalendar, invalidates: GUEST });
}
