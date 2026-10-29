import { z } from "zod";

// ===========================================================================
// Kigali days, and the calendar rules of a tenancy
// ===========================================================================
//
// Every rentals rule that names a date is written in Kigali days: rent is due
// on the 5th on the calendar on the wall in Rwanda, whatever the clock of the
// server or the browser that checks it. Kigali is UTC+2 all year (no daylight
// saving), so a day is a plain `yyyy-mm-dd` string and the arithmetic is done
// at midnight UTC, where no zone can move it. `yyyy-mm-dd` strings compare
// correctly as strings, which the rules below rely on.
//
// Each rule returns the words to show, or null when the date is fine, so a
// date picker, a form and an API refusal say the same thing.

const DAY_MS = 86_400_000;

/** Kigali's offset from UTC, in hours. Rwanda keeps no daylight saving. */
export const KIGALI_UTC_OFFSET_HOURS = 2;

/** Today's date in Kigali, as `yyyy-mm-dd`. */
export function kigaliToday(now: Date = new Date()): string {
  return kigaliDateOf(now);
}

/** The Kigali calendar day an instant falls on. */
export function kigaliDateOf(instant: Date | string): string {
  const t = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
  if (!Number.isFinite(t)) throw new RangeError(`kigaliDateOf: not an instant: ${String(instant)}`);
  return new Date(t + KIGALI_UTC_OFFSET_HOURS * 3_600_000).toISOString().slice(0, 10);
}

/** Whether `v` is a real calendar day written `yyyy-mm-dd` (no 31 February). */
export function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}

/** A real calendar day, `yyyy-mm-dd`. */
export const CalendarDay = z
  .string({ required_error: "Pick a date.", invalid_type_error: "Pick a date." })
  .trim()
  .refine((v): boolean => isIsoDate(v), "Pick a date.");
export type CalendarDay = z.infer<typeof CalendarDay>;

function parts(iso: string): [number, number, number] {
  if (!isIsoDate(iso)) throw new RangeError(`Not a yyyy-mm-dd date: ${iso}`);
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return [y, m, d];
}

function fromUtc(y: number, monthIndex: number, d: number): string {
  return new Date(Date.UTC(y, monthIndex, d)).toISOString().slice(0, 10);
}

/** The number of days in a month (`month` from 1 to 12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The number of days in the month `iso` falls in. */
export function daysInMonthOf(iso: string): number {
  const [y, m] = parts(iso);
  return daysInMonth(y, m);
}

/** `days` after `iso` (before it when negative). */
export function addDays(iso: string, days: number): string {
  parts(iso);
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * `months` after `iso`, keeping the day of the month where it exists and
 * otherwise taking the month's last day: 31 January plus one month is
 * 28 February (29 in a leap year).
 */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = parts(iso);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return fromUtc(year, month - 1, Math.min(d, daysInMonth(year, month)));
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  parts(from);
  parts(to);
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** The first day of the month `iso` falls in. */
export function startOfMonth(iso: string): string {
  const [y, m] = parts(iso);
  return fromUtc(y, m - 1, 1);
}

/** The last day of the month `iso` falls in. */
export function endOfMonth(iso: string): string {
  const [y, m] = parts(iso);
  return fromUtc(y, m - 1, daysInMonth(y, m));
}

/** The month `iso` falls in, as `yyyy-mm`. */
export function monthKey(iso: string): string {
  parts(iso);
  return iso.slice(0, 7);
}

/** Day `day` of the month `iso` falls in, capped at the month's last day. */
export function dayOfMonth(iso: string, day: number): string {
  const [y, m] = parts(iso);
  return fromUtc(y, m - 1, Math.min(Math.max(1, day), daysInMonth(y, m)));
}

/** The earlier of two days. */
export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

/** The later of two days. */
export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

const MONTH_NAMES = [
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
] as const;

/** `2026-11-01` as `1 November 2026`, the same on every runtime (no locale tables). */
export function longDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

/** `1st`, `2nd`, `3rd`, `5th`, `21st`: a day of the month as people say it. */
export function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  const suffix = ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] ?? "th";
  return `${day}${suffix}`;
}

/** Which field a date rule refused, and the words to show under it. */
export interface DateProblem {
  path: string;
  message: string;
}

// --- Lease dates -------------------------------------------------------------------

/** A new lease may start up to this many days ago: a tenant already moved in. */
export const LEASE_START_PAST_DAYS = 30;

/** The longest lease Injishi drafts, in years. */
export const MAX_LEASE_YEARS = 10;

/** The earliest start date a new lease may have. */
export function earliestLeaseStart(today: string = kigaliToday()): string {
  return addDays(today, -LEASE_START_PAST_DAYS);
}

/**
 * The earliest end date for a lease starting on `start`: one month, so a lease
 * from 1 November ends on 30 November at the soonest. A start on a day the
 * next month does not have ends on the last day of the next month.
 */
