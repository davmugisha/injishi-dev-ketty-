"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange, Matcher } from "react-day-picker";
import { Button, Calendar } from "@injishi/ui";
import { cn, formatDateRange, nightsBetween, pluralize, toISODate } from "@injishi/utils";
import type { BookingCalendar } from "@/data/availability";
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
 * picker loses people.
 *
 * TWO variants, and the difference between them is real rather than cosmetic:
 *
 *  - `hero` is the floating panel under the search pill. It pins white in both
 *    themes, because it sits over a photograph, so it also pins its selection
 *    colour to ink rather than letting the theme decide. It carries the plus
 *    or minus window, which only means anything before a search has been run.
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
  calendar,
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
  const [month, setMonth] = useState<Date>(range?.from ?? startOfToday());

  const nights = range?.from && range?.to ? nightsBetween(range.from, range.to) : 0;
  const hero = variant === "hero";
  const showFlex = hero && flexDays !== undefined && onFlexChange !== undefined;

  /**
   * Past nights, sold-out nights, and everything past the booking horizon.
   *
   * This used to be `{ before: startOfToday() }` and nothing else, so the
   * picker offered nights the API would refuse — sold out, or beyond the
   * 18-month horizon — at the last click, after the guest had chosen a room, a
   * party and a payment method. `MAX_HORIZON_DAYS` was a server-only constant
   * until ADR-047; it is in `@injishi/contracts` now, so the two sides cannot
   * disagree about how far ahead a booking opens.
   *
   * The sold-out rule is a PREDICATE rather than a list of dates: a `Set`
   * consulted per rendered cell, instead of 540 `Date` objects built to be
   * compared against.
   */
  const disabledDays = useMemo<Matcher[]>(() => {
    const rules: Matcher[] = [{ before: startOfToday() }];
    if (!calendar) return rules;

    rules.push({ after: new Date(`${calendar.lastBookableNight}T00:00:00`) });
    rules.push((day: Date) => calendar.soldOut.has(toISODate(day)));
    return rules;
  }, [calendar]);

  return (
    <div
      className={cn(
        hero
          ? // Pinned white, ring rather than border: it floats over the hero
            // photograph and owes an edge the page cannot supply.
            "w-[min(660px,calc(100vw-2rem))] overflow-hidden rounded-card bg-white text-ink shadow-[0_18px_50px_-12px_rgba(4,35,48,0.35)] ring-1 ring-black/5"
          : "w-[min(640px,calc(100vw-2rem))] p-6",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-start justify-between gap-4",
          hero ? "px-6 pt-5" : "mb-4",
        )}
      >
        <div>
          <p
            className={cn(
              "font-medium",
              hero ? "text-base text-ink" : "text-lg font-semibold text-page-fg",
            )}
          >
            {nights > 0 ? pluralize(nights, "night") : headline(range, hero)}
          </p>
          {!hero ? (
            <p className="text-sm text-page-fg-70">
              {range?.from && range?.to
                ? formatDateRange(range.from, range.to)
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

      {/*
        `relative` matters: the shared Calendar positions its month nav
        `absolute inset-x-0 top-1`, and without a positioned root here the
        arrows escape to the header row above and land ~95px from the months
        they actually page.
      */}
      <div className="relative">
        <Calendar
          mode="range"
          month={month}
          onMonthChange={setMonth}
          numberOfMonths={2}
          disabled={disabledDays}
          selected={range}
          onSelect={onChange}
          className={cn(
            hero
              ? // The panel is white in both themes, so the selection cannot
                // take the theme-following accent without inverting under it.
                "px-4 pb-1 pt-3 [--rdp-accent-color:var(--color-ink)]"
              : "p-0",
          )}
          classNames={hero ? { months: "flex flex-col sm:flex-row gap-6" } : undefined}
        />
      </div>

      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          hero
            ? "border-t border-black/5 px-6 py-4"
            : "mt-4 justify-end border-t border-input pt-4",
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

function headline(range: DateRange | undefined, hero: boolean): string {
  if (!range?.from) return hero ? "Pick your dates" : "Select dates";
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
