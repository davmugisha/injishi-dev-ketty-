/**
 * Clock and calendar labels for a message, computed WITHOUT `Intl` and WITHOUT
 * the current time.
 *
 * Two hazards, and both have already broken screens in this app.
 *
 * 1. HYDRATION. The seeded conversation renders on the server and again on the
 *    first client paint. `toLocaleTimeString()` asks the RUNTIME for a locale
 *    and a zone, and Node's answer is not the browser's — so the same message
 *    came back "06:40" on the server and "8:40 AM" in the browser and React
 *    threw the thread away and rebuilt it. Everything below is arithmetic on
 *    the ISO string, so both sides produce the same characters.
 *
 * 2. `Date.now()`. A "Today"/"Yesterday" separator has to know what day it is,
 *    which is a value that differs between the render on the server and the
 *    render in the browser and changes under the reader at midnight. So a day
 *    separator here names the DATE — "Tuesday 8 September 2026" — derived from
 *    the message's own timestamp and nothing else.
 *
 * TIME ZONE. Every timestamp in the store is UTC (`toISOString`, and the seeded
 * literals end in `Z`), and every reader of this demo is in Rwanda. Central
 * Africa Time is UTC+02:00 all year — Rwanda has never observed daylight saving
 * — so the shift is a constant rather than a lookup, which is exactly why it can
 * be done without `Intl` at all.
 */

/** Central Africa Time, in minutes. No DST: see the note above. */
const KIGALI_OFFSET_MINUTES = 120;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The instant, shifted so the UTC getters read as Kigali wall-clock time.
 *
 * Returns null for anything unparseable rather than an Invalid Date, because a
 * corrupted timestamp in `localStorage` must degrade to "no time shown" and
 * never to "NaN:NaN" beside a message.
 */
function kigaliClock(iso: string): Date | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + KIGALI_OFFSET_MINUTES * 60_000);
}

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** "06:40" — the time a message was sent, in Kigali, 24-hour. */
export function clockLabel(iso: string): string {
  const at = kigaliClock(iso);
  if (at === null) return "";
  return `${pad2(at.getUTCHours())}:${pad2(at.getUTCMinutes())}`;
}

/**
 * "2026-09-08" — the calendar day, used only to decide where a separator goes.
 *
 * Never rendered. It exists so grouping compares two strings instead of two
 * dates, which is the comparison that cannot go wrong across a zone boundary.
 */
export function dayKey(iso: string): string {
  const at = kigaliClock(iso);
  if (at === null) return "";
  return `${at.getUTCFullYear()}-${pad2(at.getUTCMonth() + 1)}-${pad2(at.getUTCDate())}`;
}

/** "Tuesday 8 September 2026" — the day separator a reader actually sees. */
export function dayLabel(iso: string): string {
  const at = kigaliClock(iso);
  if (at === null) return "";
  return `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
}
