"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ListingCard } from "@/components/stays/listing-card";
import type { Listing } from "@/data/listings";
import { parseIntent } from "@/lib/search-params";

/**
 * The similar-stays rail, with the search carried across it.
 *
 * A client leaf for one reason: the property page is statically generated from
 * `generateStaticParams`, and giving it a `searchParams` prop would opt all
 * thirty pages out of that. Reading the params in the browser keeps the page
 * static and still lets a hop from one stay to the next keep the dates and the
 * party the guest already entered.
 *
 * Without this the rail was the one place in the funnel that quietly reset the
 * search: three cards linking to a bare `/property/<slug>`, and a booking
 * widget that opened empty on arrival.
 */
export function RelatedStays({ listings }: { listings: Listing[] }) {
  const params = useSearchParams();
  const intent = useMemo(() => parseIntent(params), [params]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing) => (
        <ListingCard key={listing.slug} listing={listing} intent={intent} />
      ))}
    </div>
  );
}

/** The rail's shape while the browser reads the URL. Three cells, same grid. */
export function RelatedStaysSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-hidden
    >
      {[0, 1, 2].map((cell) => (
        <div
          key={cell}
          className="aspect-[16/10] w-full animate-pulse rounded-card bg-surface-secondary"
        />
      ))}
    </div>
  );
}
