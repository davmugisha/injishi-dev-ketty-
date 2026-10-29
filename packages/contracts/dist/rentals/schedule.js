"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENT_RAISE_DAYS_AHEAD = void 0;
exports.rentSchedule = rentSchedule;
exports.raiseOn = raiseOn;
exports.rentChargesToRaise = rentChargesToRaise;
exports.scheduledRentTotal = scheduledRentTotal;
exports.scheduledChargeOn = scheduledChargeOn;
exports.depositCharge = depositCharge;
exports.overdueFrom = overdueFrom;
exports.isChargeOverdue = isChargeOverdue;
exports.daysOverdue = daysOverdue;
exports.arrearsBand = arrearsBand;
const dates_1 = require("./dates");
const vocab_1 = require("./vocab");
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
exports.RENT_RAISE_DAYS_AHEAD = 7;
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
function rentSchedule(input) {
    const { startDate, endDate, monthlyRentRwf, rentDueDay } = input;
    if (!(0, dates_1.isIsoDate)(startDate) || !(0, dates_1.isIsoDate)(endDate))
        throw new RangeError("rentSchedule: dates must be yyyy-mm-dd");
    if (endDate < startDate)
        throw new RangeError("rentSchedule: the lease ends before it starts");
    if (!(0, vocab_1.isRwf)(monthlyRentRwf) || monthlyRentRwf <= 0)
        throw new RangeError("rentSchedule: rent must be whole francs above 0");
    if (!Number.isInteger(rentDueDay) || rentDueDay < 1 || rentDueDay > 28) {
        throw new RangeError("rentSchedule: the due day is 1 to 28");
    }
    const billingStart = input.billingStartsOn ?? startDate;
    if (!(0, dates_1.isIsoDate)(billingStart) || billingStart < startDate || billingStart > endDate) {
        throw new RangeError("rentSchedule: billing starts inside the lease");
    }
    const charges = [];
    let monthStart = (0, dates_1.startOfMonth)(billingStart);
    while (monthStart <= endDate) {
        const monthEnd = (0, dates_1.endOfMonth)(monthStart);
        const periodStart = (0, dates_1.maxDate)(monthStart, billingStart);
        const periodEnd = (0, dates_1.minDate)(monthEnd, endDate);
        const monthDays = (0, dates_1.daysInMonthOf)(monthStart);
        const days = (0, dates_1.daysBetween)(periodStart, periodEnd) + 1;
        const prorated = days < monthDays;
        const amountRwf = prorated ? Math.max(1, (0, vocab_1.prorateRwf)(monthlyRentRwf, days, monthDays)) : monthlyRentRwf;
        const dueOn = (0, dates_1.minDate)((0, dates_1.maxDate)((0, dates_1.dayOfMonth)(monthStart, rentDueDay), periodStart), periodEnd);
        charges.push({ periodStart, periodEnd, dueOn, amountRwf, days, daysInMonth: monthDays, prorated });
        monthStart = (0, dates_1.addDays)(monthEnd, 1);
    }
    return charges;
}
/** The day a charge is raised: `RENT_RAISE_DAYS_AHEAD` before it falls due. */
function raiseOn(charge) {
    return (0, dates_1.addDays)(charge.dueOn, -exports.RENT_RAISE_DAYS_AHEAD);
}
/**
 * The charges to raise as of `today`: every scheduled charge whose raise day
 * has come and whose period has not been raised yet (`raised` holds the
 * period starts already charged). Past charges a late run missed are
 * included, so a job that did not run for a week catches up.
 */
function rentChargesToRaise(schedule, today = (0, dates_1.kigaliToday)(), raised = []) {
    const done = new Set(raised);
    return schedule.filter((c) => raiseOn(c) <= today && !done.has(c.periodStart));
}
/** The total rent a schedule charges over the whole lease. */
function scheduledRentTotal(schedule) {
    return schedule.reduce((s, c) => s + c.amountRwf, 0);
}
/** The scheduled charge covering `day`, or null when the day is outside the billed lease. */
function scheduledChargeOn(schedule, day) {
    return schedule.find((c) => c.periodStart <= day && day <= c.periodEnd) ?? null;
}
// --- The deposit ----------------------------------------------------------------
/**
 * The deposit charge: raised when the tenant signs, due on the start date.
 * Null when the lease takes no deposit.
 */
function depositCharge(lease) {
    if (!(0, vocab_1.isRwf)(lease.depositRwf))
        throw new RangeError("depositCharge: deposit must be whole francs");
    return lease.depositRwf > 0 ? { dueOn: lease.startDate, amountRwf: lease.depositRwf } : null;
}
// --- Overdue ----------------------------------------------------------------------
/** The first day an unpaid charge is overdue: the day after its due day plus the grace days. */
function overdueFrom(dueOn, graceDays) {
    return (0, dates_1.addDays)(dueOn, graceDays + 1);
}
/** Is a charge overdue on `today`? Open, and `today` is after its due day plus the grace days. */
function isChargeOverdue(charge, graceDays, today = (0, dates_1.kigaliToday)()) {
    return charge.status === "open" && today > (0, dates_1.addDays)(charge.dueOn, graceDays);
}
/** Days past the due day of an overdue charge; 0 when it is not overdue. */
function daysOverdue(charge, graceDays, today = (0, dates_1.kigaliToday)()) {
    return isChargeOverdue(charge, graceDays, today) ? (0, dates_1.daysBetween)(charge.dueOn, today) : 0;
}
/** The ageing band of a number of days past due, or null when not past due. */
function arrearsBand(days) {
    if (days <= 0)
        return null;
    if (days <= 15)
        return "1_15";
    if (days <= 30)
        return "16_30";
    if (days <= 60)
        return "31_60";
    return "61_plus";
}
//# sourceMappingURL=schedule.js.map