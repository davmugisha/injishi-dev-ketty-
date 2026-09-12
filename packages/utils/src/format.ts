/** Presentation helpers. Locale is fixed to the market the client serves. */

const LOCALE = "en-RW";

/**
 * Whole francs, grouped: 175000 → "RWF 175,000".
 *
 * The prefix is written literally rather than through `Intl`'s currency style,
 * whose RWF symbol renders as "RF" in several locales. The design and the
 * specs both use "RWF".
 */
const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPrice(amount: number, currency: "RWF" | "USD" = "RWF"): string {
  if (currency === "USD") return usd.format(amount);
  return `RWF ${wholeNumber.format(Math.round(amount))}`;
}

const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });

/** "12 Mar" — the form the listing cards and booking widget use. */
export function formatDayMonth(date: Date): string {
  return dayMonth.format(date);
}

/**
 * The market's own clock. An INSTANT (a reset, a sent message) is shown in
 * Kigali time whatever zone the server or the phone rendering it is in; a web
 * container runs on UTC, so the local zone would print the demo's 03:00 reset
 * as 01:00. Rwanda keeps no daylight saving, so this is always UTC+2.
 */
const MARKET_TIME_ZONE = "Africa/Kigali";

const dayMonthTime = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: MARKET_TIME_ZONE,
});

/** "11 Sep, 03:00", an instant in Kigali time. */
export function formatMarketDateTime(date: Date): string {
  return dayMonthTime.format(date);
}

/** "12 – 18 Mar" when the months match, "28 Feb – 3 Mar" when they do not. */
export function formatDateRange(from: Date, to: Date): string {
  const sameMonth =
    from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  if (sameMonth) {
    return `${from.getDate()} – ${dayMonth.format(to)}`;
  }
  return `${dayMonth.format(from)} – ${dayMonth.format(to)}`;
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Local calendar day as yyyy-mm-dd.
 *
 * Built from the local getters rather than `toISOString`, which converts to UTC
 * first and so reports the previous day for any evening east of Greenwich —
 * Kigali is UTC+2, so a 9pm check-in date would book the night before.
 */
export function toISODate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Whole nights between two dates, ignoring time of day. */
export function nightsBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 86_400_000;
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}
