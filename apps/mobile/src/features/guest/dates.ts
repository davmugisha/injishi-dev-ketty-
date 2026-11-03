// Calendar days for the guest's booking flow: the dates sheet's month grid, and the words a stay's
// dates are written in ("Wed 14 – Fri 16 Oct"). A day is a calendar day (`yyyy-mm-dd`), never an
// instant, so everything here runs in UTC and no time zone shifts it. Pure: no React Native import.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86_400_000;

function toDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The day `n` days after (or before) `iso`. */
export function addDays(iso: string, n: number): string {
  return toIso(new Date(toDate(iso).getTime() + n * DAY_MS));
}

/** Nights from check-in to check-out; days from one day to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

/** "Wed", "Wednesday". */
export function weekday(iso: string, long = false): string {
  const day = toDate(iso).getUTCDay();
  return (long ? WEEKDAYS_LONG : WEEKDAYS)[day] ?? "";
}

/** "7 Oct". */
export function dayMonth(iso: string): string {
  const date = toDate(iso);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

/** "Wed 7 Oct". */
export function dayWords(iso: string): string {
  return `${weekday(iso)} ${dayMonth(iso)}`;
}

/** "Wed 14 – Fri 16 Oct", or "Fri 30 Oct – Sun 1 Nov" across a month. */
export function rangeWords(checkIn: string, checkOut: string): string {
  const sameMonth = checkIn.slice(0, 7) === checkOut.slice(0, 7);
  const first = sameMonth ? `${weekday(checkIn)} ${toDate(checkIn).getUTCDate()}` : dayWords(checkIn);
  return `${first} – ${dayWords(checkOut)}`;
}

/** "14–16 Oct", or "30 Oct–1 Nov" across a month. */
export function shortRange(checkIn: string, checkOut: string): string {
  const sameMonth = checkIn.slice(0, 7) === checkOut.slice(0, 7);
  return sameMonth
    ? `${toDate(checkIn).getUTCDate()}–${dayMonth(checkOut)}`
    : `${dayMonth(checkIn)}–${dayMonth(checkOut)}`;
}

/** "1 night", "2 nights". */
export function nightsWords(nights: number): string {
  return nights === 1 ? "1 night" : `${nights} nights`;
}

/** "In 2 days", "Tomorrow", "Today": how far a check-in is from `today`. */
export function countdownWords(today: string, checkIn: string): string {
  const days = daysBetween(today, checkIn);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

/** A month to draw: its first day and its name ("October 2026"). */
export interface Month {
  year: number;
  /** 0 for January. */
  month: number;
}

export function monthOf(iso: string): Month {
  const date = toDate(iso);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function shiftMonth({ year, month }: Month, by: number): Month {
  const index = year * 12 + month + by;
  return { year: Math.floor(index / 12), month: index % 12 };
}

export function monthWords({ year, month }: Month): string {
  return `${MONTHS_LONG[month]} ${year}`;
}

/** "Wednesday 14 October": a calendar day read aloud, or a header's eyebrow. */
export function dayLong(iso: string): string {
  const date = toDate(iso);
  return `${weekday(iso, true)} ${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]}`;
}

/**
 * The month's weeks, Monday first: each a row of seven, a day's `yyyy-mm-dd` or null for a blank
 * before the first or after the last (October 2026 starts on a Thursday: three blanks).
 */
export function monthWeeks({ year, month }: Month): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= length; d++) cells.push(toIso(new Date(Date.UTC(year, month, d))));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
