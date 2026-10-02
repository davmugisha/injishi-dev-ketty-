"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  COMPARE_LIMIT,
  CompareSheet,
  CompareTray,
} from "@/components/explore/compare";
import { List, Map as MapIcon } from "lucide-react";
import { cn } from "@injishi/utils";
import { ActiveFilterChips } from "@/components/explore/active-filters";
import { ExploreFilterBar } from "@/components/explore/explore-filter-bar";
import { CLEARED_REFINEMENT } from "@/components/explore/explore-filters";
import { SEARCH_DISTRICTS } from "@/data/search-options";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ExploreResults } from "@/components/explore/explore-results";
import { ExploreSearchBar } from "@/components/explore/explore-search-bar";
import { FilterSheet } from "@/components/explore/filter-sheet";

// The map pulls in maplibre-gl (~200 KB gz) and touches `window`, so it is
// dynamic + client-only. A guest who never toggles the map never pays for it.
const ExploreMap = dynamic(
  () => import("@/components/explore/explore-map").then((m) => m.ExploreMap),
  { ssr: false, loading: () => <MapSkeleton /> },
);

function MapSkeleton() {
  return <div className="h-full w-full animate-pulse rounded-card bg-surface-secondary" />;
}
import { EXPLORE_RESULTS_ID, ResultsToolbar, stayTabId } from "@/components/explore/results-toolbar";
import { LISTINGS, type Listing } from "@/data/listings";
import type { MapBounds } from "@/components/explore/explore-map";
import { filterListings } from "@/lib/filter-listings";
import {
  DEFAULT_REFINEMENT,
  EMPTY_INTENT,
  exploreHref,
  parseIntent,
  parseRefinement,
  refinementCount,
  type ExploreRefinement,
  type ExploreSort,
  type StayIntent,
} from "@/lib/search-params";
import { intentDateSummary, guestSummary } from "@/lib/stay-search";

/**
 * The whole of `/explore`'s client behaviour, in one place.
 *
 * Everything downstream — the rail, the toolbar, the list, the mobile sheet —
 * is a pure function of `intent` and `refinement`, both held here and both
 * mirrored to the URL by ONE function, `commit`. `lib/search-params.ts` is the
 * only module allowed to build that query string; this component is the only
 * one allowed to call the function that does.
 *
 * The page is two halves from `lg` up: a grid of stays on the left and the
 * map on the right, under a compact search pill and one row of filters
 * (Filters, the quick chips, Compare). Every rail group lives in the Filters
 * panel. On a phone the list and the map swap, with a floating toggle.
 */
