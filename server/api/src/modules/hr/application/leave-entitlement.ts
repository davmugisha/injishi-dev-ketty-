/**
 * How many days of leave somebody has, worked out rather than typed (HR
 * module, Phase 4 — first pass, no ADR yet).
 *
 * An allowance used to be a number HR entered for every person, every year.
 * Now each leave type carries a rule, set once, and a person's allowance for a
 * year follows from it and from when they started:
 *
 *   the days a year          18 for annual leave
 *   more for long service    a day more for every three years here, up to three
 *   less in the first year   a twelfth of the year for each month worked in it
 *   plus what was not taken  last year's unused days, where the type carries over
 *
 * A NUMBER HR TYPES STILL WINS. A row in `leave_balances` is somebody's
 * allowance set by hand, exactly as before, and it replaces all of the above
 * for that person, type and year until HR hands it back to the rule.
 *
 * THE ARITHMETIC OF LONG SERVICE IS MAIN'S: `completedYears` and
 * `entitlementFor` are taken from `modules/people/domain/leave-lots.ts` there
 * (ADR-058 AC-LV5), so the two modules agree on what three years of service
 * means. The rest is this module's.
 *
 * THE DEFAULT FIGURES ARE A STARTING POINT, NOT LEGAL ADVICE. Eighteen days a
 * year rising to twenty-one with service, and fifteen days of sick leave, are
 * Rwanda's labour law as understood when this was written. Nobody qualified
 * has checked them, and every one can be changed per business on the Leave
 * tab, which is where a business with a more generous contract sets its own.
 *
 * Pure: every input is a value, so the same facts always give the same days.
 */

export type LeaveKind = 'annual' | 'sick' | 'unpaid' | 'other';

export interface EntitlementRule {
  /** Days a year everybody gets. Null: nothing is worked out, and an allowance is only ever what HR types. */
  yearlyDays: number | null;
  /** A step of long service: every this many years here... */
  seniorityEveryYears: number | null;
  /** ...adds this many days... */
  seniorityExtraDays: number | null;
  /** ...until this many have been added. Null is no ceiling. */
  seniorityCapDays: number | null;
  /** Whether days not taken last year are added to this year's. */
  carryForward: boolean;
}

export type EntitlementDefaults = Omit<EntitlementRule, 'carryForward'>;

const NO_RULE: EntitlementDefaults = { yearlyDays: null, seniorityEveryYears: null, seniorityExtraDays: null, seniorityCapDays: null };

/** What a leave type gives until a business says otherwise. */
export const DEFAULT_ENTITLEMENT: Readonly<Record<LeaveKind, EntitlementDefaults>> = {
  annual: { yearlyDays: 18, seniorityEveryYears: 3, seniorityExtraDays: 1, seniorityCapDays: 3 },
  sick: { yearlyDays: 15, seniorityEveryYears: null, seniorityExtraDays: null, seniorityCapDays: null },
  // Asked for, never allotted: there is no balance to keep.
  unpaid: NO_RULE,
  other: NO_RULE,
};

const yearOf = (day: string): number => Number(day.slice(0, 4));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `2026-10-08` as a person reads a date: `08 Oct 2026`. */
const dayText = (day: string): string => `${day.slice(8, 10)} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;

/** Full years from `from` to `to` (both dates). */
export function completedYears(from: string, to: string): number {
  if (to < from) return 0;
  const years = yearOf(to) - yearOf(from);
  return to.slice(5) >= from.slice(5) ? years : years - 1;
}

/**
 * A full year's entitlement: the base, plus M days for every N years of
 * service completed by the year's first day, the extra capped.
 */
export function entitlementFor(rule: EntitlementDefaults, hiredOn: string | null, year: number): number | null {
  if (rule.yearlyDays === null) return null;
  if (!hiredOn || !rule.seniorityEveryYears || !rule.seniorityExtraDays) return rule.yearlyDays;
  const steps = Math.floor(completedYears(hiredOn, `${year}-01-01`) / rule.seniorityEveryYears);
  const extra = steps * rule.seniorityExtraDays;
  return rule.yearlyDays + (rule.seniorityCapDays !== null ? Math.min(extra, rule.seniorityCapDays) : extra);
}

/**
 * How much of a year somebody is here for, as twelfths: a whole twelfth for
 * each month after the one they started in, and the share of that first month
 * still to run on the day they started. Twelve for anybody who was already
 * here on 1 January, none for somebody who has not started yet.
 */
export function monthsOfYear(hiredOn: string | null, year: number): number {
  if (!hiredOn || yearOf(hiredOn) < year) return 12;
  if (yearOf(hiredOn) > year) return 0;
  const month = Number(hiredOn.slice(5, 7));
  const day = Number(hiredOn.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return 12 - month + (daysInMonth - day + 1) / daysInMonth;
}

/** Half a day up to the whole day: an allowance is counted in days. */
const wholeDays = (days: number): number => Math.floor(days + 0.5);

export interface WorkedOutAllowance {
  /** The allowance for the year, carried days included. */
  days: number;
  /** The year's own days, before anything carried over. */
  entitlement: number;
  /** Days brought over from last year. */
  carried: number;
  /** How the figure was reached, in words HR and the employee can both check. */
  basis: string;
}

/** A year's own days, before anything carried over: the entitlement, scaled to the months worked in it. */
export function yearAllowance(rule: EntitlementDefaults, hiredOn: string | null, year: number): number | null {
  const full = entitlementFor(rule, hiredOn, year);
  if (full === null) return null;
  return wholeDays((full * monthsOfYear(hiredOn, year)) / 12);
}

/**
 * Somebody's allowance for a year, worked out. Null when the type has no rule
 * to work it out from.
 *
 * `previous` is what last year left, when it is known: that year's allowance
 * (set by hand or worked out, but never with a carry of its own, so unused
 * days do not pile up year on year without limit) and the days taken from it.
 * It is ignored unless the type carries over.
 */
export function workOutAllowance(input: {
  rule: EntitlementRule;
  hiredOn: string | null;
  year: number;
  previous: { allowance: number; used: number } | null;
}): WorkedOutAllowance | null {
  const { rule, hiredOn, year, previous } = input;
  const full = entitlementFor(rule, hiredOn, year);
  if (full === null || rule.yearlyDays === null) return null;

  const months = monthsOfYear(hiredOn, year);
  const entitlement = wholeDays((full * months) / 12);
  const carried = rule.carryForward && previous ? Math.max(0, previous.allowance - previous.used) : 0;

  const parts: string[] = [];
  const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;
  if (full > rule.yearlyDays) parts.push(`${days(rule.yearlyDays)} a year, plus ${days(full - rule.yearlyDays)} for long service`);
  else parts.push(`${days(rule.yearlyDays)} a year`);
  if (months === 0) parts.push('not started yet');
  else if (months < 12 && hiredOn) parts.push(`${days(entitlement)} this year, having started on ${dayText(hiredOn)}`);
  if (carried > 0) parts.push(`${days(carried)} carried over from ${year - 1}`);

  return { days: entitlement + carried, entitlement, carried, basis: parts.join('; ') };
}
