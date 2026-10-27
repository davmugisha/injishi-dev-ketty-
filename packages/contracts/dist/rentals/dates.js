"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PastCalendarDay = exports.EARLIEST_RECORD_DATE = exports.MAX_GUEST_STAY_DAYS = exports.LEASE_NOTICE_MAX_DAYS = exports.LEASE_NOTICE_MIN_DAYS = exports.MAX_LEASE_YEARS = exports.LEASE_START_PAST_DAYS = exports.CalendarDay = exports.KIGALI_UTC_OFFSET_HOURS = void 0;
exports.kigaliToday = kigaliToday;
exports.kigaliDateOf = kigaliDateOf;
exports.isIsoDate = isIsoDate;
exports.daysInMonth = daysInMonth;
exports.daysInMonthOf = daysInMonthOf;
exports.addDays = addDays;
exports.addMonths = addMonths;
exports.daysBetween = daysBetween;
exports.startOfMonth = startOfMonth;
exports.endOfMonth = endOfMonth;
exports.monthKey = monthKey;
exports.dayOfMonth = dayOfMonth;
exports.minDate = minDate;
exports.maxDate = maxDate;
exports.longDate = longDate;
exports.ordinal = ordinal;
exports.earliestLeaseStart = earliestLeaseStart;
exports.shortestLeaseEnd = shortestLeaseEnd;
exports.longestLeaseEnd = longestLeaseEnd;
exports.leaseDatesProblem = leaseDatesProblem;
exports.noticeDaysOf = noticeDaysOf;
exports.earliestMoveOutDate = earliestMoveOutDate;
exports.noticeWindow = noticeWindow;
exports.noticeNotNeeded = noticeNotNeeded;
exports.noticeDateProblem = noticeDateProblem;
exports.movedOutWindow = movedOutWindow;
exports.movedOutProblem = movedOutProblem;
exports.guestArrivalMin = guestArrivalMin;
exports.guestDepartureMax = guestDepartureMax;
exports.guestStayProblem = guestStayProblem;
exports.guestStayPhase = guestStayPhase;
exports.pastDateProblem = pastDateProblem;
const zod_1 = require("zod");
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
const DAY_MS = 86400000;
/** Kigali's offset from UTC, in hours. Rwanda keeps no daylight saving. */
exports.KIGALI_UTC_OFFSET_HOURS = 2;
/** Today's date in Kigali, as `yyyy-mm-dd`. */
function kigaliToday(now = new Date()) {
    return kigaliDateOf(now);
}
/** The Kigali calendar day an instant falls on. */
function kigaliDateOf(instant) {
    const t = typeof instant === "string" ? Date.parse(instant) : instant.getTime();
    if (!Number.isFinite(t))
        throw new RangeError(`kigaliDateOf: not an instant: ${String(instant)}`);
    return new Date(t + exports.KIGALI_UTC_OFFSET_HOURS * 3600000).toISOString().slice(0, 10);
}
/** Whether `v` is a real calendar day written `yyyy-mm-dd` (no 31 February). */
function isIsoDate(v) {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
        return false;
    const t = Date.parse(`${v}T00:00:00Z`);
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}
/** A real calendar day, `yyyy-mm-dd`. */
exports.CalendarDay = zod_1.z
    .string({ required_error: "Pick a date.", invalid_type_error: "Pick a date." })
    .trim()
    .refine((v) => isIsoDate(v), "Pick a date.");
