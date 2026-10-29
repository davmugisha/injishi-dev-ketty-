// Kigali time on the phone (mobile spec 0003, D-ai). Rwanda is UTC plus 2 all year, with no daylight
// saving, so the day and the clock are plain arithmetic, whatever time zone the phone is set to.
// Pure: no React Native import, so `node --test` runs what uses it.

const KIGALI_OFFSET_MS = 2 * 3_600_000;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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

function kigaliClock(ms: number): Date {
  return new Date(ms + KIGALI_OFFSET_MS);
}

/** The Kigali date an instant falls on, `YYYY-MM-DD`. */
export function kigaliDate(ms: number): string {
  return kigaliClock(ms).toISOString().slice(0, 10);
}

/** `HH:MM` on the Kigali clock. */
export function kigaliTime(at: number | string): string {
  const ms = typeof at === "number" ? at : Date.parse(at);
  return kigaliClock(ms).toISOString().slice(11, 16);
}

/** "Thursday 29 October", for a day's heading. */
export function kigaliDayLabel(ms: number): string {
  const d = kigaliClock(ms);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "29 Oct", for a time that was not today. */
export function kigaliShortDate(at: number | string): string {
  const d = kigaliClock(typeof at === "number" ? at : Date.parse(at));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}`;
}

/** The date `days` after a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The hour on the Kigali clock, 0 to 23. */
export function kigaliHour(ms: number): number {
  return kigaliClock(ms).getUTCHours();
}
