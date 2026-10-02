"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@injishi/ui";
import {
  COMPARE_LIMIT,
  CompareSheet,
  CompareTray,
} from "@/components/explore/compare";
import { ExploreFilterRail } from "@/components/explore/explore-filters";
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
import {
  EXPLORE_RESULTS_ID,
  ResultsToolbar,
  stayTabId,
} from "@/components/explore/results-toolbar";
import { LISTINGS, type Listing } from "@/data/listings";
import type { MapBounds } from "@/components/explore/explore-map";
import { PROMO_PAIR } from "@/data/promotions";
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
 * The page renders three regions side by side from `lg` up — the filter rail,
 * the result column, and a narrow ad rail — and collapses to the result
 * column alone below it, with the rail moved into `FilterSheet`.
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
  const [mapOn, setMapOn] = useState(false);
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

  return (
    <div data-explore-shell>
      <ExploreSearchBar intent={intent} onIntentChange={onIntentChange} onSubmit={submit} />

      <div className="container mt-6 flex items-start gap-6 xl:gap-7">
        <ExploreFilterRail
          listings={listings}
          intent={intent}
          refinement={refinement}
          onIntentChange={onIntentChange}
          onRefinementChange={onRefinementChange}
        />

        <div className="min-w-0 flex-1">
          <ResultsToolbar
            count={listed.length}
            totalCatalogue={listings.length}
            stayType={refinement.stayType}
            onStayTypeChange={(stayType) => onRefinementChange({ stayType })}
            sort={refinement.sort}
            onSortChange={(sort: ExploreSort) => onRefinementChange({ sort })}
            onOpenFilters={() => setSheetOpen(true)}
            activeFilterCount={
              refinementCount(refinement) + (intent.districts.length > 0 ? 1 : 0)
            }
            mapOn={mapOn}
            onToggleMap={() => setMapOn((on) => !on)}
          />

          {dates ? (
            <p className="mt-2 text-sm text-page-fg-70">
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
            className="mt-4"
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
              cardVariant={mapOn ? "vertical" : "horizontal"}
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
          // Split view: map fills the third column at roughly half the
          // available width. AdRail steps aside — the map is what a guest
          // toggled it on for. Vertical cards for the narrower results column
          // so the name never wraps one word per line. Desktop only: below
          // `md` a half-viewport map on a phone is unusable, so it hides and
          // the toolbar toggle re-appears as a full swap.
          <aside
            data-explore-map
            className="sticky top-[169px] hidden h-[calc(100dvh-185px)] flex-1 shrink basis-0 md:block"
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
        ) : (
          <AdRail />
        )}
      </div>

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
      />
    </div>
  );
}

/**
 * The narrow right rail at wide viewports.
 *
 * The reference sells this column to a third-party advertiser (Hilton, in the
 * capture). Injishi has no ad sales module and no advertiser relationship, so
 * inventing one would be a false claim about a company that has never bought
 * placement here. `PROMO_PAIR` is the real fixture ADR-022 authored for
 * exactly this shape — a claim-free promotional tile — reused rather than
 * duplicated.
 */
function AdRail() {
  const tiles = PROMO_PAIR.filter((tile): tile is NonNullable<typeof tile> => tile !== null);
  if (tiles.length === 0) return null;

  return (
    <aside
      data-ad-rail
      className="sticky top-[96px] hidden w-[220px] shrink-0 flex-col gap-4 xl:flex"
    >
      {tiles.map((tile) => (
        <div
          key={tile.headline}
          className="flex flex-col gap-2 rounded-card bg-surface-secondary p-5"
        >
          <span className="text-2xs font-bold uppercase tracking-widest text-accent-text">
            {tile.tag}
          </span>
          <h3 className="text-base font-bold text-foreground">{tile.headline}</h3>
          <p className="text-sm text-muted-foreground">{tile.body}</p>
          <Button asChild variant="outline" size="sm" className="mt-1 w-max">
            <Link href={tile.href}>{tile.ctaLabel}</Link>
          </Button>
        </div>
      ))}
    </aside>
  );
}

