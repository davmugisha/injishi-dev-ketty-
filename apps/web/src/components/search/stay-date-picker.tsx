"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button, Calendar, HALF_BAND } from "@injishi/web-ui";
import { cn, formatDateRange, nightsBetween, pluralize } from "@injishi/utils";
import type { BookingCalendar } from "@/data/availability";
import {
  addDays,
  disabledDays,
  lastBookableNight,
  nextRange,
  phaseOf,
  previewModifiers,
} from "@/lib/stay-range";
import { FLEX_DAYS, startOfToday, type FlexDays } from "@/lib/stay-search";

/**
 * The one stay date-range picker.
 *
 * There were two, `search/date-panel.tsx` behind the hero pill and
 * `property/booking-date-picker.tsx` inside the booking card. Both wrapped the
 * same `@injishi/ui` `Calendar` in range mode over two months with the past
 * disabled, and they had drifted: one opened on the month of the selected
 * check-in and the other always on today, one cleared the range from a link in
 * its header and the other from a footer button, and only one of them
 * disabled its clear control when there was nothing to clear.
 *
 * Two months at once in both, because a stay that straddles a month boundary
 * is the common case and paging back and forth to compare is where a one-month
 * picker loses people. Outside days are hidden: with two months side by side
 * the first days of October were drawn twice, once faded at the foot of
 * September and once in October, and both were clickable.
 *
 * What a click does, what is offered, and what the hover previews are all
 * `lib/stay-range.ts`, which has no React in it and is unit tested on a fixed
 * calendar. This file mounts those rules and owns nothing but the chrome.
 *
 * TWO variants, and the difference between them is real rather than cosmetic:
 *
 *  - `hero` is the floating panel under the search pill. It pins white in both
 *    themes, because it sits over a photograph. Its selection needs no pin of
 *    its own: the `Calendar` paints it in `foreground`/`background`, and
 *    ADR-028's pin block redeclares both roles inside `.bg-white`, so a dark
 *    theme does not invert the circle out from under this panel. It carries
 *    the plus or minus window, which only means anything before a search.
 *  - `booking` sits inside the property card and follows the theme like every
 *    other surface there. It carries two summary cells that each clear their
 *    own end of the range, because by this point the guest is editing a
 *    decision rather than making one.
 *
 * Clearing the check-in clears both. A checkout with no check-in has nothing
 * to anchor to, and `search-params.ts` drops that half on the way into a URL
 * anyway, so leaving it on screen would show a value the funnel would discard.
 */
