"use client";

import { useMemo, useState } from "react";
import { Slider } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { FilterSection } from "@/components/explore/filter-primitives";
import { CATALOGUE_HISTOGRAM, PRICE_CEILING, type PriceHistogram } from "@/data/explore-facets";
import { formatRateNumber } from "@/lib/price";
import type { PriceBasis } from "@/lib/search-params";

/**
 * The rail's price block: a histogram of the catalogue's own rates, a
 * two-handle range under it, a nightly/total basis switch, and paired min/max
 * fields.
 *
 * The histogram is a PICTURE OF THE FILTERED SET, redrawn as other facets
 * narrow it, not a static decoration over a fixed range. The reference draws
 * it that way — the shape answers "where is the market, given everything else
 * I've already ticked" — and a bar chart that never changes would be telling
 * the same lie a decorative control always tells: that it responds to nothing.
 *
 * Committed on RELEASE, not on drag. The slider fires continuously while
 * dragged; writing every intermediate value to the URL would thrash history
 * and refilter the grid sixty times for one gesture. `onValueCommit` is
 * Radix's release event and is what `onCommit` is wired to below.
 */
export function PriceFilter({
  basis,
  min,
  max,
  onBasisChange,
  onRangeChange,
  histogram,
}: {
  basis: PriceBasis;
  min: number | null;
  max: number | null;
  onBasisChange: (basis: PriceBasis) => void;
  onRangeChange: (min: number | null, max: number | null) => void;
  /** The distribution to draw. Falls back to the catalogue-wide one. */
  histogram: PriceHistogram | null;
}) {
  const chart = histogram ?? CATALOGUE_HISTOGRAM;
  const ceiling = chart?.maxRwf ?? PRICE_CEILING;

  const [draft, setDraft] = useState<[number, number]>([min ?? 0, max ?? ceiling]);
  const value = useMemo<[number, number]>(
    () => [min ?? 0, max ?? ceiling],
    [min, max, ceiling],
  );
  const live = draft[0] === (min ?? 0) && draft[1] === (max ?? ceiling) ? value : draft;

  const commit = (next: number[]) => {
    const [lo, hi] = next as [number, number];
    onRangeChange(lo <= 0 ? null : lo, hi >= ceiling ? null : hi);
  };

  return (
    <FilterSection id="price" title="Price">
      <div className="mb-1 flex rounded-full bg-surface-secondary p-0.5 text-xs font-bold">
        {(["nightly", "total"] as const).map((option) => (
          <button
            key={option}
            type="button"
            data-price-basis
            aria-pressed={basis === option}
            onClick={() => onBasisChange(option)}
            className={cn(
              "flex-1 rounded-full px-2 py-1.5 transition-colors",
              basis === option
                ? "bg-white text-foreground shadow-control"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "nightly" ? "Nightly price" : "Total price"}
          </button>
        ))}
      </div>

      {chart ? (
        <div
          data-price-histogram
          className="mt-3 flex h-10 items-end gap-[2px]"
          aria-hidden
        >
          {chart.bars.map((height, index) => {
            const edge = chart.edges[index] ?? 0;
            const inRange = edge >= (min ?? 0) && edge <= (max ?? ceiling);
            return (
              <span
                key={index}
                data-price-bar
                style={{ height: `${Math.max(6, Math.round(height * 100))}%` }}
                className={cn(
                  "flex-1 rounded-t-[2px] transition-colors",
                  inRange ? "bg-accent-text/70" : "bg-surface-secondary",
                )}
              />
            );
          })}
        </div>
      ) : null}

      <div data-price-range className="mt-3 px-1">
        <Slider
          min={0}
          max={ceiling}
          step={Math.max(1000, Math.round(ceiling / 100))}
          value={live}
          onValueChange={(next) => setDraft(next as [number, number])}
          onValueCommit={commit}
          aria-label="Price range"
        />
      </div>

      <div className="mt-3 flex items-center gap-2 text-sm">
        <label className="flex-1">
          <span className="mb-1 block text-2xs font-medium text-muted-foreground">
            Min
          </span>
          <input
            type="number"
            inputMode="numeric"
            data-price-min
            min={0}
            max={ceiling}
            step={1000}
            value={min ?? ""}
            placeholder="0"
            onChange={(event) => {
              const raw = event.currentTarget.value;
              const parsed = raw === "" ? null : Number(raw);
              onRangeChange(parsed !== null && Number.isFinite(parsed) ? parsed : null, max);
            }}
            className="w-full border border-field-outline bg-field-background px-2.5 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          />
        </label>
        <span className="mt-4 text-muted-foreground">–</span>
        <label className="flex-1">
          <span className="mb-1 block text-2xs font-medium text-muted-foreground">
            Max
          </span>
          {/*
            A `+` placeholder, and no `max` attribute. The chart's top is a
            DISPLAY trim now — the lower of the 95th percentile and three
            medians — not the catalogue's real ceiling, so capping the field at
            it would refuse a guest who genuinely wants a 4,000,000 RWF lodge.
            The plus says what the reference's "$350+" says.
          */}
          <input
            type="number"
            inputMode="numeric"
            data-price-max
            min={0}
            step={1000}
            value={max ?? ""}
            placeholder={`${formatRateNumber(ceiling) ?? ""}+`}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              const parsed = raw === "" ? null : Number(raw);
              onRangeChange(min, parsed !== null && Number.isFinite(parsed) ? parsed : null);
            }}
            className="w-full border border-field-outline bg-field-background px-2.5 py-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          />
        </label>
      </div>
    </FilterSection>
  );
}
