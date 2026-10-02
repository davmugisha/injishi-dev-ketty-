import { localMidnight, localToday } from '../../booking/domain/pricing';

/**
 * Calendar arithmetic for the HR module (ADR-058, index contract 9).
 *
 * Every date here is a calendar date in `Africa/Kigali`, written `YYYY-MM-DD`.
 * "Today" and "the day an instant falls on" come from the booking domain's
 * `localToday`, the one reader of the property time zone, so a clock in at
 * 00:30 in Kigali lands on Kigali's date and not on UTC's yesterday.
 *
 * Arithmetic on dates is done at UTC noon of the date, which no offset can move
 * across a day boundary. Rwanda keeps no daylight saving, and nothing here
 * assumes it does not either.
 */

/** Today in Kigali. */
export function kigaliToday(now: Date = new Date()): string {
  return localToday(now);
}

/** The Kigali date an instant falls on. */
export function kigaliDateOf(at: Date): string {
  return localToday(at);
}

function noon(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = noon(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

/** Every date from `from` to `to`, both included. Empty when `to` is before `from`. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  return Math.round((noon(to).getTime() - noon(from).getTime()) / 86_400_000);
}

/** Monday to Friday. */
export function isWeekday(date: string): boolean {
  const day = noon(date).getUTCDay();
  return day !== 0 && day !== 6;
}

/** `YYYY-MM` of a date. */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** `YYYY` of a date. */
export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** The first day of a `YYYY-MM` period. */
export function firstOfMonth(period: string): string {
  return `${period}-01`;
}

export function daysInMonth(period: string): number {
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The last day of a `YYYY-MM` period. */
export function lastOfMonth(period: string): string {
  return `${period}-${String(daysInMonth(period)).padStart(2, '0')}`;
}

/** The period after `YYYY-MM`. */
export function nextMonth(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Every `YYYY-MM` from `from` to `to`, both included. */
export function eachMonth(from: string, to: string): string[] {
  const out: string[] = [];
  for (let p = from; p <= to; p = nextMonth(p)) out.push(p);
  return out;
}

/**
 * `HH:MM` or `HH:MM:SS` as minutes past midnight.
 */
export function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** `HH:MM:SS` from Postgres, shown as `HH:MM`. */
export function hhmm(time: string): string {
  return time.slice(0, 5);
}

/**
 * Does a shift with these wall clock times run past midnight? An end at or
 * before its start does (AC-T1). Equal times are refused by the table.
 */
export function crossesMidnight(startsAt: string, endsAt: string): boolean {
  return minutesOf(endsAt) <= minutesOf(startsAt);
}

/**
 * The instants of a shift on a work date: the template's times on that date in
 * Kigali, and a day later for an end that crosses midnight (AC-T1).
 */
export function shiftInstants(
  workDate: string,
  startsAt: string,
  endsAt: string,
): { startsAt: Date; endsAt: Date } {
  const midnight = localMidnight(workDate).getTime();
  const start = midnight + minutesOf(startsAt) * 60_000;
  let end = midnight + minutesOf(endsAt) * 60_000;
  if (crossesMidnight(startsAt, endsAt)) end += 86_400_000;
  return { startsAt: new Date(start), endsAt: new Date(end) };
}

/**
 * Payable thirtieths of one contract in one month (index contract 9).
 *
 * A day of a monthly wage is the wage divided by 30, whatever the month's
 * length, and a full month is always 30. For a contract that starts or ends
 * inside the month: 30, less the days of the month before it starts, less the
 * days after it ends, kept between 0 and 30. A contract that does not touch the
 * month is paid nothing.
 */
export function payableThirtieths(
  contract: { startsOn: string; endsOn: string | null },
  period: string,
): number {
  const first = firstOfMonth(period);
  const last = lastOfMonth(period);
  if (contract.startsOn > last) return 0;
  if (contract.endsOn !== null && contract.endsOn < first) return 0;
  const before = contract.startsOn > first ? daysBetween(first, contract.startsOn) : 0;
  const after =
    contract.endsOn !== null && contract.endsOn < last ? daysBetween(contract.endsOn, last) : 0;
  return Math.min(30, Math.max(0, 30 - before - after));
}

/**
 * Half up to the whole franc, the default rounding (index contract 9). Written
 * out rather than `Math.round`, which rounds -2.5 to -2.
 */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.floor(Math.abs(value) + 0.5);
}
