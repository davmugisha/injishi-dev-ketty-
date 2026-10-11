"use client";

/**
 * Stacked columns over a short run of months, and the palette they draw in.
 *
 * Two screens ask the same question of different money — "how did this month's
 * total divide, and how does it compare with the months before" — so they share
 * one chart: an employee's pay split into take-home and what was withheld (My
 * HR), and the business's staff cost split by department (Payroll).
 *
 * THE COLOURS ARE THE DESIGN SYSTEM'S, ASSIGNED IN A FIXED ORDER. `--chart-1`
 * to `--chart-5` are the token sheet's chart ramp (ADR-068): one hue, five
 * steps, darkest first, the same ramp `BarList` draws its bars in. A caller
 * hands each series a slot and keeps it: the same department is the same step
 * in every month, whatever else is on screen. A sixth series is never a new
 * colour — the caller folds the smallest into "Other", which wears
 * `--chart-muted`.
 *
 * Neighbouring steps of one hue are close, so colour is never the only way to
 * read this: the legend names every series, the tooltip lists each value, and
 * every caller keeps the same figures in a list or table below.
 */

import { useState } from "react";

import { cn } from "@/lib/utils";

export const VIZ_SLOTS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const VIZ_OTHER = "var(--chart-muted)";

export interface VizSeries {
  key: string;
  label: string;
  color: string;
}

export interface VizColumn {
  id: string;
  /** Under the column: "Oct". */
  short: string;
  /** In the tooltip and for a screen reader: "October 2026". */
  long: string;
  /** Per series key. `null` is a month with nothing in it, which keeps its slot. */
  values: Record<string, number> | null;
  /** A line under the tooltip's title, such as "Draft". */
  note?: string;
}

/** A filled square for a legend, mirroring the bar it names. */
export function VizSwatch({ color }: { color: string }) {
  return <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />;
}

