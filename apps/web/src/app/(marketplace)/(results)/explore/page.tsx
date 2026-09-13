import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@injishi/ui";
import { ExploreShell } from "@/components/explore/explore-shell";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
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
    <div className="page-y pt-5 lg:pt-6">
      <div className="container max-lg:mb-3">
        <Breadcrumbs trail={[{ label: "Home", href: "/" }, { label: "Search" }]} />
      </div>

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

function ResultsSkeleton() {
  return (
    <div>
      <div className="border-b border-separator py-2.5">
        <div className="container">
          <Skeleton className="h-11 w-full rounded-full lg:w-[600px]" />
        </div>
      </div>
      <div className="container mt-6 flex items-start gap-8">
        <Skeleton className="hidden h-[600px] w-[280px] shrink-0 rounded-card lg:block" />
        <div className="min-w-0 flex-1">
          <Skeleton className="mb-4 h-8 w-full rounded-full" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-[220px] w-full rounded-card" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
