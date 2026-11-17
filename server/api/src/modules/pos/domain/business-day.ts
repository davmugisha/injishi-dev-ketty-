/**
 * The business day of a bar or restaurant. A venue that closes at 03:00 does not want a sale at 01:30 counted in
 * "tomorrow": it sets the start of its business day (`business_day_start_minutes`, minutes after midnight in Kigali,
 * 0 to 719) and a day then runs from that time to the same time the next day. 0 is the calendar day, the behaviour
 * before the setting existed, so every outlet that has not set it reads exactly as it did.
 *
 * Kigali is UTC+2 all year (no daylight saving), so a Kigali day is [00:00, 24:00) at +02:00 and every business
 * day is exactly 24 hours long.
 */

const KIGALI = 'Africa/Kigali';
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

/** The largest start a business day may have: 11:59 (a day must start before noon). */
export const MAX_BUSINESS_DAY_START = 719;

/** Kigali calendar day of `at` as `YYYY-MM-DD`. */
export function kigaliDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: KIGALI }).format(at);
}

/** 00:00 in Kigali of a calendar day. */
export function dayStart(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00+02:00`);
}

/** The calendar day `n` days after `isoDay` (negative goes back). */
export function addDays(isoDay: string, n: number): string {
  // An hour past midnight keeps the arithmetic clear of the day boundary.
  return kigaliDay(new Date(dayStart(isoDay).getTime() + n * DAY_MS + 3_600_000));
}

function checkStart(startMinutes: number): number {
  if (!Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes > MAX_BUSINESS_DAY_START) {
    throw new RangeError(`A business day starts 0 to ${MAX_BUSINESS_DAY_START} minutes after midnight, not ${startMinutes}.`);
  }
  return startMinutes;
}

/** The business day `at` falls in: the calendar day of `at` moved back by the start. */
export function businessDayOf(at: Date, startMinutes: number): string {
  return kigaliDay(new Date(at.getTime() - checkStart(startMinutes) * MINUTE_MS));
}

/** The instants a run of business days covers, `from` to `to` both included: [start, end). */
export function businessDayWindow(from: string, to: string, startMinutes: number): { start: Date; end: Date } {
  const shift = checkStart(startMinutes) * MINUTE_MS;
  return {
    start: new Date(dayStart(from).getTime() + shift),
    end: new Date(dayStart(addDays(to, 1)).getTime() + shift),
  };
}

/**
 * The start to use for a set of outlets read together. One outlet, or several that agree, use theirs; outlets that
 * disagree fall back to the calendar day and say so (`mixed`), so a report never silently picks one venue's hours.
 */
export function commonBusinessDayStart(starts: readonly number[]): { startMinutes: number; mixed: boolean } {
  const distinct = [...new Set(starts)];
  if (distinct.length === 0) return { startMinutes: 0, mixed: false };
  if (distinct.length === 1) return { startMinutes: checkStart(distinct[0] ?? 0), mixed: false };
  return { startMinutes: 0, mixed: true };
}

/** `240` -> `04:00`. */
export function formatDayStart(startMinutes: number): string {
  const m = checkStart(startMinutes);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
