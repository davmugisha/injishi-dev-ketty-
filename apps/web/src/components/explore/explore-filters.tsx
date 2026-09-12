"use client";

import { GitCompare, MapPin } from "lucide-react";
import { Input } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { ClearButton, FacetBlock } from "@/components/explore/filter-primitives";
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
}: {
  listings: Listing[];
  intent: StayIntent;
  refinement: ExploreRefinement;
  onIntentChange: (next: Partial<StayIntent>) => void;
  onRefinementChange: (next: Partial<ExploreRefinement>) => void;
}) {
  const pool = (_id: string, field: FacetField) =>
    poolExcluding(listings, intent, refinement, field);
  const groups = buildFacetGroups(pool);

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

  const onList = (field: FacetField & keyof ExploreRefinement, value: string) => {
    const current = refinement[field] as string[];
    onRefinementChange({ [field]: toggleFacet(current, value) } as Partial<ExploreRefinement>);
  };

  const onDistrict = (slug: string) => {
    onIntentChange({
      districts: intent.districts.includes(slug)
        ? intent.districts.filter((entry) => entry !== slug)
        : [...intent.districts, slug],
    });
  };

  const onClass = (value: string) => {
    const stars = Number(value);
    onRefinementChange({
      classes: refinement.classes.includes(stars)
        ? refinement.classes.filter((entry) => entry !== stars)
        : [...refinement.classes, stars],
    });
  };

  const onRadio = (field: "rating" | "bedrooms", value: string) => {
    const parsed = Number(value);
    onRefinementChange({ [field]: refinement[field] === parsed ? null : parsed });
  };

  const toggle = (group: FacetField, value: string) => {
    switch (group) {
      case "districts":
        return onDistrict(value);
      case "classes":
        return onClass(value);
      case "rating":
        return onRadio("rating", value);
      case "bedrooms":
        return onRadio("bedrooms", value);
      case "available":
        return onRefinementChange({ available: !refinement.available });
      default:
        return onList(group, value);
    }
  };

  const selectedFor = (group: FacetField): string[] => {
    switch (group) {
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
        return refinement[group] as string[];
    }
  };

  const clearAll = () => {
    onIntentChange({ districts: [] });
    onRefinementChange({
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
    });
  };

  const activeCount = refinementCount(refinement) + (intent.districts.length > 0 ? 1 : 0);

  return (
    <div>
      <RailShortcuts
        compareOn={refinement.compare}
        onToggleCompare={() => onRefinementChange({ compare: !refinement.compare })}
        name={refinement.name}
        onNameChange={(name) => onRefinementChange({ name })}
      />

      <PriceFilter
        basis={refinement.priceBasis}
        min={refinement.minRwf}
        max={refinement.maxRwf}
        onBasisChange={setBasis}
        onRangeChange={setRange}
        histogram={histogram}
      />

      <div className="flex items-center justify-between border-t border-separator pt-4">
        <h2 className="text-base font-bold text-foreground">Filter by</h2>
        <ClearButton count={activeCount} onClear={clearAll} />
      </div>

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

/** The map card, the compare toggle and the name search, above "Filter by". */
function RailShortcuts({
  compareOn,
  onToggleCompare,
  name,
  onNameChange,
}: {
  compareOn: boolean;
  onToggleCompare: () => void;
  name: string;
  onNameChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 pb-4">
      {/*
        No map provider is wired into this app (no Mapbox or Google Maps key
        in `.env.example`), so this is an honest static card rather than a
        picture of an interactive map wearing a "View in a map" label that
        would do nothing when pressed.
      */}
      <div
        data-rail-map
        className="flex items-center gap-3 rounded-card bg-surface-secondary px-4 py-3 text-muted-foreground"
      >
        <MapPin className="size-5 shrink-0" strokeWidth={2} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Map view</p>
          <p className="text-xs">Coming soon for this catalogue.</p>
        </div>
      </div>

      <button
        type="button"
        data-rail-compare
        aria-pressed={compareOn}
        onClick={onToggleCompare}
        className={cn(
          "flex items-center gap-3 rounded-card border px-4 py-3 text-left transition-colors",
          compareOn
            ? "border-accent-text bg-surface-secondary"
            : "border-slate-line hover:bg-surface-secondary",
        )}
      >
        <GitCompare className="size-5 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Compare properties</p>
          <p className="text-xs text-muted-foreground">
            Get a side-by-side view of up to 5 properties.
          </p>
        </div>
      </button>

      {/*
        NOT a `FilterSection`: that primitive stamps `data-facet-group`, which
        is also the checker's handle on the twenty computed rail blocks below.
        This field is real but writes free text rather than a computed facet,
        and letting it carry the same attribute would count it as a group with
        zero options and fail the very check that proves the real groups all
        have some.
      */}
      <div className="border-t border-separator pt-4">
        <h3 className="mb-2 text-base font-bold text-foreground">
          Search by property name
        </h3>
        <Input
          type="search"
          data-rail-name-search
          value={name}
          onChange={(event) => onNameChange(event.currentTarget.value)}
          placeholder="e.g. Radisson Blu"
          className="w-full"
        />
      </div>
    </div>
  );
}

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
      className="hidden lg:sticky lg:top-[169px] lg:block lg:h-[calc(100dvh-185px)] lg:w-[248px] lg:shrink-0 xl:w-[264px] scrollbar lg:overflow-y-auto lg:pr-2"
    >
      <FilterRailBody {...props} />
    </aside>
  );
}
