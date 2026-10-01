"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@injishi/ui";
import { List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { SORT_EXPLAINER, SORT_OPTIONS, STAY_TYPES, type ExploreSort, type StayType } from "@/lib/search-params";

/**
 * The id `explore-shell.tsx` gives the result list, so each stay-type tab can
 * name it as the panel it switches. Radix would otherwise point every trigger's
 * `aria-controls` at a `TabsContent` this toolbar does not render.
 */
export const EXPLORE_RESULTS_ID = "explore-results";

/** The trigger id the result list names back through `aria-labelledby`. */
export function stayTabId(type: StayType): string {
  return `stay-tab-${type}`;
}

/**
 * The bar above the result list: the count, the stay-type tabs, the
 * sort-order explainer and the sort control.
 *
 * The stay-type row is the shared `Tabs`, `underline` variant (2026-09-12).
 * It was three bare `<button>`s with a `border-b-2` each, and the public
 * stylesheet rounds every bare button into a pill, so the selected tab's rule
 * curved up at both ends. The shared trigger opts out of that rule, and the
 * row gains the arrow keys and roving focus a tablist owes. The result list is
 * its panel: see `EXPLORE_RESULTS_ID`.
 *
 * `data-result-count` carries the RAW NUMBER as `data-count`, separately from
 * the printed sentence. The sentence is written for a reader ("300+
 * properties"); a check that needs the true count reads the attribute rather
 * than parsing prose, so a later copy change cannot break it.
 */
export function ResultsToolbar({
  count,
  totalCatalogue,
  stayType,
  onStayTypeChange,
  sort,
  onSortChange,
  onOpenFilters,
  activeFilterCount,
  mapOn,
  onToggleMap,
}: {
  count: number;
  /** The whole catalogue's size, so "300+" never overstates what exists. */
  totalCatalogue: number;
  stayType: StayType;
  onStayTypeChange: (type: StayType) => void;
  sort: ExploreSort;
  onSortChange: (sort: ExploreSort) => void;
  /** Opens the mobile filter sheet. Omit to hide the trigger (desktop). */
  onOpenFilters?: () => void;
  activeFilterCount?: number;
  mapOn: boolean;
  onToggleMap: () => void;
}) {
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort";

  return (
    <div data-results-toolbar className="flex flex-col gap-3">
      <Tabs value={stayType} onValueChange={(value) => onStayTypeChange(value as StayType)}>
        <TabsList variant="underline" aria-label="Stay type" className="-mx-1 scrollbar overflow-x-auto px-1">
          {STAY_TYPES.map((type) => (
            <TabsTrigger
              key={type.value}
              value={type.value}
              id={stayTabId(type.value)}
              aria-controls={EXPLORE_RESULTS_ID}
              data-stay-tab
            >
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p data-result-count data-count={count} className="text-page-fg">
            {count === 1 ? (
              "1 property"
            ) : (
              <>
                <b>{count === totalCatalogue ? `${count}+` : count}</b> properties
              </>
            )}
          </p>
          <p data-sort-explainer className="mt-0.5 text-xs text-page-fg-70">
            How our sort order works
            <span className="sr-only">: {SORT_EXPLAINER}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            data-map-toggle
            aria-pressed={mapOn}
            onClick={onToggleMap}
            className="gap-2 whitespace-nowrap border-slate-line px-4 py-2.5 text-page-fg hover:border-ink"
          >
            {mapOn ? (
              <>
                <List className="size-4" strokeWidth={2} aria-hidden />
                Show list
              </>
            ) : (
              <>
                <MapIcon className="size-4" strokeWidth={2} aria-hidden />
                Show map
              </>
            )}
          </Button>

          {onOpenFilters ? (
            <Button
              variant="outline"
              size="sm"
              data-filter-sheet-trigger
              onClick={onOpenFilters}
              className="gap-2 border-slate-line px-4 py-2.5 text-page-fg hover:border-ink lg:hidden"
            >
              <SlidersHorizontal className="size-4" strokeWidth={2} aria-hidden />
              Filters
              {activeFilterCount ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-accent text-2xs font-bold text-accent-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-sort-trigger
                className="gap-2 whitespace-nowrap border-slate-line px-5 py-2.5 text-page-fg hover:border-ink"
              >
                <span className="text-page-fg-70">Sort by</span>
                {sortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border border-border">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => onSortChange(value as ExploreSort)}
              >
                {SORT_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
