import type { DateRange, Matcher } from "react-day-picker";
import { MAX_HORIZON_DAYS, MAX_NIGHTS } from "@injishi/contracts";
import { toISODate } from "@injishi/utils";
import type { BookingCalendar } from "@/data/availability";

/**
 * The rules of the stay date picker, with no React in them.
 *
 * `StayDatePicker` used to hand react-day-picker its `mode="range"` defaults
 * and a single `disabled` list, which gave a guest the library's idea of a
 * range rather than a hotel's:
 *
 *  - a third click EXTENDED a finished range instead of starting a new one, so
 *    "actually, the week after" meant clearing first;
 *  - a sold-out night was refused as a CHECK-OUT day, although a guest who
 *    leaves that morning never sleeps it, and the nights past it — which no
 *    stay starting here can reach — were still offered;
 *  - a stay shorter than the room's minimum, or longer than the platform's
 *    cap, was offered and refused later by `rangeProblem`.
 *
 * Every rule here is pure and takes `today` as an argument, so the unit tests
 * in `tests/stay-range.test.mjs` run the real code on a fixed calendar. The
 * caps come from `@injishi/contracts`, the same constants the API refuses on.
 */

/** Which end of the range the next click decides. */
export type Phase = "check-in" | "check-out";

export function phaseOf(range: DateRange | undefined): Phase {
  return range?.from && !range.to ? "check-out" : "check-in";
}

/** Local midnight `days` from `date`; month and year roll over. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** A comparable number for a calendar day, ignoring the time of day. */
function dayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/** `yyyy-mm-dd` as a local calendar day, the way the picker holds dates. */
function fromISO(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/**
 * What one click does to the range.
 *
 * With nothing chosen, or with a finished range, the click is a new check-in.
 * With only a check-in, a later day closes the range and an earlier one — or
 * the same one — moves the check-in there. This is how every stay site a
 * guest has used behaves, and it means no click ever needs a Clear first.
 */
export function nextRange(range: DateRange | undefined, day: Date): DateRange {
  if (phaseOf(range) === "check-in") return { from: day };
  const from = range?.from as Date;
  return dayNumber(day) <= dayNumber(from) ? { from: day } : { from, to: day };
}

/**
 * The last night that can be booked. The room's calendar says so when the
 * caller has one; otherwise the platform horizon from today.
 */
export function lastBookableNight(today: Date, calendar: BookingCalendar | null): Date {
  return calendar ? fromISO(calendar.lastBookableNight) : addDays(today, MAX_HORIZON_DAYS);
}

interface CheckoutWindow {
  /** The first day a guest may leave: check-in plus the minimum stay. */
  earliest: Date;
  /**
   * The last day a guest may leave. The morning after the last bookable
   * night, the 90-night cap, or the first sold-out night on or after the
   * check-in — a guest may leave ON that morning, because leaving does not
   * sleep it, but no stay starting here can reach past it.
   */
  latest: Date;
}

export function checkoutWindow(
  from: Date,
  today: Date,
  calendar: BookingCalendar | null,
): CheckoutWindow {
  const minStay = Math.max(1, calendar?.minStay ?? 1);
  const earliest = addDays(from, minStay);

  let latest = addDays(lastBookableNight(today, calendar), 1);
  const cap = addDays(from, MAX_NIGHTS);
  if (dayNumber(cap) < dayNumber(latest)) latest = cap;

  if (calendar) {
    for (let night = from; dayNumber(night) < dayNumber(latest); night = addDays(night, 1)) {
      if (calendar.soldOut.has(toISODate(night))) {
        latest = night;
        break;
      }
    }
  }

  return { earliest, latest };
}

/**
 * The days the picker must not offer, for the click that comes next.
 *
 * Choosing a check-in: the past, anything past the horizon, every sold-out
 * night, and a night the minimum stay cannot be completed from. Choosing a
 * check-out: everything past the window above, the
 * days too close to the check-in for the minimum stay, and — because a day on
 * or before the check-in RESTARTS the selection there — a sold-out day on that
 * side, which would be an unbookable check-in.
 */
export function disabledDays(
  range: DateRange | undefined,
  today: Date,
  calendar: BookingCalendar | null,
): Matcher[] {
  const rules: Matcher[] = [{ before: today }];
  const soldOut = (day: Date) => calendar?.soldOut.has(toISODate(day)) ?? false;

  if (phaseOf(range) === "check-in") {
    rules.push({ after: lastBookableNight(today, calendar) });
    if (calendar) {
      rules.push(soldOut);
      // A night no stay can be completed from: the minimum stay runs into a
      // sold-out night or the horizon, so the earliest check-out falls after
      // the latest. Offering it left every later day greyed out once clicked,
      // and the guest needing Clear — the one thing this module promises not
      // to ask for. Without a calendar the window is never empty.
      rules.push((day: Date) => {
        const { earliest, latest } = checkoutWindow(day, today, calendar);
        return dayNumber(earliest) > dayNumber(latest);
      });
    }
    return rules;
  }

  const from = range?.from as Date;
  const { earliest, latest } = checkoutWindow(from, today, calendar);
  rules.push({ after: latest });
  // `{ after, before }` is exclusive at both ends: the days strictly between
  // the check-in and the earliest check-out, which is empty for a one-night
  // minimum and so is only added when it holds something.
  if (dayNumber(earliest) > dayNumber(addDays(from, 1))) {
    rules.push({ after: from, before: earliest });
  }
  if (calendar) rules.push((day: Date) => dayNumber(day) <= dayNumber(from) && soldOut(day));
  return rules;
}

/** The three modifiers the hover preview paints with, keyed as the picker names them. */
type PreviewModifiers = Partial<
  Record<"preview" | "preview_start" | "preview_end", Matcher>
>;

/**
 * The nights a guest would get if they clicked the day under the pointer.
 *
 * Only while a check-out is being chosen and only for a day after the
 * check-in; anything else previews nothing, because clicking it would restart
 * the selection rather than close it.
 */
export function previewModifiers(
  range: DateRange | undefined,
  hovered: Date | null,
): PreviewModifiers {
  if (!hovered || phaseOf(range) !== "check-out") return {};
  const from = range?.from as Date;
  if (dayNumber(hovered) <= dayNumber(from)) return {};
  return {
    preview_start: from,
    preview: { after: from, before: hovered },
    preview_end: hovered,
  };
}
