"use client";

import { ArrowRight, GitCompare, Search, X } from "lucide-react";
import { Button, Input } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { FacetBlock } from "@/components/explore/filter-primitives";
import { PriceFilter } from "@/components/explore/price-filter";
import {
  buildFacetGroups,
  priceHistogram,
  totalHistogram,
  type FacetField,
} from "@/data/explore-facets";
import type { Listing } from "@/data/listings";
import { filterListings, poolExcluding } from "@/lib/filter-listings";
import {
  refinementCount,
  toggleFacet,
  type ExploreRefinement,
  type PriceBasis,
  type StayIntent,
} from "@/lib/search-params";

/**
 * The rail's body: the map card, the compare toggle, the name search, the
 * price block, and every facet group — in the reference's own order.
 *
 * Exported separately from `ExploreFilterRail` below so `filter-sheet.tsx`
 * can render the SAME body inside a mobile sheet rather than keeping a second
 * copy that could drift from the desktop rail's fields, order or behaviour.
 *
 * `listings` is the WHOLE catalogue (post-intent-query, pre-refinement), and
 * every group's count is measured with `poolExcluding` against it — the
 * listings that would remain if every OTHER group's selection still applied
 * and this one's did not. That is what makes a count answer "if I also tick
 * this" rather than "how many exist anywhere", and it is why ticking one
 * amenity does not zero out the count beside every other one in its group.
 */