export function shortestLeaseEnd(start: string): string {
  const [y, m, d] = parts(start);
  const nextMonthDays = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  if (d > nextMonthDays) return fromUtc(y, m, nextMonthDays);
  return addDays(fromUtc(y, m, d), -1);
}

/** The latest end date for a lease starting on `start`. */
export function longestLeaseEnd(start: string): string {
  return addDays(addMonths(start, MAX_LEASE_YEARS * 12), -1);
}

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
export function leaseDatesProblem(dates: LeaseDates, today: string = kigaliToday()): DateProblem | null {
  if (!isIsoDate(dates.startDate)) return { path: "startDate", message: "Pick a start date." };
  if (!isIsoDate(dates.endDate)) return { path: "endDate", message: "Pick an end date." };
  if (dates.endDate <= dates.startDate) return { path: "endDate", message: "The lease has to end after it starts." };
  if (dates.endDate < shortestLeaseEnd(dates.startDate)) {
    return { path: "endDate", message: "A lease runs for at least one month." };
  }
  if (dates.endDate > longestLeaseEnd(dates.startDate)) {
    return { path: "endDate", message: `A lease runs for at most ${MAX_LEASE_YEARS} years.` };
  }
  const earliest = earliestLeaseStart(today);
  const billing = dates.billingStartsOn ?? null;
  if (billing === null) {
    if (dates.startDate < earliest) {
      return { path: "startDate", message: `Pick a start date no more than ${LEASE_START_PAST_DAYS} days ago.` };
    }
    return null;
  }
  if (!isIsoDate(billing)) return { path: "billingStartsOn", message: "Pick the day billing starts." };
  if (dates.startDate < EARLIEST_RECORD_DATE) return { path: "startDate", message: "Pick a start date from 2000 on." };
  if (billing < dates.startDate) return { path: "billingStartsOn", message: "Billing can't start before the lease does." };
  if (billing >= dates.endDate) return { path: "billingStartsOn", message: "Billing has to start before the lease ends." };
  if (billing < earliest) {
    return { path: "billingStartsOn", message: `Pick a billing start no more than ${LEASE_START_PAST_DAYS} days ago.` };
  }
  return null;
}

// --- Notice ------------------------------------------------------------------------

/**
 * The least notice either side gives before the lease ends early, in days.
 * A lease may ask for more (`leases.notice_days`), never less.
 */
export const LEASE_NOTICE_MIN_DAYS = 15;

/** The most notice a lease may ask for, in days. */
export const LEASE_NOTICE_MAX_DAYS = 180;

export interface NoticeLease {
  startDate: string;
  endDate: string;
  /** The lease's own notice period; never below `LEASE_NOTICE_MIN_DAYS`. */
  noticeDays?: number | null;
}

/** The notice a lease asks for, never below the legal least. */
export function noticeDaysOf(lease: Pick<NoticeLease, "noticeDays">): number {
  return Math.max(LEASE_NOTICE_MIN_DAYS, lease.noticeDays ?? LEASE_NOTICE_MIN_DAYS);
}

/** The earliest move out date a notice given on `today` may name. */
export function earliestMoveOutDate(today: string = kigaliToday(), noticeDays: number = LEASE_NOTICE_MIN_DAYS): string {
  return addDays(today, Math.max(LEASE_NOTICE_MIN_DAYS, noticeDays));
}

/**
 * The days a notice given on `today` may name: from the notice period away
 * (and after the lease starts) to the lease's last day. `min > max` means the
 * lease ends too soon for a notice (`noticeNotNeeded`).
 */
export function noticeWindow(lease: NoticeLease, today: string = kigaliToday()): { min: string; max: string } {
  const earliest = earliestMoveOutDate(today, noticeDaysOf(lease));
  const afterStart = addDays(lease.startDate, 1);
  return { min: maxDate(earliest, afterStart), max: lease.endDate };
}

/** The lease ends sooner than a notice could: it simply ends on its last day, no notice needed. */
export function noticeNotNeeded(lease: NoticeLease, today: string = kigaliToday()): boolean {
  const w = noticeWindow(lease, today);
  return w.max < w.min;
}

/** What is wrong with the move out date a notice names, or null. */
export function noticeDateProblem(moveOutOn: string, lease: NoticeLease, today: string = kigaliToday()): string | null {
  const days = noticeDaysOf(lease);
  if (noticeNotNeeded(lease, today)) {
    return `The lease ends in less than ${days} days, so it simply ends on its last day. No notice is needed.`;
  }
  if (!isIsoDate(moveOutOn)) return "Pick a date.";
  if (moveOutOn < earliestMoveOutDate(today, days)) return `Pick a date at least ${days} days away.`;
  if (moveOutOn <= lease.startDate) return "Pick a date after the lease starts.";
  if (moveOutOn > lease.endDate) return "Pick the lease's last day or earlier.";
  return null;
}

