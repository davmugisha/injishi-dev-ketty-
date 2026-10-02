import { eachDate, isWeekday, monthOf, yearOf } from './hr-calendar';

/**
 * How many days a leave takes (ADR-058 AC-L3), and how they split by month.
 *
 * A request's days are the person's ROSTERED days in the range; a date with no
 * roster entry counts Monday to Friday; a public holiday never counts. A half
 * day is allowed at either end: the afternoon of the first day, the morning of
 * the last. So a person rostered Saturday and Sunday who takes a weekend is
 * charged two days, and one who takes a public holiday off is charged nothing.
 *
 * Estimated at request and counted again at approval under a lock on the
 * employee row, because the roster can change in between (AC-L4).
 */

export interface LeaveRange {
  startsOn: string;
  endsOn: string;
  startHalf: 'full' | 'second_half';
  endHalf: 'full' | 'first_half';
}

export interface LeaveDayContext {
  /** Dates in the range on which the person has a scheduled roster entry. */
  rosteredDates: ReadonlySet<string>;
  /** Public holidays of every year the range touches. */
  holidays: ReadonlySet<string>;
}

export interface LeaveMonthShare {
  /** `YYYY-MM`. */
  period: string;
  days: number;
  /** The first leave day in that month: what the `taken` row is dated. */
  effectiveOn: string;
}

export interface LeaveCount {
  days: number;
  byMonth: LeaveMonthShare[];
}

/** Every calendar year a range touches; each needs its holiday row. */
export function yearsTouched(range: Pick<LeaveRange, 'startsOn' | 'endsOn'>): number[] {
  const years: number[] = [];
  for (let y = yearOf(range.startsOn); y <= yearOf(range.endsOn); y++) years.push(y);
  return years;
}

/**
 * A range whose one day is both "from the afternoon" and "until lunch" is no
 * time at all, and is refused rather than counted as zero.
 */
export function isContradictoryHalfDay(range: LeaveRange): boolean {
  return (
    range.startsOn === range.endsOn &&
    range.startHalf === 'second_half' &&
    range.endHalf === 'first_half'
  );
}

export function countLeaveDays(range: LeaveRange, context: LeaveDayContext): LeaveCount {
  const byMonth = new Map<string, LeaveMonthShare>();
  let days = 0;
  for (const date of eachDate(range.startsOn, range.endsOn)) {
    if (context.holidays.has(date)) continue;
    const counts = context.rosteredDates.has(date) || isWeekday(date);
    if (!counts) continue;
    let value = 1;
    if (date === range.startsOn && range.startHalf === 'second_half') value -= 0.5;
    if (date === range.endsOn && range.endHalf === 'first_half') value -= 0.5;
    if (value <= 0) continue;
    days += value;
    const period = monthOf(date);
    const share = byMonth.get(period);
    if (share) share.days += value;
    else byMonth.set(period, { period, days: value, effectiveOn: date });
  }
  return { days, byMonth: [...byMonth.values()] };
}
