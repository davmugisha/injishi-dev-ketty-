"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@injishi/web-ui";
import { FacetBlock } from "@/components/explore/filter-primitives";
import { PriceFilter } from "@/components/explore/price-filter";
import {
  buildFacetGroups,
  priceHistogram,
  type FacetField,
} from "@/data/explore-facets";
import type { Listing } from "@/data/listings";
import { filterListings, poolExcluding } from "@/lib/filter-listings";
import {
  toggleFacet,
  type ExploreRefinement,
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
  const groups = buildFacetGroups(pool, (field) => facetSelection(field, intent, refinement));

  // The histogram redraws over whatever survives every filter EXCEPT the
  // price bound itself — the same "everything but this" pool the groups below
  // use, so the chart and the range agree about what "narrower" means.
  const pricePool = filterListings(listings, intent, { ...refinement, minRwf: null, maxRwf: null });
  const histogram = priceHistogram(pricePool);

  const setRange = (minRwf: number | null, maxRwf: number | null) =>
    onRefinementChange({ minRwf, maxRwf });

  const toggle = (field: FacetField, value: string) => {
    const patch = facetTogglePatch(field, value, intent, refinement);
    if (patch.intent) onIntentChange(patch.intent);
    if (patch.refinement) onRefinementChange(patch.refinement);
  };
  const selectedFor = (field: FacetField) => facetSelection(field, intent, refinement);

  return (
    <div>
      <NameSearch value={refinement.name} onChange={(name) => onRefinementChange({ name })} />

      <PriceFilter
        min={refinement.minRwf}
        max={refinement.maxRwf}
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
 * NOT a `FilterSection`: that primitive stamps `data-facet-group`, which is
 * also the checker's handle on the twenty computed rail blocks below. This
 * field is real but writes free text rather than a computed facet, and letting
 * it carry the same attribute would count it as a group with zero options and
 * fail the very check that proves the real groups all have some.
 */
function NameSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("search");
  return (
    <div className="border-b border-separator py-4">
      <label className="relative block">
        <span className="sr-only">{t("searchByName")}</span>
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
          placeholder={t("searchByName")}
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
  meals: [],
  popular: [],
  bedrooms: null,
  name: "",
};
