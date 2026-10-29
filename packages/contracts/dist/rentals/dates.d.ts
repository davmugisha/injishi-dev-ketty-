import { z } from "zod";
/** Kigali's offset from UTC, in hours. Rwanda keeps no daylight saving. */
export declare const KIGALI_UTC_OFFSET_HOURS = 2;
/** Today's date in Kigali, as `yyyy-mm-dd`. */
export declare function kigaliToday(now?: Date): string;
/** The Kigali calendar day an instant falls on. */
export declare function kigaliDateOf(instant: Date | string): string;
/** Whether `v` is a real calendar day written `yyyy-mm-dd` (no 31 February). */
export declare function isIsoDate(v: unknown): v is string;
/** A real calendar day, `yyyy-mm-dd`. */
export declare const CalendarDay: z.ZodEffects<z.ZodString, string, string>;
export type CalendarDay = z.infer<typeof CalendarDay>;
/** The number of days in a month (`month` from 1 to 12). */
export declare function daysInMonth(year: number, month: number): number;
/** The number of days in the month `iso` falls in. */
export declare function daysInMonthOf(iso: string): number;
/** `days` after `iso` (before it when negative). */
export declare function addDays(iso: string, days: number): string;
/**
 * `months` after `iso`, keeping the day of the month where it exists and
 * otherwise taking the month's last day: 31 January plus one month is
 * 28 February (29 in a leap year).
 */
export declare function addMonths(iso: string, months: number): string;
/** Whole days from `from` to `to` (negative when `to` is earlier). */
export declare function daysBetween(from: string, to: string): number;
/** The first day of the month `iso` falls in. */
export declare function startOfMonth(iso: string): string;
/** The last day of the month `iso` falls in. */
export declare function endOfMonth(iso: string): string;
/** The month `iso` falls in, as `yyyy-mm`. */
export declare function monthKey(iso: string): string;
/** Day `day` of the month `iso` falls in, capped at the month's last day. */
export declare function dayOfMonth(iso: string, day: number): string;
/** The earlier of two days. */
export declare function minDate(a: string, b: string): string;
/** The later of two days. */
export declare function maxDate(a: string, b: string): string;
/** `2026-11-01` as `1 November 2026`, the same on every runtime (no locale tables). */
export declare function longDate(iso: string): string;
/** `1st`, `2nd`, `3rd`, `5th`, `21st`: a day of the month as people say it. */
export declare function ordinal(day: number): string;
/** Which field a date rule refused, and the words to show under it. */
export interface DateProblem {
    path: string;
    message: string;
}
/** A new lease may start up to this many days ago: a tenant already moved in. */
export declare const LEASE_START_PAST_DAYS = 30;
/** The longest lease Injishi drafts, in years. */
export declare const MAX_LEASE_YEARS = 10;
/** The earliest start date a new lease may have. */
export declare function earliestLeaseStart(today?: string): string;
/**
 * The earliest end date for a lease starting on `start`: one month, so a lease
 * from 1 November ends on 30 November at the soonest. A start on a day the
 * next month does not have ends on the last day of the next month.
 */
export declare function shortestLeaseEnd(start: string): string;
/** The latest end date for a lease starting on `start`. */
export declare function longestLeaseEnd(start: string): string;
export interface LeaseDates {
    startDate: string;
    endDate: string;
    /**
     * The day rent starts being charged on Injishi, for a tenancy that began
     * before it was brought in. Null or absent: from the start date.
     */
    billingStartsOn?: string | null;
}
/**
 * What is wrong with a lease's dates, or null.
 *
 * The lease ends after it starts, runs at least a month and at most
 * `MAX_LEASE_YEARS`, and starts no more than `LEASE_START_PAST_DAYS` ago.
 * An existing tenancy brought in mid way (`billingStartsOn` set) may have
 * started earlier; then the billing start is what may be at most 30 days
 * ago, and it falls inside the lease.
 */