export function FilterRailBody({
  listings,
  intent,
  refinement,
  onIntentChange,
  onRefinementChange,
  onOpenCompare,
  onClearAll,
}: {
  listings: Listing[];
  intent: StayIntent;
  refinement: ExploreRefinement;
  onIntentChange: (next: Partial<StayIntent>) => void;
  onRefinementChange: (next: Partial<ExploreRefinement>) => void;
  /** Opens the side-by-side sheet. Absent where the rail cannot open it. */
  onOpenCompare?: () => void;
  /** Clears place and filters in one commit; see `clearFilters` in the shell. */
  onClearAll: () => void;
}) {
  const pool = (_id: string, field: FacetField) =>
    poolExcluding(listings, intent, refinement, field);
  const groups = buildFacetGroups(pool, (field) => facetSelection(field, intent, refinement));

  // The histogram redraws over whatever survives every filter EXCEPT the
  // price bound itself — the same "everything but this" pool the groups below
  // use, so the chart and the range agree about what "narrower" means.
  const pricePool = filterListings(listings, intent, { ...refinement, minRwf: null, maxRwf: null });
  const histogram =
    refinement.priceBasis === "total"
      ? totalHistogram(pricePool)
      : priceHistogram(pricePool);

  const setBasis = (priceBasis: PriceBasis) => onRefinementChange({ priceBasis });
  const setRange = (minRwf: number | null, maxRwf: number | null) =>
    onRefinementChange({ minRwf, maxRwf });

  const toggle = (field: FacetField, value: string) => {
    const patch = facetTogglePatch(field, value, intent, refinement);
    if (patch.intent) onIntentChange(patch.intent);
    if (patch.refinement) onRefinementChange(patch.refinement);
  };
  const selectedFor = (field: FacetField) => facetSelection(field, intent, refinement);

  const clearAll = onClearAll;

  const activeCount = refinementCount(refinement) + (intent.districts.length > 0 ? 1 : 0);

  return (
    <div>
      <CompareCard
        compareOn={refinement.compare}
        picked={refinement.picks
          .map((slug) => listings.find((l) => l.slug === slug))
          .filter((l): l is Listing => l !== undefined)}
        onToggleCompare={() =>
          onRefinementChange({ compare: !refinement.compare, page: refinement.page })
        }
        onDismiss={() => onRefinementChange({ compare: false, picks: [], page: refinement.page })}
        onOpenCompare={onOpenCompare}
      />

      <div className="flex items-end justify-between gap-3 border-b border-separator pb-3 pt-5">
        <div>
          <h2 className="text-lg font-bold leading-tight text-foreground">Filters</h2>
          <p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">
            {activeCount === 0
              ? "Nothing applied yet"
              : `${activeCount} ${activeCount === 1 ? "filter" : "filters"} applied`}
            {activeCount > 0 ? (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={clearAll}
                  className="rounded font-bold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear all
                </button>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <NameSearch value={refinement.name} onChange={(name) => onRefinementChange({ name })} />

      <PriceFilter
        basis={refinement.priceBasis}
        min={refinement.minRwf}
        max={refinement.maxRwf}
        onBasisChange={setBasis}
        onRangeChange={setRange}
        histogram={histogram}
        matchCount={filterListings(listings, intent, refinement).length}
      />

      {groups.map((group) => (
        <FacetBlock
          key={group.id}
          group={group}
          selected={selectedFor(group.field)}
          onToggle={(value) => toggle(group.field, value)}
        />
      ))}
    </div>
  );
}

/**
 * Compare, at the top of the rail. Off, it is the tile that turns compare mode
 * on. With stays picked it becomes a summary: how many, which, and the button
 * that opens them side by side; × drops the picks and leaves compare mode.
 */
function CompareCard({
  compareOn,
  picked,
  onToggleCompare,
  onDismiss,
  onOpenCompare,
}: {
  compareOn: boolean;
  picked: Listing[];
  onToggleCompare: () => void;
  onDismiss: () => void;
  onOpenCompare?: () => void;
}) {
  if (picked.length > 0) {
    const names = picked.map((l) => l.nameLead.trim() || l.nameRest);
    return (
      <div
        data-rail-compare
        className="relative rounded-card bg-surface-secondary p-4 ring-1 ring-accent"
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Stop comparing and clear picks"
          className="absolute right-2.5 top-2.5 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" strokeWidth={2.4} aria-hidden />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-card bg-accent text-accent-foreground">
            <GitCompare className="size-4.5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              {picked.length} {picked.length === 1 ? "property" : "properties"} selected
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{names.join(" · ")}</p>
          </div>
        </div>
        {onOpenCompare ? (
          <Button
            size="sm"
            onClick={onOpenCompare}
            disabled={picked.length < 2}
            className="mt-3 w-full gap-1.5"
          >
            {picked.length < 2 ? "Pick one more to compare" : "Compare properties"}
            {picked.length >= 2 ? <ArrowRight className="size-4" strokeWidth={2.4} aria-hidden /> : null}
          </Button>
        ) : null}
        {!compareOn ? (
          <button
            type="button"
            onClick={onToggleCompare}
            className="mt-2 w-full rounded text-center text-xs font-bold text-accent-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Pick more stays
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-rail-compare
      aria-pressed={compareOn}
      onClick={onToggleCompare}
      className={cn(
        "flex w-full items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors",
        compareOn
          ? "border-accent-text bg-surface-secondary"
          : "border-border bg-card hover:bg-surface-secondary",
      )}
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-card transition-colors",
          compareOn ? "bg-accent text-accent-foreground" : "bg-surface-secondary text-muted-foreground",
        )}
      >
        <GitCompare className="size-4.5" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">Compare properties</p>
        <p className="text-xs text-muted-foreground">
          {compareOn
            ? "On. Tick Compare on up to 5 stays."
            : "Get a side-by-side view of up to 5 properties."}
        </p>
      </div>
    </button>
  );
}

/**
 * NOT a `FilterSection`: that primitive stamps `data-facet-group`, which is
 * also the checker's handle on the twenty computed rail blocks below. This
 * field is real but writes free text rather than a computed facet, and letting
 * it carry the same attribute would count it as a group with zero options and
 * fail the very check that proves the real groups all have some.
 */
function NameSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="border-b border-separator py-4">
      <label className="relative block">
        <span className="sr-only">Search by property name</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
        <Input
          type="search"
          data-rail-name-search
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder="Search by property name"
          className="w-full pl-9"
        />
      </label>
    </div>
  );
}

/* ------------------------------------------------- shared selection logic */

/**
 * What a facet group has ticked, as the option values the group renders. One
 * reading of the URL state, shared by the rail and the active-filter chips so
 * the two can never disagree about what is applied.
 */
export function facetSelection(
  field: FacetField,
  intent: StayIntent,
  refinement: ExploreRefinement,
): string[] {
  switch (field) {
    case "districts":
      return intent.districts;
    case "classes":
      return refinement.classes.map(String);
    case "rating":
      return refinement.rating !== null ? [String(refinement.rating)] : [];
    case "bedrooms":
      return refinement.bedrooms !== null ? [String(refinement.bedrooms)] : [];
    case "available":
      return refinement.available ? ["1"] : [];
    default:
      return refinement[field] as string[];
  }
}

/** The state change that ticks or unticks one option. */
export function facetTogglePatch(
  field: FacetField,
  value: string,
  intent: StayIntent,
  refinement: ExploreRefinement,
): { intent?: Partial<StayIntent>; refinement?: Partial<ExploreRefinement> } {
  switch (field) {
    case "districts":
      return {
        intent: {
          districts: intent.districts.includes(value)
            ? intent.districts.filter((entry) => entry !== value)
            : [...intent.districts, value],
        },
      };
    case "classes": {
      const stars = Number(value);
      return {
        refinement: {
          classes: refinement.classes.includes(stars)
            ? refinement.classes.filter((entry) => entry !== stars)
            : [...refinement.classes, stars],
        },
      };
    }
    case "rating":
    case "bedrooms": {
      const parsed = Number(value);
      return { refinement: { [field]: refinement[field] === parsed ? null : parsed } };
    }
    case "available":
      return { refinement: { available: !refinement.available } };
    default:
      return {
        refinement: {
          [field]: toggleFacet(refinement[field] as string[], value),
        } as Partial<ExploreRefinement>,
      };
  }
}

/** Every rail filter back to its default; the view (sort, page, compare) kept. */
export const CLEARED_REFINEMENT: Partial<ExploreRefinement> = {
  minRwf: null,
  maxRwf: null,
  kinds: [],
  classes: [],
  rating: null,
  amenities: [],
  roomAmenities: [],
  experience: [],
  views: [],
  activities: [],
  payment: [],
  cancellation: [],
  meals: [],
  access: [],
  popular: [],
  bedrooms: null,
  name: "",
  available: false,
};

/**
 * The DESKTOP rail: sticky, scrollable, and pinned to the left column.
 *
 * `filter-sheet.tsx` renders `FilterRailBody` directly inside a `Sheet` at
 * narrow widths instead of this wrapper — the body is shared, the chrome
 * around it is not.
 */
export function ExploreFilterRail(props: React.ComponentProps<typeof FilterRailBody>) {
  return (
    <aside
      data-filter-rail
      className="hidden lg:sticky lg:top-[calc(var(--explore-band-bottom,169px)+16px)] lg:block lg:h-[calc(100dvh-var(--explore-band-bottom,169px)-32px)] lg:w-[236px] lg:shrink-0 2xl:w-[264px] scrollbar lg:overflow-y-auto lg:pr-2"
    >
      <FilterRailBody {...props} />
    </aside>
  );
}
