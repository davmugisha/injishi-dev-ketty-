import { type LeaseChargeStatus } from "./vocab";
/** How many days before its due day a rent charge is raised. */
export declare const RENT_RAISE_DAYS_AHEAD = 7;
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
export declare function rentSchedule(input: RentScheduleInput): ScheduledRentCharge[];
/** The day a charge is raised: `RENT_RAISE_DAYS_AHEAD` before it falls due. */
export declare function raiseOn(charge: Pick<ScheduledRentCharge, "dueOn">): string;
/**
 * The charges to raise as of `today`: every scheduled charge whose raise day
 * has come and whose period has not been raised yet (`raised` holds the
 * period starts already charged). Past charges a late run missed are
 * included, so a job that did not run for a week catches up.
 */
export declare function rentChargesToRaise(schedule: readonly ScheduledRentCharge[], today?: string, raised?: Iterable<string>): ScheduledRentCharge[];
/** The total rent a schedule charges over the whole lease. */
export declare function scheduledRentTotal(schedule: readonly ScheduledRentCharge[]): number;
/** The scheduled charge covering `day`, or null when the day is outside the billed lease. */
export declare function scheduledChargeOn(schedule: readonly ScheduledRentCharge[], day: string): ScheduledRentCharge | null;
/**
 * The deposit charge: raised when the tenant signs, due on the start date.
 * Null when the lease takes no deposit.
 */
export declare function depositCharge(lease: {
    startDate: string;
    depositRwf: number;
}): {
    dueOn: string;
    amountRwf: number;
} | null;
/** The first day an unpaid charge is overdue: the day after its due day plus the grace days. */
export declare function overdueFrom(dueOn: string, graceDays: number): string;
/** Is a charge overdue on `today`? Open, and `today` is after its due day plus the grace days. */
export declare function isChargeOverdue(charge: {
    status: LeaseChargeStatus;
    dueOn: string;
}, graceDays: number, today?: string): boolean;
/** Days past the due day of an overdue charge; 0 when it is not overdue. */
export declare function daysOverdue(charge: {
    status: LeaseChargeStatus;
    dueOn: string;
}, graceDays: number, today?: string): number;
/** The arrears ageing bands the overview shows, by days past due. */
export type ArrearsBand = "1_15" | "16_30" | "31_60" | "61_plus";
/** The ageing band of a number of days past due, or null when not past due. */
export declare function arrearsBand(days: number): ArrearsBand | null;
//# sourceMappingURL=schedule.d.ts.map