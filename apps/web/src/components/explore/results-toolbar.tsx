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
import { ChevronDown, Info, LayoutGrid, List, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { cn } from "@injishi/utils";
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
 * The bar above the result list: "61+ stays in Rwanda", the stay-type tabs,
 * the sort control with its explainer one hover away, and the list/grid
 * layout switch. The map toggle shows only where the right rail's mini map
 * is not on screen, and to come back from the map view.
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
export type ResultsView = "list" | "grid";

export function ResultsToolbar({
  count,
  totalCatalogue,
  place,
  stayType,
  onStayTypeChange,
  sort,
  onSortChange,
  onOpenFilters,
  activeFilterCount,
  mapOn,
  onToggleMap,
  mapToggleAlways,
  view,
  onViewChange,
}: {
  count: number;
  /** The whole catalogue's size, so "300+" never overstates what exists. */
  totalCatalogue: number;
  /** Where the results are: "Rwanda", "Musanze", "2 districts". */
  place: string;
  stayType: StayType;
  onStayTypeChange: (type: StayType) => void;
  sort: ExploreSort;
  onSortChange: (sort: ExploreSort) => void;
  /** Opens the mobile filter sheet. Omit to hide the trigger (desktop). */
  onOpenFilters?: () => void;
  activeFilterCount?: number;
  mapOn: boolean;
  onToggleMap: () => void;
  /**
   * The map toggle is needed only where the rail's mini map is not on screen
   * (below `xl`) and to come back from the map view. False hides it at `xl`.
   */
  mapToggleAlways: boolean;
  view: ResultsView;
  onViewChange: (view: ResultsView) => void;
}) {
  const sortLabel = SORT_OPTIONS.find((option) => option.value === sort)?.label ?? "Sort";
  const shown = count === totalCatalogue ? `${count}+` : String(count);

  return (
    <div data-results-toolbar className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-end gap-x-6 gap-y-2">
          <h2
            data-result-count
            data-count={count}
            className="text-xl font-bold leading-tight text-foreground lg:text-2xl"
          >
            {count === 1 ? "1 stay" : `${shown} stays`} in {place}
          </h2>

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
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
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

          <Button
            variant="outline"
            size="sm"
            data-map-toggle
            aria-pressed={mapOn}
            onClick={onToggleMap}
            className={cn(
              "gap-2 whitespace-nowrap border-slate-line px-4 py-2.5 text-page-fg hover:border-ink",
              !mapToggleAlways && "xl:hidden",
            )}
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-sort-trigger
                className="gap-2 whitespace-nowrap border-border bg-card px-4 py-2.5 text-page-fg hover:border-ink"
              >
                <span className="hidden text-page-fg-70 sm:inline">Sort by</span>
                <span className="font-bold">{sortLabel}</span>
                <ChevronDown className="size-4 text-muted-foreground" strokeWidth={2.2} aria-hidden />
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

          {/* How the default order is decided, kept one hover away rather
              than as a second line under the count. */}
          <span
            data-sort-explainer
            title={SORT_EXPLAINER}
            className="hidden size-9 items-center justify-center rounded-full text-muted-foreground sm:flex"
          >
            <Info className="size-4" strokeWidth={2} aria-hidden />
            <span className="sr-only">How our sort order works: {SORT_EXPLAINER}</span>
          </span>

          {!mapOn ? (
            <div
              role="radiogroup"
              aria-label="Layout"
              className="hidden items-center rounded-full bg-card p-1 ring-1 ring-border md:flex"
            >
              {(
                [
                  { value: "list", label: "List view", Icon: List },
                  { value: "grid", label: "Grid view", Icon: LayoutGrid },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={view === value}
                  aria-label={label}
                  title={label}
                  onClick={() => onViewChange(value)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    view === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" strokeWidth={2} aria-hidden />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
