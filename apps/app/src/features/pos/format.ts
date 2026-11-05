import { formatRwf } from "@injishi/ui";

/**
 * Number and date text for the POS screens that render on the server. `shared.tsx` is a client module, so a
 * server component cannot call the functions it exports; these are the same figures, callable anywhere.
 */

/** "RWF 14,000" (whole francs). */
export const rwf = (n: number) => formatRwf(Math.round(n));

/** RWF with a minus sign for a loss. */
export const rwfSigned = (n: number) => (n < 0 ? `-${rwf(Math.abs(n))}` : rwf(n));

/** "5 Nov" for a `YYYY-MM-DD` day. */
export function shortDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** "Thu 5 Nov" for a `YYYY-MM-DD` day. */
export function longDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** Today's date in Kigali as `YYYY-MM-DD`. */
export function kigaliToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kigali" }).format(now);
}

/** The day `n` days after `day` (negative for before). */
export function addDays(day: string, n: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}

/** "14:05" in Kigali. */
export const kigaliClock = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kigali", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
