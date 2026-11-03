/**
 * Formatting for the operator surface. Kigali time, RWF money, tabular dates.
 *
 * The demo dataset models dates as day offsets from today (see data/types.ts),
 * so these helpers take an offset. When the API lands they take a Date; the
 * call sites read the same either way.
 */

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY_MS = 864e5;

export const TIMEZONE = "Africa/Kigali";

/** `RWF 45,000` — the platform money format (ui-tokens.md). */
export function fmt(n: number): string {
  return "RWF " + Math.round(n).toLocaleString("en-US");
}

function dateAt(offset: number): Date {
  return new Date(Date.now() + offset * DAY_MS);
}

/** `Sat 04 Jul` */
export function ds(offset: number): string {
  const d = dateAt(offset);
  return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]}`;
}

/** `04 Jul` */
export function dshort(offset: number): string {
  const d = dateAt(offset);
  return `${String(d.getDate()).padStart(2, "0")} ${MON[d.getMonth()]}`;
}

/** `04 Jul – 07 Jul` — a stay's span. */
export function dateRange(start: number, nights: number): string {
  return `${dshort(start)} – ${dshort(start + nights)}`;
}

/**
 * The same span from two real `YYYY-MM-DD` dates, as the API sends them.
 *
 * Parsed as UTC midnight rather than handed to `new Date("2026-08-27")` in
 * local time, because in Kigali (UTC+2) the local reading of a bare date is the
 * same day, but on a machine west of UTC it is the day BEFORE — and a booking
 * that shows the wrong arrival date on a developer's laptop is the kind of bug
 * that gets explained away as "just the demo".
 */
export function dateRangeIso(checkIn: string, checkOut: string): string {
  return `${dshortIso(checkIn)} – ${dshortIso(checkOut)}`;
}

/** `04 Jul` from `YYYY-MM-DD`. Returns the input unchanged if it is not one. */
export function dshortIso(iso: string): string {
  /*
   * Accepts a bare date OR a full timestamp, and that second half was missing.
   *
   * It used to append `T00:00:00Z` unconditionally, which turns a timestamp
   * into `2026-09-05T06:46:11.725ZT00:00:00Z` — unparseable — and the guard
   * below then returned the RAW STRING. So every caller passing a timestamp
   * rendered a machine readable ISO date on screen instead of "05 Sep", and
   * nothing failed loudly enough to notice: the fallback is silent by design,
   * because a date it cannot read is better shown than swallowed.
   *
   * The operator screens wired in ADR-035 waves 1 and 2 pass both kinds —
   * `businessDate` is a bare date, `postedAt`, `createdAt`, `heldAt` and
   * `joinedAt` are timestamps — so taking the first ten characters is what lets
   * one helper serve both rather than two that can drift.
   */
  const day = iso.slice(0, 10);
  const ms = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(ms)) return iso;
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MON[d.getUTCMonth()]}`;
}

/** Today in Kigali as `YYYY-MM-DD`, to compare against a bare date column. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());
}

/**
 * The Kigali calendar day an instant falls on, as `YYYY-MM-DD`.
 *
 * For a TIMESTAMP (`entryAt`, `actualExitAt`), never a bare date. Slicing the
 * ISO string instead would read the UTC day, and a guest who checked in at
 * 01:00 Kigali would be drawn arriving the evening before.
 */
export function kigaliDateOf(timestamp: string): string {
  const ms = Date.parse(timestamp);
  if (Number.isNaN(ms)) return timestamp.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date(ms));
}

/** `YYYY-MM-DD` plus `days`, in calendar days. UTC arithmetic, so no DST drift. */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS);
  return d.toISOString().slice(0, 10);
}

/** Calendar days from `a` to `b`; negative when `b` is earlier. */
export function daysBetweenIso(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** What a date column header prints: weekday, day of month, month, weekend. */
export function dayPartsIso(iso: string): { wd: string; dd: string; mon: string; weekend: boolean } {
  const d = new Date(Date.parse(`${iso}T00:00:00Z`));
  const day = d.getUTCDay();
  return {
    wd: DOW[day],
    dd: String(d.getUTCDate()).padStart(2, "0"),
    mon: MON[d.getUTCMonth()],
    weekend: day === 0 || day === 6,
  };
}

export function weekday(offset: number): string {
  return DOW[dateAt(offset).getDay()];
}

export function monthShort(offset: number): string {
  return MON[dateAt(offset).getMonth()];
}

export function isWeekend(offset: number): boolean {
  const day = dateAt(offset).getDay();
  return day === 0 || day === 6;
}

/** Two-letter initials for an avatar. */
export function initials(name: string): string {
  return String(name)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Pluralise a count of nights: `1 night`, `3 nights`. */
export function nights(n: number): string {
  return `${n} night${n === 1 ? "" : "s"}`;
}

/** Digits out of a typed amount ("45,000" → 45000). Returns 0 if none. */
export function parseAmount(v: string | number): number {
  return parseInt(String(v).replace(/\D/g, ""), 10) || 0;
}
