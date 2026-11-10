"use client";

import { Award, Check, Coffee, Waves, Wallet, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@injishi/utils";
import { facetSelection, facetTogglePatch } from "@/components/explore/explore-filters";
import { buildFacetGroups } from "@/data/explore-facets";
import type { Listing } from "@/data/listings";
import { SEARCH_DISTRICTS } from "@/data/search-options";
import { poolExcluding } from "@/lib/filter-listings";
import { formatRateNumber } from "@/lib/price";
import type { ExploreRefinement, StayIntent } from "@/lib/search-params";

type Change = {
  intent?: Partial<StayIntent>;
  refinement?: Partial<ExploreRefinement>;
};

type Chip = { key: string; label: string; change: Change };

/**
 * The filters in force, as removable chips above the results.
 *
 * The rail's own "N filters applied" count scrolls away with the rail and
 * names nothing; these say WHAT is applied, right where the results answer
 * it, and each × undoes exactly one thing. Labels come from the same facet
 * groups the rail renders and selection from the same helpers, so the chips
 * and the ticks can never disagree.
 */
export function ActiveFilterChips({
  listings,
  intent,
  refinement,
  onIntentChange,
  onRefinementChange,
  onClearAll,
}: {
  listings: Listing[];
  intent: StayIntent;
  refinement: ExploreRefinement;
  onIntentChange: (next: Partial<StayIntent>) => void;
  onRefinementChange: (next: Partial<ExploreRefinement>) => void;
  /** Place and filters in one commit (two calls would race the URL). */
  onClearAll: () => void;
}) {
  const t = useTranslations("search");
  const chips = useMemo<Chip[]>(() => {
    const out: Chip[] = [];

    if (intent.query.trim()) {
      out.push({ key: "q", label: `“${intent.query.trim()}”`, change: { intent: { query: "" } } });
    }
    for (const slug of intent.districts) {
      const name = SEARCH_DISTRICTS.find((d) => d.slug === slug)?.name ?? slug;
      out.push({
        key: `district:${slug}`,
        label: name,
        change: { intent: { districts: intent.districts.filter((d) => d !== slug) } },
      });
    }
    if (refinement.minRwf !== null || refinement.maxRwf !== null) {
      const fmt = (n: number) => formatRateNumber(n) ?? String(n);
      const { minRwf: lo, maxRwf: hi } = refinement;
      const label =
        lo !== null && hi !== null
          ? `${fmt(lo)} – ${fmt(hi)} RWF`
          : lo !== null
            ? `From ${fmt(lo)} RWF`
            : `Up to ${fmt(hi!)} RWF`;
      out.push({
        key: "price",
        label,
        change: { refinement: { minRwf: null, maxRwf: null } },
      });
    }
    if (refinement.name.trim()) {
      out.push({
        key: "name",
        label: `Name: ${refinement.name.trim()}`,
        change: { refinement: { name: "" } },
      });
    }

    // Every rail group, labelled exactly as the rail labels it. Districts are
    // already listed above (they live in the intent, not the refinement).
    const groups = buildFacetGroups(
      (_id, field) => poolExcluding(listings, intent, refinement, field),
      (field) => facetSelection(field, intent, refinement),
    );
    const seen = new Set<string>();
    for (const group of groups) {
      if (group.field === "districts") continue;
      for (const value of facetSelection(group.field, intent, refinement)) {
        const key = `${group.field}:${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const label = group.options.find((o) => o.value === value)?.label ?? value;
        out.push({ key, label, change: facetTogglePatch(group.field, value, intent, refinement) });
      }
    }
    return out;
  }, [listings, intent, refinement]);

  if (chips.length === 0) return null;

  const apply = (change: Change) => {
    if (change.intent) onIntentChange(change.intent);
    if (change.refinement) onRefinementChange(change.refinement);
  };

  return (
    <div
      data-active-filters
      role="region"
      aria-label={t("filtersApplied")}
      className="flex flex-wrap items-center gap-2"
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => apply(chip.change)}
          aria-label={t("removeFilter", { label: chip.label })}
          className="group flex h-8 max-w-full items-center gap-1.5 rounded-full bg-foreground py-1 pl-3 pr-2 text-xs font-semibold text-background transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="truncate">{chip.label}</span>
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-background/20 transition-colors group-hover:bg-background/35">
            <X className="size-3" strokeWidth={3} aria-hidden />
          </span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="h-8 rounded-full px-2 text-xs font-bold text-accent-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("clearAll")}
      </button>
    </div>
  );
}

/**
 * One-tap chips for the filters most guests reach for, so most never need
 * the rail. They write the rail's own "Popular filters" values, so a chip
 * tapped here is ticked there too, and the counts are the rail's counts. A
 * chip no listed stay would answer is left out rather than shown at zero.
 */
const QUICK = [
  { id: "breakfast", key: "quickBreakfast", Icon: Coffee },
  { id: "pool", key: "quickPool", Icon: Waves },
  { id: "rated_8", key: "quickRated", Icon: Award },
  { id: "under_50k", key: "quickUnderPrice", Icon: Wallet },
] as const;

export function QuickFilters({
  listings,
  intent,
  refinement,
  onRefinementChange,
}: {
  listings: Listing[];
  intent: StayIntent;
  refinement: ExploreRefinement;
  onRefinementChange: (next: Partial<ExploreRefinement>) => void;
}) {
  const t = useTranslations("search");
  const counts = useMemo(() => {
    const groups = buildFacetGroups((_id, field) =>
      poolExcluding(listings, intent, refinement, field),
    );
    const popular = groups.find((g) => g.field === "popular");
    return new Map(popular?.options.map((o) => [o.value, o.count]) ?? []);
  }, [listings, intent, refinement]);

  return (
    <div
      role="group"
      aria-label={t("quickFilters")}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {QUICK.map(({ id, key, Icon }) => {
        const label = t(key);
        const on = refinement.popular.includes(id);
        const count = counts.get(id) ?? 0;
        if (!on && count === 0) return null;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onRefinementChange({
                popular: on
                  ? refinement.popular.filter((p) => p !== id)
                  : [...refinement.popular, id],
              })
            }
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on
                ? "bg-accent text-accent-foreground ring-accent"
                : "bg-card text-foreground ring-border hover:bg-surface-secondary",
            )}
          >
            {on ? (
              <Check className="size-4" strokeWidth={2.6} aria-hidden />
            ) : (
              <Icon className="size-4 text-muted-foreground" strokeWidth={2} aria-hidden />
            )}
            {label}
            {!on ? <span className="text-xs font-normal text-muted-foreground">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
