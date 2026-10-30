/**
 * Calendar words for the HR screens, from a real Kigali day ("2026-10-15") the page hands down. They
 * replace the prototype's fixed Monday 12 October: weekday names, the days of a roster week and the
 * leave calendar's three weeks all start from today.
 */

const WEEKDAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTH = [
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

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday 0. */
export function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
}

const dayNo = (iso: string) => Number(iso.slice(8, 10));
const month = (iso: string) => MONTH[Number(iso.slice(5, 7)) - 1];

/** "Thu" */
export const weekdayShort = (iso: string) => WEEKDAY[weekdayIndex(iso)].slice(0, 3);
/** "Thursday" */
export const weekdayLong = (iso: string) => WEEKDAY[weekdayIndex(iso)];
/** "Thu 15" */
export const shortDay = (iso: string) => `${weekdayShort(iso)} ${dayNo(iso)}`;
/** "Thursday 15 October" */
export const longDay = (iso: string) => `${weekdayLong(iso)} ${dayNo(iso)} ${month(iso)}`;
/** "Thursday 15 October 2026" */
export const fullDay = (iso: string) => `${longDay(iso)} ${iso.slice(0, 4)}`;
/** "15 Oct 2026" */
export const dayMonthYear = (iso: string) => `${dayNo(iso)} ${month(iso).slice(0, 3)} ${iso.slice(0, 4)}`;
/** "October" */
export const monthLong = (iso: string) => month(iso);
/** "15" */
export const dayOfMonth = (iso: string) => String(dayNo(iso));

/** "15–21 Oct", or "29 Oct – 4 Nov" across months. */
export function rangeShort(from: string, to: string): string {
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${dayNo(from)}–${dayNo(to)} ${month(to).slice(0, 3)}`
    : `${dayNo(from)} ${month(from).slice(0, 3)} – ${dayNo(to)} ${month(to).slice(0, 3)}`;
}

/** "15 October – 4 November", or "15–21 October". */
export function rangeLong(from: string, to: string): string {
  return from.slice(0, 7) === to.slice(0, 7)
    ? `${dayNo(from)}–${dayNo(to)} ${month(to)}`
    : `${dayNo(from)} ${month(from)} – ${dayNo(to)} ${month(to)}`;
}