export function StayDatePicker({
  variant,
  range,
  onChange,
  flexDays,
  onFlexChange,
  onDone,
  doneLabel = "Done",
  calendar = null,
}: {
  variant: "hero" | "booking";
  range: DateRange | undefined;
  onChange: (next: DateRange | undefined) => void;
  /** Hero only. Omit and the plus-or-minus rail is not rendered. */
  flexDays?: FlexDays;
  onFlexChange?: (days: FlexDays) => void;
  onDone: () => void;
  doneLabel?: string;
  /**
   * What is left to sell, when the caller knows (ADR-047 wave E).
   *
   * Omitted on the hero, which searches the whole catalogue and has no single
   * room to ask about. Absent or null means "offer every night": a calendar
   * that greys itself out because a request failed tells the guest this
   * property is full, which is a lie that costs a booking — and the server
   * re-checks availability under a row lock at the moment of purchase, so
   * optimism here is safe and pessimism is not.
   */
  calendar?: BookingCalendar | null;
}) {
  // Fixed for the life of the panel: the month bounds below are Dates, and a
  // fresh object on every render would re-clamp the view under the guest.
  const today = useMemo(() => startOfToday(), []);
  const [month, setMonth] = useState<Date>(range?.from ?? today);
  const [hovered, setHovered] = useState<Date | null>(null);

  const closed = range?.from && range?.to ? { from: range.from, to: range.to } : null;
  const nights = closed ? nightsBetween(closed.from, closed.to) : 0;
  const hero = variant === "hero";
  const showFlex = hero && flexDays !== undefined && onFlexChange !== undefined;
  const minStay = Math.max(1, calendar?.minStay ?? 1);

  /**
   * Past nights, sold-out nights, and everything past the booking horizon —
   * and, while a check-out is being chosen, everything a stay from that
   * check-in cannot reach. `MAX_HORIZON_DAYS` was a server-only constant until
   * ADR-047; it is in `@injishi/contracts` now, so the two sides cannot
   * disagree about how far ahead a booking opens.
   */
  const disabled = useMemo(
    () => disabledDays(range, today, calendar),
    [range, today, calendar],
  );

  // Arrows stop at today's month and at the month a stay can last reach.
  // react-day-picker marks the arrow `aria-disabled` at a bound, and the
  // shared Calendar fades it; before this the past paged back forever.
  const endMonth = useMemo(
    () => addDays(lastBookableNight(today, calendar), 1),
    [today, calendar],
  );

  return (
    <div
      className={cn(
        hero
          ? // Pinned white, ring rather than border: it floats over the hero
            // photograph and owes an edge the page cannot supply.
            "w-[min(660px,calc(100vw-2rem))] overflow-hidden rounded-card bg-white text-ink shadow-[0_18px_50px_-12px_rgba(4,35,48,0.35)] ring-1 ring-black/5"
          : "w-[min(640px,calc(100vw-2rem))] px-6 pt-5",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4",
          hero
            ? "px-6 pt-5"
            : // Sticky for the same reason the footer is: the popover caps
              // itself to the room Radix measures and scrolls the rest, and
              // the two summary cells are how a guest edits one end of the
              // range. They must not be the part that scrolls away.
              "sticky top-0 z-20 -mx-6 -mt-5 bg-popover px-6 pb-3 pt-5 text-popover-foreground",
        )}
      >
        <div>
          <p
            className={cn(
              "font-medium",
              hero ? "text-base text-ink" : "text-lg font-semibold text-page-fg",
            )}
          >
            {closed
              ? hero
                ? pluralize(nights, "night")
                : `${pluralize(nights, "night")} · ${formatDateRange(closed.from, closed.to)}`
              : headline(range, hero)}
          </p>
          {!hero && !closed ? (
            <p className="text-sm text-page-fg-70">
              {minStay > 1
                ? `${pluralize(minStay, "night")} minimum · add dates for exact pricing`
                : "Add your travel dates for exact pricing"}
            </p>
          ) : null}
        </div>

        {hero && range?.from ? (
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              onChange(undefined);
              onFlexChange?.(0);
            }}
            className="text-ink/50 hover:text-ink"
          >
            Clear
          </Button>
        ) : null}

        {!hero ? (
          <div className="flex overflow-hidden rounded border border-input">
            <SummaryCell
              label="Check-in"
              value={range?.from}
              onClear={() => onChange(undefined)}
            />
            <span aria-hidden className="w-px self-stretch bg-input" />
            <SummaryCell
              label="Checkout"
              value={range?.to}
              onClear={() => onChange(range?.from ? { from: range.from } : undefined)}
            />
          </div>
        ) : null}
      </div>

      <Calendar
        mode="range"
        month={month}
        onMonthChange={setMonth}
        numberOfMonths={2}
        showOutsideDays={false}
        startMonth={today}
        endMonth={endMonth}
        disabled={disabled}
        selected={range}
        // The library's own range arithmetic is not used: `nextRange` decides
        // what the click means from the day that was clicked, so a finished
        // range restarts and a day before the check-in moves it.
        onSelect={(_next, day) => {
          setHovered(null);
          onChange(nextRange(range, day));
        }}
        onDayMouseEnter={(day, modifiers) => setHovered(modifiers.disabled ? null : day)}
        onDayMouseLeave={() => setHovered(null)}
        modifiers={previewModifiers(range, hovered)}
        modifiersClassNames={PREVIEW}
        className={cn(hero ? "px-4 pb-1 pt-3" : "p-0")}
        classNames={
          hero
            ? { months: "relative flex flex-col sm:flex-row gap-6" }
            : // Tighter than the shared default, for the same reason the
              // chrome above and below is: this panel is height-capped.
              { month: "flex flex-col gap-3" }
        }
      />

      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          hero
            ? "border-t border-black/5 px-6 py-4"
            : // Sticky, because the booking popover caps itself to the space
              // Radix measures and scrolls the rest. On a 900px-tall viewport
              // that fold fell across this row, and the Close button was the
              // thing below it. The band is the popover's own ground.
              "sticky bottom-0 -mx-6 mt-3 justify-end border-t border-input bg-popover px-6 py-3 text-popover-foreground",
        )}
      >
        {showFlex ? (
          <>
            <span className="mr-1 text-sm text-ink/65">Flexible by</span>
            {FLEX_DAYS.map((days) => (
              /* The selected window is the accent, not a fixed navy. This
                 panel pins itself white in both themes, so the unselected
                 state stays `inverse`, an always-white fill, rather than an
                 outline that would invert underneath it. */
              <Button
                key={days}
                variant={flexDays === days ? "primary" : "inverse"}
                size="sm"
                aria-pressed={flexDays === days}
                onClick={() => onFlexChange(days)}
                className={cn(
                  "h-auto px-3.5 py-1.5",
                  flexDays === days
                    ? undefined
                    : "border border-black/10 hover:border-ink/40",
                )}
              >
                {days === 0 ? "Exact" : `± ${pluralize(days, "day")}`}
              </Button>
            ))}
          </>
        ) : null}

        {!hero ? (
          /* Full-strength ink with the underline. At the muted weight this
             read as disabled when it was live, which is worse than no
             affordance at all. */
          <Button
            variant="ghost"
            shape="rounded"
            onClick={() => onChange(undefined)}
            disabled={!range?.from}
            className="px-3 text-base text-page-fg underline underline-offset-4"
          >
            Clear dates
          </Button>
        ) : null}

        <Button
          variant={hero ? "primary" : "solid"}
          size={hero ? "sm" : undefined}
          shape={hero ? undefined : "rounded"}
          onClick={onDone}
          className={hero ? "ml-auto h-auto px-6 py-2" : "px-5 text-base"}
        >
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * The hover preview, drawn like the closed range it would become — the band
 * at half strength between the check-in and the day under the pointer, the
 * band's two ends on those two cells, and a ring on the day itself.
 */
