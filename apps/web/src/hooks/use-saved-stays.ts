"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "injishi:saved-stays";
/** Fired on write so every mounted card re-reads, not just the one clicked. */
const CHANGE_EVENT = "injishi:saved-stays-change";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Saved stays, held in localStorage.
 *
 * Stands in for the collections endpoint until accounts exist. Starts empty on
 * the server and fills after mount, so SSR and the first client render agree.
 */
export function useSavedStays() {
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setSaved(read());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    const current = read();
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const isSaved = useCallback((slug: string) => saved.includes(slug), [saved]);

  return { saved, isSaved, toggle };
}
