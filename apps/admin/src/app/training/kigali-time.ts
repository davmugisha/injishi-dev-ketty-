/**
 * Session times in Kigali, for the Training screens (ADR-049).
 *
 * THE ZONE IS NAMED, never left to the browser or the server. A staffer opening
 * the console from outside Rwanda must read and type the time a session starts
 * for the people attending it, and the admin server's own zone is whatever the
 * container was built with. Rwanda keeps UTC+2 all year, and the server action
 * turns a typed time back into an instant with that same offset
 * (`kigaliInstant` in `lib/actions/training.ts`).
 */

const KIGALI = "Africa/Kigali";

/** "Mon 15 Sep 2026, 09:00", Kigali time. */
export function formatKigali(iso: string): string {
  return new Intl.DateTimeFormat("en-RW", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: KIGALI,
  }).format(new Date(iso));
}

/**
 * An instant as the value a `datetime-local` field takes, read in Kigali:
 * `2026-09-15T07:00:00Z` becomes `2026-09-15T09:00`.
 */
export function kigaliLocalValue(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: KIGALI,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
