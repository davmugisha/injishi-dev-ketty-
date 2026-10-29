"use client";

import type { SalesEventsSpace, SalesEventsSpaceBooking } from "@injishi/product-pms";
import { usePmsMedia } from "@injishi/product-pms/web";
import { Photo } from "@injishi/ui";
import type { CSSProperties, ReactNode } from "react";

/** The event day runs from 08:00 to 24:00 on the space chart. */
const DAY_START = 8;
const DAY_HOURS = 16;
const TICKS = [8, 10, 12, 14, 16, 18, 20, 22, 24];

const pct = (hour: number) => ((hour - DAY_START) / DAY_HOURS) * 100;
const span = (start: number, end: number): CSSProperties => ({
  left: `${pct(start)}%`,
  width: `${((end - start) / DAY_HOURS) * 100}%`,
});

const BAR_BASE =
  "absolute top-[5px] bottom-[5px] z-[1] flex items-center gap-1.5 overflow-hidden rounded-[10px] px-2.5 text-[12px] font-medium whitespace-nowrap";

const BAR_KIND: Record<SalesEventsSpaceBooking["kind"], string> = {
  contracted: "bg-accent text-accent-foreground",
  tentative: "bg-surface text-foreground shadow-[inset_0_0_0_1.5px_var(--border-tertiary)]",
  turnaround: "text-muted",
};

const TURNAROUND_FILL: CSSProperties = {
  background: "repeating-linear-gradient(135deg, var(--surface-secondary) 0 6px, var(--surface-tertiary) 6px 12px)",
};

const CLASH_FILL: CSSProperties = {
  background:
    "repeating-linear-gradient(135deg, color-mix(in oklab, var(--danger) 30%, transparent) 0 6px, transparent 6px 12px)",
  boxShadow: "inset 0 0 0 2px var(--danger)",
};

/** Colour key of the space chart (artifact: .ij-legend). */
export function SalesEventsSpaceLegend() {
  const item = (swatch: string, label: string, style?: CSSProperties): ReactNode => (
    <span key={label} className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span aria-hidden="true" className={`inline-block size-2.5 rounded-[3px] ${swatch}`} style={style} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-[14px]">
      {item("bg-accent", "Contracted")}
      {item("shadow-[inset_0_0_0_1.5px_var(--border-tertiary)]", "Tentative hold")}
      {item("bg-surface-tertiary", "Turnaround")}
      {item("shadow-[inset_0_0_0_2px_var(--danger)]", "Collision")}
    </div>
  );
}

/**
 * One day of event-space bookings: a row per space with contracted, tentative and turnaround bars on an
 * 08:00–24:00 axis, and a hatched collision overlay while the double booking is open.
 */
export function SalesEventsSpaceTimeline({
  spaces,
  bookings,
  collision,
  label,
}: {
  spaces: SalesEventsSpace[];
  bookings: SalesEventsSpaceBooking[];
  collision: boolean;
  label: string;
}) {
  const { photo, hasPhoto } = usePmsMedia();
  const scenario = collision ? "collision" : "resolved";
  return (
    <div role="img" aria-label={label} className="flex flex-col gap-2">
      <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 sm:grid-cols-[196px_minmax(0,1fr)]">
        <span />
        <div className="relative h-4">
          {TICKS.map((h) => (
            <span
              key={h}
              className="absolute -translate-x-1/2 text-[11px] leading-4 text-muted tabular"
              style={{ left: `${pct(h)}%` }}
            >
              {`${String(h).padStart(2, "0")}:00`}
            </span>
          ))}
        </div>
      </div>
      {spaces.map((s) => {
        const bars = bookings.filter((b) => b.space === s.id && (b.scenario === "always" || b.scenario === scenario));
        return (
          <div
            key={s.id}
            className="grid grid-cols-[150px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[196px_minmax(0,1fr)]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {hasPhoto(s.photo) ? (
                <Photo
                  image={photo(s.photo)}
                  sizes="44px"
                  className="hidden size-[44px] shrink-0 rounded-[10px] sm:block"
                />
              ) : null}
              <span className="flex min-w-0 flex-col">
                <span className="text-[13px] leading-[18px] font-medium">{s.name}</span>
                <span className="text-[12px] leading-4 text-muted">{s.cap}</span>
              </span>
            </span>
            <div className="relative h-[44px] rounded-xl bg-surface-secondary">
              {bars.map((b) => (
                <span
                  key={b.id}
                  className={`${BAR_BASE} ${BAR_KIND[b.kind]}`}
                  style={{ ...span(b.start, b.end), ...(b.kind === "turnaround" ? TURNAROUND_FILL : null) }}
                >
                  {b.label}
                </span>
              ))}
              {collision && s.clash ? (
                <span
                  className="absolute top-[2px] bottom-[2px] z-[2] rounded-[10px]"
                  style={{ ...span(s.clash.start, s.clash.end), ...CLASH_FILL }}
                />
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