export declare function leaseDatesProblem(dates: LeaseDates, today?: string): DateProblem | null;
/**
 * The least notice either side gives before the lease ends early, in days.
 * A lease may ask for more (`leases.notice_days`), never less.
 */
export declare const LEASE_NOTICE_MIN_DAYS = 15;
/** The most notice a lease may ask for, in days. */
export declare const LEASE_NOTICE_MAX_DAYS = 180;
export interface NoticeLease {
    startDate: string;
    endDate: string;
    /** The lease's own notice period; never below `LEASE_NOTICE_MIN_DAYS`. */
    noticeDays?: number | null;
}
/** The notice a lease asks for, never below the legal least. */
export declare function noticeDaysOf(lease: Pick<NoticeLease, "noticeDays">): number;
/** The earliest move out date a notice given on `today` may name. */
export declare function earliestMoveOutDate(today?: string, noticeDays?: number): string;
/**
 * The days a notice given on `today` may name: from the notice period away
 * (and after the lease starts) to the lease's last day. `min > max` means the
 * lease ends too soon for a notice (`noticeNotNeeded`).
 */
export declare function noticeWindow(lease: NoticeLease, today?: string): {
    min: string;
    max: string;
};
/** The lease ends sooner than a notice could: it simply ends on its last day, no notice needed. */
export declare function noticeNotNeeded(lease: NoticeLease, today?: string): boolean;
/** What is wrong with the move out date a notice names, or null. */
export declare function noticeDateProblem(moveOutOn: string, lease: NoticeLease, today?: string): string | null;
/**
 * The days a landlord may say a tenant moved out on: from the day the lease
 * started to today. Never a day still to come: "moved out" is a fact.
 */
export declare function movedOutWindow(lease: {
    startDate: string;
}, today?: string): {
    min: string;
    max: string;
};
/** What is wrong with a moved out date, or null. */
export declare function movedOutProblem(movedOutOn: string, lease: {
    startDate: string;
}, today?: string): string | null;
/** The longest stay one guest registration covers. A longer visit is a new registration. */
export declare const MAX_GUEST_STAY_DAYS = 90;
/** The days a stay may fall in: the lease's for a tenant's guest, any for a landlord's. */
export interface GuestStayWindow {
    start?: string | null;
    end?: string | null;
}
/** The first day a guest may arrive: today in Kigali, or the lease's first day if later. */
export declare function guestArrivalMin(today: string, window?: GuestStayWindow): string;
/** The last day a guest may leave: 90 days after arriving, or the lease's last day if sooner. */
export declare function guestDepartureMax(arrivalOn: string, window?: GuestStayWindow): string;
/**
 * The calendar rules every guest form and the API share: arrival today or
 * later, departure on or after arrival, at most 90 days, and inside the lease
 * for a tenant's guest. Null when the dates are fine.
 */
export declare function guestStayProblem(input: {
    arrivalOn: string;
    departureOn: string;
    today?: string;
    window?: GuestStayWindow;
}): DateProblem | null;
/** Where a guest's stay is on `today`. */
export type GuestStayPhase = "arriving" | "staying" | "left";
export declare function guestStayPhase(today: string, arrivalOn: string, departureOn: string): GuestStayPhase;
/** The first day an expense, fault or payment date may name. Nothing older is a real record here. */
export declare const EARLIEST_RECORD_DATE = "2000-01-01";
/**
 * Why a day that already happened is not acceptable, or null: a real day,
 * not before 2000 and not after today in Kigali. `notBefore` narrows the
 * start, such as the day a fault was reported.
 */
export declare function pastDateProblem(v: string, opts?: {
    today?: string;
    notBefore?: string | null;
    notBeforeLabel?: string;
}): string | null;
/** A day that has already happened: from 2000 to today in Kigali. */
export declare const PastCalendarDay: z.ZodEffects<z.ZodString, string, string>;
export type PastCalendarDay = z.infer<typeof PastCalendarDay>;
//# sourceMappingURL=dates.d.ts.map