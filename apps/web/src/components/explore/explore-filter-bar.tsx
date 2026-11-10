"use client";

import { GitCompare, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@injishi/utils";
import { QuickFilters } from "@/components/explore/active-filters";
import type { Listing } from "@/data/listings";
import type { ExploreRefinement, StayIntent } from "@/lib/search-params";

/**
 * The row pinned under the search bar: "Filters" (every rail group, in a
 * panel), the one-tap quick filters, and Compare.
 *
 * It replaced the left filter column. Twenty collapsible groups in a column
 * beside the results made the page busy and were hard to scroll through;
 * here the common filters are one tap away and the rest one click away, and
 * the results get the width back.
 */
export function ExploreFilterBar({
  listings,
  intent,
  refinement,
  onRefinementChange,
  activeCount,
  onOpenFilters,
}: {
  listings: Listing[];
  intent: StayIntent;
  refinement: ExploreRefinement;
  onRefinementChange: (next: Partial<ExploreRefinement>) => void;
  /** Filters applied, for the badge on the Filters button. */
  activeCount: number;
  onOpenFilters: () => void;
}) {
  const t = useTranslations("search");
  const chip =
    "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="-mx-1 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-max items-center gap-2">
        <button
          type="button"
          data-filter-sheet-trigger
          onClick={onOpenFilters}
          className={cn(chip, "bg-card text-foreground ring-border hover:bg-surface-secondary")}
        >
          <SlidersHorizontal className="size-4" strokeWidth={2} aria-hidden />
          {t("filters")}
          {activeCount > 0 ? (
            <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-2xs font-bold text-background">
              {activeCount}
            </span>
          ) : null}
        </button>

        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

        <QuickFilters
          listings={listings}
          intent={intent}
          refinement={refinement}
          onRefinementChange={onRefinementChange}
        />

        <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-border" />

        <button
          type="button"
          data-rail-compare
          aria-pressed={refinement.compare}
          onClick={() =>
            onRefinementChange({ compare: !refinement.compare, page: refinement.page })
          }
          className={cn(
            chip,
            refinement.compare
              ? "bg-foreground text-background ring-foreground"
              : "bg-card text-foreground ring-border hover:bg-surface-secondary",
          )}
        >
          <GitCompare className="size-4" strokeWidth={2} aria-hidden />
          {t("compare")}
          {refinement.picks.length > 0 ? (
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full text-2xs font-bold",
                refinement.compare ? "bg-accent text-accent-foreground" : "bg-foreground text-background",
              )}
            >
              {refinement.picks.length}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}
