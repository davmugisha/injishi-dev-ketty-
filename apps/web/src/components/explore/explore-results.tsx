"use client";

import Link from "next/link";
import { Button } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { CompareToggle } from "@/components/explore/compare";
import { Pagination } from "@/components/explore/pagination";
import {
  BrandRail,
  BundleBanner,
  EditorialCard,
  SupportInterstitial,
} from "@/components/explore/result-interstitials";
import { ResultCard } from "@/components/explore/result-card";
import { ResultCardVertical } from "@/components/explore/result-card-vertical";
import type { Listing } from "@/data/listings";
import { SEARCH_DISTRICTS } from "@/data/search-options";
import type { ExploreRefinement, StayIntent } from "@/lib/search-params";
import { LIST_HREF } from "@/lib/stay-count";
import { supportHref } from "@/lib/support-intent";

/**
 * The result list itself: the interstitial-spliced column of cards, the empty
 * state, and pagination.
 *
 * Deliberately holds no state and reads no URL — `explore-shell.tsx` owns
 * both and hands this component a finished, already-filtered, already-sorted
 * `results` array plus the callbacks a click needs to reach back up to it.
 * That split is what lets the shell's tests (and this file's own review)
 * treat "what the guest sees" and "how the guest's intent became a URL" as
 * two separate questions.
 */
export function ExploreResults({
  results,
  all,
  intent,
  refinement,
  onPageChange,
  onClearAll,
  onPickDistrict,
  hoveredSlug,
  onCardHover,
  cardVariant = "horizontal",
  wide = false,
  compare,
}: {
  results: Listing[];
  /** Every stay listed, before any filter: the empty state offers districts that have one. */
  all: Listing[];
  intent: StayIntent;
  refinement: ExploreRefinement;
  onPageChange: (page: number) => void;
  onClearAll: () => void;
  onPickDistrict: (slug: string) => void;
  hoveredSlug: string | null;
  onCardHover: (slug: string | null) => void;
  /** `vertical` is used inside the split-with-map layout; `horizontal` is the
   * default full-width list. */
  cardVariant?: "horizontal" | "vertical";
  /** The grid has the whole width (no map beside it): more columns. */
  wide?: boolean;
  /** Compare mode: a checkbox over every card. Absent when the mode is off. */
  compare?: {
    selected: readonly string[];
    full: boolean;
    onToggle: (slug: string) => void;
  };
}) {
  // The compare checkbox rides over the card's photo, top-left (the save
  // heart owns top-right), outside the card so neither card shape changes.
  const withCompare = (listing: Listing, card: React.ReactNode) => {
    if (!compare) return card;
    const selected = compare.selected.includes(listing.slug);
    return (
      <div
        key={listing.slug}
        className={cn(
          "relative rounded-card transition-shadow duration-quick",
          selected && "ring-2 ring-accent ring-offset-2 ring-offset-background",
        )}
      >
        {card}
        <div className="absolute left-3 top-3 z-30">
          <CompareToggle
            listing={listing}
            selected={selected}
            disabled={compare.full && !selected}
            onToggle={compare.onToggle}
          />
        </div>
      </div>
    );
  };

  const firstPageSize = PAGE_SIZE - INTERSTITIAL_SLOTS.length;
  const pageCount =
    results.length <= firstPageSize
      ? 1
      : 1 + Math.ceil((results.length - firstPageSize) / PAGE_SIZE);

  const currentPage = Math.min(refinement.page, pageCount);
  const start = currentPage === 1 ? 0 : firstPageSize + (currentPage - 2) * PAGE_SIZE;
  const pageResults = results.slice(
    start,
    currentPage === 1 ? firstPageSize : start + PAGE_SIZE,
  );

  if (results.length === 0) {
    return (
      <EmptyResults
        all={all}
        intent={intent}
        onReset={onClearAll}
        onPickDistrict={onPickDistrict}
      />
    );
  }

  if (cardVariant === "vertical") {
    // Split-view mode: no interstitials (they are designed for the full-width
    // horizontal list), compact cards, two per row on wider breakpoints.
    return (
      <>
        <div
          data-result-list
          data-variant="vertical"
          className={cn(
            "grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2",
            wide && "lg:grid-cols-3 xl:grid-cols-4",
          )}
        >
          {pageResults.map((listing) =>
            withCompare(
              listing,
              <ResultCardVertical
                key={listing.slug}
                listing={listing}
                intent={intent}
                highlighted={hoveredSlug === listing.slug}
                onHover={onCardHover}
              />,
            ),
          )}
        </div>
        <Pagination page={currentPage} pageCount={pageCount} onPageChange={onPageChange} />
      </>
    );
  }

  return (
    <>
      <div data-result-list className="flex flex-col gap-4">
        {pageResults.flatMap((listing, index) => {
          const row: React.ReactNode[] = [
            withCompare(
              listing,
              <ResultCard
                key={listing.slug}
                listing={listing}
                intent={intent}
                highlighted={hoveredSlug === listing.slug}
                onHover={onCardHover}
              />,
            ),
          ];
          // The three interstitials ride the first page only: repeating a
          // promo under every page turn would read as another result rather
          // than as a one-off aside, exactly as the support tile always has.
          if (currentPage === 1) {
            const slot = INTERSTITIAL_SLOTS.find((entry) => entry.afterIndex === index);
            if (slot) row.push(<slot.Component key={slot.id} />);
          }
          return row;
        })}
      </div>

      <Pagination page={currentPage} pageCount={pageCount} onPageChange={onPageChange} />
    </>
  );
}

