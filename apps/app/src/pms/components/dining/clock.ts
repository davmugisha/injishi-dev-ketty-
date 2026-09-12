/**
 * Wall-clock time for a dining timestamp, in Kigali.
 *
 * ABSOLUTE, NEVER RELATIVE, and that is the whole reason this exists. "6 min
 * ago" has to be computed from `Date.now()`, which differs between the server
 * render and the first client render of the same order and makes React discard
 * the tree — the exact defect the two demo stores are written to avoid. A clock
 * time is a pure function of the ISO string, so both sides produce "19:42" and
 * a runner reads the one thing they actually need off a ticket.
 *
 * `lib/format.ts` owns dates for the operator surface and has no time-of-day
 * helper; this is the dining screens' half rather than a second date format.
 */

const TIMEZONE = "Africa/Kigali";

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "short",
});

/** `19:42`. Returns an empty string for anything that is not a timestamp. */
export function kigaliTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return TIME.format(new Date(ms));
}

/** `08 Sep · 19:42` — the same instant when the day matters too. */
export function kigaliStamp(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const at = new Date(ms);
  return `${DAY.format(at)} · ${TIME.format(at)}`;
}
