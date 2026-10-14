"use client";

import { PropertyCard } from "@injishi/contracts";
import { useEffect, useState } from "react";
import type { Destination } from "@/data/destinations";
import { API_URL } from "@/lib/api";

/**
 * Stays businesses published from the operator app, as search suggestions.
 *
 * THE GAP THIS CLOSES. The "Where to?" field ranked districts, parks, areas and
 * the code's fixed catalogue of stays. A property a business set up and
 * published lives only in the database, so typing its name answered "Nothing
 * matches" while the same stay sat in the results underneath. Every real stay
 * on the platform was unfindable by name.
 *
 * Read in the BROWSER, once, the first time a search field opens, and shared
 * by every field after that. Not in the server layout: that would make every
 * marketplace page wait on the API, up to its timeout when it is down. A failed
 * read leaves the suggestions as they were, never an error.
 */
let pending: Promise<Destination[]> | null = null;

function load(): Promise<Destination[]> {
  pending ??= fetch(`${API_URL}/api/v1/properties`)
    .then((res) => (res.ok ? res.json() : []))
    .then((body: unknown) => {
      const parsed = PropertyCard.array().safeParse(body);
      if (!parsed.success) return [];
      return parsed.data.map(
        (card): Destination => ({
          id: `s-${card.slug}`,
          label: card.name,
          context: card.districtName ?? "Rwanda",
          kind: "stay",
          district: card.districtName?.toLowerCase(),
          slug: card.slug,
        }),
      );
    })
    .catch(() => {
      // Let the next open try again rather than remembering a failure.
      pending = null;
      return [];
    });
  return pending;
}

/** The published stays, once `active` has been true; empty until they arrive. */
export function usePublishedStays(active: boolean): Destination[] {
  const [stays, setStays] = useState<Destination[]>([]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void load().then((next) => {
      if (!cancelled) setStays(next);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);
  return stays;
}
