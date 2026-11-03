/**
 * The period a dashboard shows (2026-10-28): this month day by day, or months back from this one, this
 * calendar year, or last calendar year. Every figure, chart and download on the page reads the same one.
 * Kigali days as `YYYY-MM-DD`; no clock, so a test can pass any `today`.
 */
export type DashboardPeriod = "this_month" | "last_3" | "last_6" | "last_12" | "this_year" | "last_year";

export const DASHBOARD_PERIODS: readonly { id: DashboardPeriod; label: string }[] = [
  { id: "this_month", label: "This month" },
  { id: "last_3", label: "Last 3 months" },
  { id: "last_6", label: "Last 6 months" },
  { id: "last_12", label: "Last 12 months" },
  { id: "this_year", label: "This year" },
  { id: "last_year", label: "Last year" },
];

export function isDashboardPeriod(v: unknown): v is DashboardPeriod {
  return typeof v === "string" && DASHBOARD_PERIODS.some((p) => p.id === v);
}

export interface PeriodBucket {
  /** `YYYY-MM-DD` for a day, `YYYY-MM` for a month. */
  key: string;
  /** On the axis: "5" or "Oct". */
  label: string;
  /** In the tooltip and the table: "5 October 2026" or "October 2026". */
  long: string;
  from: string;
  to: string;
}

export interface PeriodRange {
  period: DashboardPeriod;
  unit: "day" | "month";
  from: string;
  to: string;
  buckets: PeriodBucket[];
  /** "October 2026", "the last 6 months", "2025". */
  words: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const monthKey = (index: number) => `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const SHORT = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const at = (day: string) => new Date(`${day}T12:00:00Z`);

function monthBucket(index: number): PeriodBucket {
  const key = monthKey(index);
  const [y, m] = key.split("-").map(Number) as [number, number];
  return {
    key,
    label: SHORT.format(at(`${key}-15`)),
    long: LONG.format(at(`${key}-15`)),
    from: `${key}-01`,
    to: `${key}-${pad(daysIn(y, m))}`,
  };
}

/** The days or months a period covers, oldest first, ending on the month `today` is in (or last December). */
export function periodRange(period: DashboardPeriod, today: string): PeriodRange {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const now = y * 12 + (m - 1);
  if (period === "this_month") {
    const key = today.slice(0, 7);
    const buckets: PeriodBucket[] = [];
    for (let d = 1; d <= daysIn(y, m); d++) {
      const day = `${key}-${pad(d)}`;
      buckets.push({ key: day, label: String(d), long: DAY_LONG.format(at(day)), from: day, to: day });
    }
    return {
      period,
      unit: "day",
      from: buckets[0]!.from,
      to: buckets.at(-1)!.to,
      buckets,
      words: LONG.format(at(today)),
    };
  }
  let first: number;
  let last = now;
  let words: string;
  if (period === "this_year") {
    first = y * 12;
    words = String(y);
  } else if (period === "last_year") {
    first = (y - 1) * 12;
    last = (y - 1) * 12 + 11;
    words = String(y - 1);
  } else {
    const n = period === "last_3" ? 3 : period === "last_6" ? 6 : 12;
    first = now - n + 1;
    words = `the last ${n} months`;
  }
  const buckets: PeriodBucket[] = [];
  for (let i = first; i <= last; i++) buckets.push(monthBucket(i));
  return { period, unit: "month", from: buckets[0]!.from, to: buckets.at(-1)!.to, buckets, words };
}

/** Sum amounts into the period's buckets by each item's day; items outside the period are left out. */
export function sumByBucket<T>(
  range: PeriodRange,
  items: readonly T[],
  dayOf: (item: T) => string | null | undefined,
  amountOf: (item: T) => number,
): number[] {
  const index = new Map(range.buckets.map((b, i) => [b.key, i]));
  const out = range.buckets.map(() => 0);
  for (const item of items) {
    const day = dayOf(item);
    if (!day || day < range.from || day > range.to) continue;
    const i = index.get(range.unit === "day" ? day.slice(0, 10) : day.slice(0, 7));
    if (i !== undefined) out[i] = (out[i] ?? 0) + amountOf(item);
  }
  return out;
}
