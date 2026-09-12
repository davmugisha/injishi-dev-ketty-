"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@injishi/ui";
import { ExploreFilterRail } from "@/components/explore/explore-filters";
import { ExploreResults } from "@/components/explore/explore-results";
import { ExploreSearchBar } from "@/components/explore/explore-search-bar";
import { FilterSheet } from "@/components/explore/filter-sheet";
import {
  EXPLORE_RESULTS_ID,
  ResultsToolbar,
  stayTabId,
} from "@/components/explore/results-toolbar";
import { LISTINGS } from "@/data/listings";
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
export function ExploreShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlIntent = useMemo(() => parseIntent(searchParams), [searchParams]);
  const urlRefinement = useMemo(() => parseRefinement(searchParams), [searchParams]);

  const [intent, setIntent] = useState<StayIntent>(urlIntent);
  const [refinement, setRefinement] = useState<ExploreRefinement>(urlRefinement);
  const [sheetOpen, setSheetOpen] = useState(false);

  const results = useMemo(
    () => filterListings(LISTINGS, intent, refinement),
    [intent, refinement],
  );

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
          listings={LISTINGS}
          intent={intent}
          refinement={refinement}
          onIntentChange={onIntentChange}
          onRefinementChange={onRefinementChange}
        />

        <div className="min-w-0 flex-1">
          <ResultsToolbar
            count={results.length}
            totalCatalogue={LISTINGS.length}
            stayType={refinement.stayType}
            onStayTypeChange={(stayType) => onRefinementChange({ stayType })}
            sort={refinement.sort}
            onSortChange={(sort: ExploreSort) => onRefinementChange({ sort })}
            onOpenFilters={() => setSheetOpen(true)}
            activeFilterCount={
              refinementCount(refinement) + (intent.districts.length > 0 ? 1 : 0)
            }
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
              results={results}
              intent={intent}
              refinement={refinement}
              onPageChange={goToPage}
              onClearAll={() => {
                setIntent(EMPTY_INTENT);
                setRefinement(DEFAULT_REFINEMENT);
                commit(EMPTY_INTENT, DEFAULT_REFINEMENT);
              }}
              onPickDistrict={(slug) => onIntentChange({ districts: [slug] })}
            />
          </div>
        </div>

        <AdRail />
      </div>

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        listings={LISTINGS}
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

