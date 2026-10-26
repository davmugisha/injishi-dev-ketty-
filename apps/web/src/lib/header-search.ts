"use client";

import { useSyncExternalStore } from "react";

/**
 * The compact search that slides into the site header once a page's own
 * search bar has scrolled out of view — the pattern Airbnb made familiar:
 * the full bar at the top of the page, a one-line summary of it in the
 * header further down, and a click on the summary brings the full bar back.
 *
 * The header lives in the shared layout and the bar inside the page, so they
 * meet here: the page registers what the pill should say and what a click on
 * it does, and reports whether its own bar is on screen; the header reads it.
 * A page that registers nothing gets no pill, so every other page's header is
 * untouched.
 */
interface HeaderSearch {
  place: string;
  dates: string;
  guests: string;
  /** Bring the page's full search bar back and open it. */
  expand: () => void;
}

interface State {
  search: HeaderSearch | null;
  /** True while the page's own bar is scrolled out of view. */
  shown: boolean;
}

let state: State = { search: null, shown: false };
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

export function setHeaderSearch(search: HeaderSearch | null) {
  emit({ search, shown: search ? state.shown : false });
}

export function setHeaderSearchShown(shown: boolean) {
  if (shown !== state.shown) emit({ ...state, shown });
}

const SERVER: State = { search: null, shown: false };

export function useHeaderSearch(): State {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => SERVER,
  );
}
