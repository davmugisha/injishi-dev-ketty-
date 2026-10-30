"use client";

import { useMemo, useState } from "react";
import { Slider } from "@injishi/web-ui";
import { cn } from "@injishi/utils";
import { FilterSection } from "@/components/explore/filter-primitives";
import type { PriceHistogram } from "@/data/explore-facets";
import { formatRateNumber } from "@/lib/price";

/**
 * The rail's price block: a histogram of the listed stays' nightly rates, a
 * two-handle range under it, and paired min/max fields.
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
/** The slider's top when no stay publishes a rate to draw it from. */
const FALLBACK_CEILING_RWF = 500_000;

export function PriceFilter({
  min,
  max,
  onRangeChange,
  histogram,
  matchCount,
}: {
  min: number | null;
  max: number | null;
  onRangeChange: (min: number | null, max: number | null) => void;
  /** The distribution to draw, or null when no stay in view has a rate. */
  histogram: PriceHistogram | null;
  /** Stays that pass every filter, this range included, for the live line. */
  matchCount?: number;
}) {
  const chart = histogram;
  const ceiling = chart?.maxRwf ?? FALLBACK_CEILING_RWF;

  const [draft, setDraft] = useState<[number, number]>([min ?? 0, max ?? ceiling]);
  const value = useMemo<[number, number]>(
    () => [min ?? 0, max ?? ceiling],
    [min, max, ceiling],
  );
  const live = draft[0] === (min ?? 0) && draft[1] === (max ?? ceiling) ? value : draft;

  const [lo, hi] = live;
  const fmt = (rwf: number) => formatRateNumber(rwf) ?? String(rwf);
  const rangeLine =
    min === null && max === null
      ? "Any price"
      : min === null
        ? `Up to ${fmt(max!)} RWF`
        : max === null
          ? `From ${fmt(min)} RWF`
          : `${fmt(min)} – ${fmt(max)} RWF`;

  // Quick ranges for the nightly rate, the figure guests think in.
  const presets = [
    { label: "Under 100K", min: null, max: 100_000 },
    { label: "100K – 250K", min: 100_000, max: 250_000 },
    { label: "250K+", min: 250_000, max: null },
  ];

  const commit = (next: number[]) => {
    const [lo, hi] = next as [number, number];
    onRangeChange(lo <= 0 ? null : lo, hi >= ceiling ? null : hi);
  };

  return (
    <FilterSection
      id="price"
      title="Price range"
      selectedCount={min !== null || max !== null ? 1 : 0}
    >
      <p className="flex items-baseline justify-between gap-2 text-sm" aria-live="polite">
        <span className="font-bold text-foreground">{rangeLine}</span>
        {typeof matchCount === "number" && (min !== null || max !== null) ? (
          <span className="shrink-0 text-xs text-muted-foreground">
            {matchCount} {matchCount === 1 ? "stay" : "stays"}
          </span>
        ) : null}
      </p>

      {chart ? (
        <div
          data-price-histogram
          className="mt-3 flex h-10 items-end gap-[2px]"
          aria-hidden
        >
          {chart.bars.map((height, index) => {
            const edge = chart.edges[index] ?? 0;
            // Follows the thumbs while they drag, not only once released.
            const inRange = edge >= lo && edge <= hi;
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

      {presets.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Quick price ranges">
          {presets.map((preset) => {
            const on = preset.min === min && preset.max === max;
            return (
              <button
                key={preset.label}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  if (on) onRangeChange(null, null);
                  else onRangeChange(preset.min, preset.max);
                  setDraft([preset.min ?? 0, preset.max ?? ceiling]);
                }}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "bg-foreground text-background ring-foreground"
                    : "bg-card text-foreground ring-border hover:bg-surface-secondary",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2 text-sm">
        <label className="flex-1">
          <span className="mb-1 block text-2xs font-medium text-muted-foreground">
            Min <span className="sr-only">(RWF)</span>
          </span>
          <span className="relative block">
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
              className="w-full border border-field-outline bg-field-background py-2 pl-2.5 pr-10 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            />
            <RwfSuffix />
          </span>
        </label>
        <span className="mt-4 text-muted-foreground">–</span>
        <label className="flex-1">
          <span className="mb-1 block text-2xs font-medium text-muted-foreground">
            Max <span className="sr-only">(RWF)</span>
          </span>
          {/*
            A `+` placeholder, and no `max` attribute. The chart's top is a
            DISPLAY trim now — the lower of the 95th percentile and three
            medians — not the catalogue's real ceiling, so capping the field at
            it would refuse a guest who genuinely wants a 4,000,000 RWF lodge.
            The plus says what the reference's "$350+" says.
          */}
          <span className="relative block">
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
              className="w-full border border-field-outline bg-field-background py-2 pl-2.5 pr-10 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            />
            <RwfSuffix />
          </span>
        </label>
      </div>
    </FilterSection>
  );
}

/** The currency, inside the field, so a bare "100000" is never ambiguous. */
function RwfSuffix() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-muted-foreground"
    >
      RWF
    </span>
  );
}
