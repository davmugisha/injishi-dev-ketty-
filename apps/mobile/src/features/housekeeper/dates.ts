// Calendar days for the schedule and leave screens, as `YYYY-MM-DD` and whole day numbers (days since
// 1 Jan 1970). Plain arithmetic on UTC midnights, so a phone's time zone never moves a day.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-12-14` is day 20801. */
export function dayNumber(iso: string): number {
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

export function isoOf(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** "Mon 14 Dec". */
export function shortDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Monday to Friday from `from` to `to`, both included; 0 when `to` is before `from`. */
export function workingDays(from: string, to: string): number {
  let count = 0;
  for (let day = dayNumber(from); day <= dayNumber(to); day++) {
    const weekday = new Date(day * DAY_MS).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
}