function parts(iso) {
    if (!isIsoDate(iso))
        throw new RangeError(`Not a yyyy-mm-dd date: ${iso}`);
    const [y, m, d] = iso.split("-").map(Number);
    return [y, m, d];
}
function fromUtc(y, monthIndex, d) {
    return new Date(Date.UTC(y, monthIndex, d)).toISOString().slice(0, 10);
}
/** The number of days in a month (`month` from 1 to 12). */
function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
/** The number of days in the month `iso` falls in. */
function daysInMonthOf(iso) {
    const [y, m] = parts(iso);
    return daysInMonth(y, m);
}
/** `days` after `iso` (before it when negative). */
function addDays(iso, days) {
    parts(iso);
    return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
/**
 * `months` after `iso`, keeping the day of the month where it exists and
 * otherwise taking the month's last day: 31 January plus one month is
 * 28 February (29 in a leap year).
 */
function addMonths(iso, months) {
    const [y, m, d] = parts(iso);
    const index = y * 12 + (m - 1) + months;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return fromUtc(year, month - 1, Math.min(d, daysInMonth(year, month)));
}
/** Whole days from `from` to `to` (negative when `to` is earlier). */
function daysBetween(from, to) {
    parts(from);
    parts(to);
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}
/** The first day of the month `iso` falls in. */
function startOfMonth(iso) {
    const [y, m] = parts(iso);
    return fromUtc(y, m - 1, 1);
}
/** The last day of the month `iso` falls in. */
function endOfMonth(iso) {
    const [y, m] = parts(iso);
    return fromUtc(y, m - 1, daysInMonth(y, m));
}
/** The month `iso` falls in, as `yyyy-mm`. */
function monthKey(iso) {
    parts(iso);
    return iso.slice(0, 7);
}
/** Day `day` of the month `iso` falls in, capped at the month's last day. */
function dayOfMonth(iso, day) {
    const [y, m] = parts(iso);
    return fromUtc(y, m - 1, Math.min(Math.max(1, day), daysInMonth(y, m)));
}
/** The earlier of two days. */
function minDate(a, b) {
    return a <= b ? a : b;
}
/** The later of two days. */
function maxDate(a, b) {
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
];
/** `2026-11-01` as `1 November 2026`, the same on every runtime (no locale tables). */
function longDate(iso) {
    const [y, m, d] = parts(iso);
    return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}
/** `1st`, `2nd`, `3rd`, `5th`, `21st`: a day of the month as people say it. */
function ordinal(day) {
    const tens = day % 100;
    if (tens >= 11 && tens <= 13)
        return `${day}th`;
    const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
    return `${day}${suffix}`;
}
// --- Lease dates -------------------------------------------------------------------
/** A new lease may start up to this many days ago: a tenant already moved in. */
exports.LEASE_START_PAST_DAYS = 30;
/** The longest lease Injishi drafts, in years. */
exports.MAX_LEASE_YEARS = 10;
/** The earliest start date a new lease may have. */
function earliestLeaseStart(today = kigaliToday()) {
    return addDays(today, -exports.LEASE_START_PAST_DAYS);
}
/**
 * The earliest end date for a lease starting on `start`: one month, so a lease
 * from 1 November ends on 30 November at the soonest. A start on a day the
 * next month does not have ends on the last day of the next month.
 */
function shortestLeaseEnd(start) {
    const [y, m, d] = parts(start);
    const nextMonthDays = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    if (d > nextMonthDays)
        return fromUtc(y, m, nextMonthDays);
    return addDays(fromUtc(y, m, d), -1);
}
/** The latest end date for a lease starting on `start`. */
function longestLeaseEnd(start) {
    return addDays(addMonths(start, exports.MAX_LEASE_YEARS * 12), -1);
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
function leaseDatesProblem(dates, today = kigaliToday()) {
    if (!isIsoDate(dates.startDate))
        return { path: "startDate", message: "Pick a start date." };
    if (!isIsoDate(dates.endDate))
        return { path: "endDate", message: "Pick an end date." };
    if (dates.endDate <= dates.startDate)
        return { path: "endDate", message: "The lease has to end after it starts." };
    if (dates.endDate < shortestLeaseEnd(dates.startDate)) {
        return { path: "endDate", message: "A lease runs for at least one month." };
    }
    if (dates.endDate > longestLeaseEnd(dates.startDate)) {
        return { path: "endDate", message: `A lease runs for at most ${exports.MAX_LEASE_YEARS} years.` };
    }
    const earliest = earliestLeaseStart(today);
    const billing = dates.billingStartsOn ?? null;
    if (billing === null) {
        if (dates.startDate < earliest) {
            return { path: "startDate", message: `Pick a start date no more than ${exports.LEASE_START_PAST_DAYS} days ago.` };
        }
        return null;
    }
    if (!isIsoDate(billing))
        return { path: "billingStartsOn", message: "Pick the day billing starts." };
    if (dates.startDate < exports.EARLIEST_RECORD_DATE)
        return { path: "startDate", message: "Pick a start date from 2000 on." };
    if (billing < dates.startDate)
        return { path: "billingStartsOn", message: "Billing can't start before the lease does." };
    if (billing >= dates.endDate)
        return { path: "billingStartsOn", message: "Billing has to start before the lease ends." };
    if (billing < earliest) {
        return { path: "billingStartsOn", message: `Pick a billing start no more than ${exports.LEASE_START_PAST_DAYS} days ago.` };
    }
    return null;
}
// --- Notice ------------------------------------------------------------------------
/**
 * The least notice either side gives before the lease ends early, in days.
 * A lease may ask for more (`leases.notice_days`), never less.
 */
exports.LEASE_NOTICE_MIN_DAYS = 15;
/** The most notice a lease may ask for, in days. */
exports.LEASE_NOTICE_MAX_DAYS = 180;
/** The notice a lease asks for, never below the legal least. */
function noticeDaysOf(lease) {
    return Math.max(exports.LEASE_NOTICE_MIN_DAYS, lease.noticeDays ?? exports.LEASE_NOTICE_MIN_DAYS);
}
/** The earliest move out date a notice given on `today` may name. */
function earliestMoveOutDate(today = kigaliToday(), noticeDays = exports.LEASE_NOTICE_MIN_DAYS) {
    return addDays(today, Math.max(exports.LEASE_NOTICE_MIN_DAYS, noticeDays));
}
/**
 * The days a notice given on `today` may name: from the notice period away
 * (and after the lease starts) to the lease's last day. `min > max` means the
 * lease ends too soon for a notice (`noticeNotNeeded`).
 */
function noticeWindow(lease, today = kigaliToday()) {
    const earliest = earliestMoveOutDate(today, noticeDaysOf(lease));
    const afterStart = addDays(lease.startDate, 1);
    return { min: maxDate(earliest, afterStart), max: lease.endDate };
}
/** The lease ends sooner than a notice could: it simply ends on its last day, no notice needed. */
function noticeNotNeeded(lease, today = kigaliToday()) {
    const w = noticeWindow(lease, today);
    return w.max < w.min;
}
/** What is wrong with the move out date a notice names, or null. */
function noticeDateProblem(moveOutOn, lease, today = kigaliToday()) {
    const days = noticeDaysOf(lease);
    if (noticeNotNeeded(lease, today)) {
        return `The lease ends in less than ${days} days, so it simply ends on its last day. No notice is needed.`;
    }
    if (!isIsoDate(moveOutOn))
        return "Pick a date.";
    if (moveOutOn < earliestMoveOutDate(today, days))
        return `Pick a date at least ${days} days away.`;
    if (moveOutOn <= lease.startDate)
        return "Pick a date after the lease starts.";
    if (moveOutOn > lease.endDate)
        return "Pick the lease's last day or earlier.";
    return null;
}
// --- Moving out --------------------------------------------------------------------
/**
 * The days a landlord may say a tenant moved out on: from the day the lease
 * started to today. Never a day still to come: "moved out" is a fact.
 */
function movedOutWindow(lease, today = kigaliToday()) {
    return { min: lease.startDate, max: today };
}
/** What is wrong with a moved out date, or null. */
function movedOutProblem(movedOutOn, lease, today = kigaliToday()) {
    if (!isIsoDate(movedOutOn))
        return "Pick a date.";
    if (movedOutOn > today)
        return "Pick today or an earlier day.";
    if (movedOutOn < lease.startDate)
        return "Pick a day on or after the lease started.";
    return null;
}
// --- Guests ------------------------------------------------------------------------
/** The longest stay one guest registration covers. A longer visit is a new registration. */
exports.MAX_GUEST_STAY_DAYS = 90;
/** The first day a guest may arrive: today in Kigali, or the lease's first day if later. */
function guestArrivalMin(today, window = {}) {
    return window.start && window.start > today ? window.start : today;
}
/** The last day a guest may leave: 90 days after arriving, or the lease's last day if sooner. */
function guestDepartureMax(arrivalOn, window = {}) {
    const cap = addDays(arrivalOn, exports.MAX_GUEST_STAY_DAYS);
    return window.end && window.end < cap ? window.end : cap;
}
/**
 * The calendar rules every guest form and the API share: arrival today or
 * later, departure on or after arrival, at most 90 days, and inside the lease
 * for a tenant's guest. Null when the dates are fine.
 */
function guestStayProblem(input) {
    const today = input.today ?? kigaliToday();
    const w = input.window ?? {};
    if (!isIsoDate(input.arrivalOn))
        return { path: "arrivalOn", message: "Pick an arrival date." };
    if (!isIsoDate(input.departureOn))
        return { path: "departureOn", message: "Pick a departure date." };
    if (input.arrivalOn < today)
        return { path: "arrivalOn", message: "Pick an arrival date from today on." };
    if (w.start && input.arrivalOn < w.start)
        return { path: "arrivalOn", message: "Pick an arrival inside the lease." };
    if (w.end && input.arrivalOn > w.end)
        return { path: "arrivalOn", message: "Pick an arrival inside the lease." };
    if (input.departureOn < input.arrivalOn) {
        return { path: "departureOn", message: "The departure date can't be before arrival." };
    }
    if (daysBetween(input.arrivalOn, input.departureOn) > exports.MAX_GUEST_STAY_DAYS) {
        return { path: "departureOn", message: `A stay can be at most ${exports.MAX_GUEST_STAY_DAYS} days.` };
    }
    if (w.end && input.departureOn > w.end)
        return { path: "departureOn", message: "Pick a departure inside the lease." };
    return null;
}
function guestStayPhase(today, arrivalOn, departureOn) {
    if (today < arrivalOn)
        return "arriving";
    if (today > departureOn)
        return "left";
    return "staying";
}
// --- Days that already happened (expenses, faults, payments) ------------------------
/** The first day an expense, fault or payment date may name. Nothing older is a real record here. */
exports.EARLIEST_RECORD_DATE = "2000-01-01";
/**
 * Why a day that already happened is not acceptable, or null: a real day,
 * not before 2000 and not after today in Kigali. `notBefore` narrows the
 * start, such as the day a fault was reported.
 */
function pastDateProblem(v, opts = {}) {
    if (!isIsoDate(v))
        return "Pick a date.";
    const today = opts.today ?? kigaliToday();
    if (v > today)
        return "That date hasn't happened yet.";
    if (v < exports.EARLIEST_RECORD_DATE)
        return "Pick a date from 2000 on.";
    if (opts.notBefore && v < opts.notBefore)
        return opts.notBeforeLabel ?? "That's before it started.";
    return null;
}
/** A day that has already happened: from 2000 to today in Kigali. */
exports.PastCalendarDay = zod_1.z
    .string({ required_error: "Pick a date.", invalid_type_error: "Pick a date." })
    .trim()
    .superRefine((v, ctx) => {
    const problem = pastDateProblem(v);
    if (problem)
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, message: problem });
});
//# sourceMappingURL=dates.js.map