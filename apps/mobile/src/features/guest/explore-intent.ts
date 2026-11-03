// The search intent as an Explore route holds it (`intent.ts`, cross child contract "The search
// intent"), and the dates sheet's "Where" pick handed to it. The sheet is a route of its own over the
// tabs, so it cannot set Explore's params; it hands the pick here, and each Explore screen that is open
// (the list, and the map over it) takes it into its own route's params, focused or not. Both modes
// alike: the sample data narrows by the same params.

import { useLocalSearchParams, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { type ExploreIntent, intentFrom, intentParams } from "./intent";

/** What the sheet's "Where" sets: a picked suggestion, typed words, or neither (everywhere). */
export type PlacePick = Pick<ExploreIntent, "place" | "placeLabel" | "q">;

type Taker = (pick: PlacePick) => void;

/** The one call this needs from the route's navigator, which every navigator has: set this route's params. */
type ParamsNavigation = { setParams: (params: Record<string, string | undefined>) => void };

const takers = new Set<Taker>();
/** A pick made while no Explore screen was open (the sheet opened on its own), for the next one. */
let waiting: PlacePick | null = null;

/** The sheet's pick: every open Explore screen searches for it now. */
export function pickPlace(pick: PlacePick): void {
  if (takers.size === 0) {
    waiting = pick;
    return;
  }
  for (const take of takers) take(pick);
}

/**
 * This Explore route's intent and a way to change it. Every key is named when it changes, so a
 * cleared one leaves the route rather than lingering in it; the sheet's picks are taken in the same way.
 */
export function useExploreIntent(): [ExploreIntent, (next: ExploreIntent) => void] {
  const params = useLocalSearchParams();
  const intent = useMemo(() => intentFrom(params), [params]);
  const navigation = useNavigation<ParamsNavigation>();
  const setIntent = useCallback(
    (next: ExploreIntent) => {
      const carried = intentParams(next);
      navigation.setParams({
        mode: carried.mode,
        q: carried.q,
        place: carried.place,
        placeLabel: carried.placeLabel,
        sort: carried.sort,
      });
    },
    [navigation],
  );
  useEffect(() => {
    const take: Taker = (pick) => setIntent({ ...intent, ...pick });
    if (waiting) {
      take(waiting);
      waiting = null;
    }
    takers.add(take);
    return () => {
      takers.delete(take);
    };
  }, [intent, setIntent]);
  return [intent, setIntent];
}
