"use client";

import { ArrowRight } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type { MapBounds } from "@/components/explore/explore-map";
import type { Listing } from "@/data/listings";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { StayIntent } from "@/lib/search-params";

// The same dynamic, client-only map the split view uses: one chunk, loaded
// only when the rail is actually on screen (see `useMediaQuery` below).
const ExploreMap = dynamic(
  () => import("@/components/explore/explore-map").then((m) => m.ExploreMap),
  { ssr: false, loading: () => <div className="size-full animate-pulse rounded-card bg-surface-secondary" /> },
);

/**
 * The right rail on Explore, from `xl` up: a live mini map of the results
 * and an editorial card that leads into the guides.
 *
 * It replaced two promotional tiles whose buttons led back to this page and
 * promised long-stay pricing no stay has. The mini map is the same map as the
 * split view (`variant="mini"`), so a pin clicked here opens the full map on
 * that stay.
 */
export function ExploreSideRail({
  results,
  hoveredSlug,
  selectedSlug,
  onHover,
  onSelect,
  onBoundsChange,
  onOpenMap,
  intent,
}: {
  results: Listing[];
  hoveredSlug: string | null;
  selectedSlug: string | null;
  onHover: (slug: string | null) => void;
  onSelect: (slug: string | null) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  onOpenMap: () => void;
  intent?: StayIntent;
}) {
  // Mount the map only where the rail shows; below `xl` it is `hidden`, and a
  // hidden map would still cost every phone the maplibre download.
  const wide = useMediaQuery("(min-width: 1280px)");

  return (
    <aside
      data-side-rail
      className="sticky top-[calc(var(--explore-band-bottom,169px)+16px)] hidden w-[264px] shrink-0 flex-col gap-4 xl:flex 2xl:w-[300px]"
    >
      <div className="h-[340px]">
        {wide ? (
          <ExploreMap
            variant="mini"
            listings={results}
            hoveredSlug={hoveredSlug}
            selectedSlug={selectedSlug}
            onHover={onHover}
            onSelect={onSelect}
            onExpand={onOpenMap}
            searchArea={false}
            onSearchAreaChange={() => {}}
            onBoundsChange={onBoundsChange}
            areaCount={results.length}
            intent={intent}
          />
        ) : null}
      </div>

      <EditorialCard />
    </aside>
  );
}

/**
 * "More than a stay, it's a story." A doorway into the guides, which are
 * real pages, so the card promises nothing the platform cannot show.
 */
function EditorialCard() {
  return (
    <Link
      href="/guides"
      className="group relative isolate flex h-[248px] flex-col justify-end overflow-hidden rounded-card p-5 text-white shadow-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <Image
        src="/assets/nyungwe-forest-03.jpg"
        alt=""
        fill
        sizes="(min-width: 1536px) 300px, 264px"
        className="-z-10 object-cover transition-transform duration-travel ease-settle group-hover:scale-105"
      />
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-black/5"
      />
      <span className="font-display text-2xl italic leading-tight">
        More than a stay,
        <br />
        it&rsquo;s a story.
      </span>
      <span className="mt-2 text-sm leading-snug text-white/85">
        Discover Rwanda&rsquo;s extraordinary places, people and wildlife.
      </span>
      <span className="mt-3 flex items-center gap-1.5 text-sm font-bold">
        Read our guides
        <ArrowRight className="size-4 transition-transform duration-quick group-hover:translate-x-0.5" strokeWidth={2.4} aria-hidden />
      </span>
    </Link>
  );
}
