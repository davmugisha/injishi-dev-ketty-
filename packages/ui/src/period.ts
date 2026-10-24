/**
 * Periods, months and years on Kigali calendar days (`yyyy-mm-dd`), as plain functions: the pickers in
 * `date-pickers.tsx` use them and `tests/period.test.ts` checks them without a browser. Days are calendar
 * days, never instants, so nothing here depends on the viewer's time zone.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function utc(day: string): number {
  return Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
}

function dayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isDay(value: unknown): value is string {
  return typeof value === "string" && DAY.test(value) && dayOf(utc(value)) === value;
}

export function isMonth(value: unknown): value is string {
  return (
    typeof value === "string" && MONTH.test(value) && Number(value.slice(5, 7)) >= 1 && Number(value.slice(5, 7)) <= 12
  );
}

/** `day` plus `n` days (negative goes back). */
export function addDays(day: string, n: number): string {
  return dayOf(utc(day) + n * MS_PER_DAY);
}

/** Whole days from `from` to `to`: 1 when `to` is the next day. */
export function dayDiff(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / MS_PER_DAY);
}

/** How many days a range covers, both ends counted: 1 Oct to 31 Oct is 31. */
export function daysInRange(start: string, end: string): number {
  return dayDiff(start, end) + 1;
}

/** The month a day falls in, as `yyyy-mm`. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

/** `month` plus `n` months, as `yyyy-mm`. */
export function addMonths(month: string, n: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7)) - 1 + n;
  const at = new Date(Date.UTC(y, m, 1));
  return at.toISOString().slice(0, 7);
}

/** Months from `from` to `to` (`yyyy-mm`): 1 when `to` is the next month. */
export function monthDiff(from: string, to: string): number {
  return (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7));
}

export function firstDayOfMonth(month: string): string {
  return `${month}-01`;
}

export function lastDayOfMonth(month: string): string {
  return addDays(firstDayOfMonth(addMonths(month, 1)), -1);
}

/** The earlier of two days (or months: both compare as text). */
export function minOf(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxOf(a: string, b: string): string {
  return a >= b ? a : b;
}

/** `value` kept within `min`..`max` (either may be missing). Works for days and months alike. */
export function clampTo(value: string, min?: string | null, max?: string | null): string {
  let v = value;
  if (min && v < min) v = min;
  if (max && v > max) v = max;
  return v;
}

// --- Periods --------------------------------------------------------------------------------------

export type PeriodPresetId = "this_month" | "last_3_months" | "this_year" | "last_year";
export type PeriodPreset = PeriodPresetId | "custom";

/** A stretch of Kigali days, both ends included, and how it was chosen. */
export interface Period {
  preset: PeriodPreset;
  /** First day, `yyyy-mm-dd`. */
  start: string;
  /** Last day, `yyyy-mm-dd`, included. */
  end: string;
}

/** The presets, in the order the picker offers them. */
export const PERIOD_PRESETS: readonly { id: PeriodPresetId; label: string }[] = [
  { id: "this_month", label: "This month" },
  { id: "last_3_months", label: "Last 3 months" },
  { id: "this_year", label: "This year" },
  { id: "last_year", label: "Last year" },
];

/**
 * A preset as days. Presets are whole calendar periods, so figures for "this month" include rent due
 * later in the month: this month is the 1st to the last day; last 3 months is this month and the two
 * before it; this year is 1 January to 31 December; last year is the year before.
 */
export function presetPeriod(preset: PeriodPresetId, today: string): Period {
  const month = monthOf(today);
  const year = Number(today.slice(0, 4));
  switch (preset) {
    case "this_month":
      return { preset, start: firstDayOfMonth(month), end: lastDayOfMonth(month) };
    case "last_3_months":
      return { preset, start: firstDayOfMonth(addMonths(month, -2)), end: lastDayOfMonth(month) };
    case "this_year":
      return { preset, start: `${year}-01-01`, end: `${year}-12-31` };
    case "last_year":
      return { preset, start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
  }
}

/**
 * The period a pair of days stands for: the preset whose days they are, else a custom range. For reading a
 * period back from the address bar (`?from=2026-10-01&to=2026-10-31` is "This month").
 */
export function periodFromRange(start: string, end: string, today: string): Period {
  for (const { id } of PERIOD_PRESETS) {
    const p = presetPeriod(id, today);
    if (p.start === start && p.end === end) return p;
  }
  return { preset: "custom", start, end };
}

/** Why a custom range can't be used, as a code the picker words; null when it can. */
export type RangeProblem =
  | { code: "order" }
  | { code: "future"; latest: string }
  | { code: "too_early"; earliest: string }
  | { code: "too_long"; maxDays: number };

export interface RangeRules {
  /** The Kigali day today (the server's, so the server and the browser agree). */
  today: string;
  /** Allow days after today. @default false */
  allowFuture?: boolean;
  /** The earliest day allowed (an account's first day, a lease start). */
  minDay?: string | null;
  /** The latest day allowed; with `allowFuture` off, today wins when it is earlier. */
  maxDay?: string | null;
  /** The most days a range may cover, both ends counted. */
  maxDays?: number | null;
}

/** The latest day a range may reach under `rules`. */
export function latestDay(rules: RangeRules): string | null {
  const cap = rules.allowFuture ? null : rules.today;
  if (cap && rules.maxDay) return minOf(cap, rules.maxDay);
  return cap ?? rules.maxDay ?? null;
}

export function rangeProblem(start: string, end: string, rules: RangeRules): RangeProblem | null {
  if (end < start) return { code: "order" };
  const latest = latestDay(rules);
  if (latest && end > latest) return { code: "future", latest };
  if (rules.minDay && start < rules.minDay) return { code: "too_early", earliest: rules.minDay };
  if (rules.maxDays && daysInRange(start, end) > rules.maxDays) return { code: "too_long", maxDays: rules.maxDays };
  return null;
}

/**
 * While a range is being picked (its first day chosen, `anchor`), whether `day` may end it: within
 * `maxDays` of the anchor, either side. Days outside are shown unavailable, so a too long range can't be
 * picked at all.
 */
export function withinSpan(day: string, anchor: string, maxDays: number): boolean {
  return Math.abs(dayDiff(anchor, day)) < maxDays;
}