const PREVIEW = {
  preview: "[&>button]:bg-secondary/50 [&>button]:rounded-none",
  preview_start: cn(HALF_BAND, "before:right-0 before:bg-secondary/50"),
  preview_end: cn(
    HALF_BAND,
    "before:left-0 before:bg-secondary/50 [&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-foreground",
  ),
};

function headline(range: DateRange | undefined, hero: boolean): string {
  if (phaseOf(range) === "check-in") return hero ? "Pick your dates" : "Select dates";
  return hero ? "Pick a check-out date" : "Select dates";
}

function SummaryCell({
  label,
  value,
  onClear,
}: {
  label: string;
  value: Date | undefined;
  onClear: () => void;
}) {
  const formatted = value
    ? `${value.getDate()}/${value.getMonth() + 1}/${value.getFullYear()}`
    : null;

  return (
    <div className="flex min-w-[130px] items-center justify-between gap-3 px-3 py-2">
      <span>
        <span className="block text-2xs font-semibold uppercase tracking-[0.04em] text-page-fg">
          {label}
        </span>
        <span className="block text-sm text-page-fg-70">{formatted ?? "Add date"}</span>
      </span>

      {formatted ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={onClear}
          className="size-5 shrink-0 text-page-fg-70 hover:text-page-fg"
        >
          <X width={10} height={10} strokeWidth={1.4} aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