/**
 * Where each interstitial rides on page one, and how many result cells they
 * cost — which is what makes every OTHER page come out to a whole `PAGE_SIZE`
 * even though page one is thinner by exactly this many slots.
 */
const INTERSTITIAL_SLOTS: { id: string; afterIndex: number; Component: () => React.ReactElement | null }[] = [
  { id: "bundle", afterIndex: 2, Component: BundleBanner },
  { id: "editorial", afterIndex: 6, Component: EditorialCard },
  { id: "brand", afterIndex: 10, Component: BrandRail },
  { id: "support", afterIndex: 14, Component: SupportInterstitial },
];

/**
 * Rows per page.
 *
 * Four interstitials ride page one, so it carries `PAGE_SIZE - 4` result
 * cards rather than the full count; every later page carries `PAGE_SIZE`. 24
 * leaves page one with 20 real cards — comfortably a populated list rather
 * than a thin one — while keeping later pages a round number.
 */
const PAGE_SIZE = 24;

/**
 * The empty list.
 *
 * Names what was searched and offers the districts that do hold stays, because
 * the search bar can land a guest here on a place the catalogue does not
 * cover yet, and "clear all filters" answers that by throwing away the one
 * thing they actually asked for.
 *
 * An empty CATALOGUE is its own case. Production opened with nothing listed,
 * and this said "No stays match these filters yet. Try widening the price
 * range" to a visitor who had set no filter at all, then offered to clear
 * them. Blaming the guest for an empty marketplace is the wrong sentence.
 */
function EmptyResults({
  all,
  intent,
  onReset,
  onPickDistrict,
}: {
  all: Listing[];
  intent: StayIntent;
  onReset: () => void;
  onPickDistrict: (slug: string) => void;
}) {
  const searchedFor =
    SEARCH_DISTRICTS.find((district) => district.slug === intent.districts[0])?.name ??
    intent.query.trim();

  const alternatives = SEARCH_DISTRICTS.filter(
    (district) =>
      !intent.districts.includes(district.slug) &&
      all.some((listing) => listing.district === district.slug),
  );

  if (all.length === 0) {
    return (
      <div data-empty-results className="mb-20 flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-xl text-page-fg">
          {searchedFor ? `Nothing is listed in ${searchedFor} yet.` : "Nothing is listed yet."}
        </p>
        <p className="max-w-[46ch] text-sm text-page-fg-70">
          Injishi lists a place only after it passes verification, and the first hosts are going
          through it now, Kigali first.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={LIST_HREF}>List your place</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={supportHref("opening")}>Tell me when stays open</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div data-empty-results className="mb-20 flex flex-col items-center gap-4 py-20 text-center">
      <p className="text-xl text-page-fg">
        {searchedFor
          ? `No stays in ${searchedFor} yet.`
          : "No stays match these filters yet."}
      </p>
      <p className="max-w-[46ch] text-sm text-page-fg-70">
        {searchedFor
          ? "We are still signing up hosts there. These districts have verified stays now:"
          : "Try widening the price range or clearing a filter."}
      </p>

      {alternatives.length > 0 ? (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {alternatives.map((district) => (
            <Button
              key={district.slug}
              variant="outline"
              size="sm"
              onClick={() => onPickDistrict(district.slug)}
              className="border-slate-line px-5 py-2 text-page-fg hover:border-ink"
            >
              {district.name}
            </Button>
          ))}
        </div>
      ) : null}

      <Button variant="outline" onClick={onReset} className="mt-2">
        Clear all filters
      </Button>
    </div>
  );
}