export function ExploreShell({
  databaseListings = [],
}: {
  /**
   * Published properties from the database that the catalogue does not
   * describe, read by the page on the server (`data/discovery.ts`). Listed
   * first: they are the stays a guest can actually book through Injishi.
   */
  databaseListings?: Listing[];
} = {}) {
  const router = useRouter();
  const listings = useMemo(() => [...databaseListings, ...LISTINGS], [databaseListings]);
  const searchParams = useSearchParams();

  const urlIntent = useMemo(() => parseIntent(searchParams), [searchParams]);
  const urlRefinement = useMemo(() => parseRefinement(searchParams), [searchParams]);

  const [intent, setIntent] = useState<StayIntent>(urlIntent);
  const [refinement, setRefinement] = useState<ExploreRefinement>(urlRefinement);
  const [sheetOpen, setSheetOpen] = useState(false);
  // The map is on by default where there is room for it beside the list
  // (`lg` up) and off on a phone, where it swaps with the list instead. A
  // toggle overrides the default for this visit.
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [mapPref, setMapPref] = useState<boolean | null>(null);
  const mapOn = mapPref ?? desktop;
  const toggleMap = () => setMapPref(!mapOn);
  // Hover-sync: a card sets this on mouse-enter, the map highlights the pin;
  // a pin sets it on hover, the card scrolls into view. Selection is a
  // separate slot so a click on either side survives the next hover clear.
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  // "Search as I move the map": when on, the list is the results inside the
  // map's last visible bounds. The map always gets the full result set, so
  // narrowing the list can never feed back into what the map fits to.
  const [searchArea, setSearchArea] = useState(false);
  // Compare: the picks live in the URL (`cmp`), so they survive filter
  // changes, page turns and reloads, and a comparison can be shared.
  const [compareOpen, setCompareOpen] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

  const results = useMemo(
    () => filterListings(listings, intent, refinement),
    [listings, intent, refinement],
  );

  const listed = useMemo(() => {
    if (!mapOn || !searchArea || !mapBounds) return results;
    const [w, s, e, n] = mapBounds;
    return results.filter(
      (l) =>
        l.latitude !== null &&
        l.longitude !== null &&
        l.longitude >= w &&
        l.longitude <= e &&
        l.latitude >= s &&
        l.latitude <= n,
    );
  }, [results, mapOn, searchArea, mapBounds]);

  const commit = useCallback(
    (nextIntent: StayIntent, nextRefinement: ExploreRefinement) => {
      router.replace(exploreHref(nextIntent, nextRefinement), { scroll: false });
    },
    [router],
  );

  const submit = useCallback(() => {
    commit(intent, refinement);
  }, [commit, intent, refinement]);

  const goToPage = useCallback(
    (next: number) => {
      const nextRefinement = { ...refinement, page: next };
      setRefinement(nextRefinement);
      commit(intent, nextRefinement);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [commit, intent, refinement],
  );

  /**
   * Every control below the search bar commits IMMEDIATELY rather than
   * waiting for a Search press — a ticked amenity is meant to narrow the list
   * the moment it is ticked, which is the whole point of a filter rail.
   *
   * State and URL are set from the SAME merged object rather than each
   * recomputing its own — two merges of the same patch is how a control ends
   * up narrowing the render but not the address bar, or the reverse.
   * Narrowing the set invalidates where you were in it, unless the patch IS
   * the page turn itself, which is what `goToPage` is for.
   */
  const onRefinementChange = useCallback(
    (next: Partial<ExploreRefinement>) => {
      const merged: ExploreRefinement = {
        ...refinement,
        ...next,
        page: "page" in next ? next.page! : 1,
      };
      setRefinement(merged);
      commit(intent, merged);
    },
    [commit, intent, refinement],
  );

  const compared = useMemo(
    () =>
      refinement.picks
        .map((slug) => listings.find((l) => l.slug === slug))
        .filter((l): l is Listing => l !== undefined),
    [refinement.picks, listings],
  );
  // Picking is not narrowing: keep the page the guest is on.
  const setPicks = useCallback(
    (picks: string[]) => onRefinementChange({ picks, page: refinement.page }),
    [onRefinementChange, refinement.page],
  );
  const toggleCompare = useCallback(
    (slug: string) => {
      const picks = refinement.picks;
      if (picks.includes(slug)) setPicks(picks.filter((s) => s !== slug));
      else if (picks.length < COMPARE_LIMIT) setPicks([...picks, slug]);
    },
    [refinement.picks, setPicks],
  );
  const removeCompared = useCallback(
    (slug: string) => {
      const next = refinement.picks.filter((s) => s !== slug);
      setPicks(next);
      // A comparison of one is not a comparison; close the sheet.
      if (next.length < 2) setCompareOpen(false);
    },
    [refinement.picks, setPicks],
  );

  /**
   * "Clear all": the place AND every rail filter, in ONE commit. Two calls in
   * a row (intent, then refinement) each committed from the state they
   * closed over, so the second wrote the old place back into the URL.
   */
  const clearFilters = useCallback(() => {
    const nextIntent: StayIntent = { ...intent, districts: [], query: "" };
    const nextRefinement: ExploreRefinement = { ...refinement, ...CLEARED_REFINEMENT, page: 1 };
    setIntent(nextIntent);
    setRefinement(nextRefinement);
    commit(nextIntent, nextRefinement);
  }, [commit, intent, refinement]);

  const onIntentChange = useCallback(
    (next: Partial<StayIntent>) => {
      const mergedIntent: StayIntent = { ...intent, ...next };
      const mergedRefinement: ExploreRefinement = { ...refinement, page: 1 };
      setIntent(mergedIntent);
      setRefinement(mergedRefinement);
      commit(mergedIntent, mergedRefinement);
    },
    [commit, intent, refinement],
  );

  const dates = intentDateSummary(intent);
  const place =
    intent.districts.length === 0
      ? intent.query.trim() || "Rwanda"
      : intent.districts.length === 1
        ? (SEARCH_DISTRICTS.find((d) => d.slug === intent.districts[0])?.name ?? "1 district")
        : `${intent.districts.length} districts`;

  const appliedCount = refinementCount(refinement) + (intent.districts.length > 0 ? 1 : 0);

  return (
    <div data-explore-shell>
      <ExploreSearchBar
        intent={intent}
        onIntentChange={onIntentChange}
        onSubmit={submit}
        below={
          <ExploreFilterBar
            listings={listings}
            intent={intent}
            refinement={refinement}
            onRefinementChange={onRefinementChange}
            activeCount={appliedCount}
            onOpenFilters={() => setSheetOpen(true)}
          />
        }
      />

      <div className="mt-6 flex items-start gap-8 px-4 sm:px-6 xl:px-10">
        {/* On a phone the map replaces the list rather than squeezing in. */}
        <div className={cn("min-w-0 flex-1", mapOn && "hidden lg:block")}>
          <ResultsToolbar
            count={listed.length}
            totalCatalogue={listings.length}
            place={place}
            stayType={refinement.stayType}
            onStayTypeChange={(stayType) => onRefinementChange({ stayType })}
            sort={refinement.sort}
            onSortChange={(sort: ExploreSort) => onRefinementChange({ sort })}
            mapOn={mapOn}
            onToggleMap={toggleMap}
          />

          <ActiveFilterChips
            listings={listings}
            intent={intent}
            refinement={refinement}
            onIntentChange={onIntentChange}
            onRefinementChange={onRefinementChange}
            onClearAll={clearFilters}
          />

          {dates ? (
            <p className="mt-3 text-sm text-page-fg-70">
              {dates} for {guestSummary(intent.guests)}. We confirm availability at the
              booking step.
            </p>
          ) : null}

          {/* The panel the stay-type tabs in the toolbar switch, named so each
              trigger can point at it. It wraps the empty state too, so a tab
              never controls an element that is not on the page. */}
          <div
            id={EXPLORE_RESULTS_ID}
            role="tabpanel"
            aria-labelledby={stayTabId(refinement.stayType)}
            className="mt-6"
          >
            <ExploreResults
              results={listed}
              intent={intent}
              refinement={refinement}
              onPageChange={goToPage}
              onClearAll={() => {
                setIntent(EMPTY_INTENT);
                setRefinement(DEFAULT_REFINEMENT);
                commit(EMPTY_INTENT, DEFAULT_REFINEMENT);
              }}
              onPickDistrict={(slug) => onIntentChange({ districts: [slug] })}
              hoveredSlug={hoveredSlug}
              onCardHover={setHoveredSlug}
              cardVariant="vertical"
              wide={!mapOn}
              compare={
                refinement.compare
                  ? {
                      selected: refinement.picks,
                      full: refinement.picks.length >= COMPARE_LIMIT,
                      onToggle: toggleCompare,
                    }
                  : undefined
              }
            />
          </div>
        </div>

        {mapOn ? (
          // Pinned beside the list from `lg`, under the search band (whose
          // height the bar publishes as `--explore-band-bottom`). On a phone
          // it takes the screen the list gave up.
          <aside
            data-explore-map
            className="sticky top-24 h-[calc(100dvh-120px)] w-full shrink-0 lg:top-[calc(var(--explore-band-bottom,169px)+16px)] lg:h-[calc(100dvh-var(--explore-band-bottom,169px)-32px)] lg:w-5/12"
          >
            <ExploreMap
              listings={results}
              hoveredSlug={hoveredSlug}
              selectedSlug={selectedSlug}
              onHover={setHoveredSlug}
              onSelect={setSelectedSlug}
              searchArea={searchArea}
              onSearchAreaChange={setSearchArea}
              onBoundsChange={setMapBounds}
              areaCount={listed.length}
              intent={intent}
            />
          </aside>
        ) : null}
      </div>

      {/* The phone's list/map switch, floating where a thumb reaches it. */}
      <button
        type="button"
        onClick={toggleMap}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background shadow-control lg:hidden"
      >
        {mapOn ? (
          <>
            <List className="size-4" strokeWidth={2.2} aria-hidden />
            Show list
          </>
        ) : (
          <>
            <MapIcon className="size-4" strokeWidth={2.2} aria-hidden />
            Show map
          </>
        )}
      </button>

      {refinement.compare ? (
        <>
          {/* Room under the last row, so the tray never covers pagination. */}
          <div aria-hidden className="h-32" />
          <CompareTray
            selected={compared}
            onRemove={removeCompared}
            onClear={() => setPicks([])}
            onOpen={() => setCompareOpen(true)}
            onClose={() => onRefinementChange({ compare: false, page: refinement.page })}
          />
        </>
      ) : null}
      <CompareSheet
        open={compareOpen}
        onOpenChange={setCompareOpen}
        selected={compared}
        onRemove={removeCompared}
        onAddMore={() => setCompareOpen(false)}
        intent={intent}
      />

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        listings={listings}
        intent={intent}
        refinement={refinement}
        onIntentChange={onIntentChange}
        onRefinementChange={onRefinementChange}
        resultCount={results.length}
        onClearAll={clearFilters}
      />
    </div>
  );
}

