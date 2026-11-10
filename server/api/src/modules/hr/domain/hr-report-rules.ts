import { addDays, eachDate } from './hr-calendar';

/**
 * The HR report's small rules, pure (058, HR reports): how much of a leave
 * request falls in a period, the day of the week a date is, and the months a
 * pay trend covers.
 */

/** Calendar days from `from` to `to`, both included. */
function spanDays(from: string, to: string): number {
  return eachDate(from, to).length;
}

/**
 * The part of a leave request inside a period. A request wholly inside counts
 * its days as they were counted when it was asked; one that runs over an edge
 * counts its share of them by calendar days, to the nearest half day.
 */
export function leaveDaysInPeriod(request: { startsOn: string; endsOn: string; days: number }, from: string, to: string): number {
  const start = request.startsOn > from ? request.startsOn : from;
  const end = request.endsOn < to ? request.endsOn : to;
  if (end < start) return 0;
  const whole = spanDays(request.startsOn, request.endsOn);
  const inside = spanDays(start, end);
  if (inside >= whole) return request.days;
  return Math.round(((request.days * inside) / whole) * 2) / 2;
}

/** 0 for Monday to 6 for Sunday. */
export function weekdayOf(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The `count` months ending with `month` ("2026-10"), oldest first. */
export function monthsTo(month: string, count: number): string[] {
  const out: string[] = [];
  let [y, m] = month.split('-').map(Number);
  for (let i = 0; i < count; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/** The instant a Kigali date starts (UTC+2 all year). */
export function kigaliStart(date: string): Date {
  return new Date(`${date}T00:00:00+02:00`);
}

/** The instant after a Kigali date ends. */
export function kigaliEnd(date: string): Date {
  return kigaliStart(addDays(date, 1));
}
