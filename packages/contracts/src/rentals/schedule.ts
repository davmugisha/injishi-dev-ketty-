import {
  addDays,
  daysBetween,
  daysInMonthOf,
  dayOfMonth,
  endOfMonth,
  isIsoDate,
  kigaliToday,
  maxDate,
  minDate,
  startOfMonth,
} from "./dates";
import { type LeaseChargeStatus, isRwf, prorateRwf } from "./vocab";

// ===========================================================================
// The rent schedule: one charge per calendar month
// ===========================================================================
//
// Rent is charged by CALENDAR MONTH and falls due on the lease's due day (1 to
// 28, so it exists in every month). The first and last months are charged
// only for the days the lease covers in them, prorated by the days in THAT
// month and rounded to the whole franc. A charge is raised 7 days before it
// falls due, and is overdue once it is still open after its due day plus the
// lease's grace days. Nothing here is stored: the job raises what this says,
// and the unique `(lease_id, period_start)` index makes raising it twice
// harmless.

/** How many days before its due day a rent charge is raised. */
export const RENT_RAISE_DAYS_AHEAD = 7;

export interface RentScheduleInput {
  startDate: string;
  /** The lease's last day, inclusive. */
  endDate: string;
  monthlyRentRwf: number;
  /** 1 to 28. */
  rentDueDay: number;
  /** A tenancy brought in mid way: no rent is charged for the days before this. */
  billingStartsOn?: string | null;
}

/** One month's rent, as the schedule says it should be charged. */
export interface ScheduledRentCharge {
  /** The first day this charge covers: the 1st, or the day billing starts. */
  periodStart: string;
  /** The last day it covers: the month's last day, or the lease's. */
  periodEnd: string;
  /** The month's due day, kept inside the period. */
  dueOn: string;
  amountRwf: number;
  /** Days covered, and days in that month: equal for a full month. */
  days: number;
  daysInMonth: number;
  prorated: boolean;
}

/**
 * The rent charges of a lease, oldest first.
 *
 * Each calendar month the lease (from its billing start) touches gives one
 * charge. Its period runs from the 1st, or the billing start in the first
 * month, to the month's end, or the lease's end in the last month. It falls
 * due on that month's due day, but never before the period starts (a lease
 * starting on the 20th with rent due on the 5th pays its first month on the
 * 20th) and never after it ends (a lease ending on the 3rd pays its last days
 * on the 3rd). A partial month is `round(rent × days ÷ days in that month)`,
 * and never less than one franc.
 */
export function rentSchedule(input: RentScheduleInput): ScheduledRentCharge[] {
  const { startDate, endDate, monthlyRentRwf, rentDueDay } = input;
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) throw new RangeError("rentSchedule: dates must be yyyy-mm-dd");
  if (endDate < startDate) throw new RangeError("rentSchedule: the lease ends before it starts");
  if (!isRwf(monthlyRentRwf) || monthlyRentRwf <= 0) throw new RangeError("rentSchedule: rent must be whole francs above 0");
  if (!Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 28) {
    throw new RangeError("rentSchedule: the due day is 1 to 28");
  }
  const billingStart = input.billingStartsOn ?? startDate;
  if (!isIsoDate(billingStart) || billingStart < startDate || billingStart > endDate) {
    throw new RangeError("rentSchedule: billing starts inside the lease");
  }

  const charges: ScheduledRentCharge[] = [];
  let monthStart = startOfMonth(billingStart);
  while (monthStart <= endDate) {
    const monthEnd = endOfMonth(monthStart);
    const periodStart = maxDate(monthStart, billingStart);
    const periodEnd = minDate(monthEnd, endDate);
    const monthDays = daysInMonthOf(monthStart);
    const days = daysBetween(periodStart, periodEnd) + 1;
    const prorated = days < monthDays;
    const amountRwf = prorated ? Math.max(1, prorateRwf(monthlyRentRwf, days, monthDays)) : monthlyRentRwf;
    const dueOn = minDate(maxDate(dayOfMonth(monthStart, rentDueDay), periodStart), periodEnd);
    charges.push({ periodStart, periodEnd, dueOn, amountRwf, days, daysInMonth: monthDays, prorated });
    monthStart = addDays(monthEnd, 1);
  }
  return charges;
}

/** The day a charge is raised: `RENT_RAISE_DAYS_AHEAD` before it falls due. */
export function raiseOn(charge: Pick<ScheduledRentCharge, "dueOn">): string {
  return addDays(charge.dueOn, -RENT_RAISE_DAYS_AHEAD);
}

/**
 * The charges to raise as of `today`: every scheduled charge whose raise day
 * has come and whose period has not been raised yet (`raised` holds the
 * period starts already charged). Past charges a late run missed are
 * included, so a job that did not run for a week catches up.
 */
export function rentChargesToRaise(
  schedule: readonly ScheduledRentCharge[],
  today: string = kigaliToday(),
  raised: Iterable<string> = [],
): ScheduledRentCharge[] {
  const done = new Set(raised);
  return schedule.filter((c) => raiseOn(c) <= today && !done.has(c.periodStart));
}

/** The total rent a schedule charges over the whole lease. */
export function scheduledRentTotal(schedule: readonly ScheduledRentCharge[]): number {
  return schedule.reduce((s, c) => s + c.amountRwf, 0);
}

/** The scheduled charge covering `day`, or null when the day is outside the billed lease. */
export function scheduledChargeOn(schedule: readonly ScheduledRentCharge[], day: string): ScheduledRentCharge | null {
  return schedule.find((c) => c.periodStart <= day && day <= c.periodEnd) ?? null;
}

// --- The deposit ----------------------------------------------------------------

/**
 * The deposit charge: raised when the tenant signs, due on the start date.
 * Null when the lease takes no deposit.
 */
export function depositCharge(lease: { startDate: string; depositRwf: number }): { dueOn: string; amountRwf: number } | null {
  if (!isRwf(lease.depositRwf)) throw new RangeError("depositCharge: deposit must be whole francs");
  return lease.depositRwf > 0 ? { dueOn: lease.startDate, amountRwf: lease.depositRwf } : null;
}

// --- Overdue ----------------------------------------------------------------------

/** The first day an unpaid charge is overdue: the day after its due day plus the grace days. */
export function overdueFrom(dueOn: string, graceDays: number): string {
  return addDays(dueOn, graceDays + 1);
}

/** Is a charge overdue on `today`? Open, and `today` is after its due day plus the grace days. */
export function isChargeOverdue(
  charge: { status: LeaseChargeStatus; dueOn: string },
  graceDays: number,
  today: string = kigaliToday(),
): boolean {
  return charge.status === "open" && today > addDays(charge.dueOn, graceDays);
}

/** Days past the due day of an overdue charge; 0 when it is not overdue. */
export function daysOverdue(
  charge: { status: LeaseChargeStatus; dueOn: string },
  graceDays: number,
  today: string = kigaliToday(),
): number {
  return isChargeOverdue(charge, graceDays, today) ? daysBetween(charge.dueOn, today) : 0;
}

/** The arrears ageing bands the overview shows, by days past due. */
export type ArrearsBand = "1_15" | "16_30" | "31_60" | "61_plus";

/** The ageing band of a number of days past due, or null when not past due. */
export function arrearsBand(days: number): ArrearsBand | null {
  if (days <= 0) return null;
  if (days <= 15) return "1_15";
  if (days <= 30) return "16_30";
  if (days <= 60) return "31_60";
  return "61_plus";
}