// --- Moving out --------------------------------------------------------------------

/**
 * The days a landlord may say a tenant moved out on: from the day the lease
 * started to today. Never a day still to come: "moved out" is a fact.
 */
export function movedOutWindow(lease: { startDate: string }, today: string = kigaliToday()): { min: string; max: string } {
  return { min: lease.startDate, max: today };
}

/** What is wrong with a moved out date, or null. */
export function movedOutProblem(movedOutOn: string, lease: { startDate: string }, today: string = kigaliToday()): string | null {
  if (!isIsoDate(movedOutOn)) return "Pick a date.";
  if (movedOutOn > today) return "Pick today or an earlier day.";
  if (movedOutOn < lease.startDate) return "Pick a day on or after the lease started.";
  return null;
}

// --- Guests ------------------------------------------------------------------------

/** The longest stay one guest registration covers. A longer visit is a new registration. */
export const MAX_GUEST_STAY_DAYS = 90;

/** The days a stay may fall in: the lease's for a tenant's guest, any for a landlord's. */
export interface GuestStayWindow {
  start?: string | null;
  end?: string | null;
}

/** The first day a guest may arrive: today in Kigali, or the lease's first day if later. */
export function guestArrivalMin(today: string, window: GuestStayWindow = {}): string {
  return window.start && window.start > today ? window.start : today;
}

/** The last day a guest may leave: 90 days after arriving, or the lease's last day if sooner. */
export function guestDepartureMax(arrivalOn: string, window: GuestStayWindow = {}): string {
  const cap = addDays(arrivalOn, MAX_GUEST_STAY_DAYS);
  return window.end && window.end < cap ? window.end : cap;
}

/**
 * The calendar rules every guest form and the API share: arrival today or
 * later, departure on or after arrival, at most 90 days, and inside the lease
 * for a tenant's guest. Null when the dates are fine.
 */
export function guestStayProblem(input: {
  arrivalOn: string;
  departureOn: string;
  today?: string;
  window?: GuestStayWindow;
}): DateProblem | null {
  const today = input.today ?? kigaliToday();
  const w = input.window ?? {};
  if (!isIsoDate(input.arrivalOn)) return { path: "arrivalOn", message: "Pick an arrival date." };
  if (!isIsoDate(input.departureOn)) return { path: "departureOn", message: "Pick a departure date." };
  if (input.arrivalOn < today) return { path: "arrivalOn", message: "Pick an arrival date from today on." };
  if (w.start && input.arrivalOn < w.start) return { path: "arrivalOn", message: "Pick an arrival inside the lease." };
  if (w.end && input.arrivalOn > w.end) return { path: "arrivalOn", message: "Pick an arrival inside the lease." };
  if (input.departureOn < input.arrivalOn) {
    return { path: "departureOn", message: "The departure date can't be before arrival." };
  }
  if (daysBetween(input.arrivalOn, input.departureOn) > MAX_GUEST_STAY_DAYS) {
    return { path: "departureOn", message: `A stay can be at most ${MAX_GUEST_STAY_DAYS} days.` };
  }
  if (w.end && input.departureOn > w.end) return { path: "departureOn", message: "Pick a departure inside the lease." };
  return null;
}

/** Where a guest's stay is on `today`. */
export type GuestStayPhase = "arriving" | "staying" | "left";
export function guestStayPhase(today: string, arrivalOn: string, departureOn: string): GuestStayPhase {
  if (today < arrivalOn) return "arriving";
  if (today > departureOn) return "left";
  return "staying";
}

// --- Days that already happened (expenses, faults, payments) ------------------------

/** The first day an expense, fault or payment date may name. Nothing older is a real record here. */
export const EARLIEST_RECORD_DATE = "2000-01-01";

/**
 * Why a day that already happened is not acceptable, or null: a real day,
 * not before 2000 and not after today in Kigali. `notBefore` narrows the
 * start, such as the day a fault was reported.
 */
export function pastDateProblem(
  v: string,
  opts: { today?: string; notBefore?: string | null; notBeforeLabel?: string } = {},
): string | null {
  if (!isIsoDate(v)) return "Pick a date.";
  const today = opts.today ?? kigaliToday();
  if (v > today) return "That date hasn't happened yet.";
  if (v < EARLIEST_RECORD_DATE) return "Pick a date from 2000 on.";
  if (opts.notBefore && v < opts.notBefore) return opts.notBeforeLabel ?? "That's before it started.";
  return null;
}

/** A day that has already happened: from 2000 to today in Kigali. */
export const PastCalendarDay = z
  .string({ required_error: "Pick a date.", invalid_type_error: "Pick a date." })
  .trim()
  .superRefine((v, ctx) => {
    const problem = pastDateProblem(v);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, message: problem });
  });
export type PastCalendarDay = z.infer<typeof PastCalendarDay>;
