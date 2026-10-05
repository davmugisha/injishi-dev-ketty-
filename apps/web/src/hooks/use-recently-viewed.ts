"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "injishi:recently-viewed";
/** Fired on write so every mounted reader re-reads, not just the writer. */
const CHANGE_EVENT = "injishi:recently-viewed-change";
/** Kept, not shown: surfaces show fewer, but a removed stay lets the next surface. */
const KEEP = 12;

export type RecentView = { slug: string; at: number };

function read(): RecentView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // The first version stored bare slugs; read those as "time unknown".
    return parsed.flatMap((entry): RecentView[] => {
      if (typeof entry === "string") return [{ slug: entry, at: 0 }];
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as RecentView).slug === "string" &&
        typeof (entry as RecentView).at === "number"
      ) {
        return [entry as RecentView];
      }
      return [];
    });
  } catch {
    return [];
  }
}

function write(views: RecentView[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Private mode or a full quota: the surfaces simply have nothing to show.
  }
}

/** Put a stay at the front of the list. Called when its page is opened. */
export function recordRecentlyViewed(slug: string) {
  const rest = read().filter((v) => v.slug !== slug);
  write([{ slug, at: Date.now() }, ...rest].slice(0, KEEP));
}

/**
 * Stays this browser opened, most recent first, held in localStorage like
 * `use-saved-stays`: a browsing aid, not account data, so it needs no
 * sign-in. Starts empty on the server and fills after mount, so SSR and the
 * first client render agree.
 */
export function useRecentlyViewed() {
  const [views, setViews] = useState<RecentView[]>([]);

  useEffect(() => {
    const sync = () => setViews(read());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const remove = useCallback((slug: string) => write(read().filter((v) => v.slug !== slug)), []);
  const clear = useCallback(() => write([]), []);

  return { views, remove, clear };
}
