"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@injishi/ui";
import { pluralize } from "@injishi/utils";
import { ListingCard } from "@/components/stays/listing-card";
import { LISTINGS, type Listing } from "@/data/listings";
import { useSavedStays } from "@/hooks/use-saved-stays";

/**
 * The saved list.
 *
 * The capture hard-coded two cards and its "Remove" buttons had no handler, so
 * nothing could ever be removed. This reads the same store the heart on every
 * listing card writes to, so the two stay in step.
 *
 * IT MATCHES AGAINST EVERY LISTING A HEART CAN BE ON. It used to look only in
 * the catalogue kept in this app, while Explore also shows the properties the
 * API publishes (`databaseListings`), so a guest could heart one of those and
 * never find it here. The page passes those in, read on the server exactly as
 * Explore reads them.
 *
 * It also carried a heading from the capture ("Kigali: March trip") on
 * everybody's list — this list is not a trip and nobody named it — and a
 * "Compare" button with no handler. Both are gone: a control that does nothing
 * reads as broken, and a made-up title reads as somebody else's data.
 */
export function SavedCollection({ extraListings = [] }: { extraListings?: Listing[] }) {
  const { saved, toggle } = useSavedStays();

  const listings = useMemo(() => {
    // A published property whose slug the catalogue also describes arrives
    // twice; the catalogue copy wins because it is the richer card, and `seen`
    // keeps the second out rather than rendering the same stay in two places.
    const seen = new Set<string>();
    return [...LISTINGS, ...extraListings].filter((listing) => {
      if (!saved.includes(listing.slug) || seen.has(listing.slug)) return false;
      seen.add(listing.slug);
      return true;
    });
  }, [saved, extraListings]);

  return (
    <section className="animate-fade-up mt-6 flex flex-col gap-6">
      {/* One column, not a `justify-between` row: the "Compare" button that
          used to sit on the other side of it is gone. */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-page-fg lg:text-display-sm">Saved stays</h1>
        <p className="text-sm text-page-fg-70">
          {listings.length === 0
            ? "Nothing saved yet"
            : `${pluralize(listings.length, "stay")} saved`}
        </p>
      </div>

      {listings.length === 0 ? (
        <EmptySaved />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <div key={listing.slug} className="relative">
              <ListingCard listing={listing} />
              {/* `inverse` is the always-white fill; the card behind it is a
                  photograph, so this control cannot follow the theme. */}
              <Button
                variant="inverse"
                size="sm"
                onClick={() => toggle(listing.slug)}
                className="absolute right-4 top-4 z-[3] h-auto bg-white/90 px-3 py-1.5 text-xs"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function EmptySaved() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-card border border-dashed border-input py-20 text-center">
      <p className="text-xl text-page-fg">You have not saved any stays yet.</p>
      <p className="text-sm text-page-fg-70">
        Tap the heart on any listing and it will appear here.
      </p>
      <Button asChild className="mt-2">
        <Link href="/explore">Browse stays</Link>
      </Button>
    </div>
  );
}
