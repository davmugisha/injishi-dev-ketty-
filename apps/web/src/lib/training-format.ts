/**
 * Dates for the training surfaces, in the market's own clock.
 *
 * WHY NOT `@injishi/utils`. That package owns `formatMarketDateTime`, which
 * gives "11 Sep, 03:00" and carries no year. A training session is published
 * weeks or months ahead, so the year is load bearing here in a way it is not
 * for a message timestamp or a check-in: "15 Sep, 09:00" for a session eleven
 * months out is a date somebody will read as next week. Rather than widen a
 * shared formatter for one surface, these two live beside the surface that
 * needs them.
 *
 * Both render in `Africa/Kigali` for the reason `@injishi/utils` records: a web
 * container runs on UTC, so the local zone would print a 09:00 Kigali start as
 * 07:00. Rwanda keeps no daylight saving, so this is always UTC+2.
 */
const MARKET_TIME_ZONE = "Africa/Kigali";
const LOCALE = "en-RW";

const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: MARKET_TIME_ZONE,
});

const dateAndTime = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: MARKET_TIME_ZONE,
});

/**
 * "Mon 15 Sep 2026" from either an ISO instant or a plain `YYYY-MM-DD`.
 *
 * A certificate's `sessionDate` is a DATE, not an instant, and parsing
 * `2026-09-15` with `new Date` yields midnight UTC, which is 02:00 in Kigali
 * and therefore still the 15th. Appending a midday time removes any doubt about
 * that for a reader of this code, and costs nothing.
 */
export function formatSessionDate(value: string): string {
  const instant = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : new Date(value);
  if (Number.isNaN(instant.getTime())) return value;
  return dateOnly.format(instant);
}

/** "Mon 15 Sep 2026, 09:00" for a session start, which has a time that matters. */
export function formatSessionWhen(value: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return value;
  return dateAndTime.format(instant);
}
