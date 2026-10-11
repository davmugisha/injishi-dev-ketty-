import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@injishi/ui";
import { ExploreShell } from "@/components/explore/explore-shell";
import { databaseListings } from "@/data/discovery";

export const metadata: Metadata = {
  title: "Find your perfect stay",
  description:
    "Browse verified guesthouses, lodges and serviced apartments across Rwanda. Filter by type, budget, district and size.",
};

export default async function ExplorePage() {
  // Inventory published in the operator app, beside the catalogue (booking
  // audit, 2026-09-13). Revalidated every minute; an unreachable API lists none.
  const fromDatabase = await databaseListings();

  return (
    // `pt-5`, tighter than `.page-y`'s shared 2.5rem. This route opens on a
    // breadcrumb and then straight into the search strip, and the reference
    // puts almost nothing between the bar and the first control. The shared
    // step is sized for pages that open on a heading, so it is overridden here
    // rather than shortened for everyone.
    // No breadcrumb and almost no top padding: this is a working surface
    // that opens straight on the search pill, the filter row and the
    // results, with nothing to scroll past first.
    <div className="page-y pt-1 lg:pt-2">

      {/*
        No visible marketing headline here any more. The reference this page
        was rebuilt from opens straight on the sticky search bar and the
        results — a dense working surface, not a landing page — and a 32px
        "Find your perfect stay" pushed that bar down for no reader benefit.
        The `sr-only` heading keeps the route's one real h1 for a screen
        reader and for the outline a search engine reads; the metadata title
        above already carries the same words into the tab and into search
        results.
      */}
      <h1 className="sr-only">Find your perfect stay</h1>

      {/* useSearchParams needs a Suspense boundary to keep the route static. */}
      <Suspense fallback={<ResultsSkeleton />}>
        <ExploreShell databaseListings={fromDatabase} />
      </Suspense>
    </div>
  );
}

/**
 * What the static page paints before the client takes over. It is built to
 * the final layout's measurements (band 133px tall from `lg`, the page
 * column, a two-column grid beside a 5/12 map) so the swap does not jump:
 * a placeholder of a different shape is itself the flicker.
 */
function ResultsSkeleton() {
  return (
    <div>
      <div className="border-b border-separator py-3 lg:h-[133px] lg:py-2.5">
        <div className="container flex flex-col items-center gap-3">
          <Skeleton className="h-[52px] w-full max-w-wide rounded-full" />
          <Skeleton className="h-10 w-full max-w-wide rounded-full" />
        </div>
      </div>
      <div className="container mt-8 flex items-start gap-8">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-8 w-64 rounded-full" />
          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="aspect-[20/19] w-full rounded-card" />
            ))}
          </div>
        </div>
        <Skeleton className="hidden h-[calc(100dvh-245px)] shrink-0 rounded-card lg:block lg:w-5/12" />
      </div>
    </div>
  );
}