/** The next clean number at or above `value`: 1, 2 or 5 times a power of ten. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

const PLOT_HEIGHT = 168;

/** The whole slot is the target, not the 24px column. */
const slotClass =
  "flex h-full w-full items-end justify-center rounded border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StackedColumns({
  series,
  columns,
  selectedId = null,
  onSelect,
  format,
  formatTick,
  totalLabel,
}: {
  /** Stacked from the baseline up, in this order. */
  series: readonly VizSeries[];
  /** Oldest first. */
  columns: readonly VizColumn[];
  selectedId?: string | null;
  /** When given, a column is a button that picks its month. */
  onSelect?: (id: string) => void;
  /** A full figure, for the tooltip. */
  format: (amount: number) => string;
  /** A compact figure, for the axis. */
  formatTick: (amount: number) => string;
  /** What a whole column adds up to: "Gross salary". */
  totalLabel: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const totalOf = (c: VizColumn) => (c.values ? series.reduce((n, s) => n + (c.values![s.key] ?? 0), 0) : 0);
  const top = niceCeiling(Math.max(...columns.map(totalOf)));
  const ticks = [top, top / 2, 0];
  const active = columns.find((c) => c.id === hovered && c.values);

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-2xs text-muted-foreground">
            <VizSwatch color={s.color} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex gap-2.5">
        {/* Three clean ticks, so a column's height can be read off the axis. */}
        <div aria-hidden className="relative w-16 shrink-0 text-2xs text-muted-foreground" style={{ height: PLOT_HEIGHT }}>
          {ticks.map((t, i) => (
            <span
              key={t}
              className="pms-num absolute right-0 -translate-y-1/2 whitespace-nowrap"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {t === 0 ? "0" : formatTick(t)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((t, i) => (
              <span
                key={t}
                aria-hidden
                className="absolute inset-x-0 h-px bg-line"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}

            <div className="absolute inset-0 flex">
              {columns.map((c) => {
                const total = totalOf(c);
                const isSelected = selectedId !== null && c.id === selectedId;
                // A column only a few pixels tall cannot afford 2px between its
                // segments: the gaps would outweigh the fills and it would read
                // as stripes. Under 40px it closes up to a hairline.
                const tall = (total / top) * PLOT_HEIGHT >= 40;
                const stack = c.values ? (
                  <span
                    // The gap is the card showing through: it separates the
                    // segments without a border drawn around any of them. The
                    // data end is rounded and the baseline square, as `BarList`
                    // draws its bars.
                    className={cn(
                      "flex w-6 flex-col-reverse overflow-hidden rounded-t",
                      tall ? "gap-0.5" : "gap-px",
                      selectedId === null || isSelected || hovered === c.id ? "opacity-100" : "opacity-55",
                    )}
                    style={{ height: `${Math.max((total / top) * 100, 4)}%` }}
                  >
                    {series.map((s) =>
                      (c.values![s.key] ?? 0) > 0 ? (
                        <span key={s.key} className="basis-0" style={{ flexGrow: c.values![s.key], background: s.color }} />
                      ) : null,
                    )}
                  </span>
                ) : null;
                const label = c.values
                  ? `${c.long}: ${totalLabel} ${format(total)}. ${series
                      .filter((s) => (c.values![s.key] ?? 0) > 0)
                      .map((s) => `${s.label} ${format(c.values![s.key])}`)
                      .join(", ")}.`
                  : "";
                const hover = {
                  onMouseEnter: () => setHovered(c.id),
                  onMouseLeave: () => setHovered(null),
                  onFocus: () => setHovered(c.id),
                  onBlur: () => setHovered(null),
                };
                const lit = hovered === c.id ? "bg-hover" : "bg-transparent";
                return (
                  <div key={c.id} className="flex flex-1 items-end justify-center">
                    {!c.values ? (
                      <span aria-hidden className="h-0.5 w-6 rounded-full bg-line2" />
                    ) : onSelect ? (
                      <button
                        type="button"
                        aria-label={label}
                        aria-pressed={isSelected}
                        onClick={() => onSelect(c.id)}
                        {...hover}
                        className={cn(slotClass, "cursor-pointer", lit)}
                      >
                        {stack}
                      </button>
                    ) : (
                      <div role="img" tabIndex={0} aria-label={label} {...hover} className={cn(slotClass, lit)}>
                        {stack}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {active?.values && (
              <div
                role="status"
                className={cn(
                  "pointer-events-none absolute top-0 z-10 min-w-52 rounded border border-card-bd bg-card px-3 py-2.5 shadow-popover",
                  // Pinned to the side away from the column, so it never covers it.
                  columns.indexOf(active) < columns.length / 2 ? "right-0" : "left-0",
                )}
              >
                <div className="text-sm font-semibold text-ink">{active.long}</div>
                {active.note && <div className="text-2xs text-muted-foreground">{active.note}</div>}
                <div className="mt-1.5">
                  {series
                    .filter((s) => (active.values![s.key] ?? 0) > 0)
                    .map((s) => (
                      <div key={s.key} className="flex items-center gap-2 py-0.5 text-2xs">
                        {/* A short stroke, not a box: at this size a filled square is ink doing a label's job. */}
                        <span aria-hidden className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: s.color }} />
                        <span className="flex-1 text-muted-foreground">{s.label}</span>
                        <span className="pms-num font-semibold text-ink">{format(active.values![s.key])}</span>
                      </div>
                    ))}
                </div>
                <div className="mt-1.5 flex gap-2 border-t border-line pt-1.5 text-2xs">
                  <span className="flex-1 text-muted-foreground">{totalLabel}</span>
                  <span className="pms-num font-bold text-ink">{format(totalOf(active))}</span>
                </div>
              </div>
            )}
          </div>

          <div aria-hidden className="mt-2 flex">
            {columns.map((c) => (
              <span
                key={c.id}
                className={cn(
                  "flex-1 text-center text-2xs",
                  selectedId !== null && c.id === selectedId ? "font-bold" : "font-medium",
                  c.values ? "text-ink" : "text-muted-foreground",
                )}
              >
                {c.short}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The six months ending at `latestMonthId` (`2026-10`), oldest first, as `{ id, short, long }`. */
export function lastSixMonths(latestMonthId: string): { id: string; short: string; long: string }[] {
  const [year, month] = latestMonthId.split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(Date.UTC(year, month - 1 - (5 - i), 1));
    return {
      id: date.toISOString().slice(0, 7),
      short: date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" }),
      long: date.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" }),
    };
  });
}

/** RWF 316K, RWF 6.3M — for an axis tick, where the full figure would crowd. */
export function rwfCompact(amount: number): string {
  return `RWF ${new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(amount)}`;
}
