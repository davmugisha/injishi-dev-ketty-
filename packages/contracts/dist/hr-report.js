"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrReport = exports.HrReportPayMonth = exports.HrReportLeave = exports.HrReportEvent = exports.HrReportAttendanceRow = exports.HrReportPerson = exports.HrReportQuery = void 0;
const zod_1 = require("zod");
/**
 * The HR report (058, HR reports): everything that took place at a business
 * over a period, in one read. Who joined and who left, attendance per person
 * with every late, missed and not counted day, leave taken by type, what pay
 * cost month by month, and the requests people made.
 *
 * Index contract 7 holds here as in the insights: people come in name order and
 * a figure is never a sort key, a threshold or a colour.
 */
const Uuid = zod_1.z.string().uuid();
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
const IsoMonth = zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is YYYY-MM.");
const Count = zod_1.z.number().int();
/** `GET /ops/hr/report?from&to`: at most a year. */
exports.HrReportQuery = zod_1.z
    .object({ from: IsoDate, to: IsoDate })
    .superRefine((b, ctx) => {
    if (b.to < b.from)
        ctx.addIssue({ code: "custom", message: "The range ends before it starts.", path: ["to"] });
    else if (Date.parse(`${b.to}T00:00:00Z`) - Date.parse(`${b.from}T00:00:00Z`) > 366 * 86400000)
        ctx.addIssue({ code: "custom", message: "Choose at most a year.", path: ["to"] });
});
/** A person as the report names them. */
exports.HrReportPerson = zod_1.z.object({
    employeeId: Uuid,
    name: zod_1.z.string(),
    job: zod_1.z.string().nullable(),
    team: zod_1.z.string().nullable(),
    branch: zod_1.z.string().nullable(),
});
exports.HrReportAttendanceRow = exports.HrReportPerson.extend({
    /** Rostered shifts that had started by the end of the period, or by now. */
    shifts: Count,
    present: Count,
    /** Rostered, no clock-in, and no approved leave that day. */
    absent: Count,
    onLeave: Count,
    late: Count,
    lateMinutes: Count,
    leftEarly: Count,
    /** Clock-ins HR marked not counted: the person was not at work. */
    notCounted: Count,
    workedMinutes: Count,
    overtimeMinutes: Count,
    approvedOvertimeMinutes: Count,
});
/** One day that went wrong for one person. */
exports.HrReportEvent = zod_1.z.object({
    employeeId: Uuid,
    date: IsoDate,
    kind: zod_1.z.enum(["late", "absent", "left_early", "not_counted"]),
    /** "07:00–15:00", Kigali. */
    shift: zod_1.z.string().nullable(),
    /** The clock-in, "07:24", Kigali; null for an absence. */
    clockIn: zod_1.z.string().nullable(),
    /** Minutes late or early; null for an absence or a clock-in not counted. */
    minutes: Count.nullable(),
    note: zod_1.z.string().nullable(),
});
exports.HrReportLeave = exports.HrReportPerson.extend({
    requestId: Uuid,
    type: zod_1.z.string(),
    startsOn: IsoDate,
    endsOn: IsoDate,
    /** The whole request, in working days as it was counted. */
    days: zod_1.z.number(),
    /** The part of it inside the period. */
    daysInPeriod: zod_1.z.number(),
    status: zod_1.z.enum(["approved", "requested"]),
    reason: zod_1.z.string().nullable(),
});
exports.HrReportPayMonth = zod_1.z.object({
    month: IsoMonth,
    status: zod_1.z.string(),
    people: Count,
    grossRwf: Count,
    payeRwf: Count,
    employeeContributionsRwf: Count,
    employerContributionsRwf: Count,
    otherDeductionsRwf: Count,
    netRwf: Count,
    /** Gross plus what the employer pays on top. */
    employerCostRwf: Count,
});
exports.HrReport = zod_1.z.object({
    from: IsoDate,
    to: IsoDate,
    /** Kigali today: a period that runs past it is counted up to it. */
    today: IsoDate,
    people: zod_1.z.object({
        atStart: Count,
        atEnd: Count,
        joined: zod_1.z.array(exports.HrReportPerson.extend({ on: IsoDate })),
        left: zod_1.z.array(exports.HrReportPerson.extend({ on: IsoDate, reason: zod_1.z.string().nullable() })),
        byTeam: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), count: Count })),
        byBranch: zod_1.z.array(zod_1.z.object({ name: zod_1.z.string(), count: Count })),
    }),
    attendance: zod_1.z.object({
        totals: exports.HrReportAttendanceRow.omit({ employeeId: true, name: true, job: true, team: true, branch: true }),
        people: zod_1.z.array(exports.HrReportAttendanceRow),
        events: zod_1.z.array(exports.HrReportEvent),
        /** Monday first. */
        byWeekday: zod_1.z.array(zod_1.z.object({ day: zod_1.z.string(), late: Count, absent: Count })),
    }),
    leave: zod_1.z.object({
        byType: zod_1.z.array(zod_1.z.object({ type: zod_1.z.string(), people: Count, days: zod_1.z.number() })),
        taken: zod_1.z.array(exports.HrReportLeave),
        /** Leave asked in the period, by what came of it. */
        asked: zod_1.z.object({ approved: Count, declined: Count, pending: Count, cancelled: Count }),
    }),
    /** The six months to the period's last; null for a reader without payroll access. */
    pay: zod_1.z.array(exports.HrReportPayMonth).nullable(),
    requests: zod_1.z.object({
        claims: zod_1.z.object({ asked: Count, approved: Count, approvedRwf: Count, pending: Count }),
        corrections: zod_1.z.object({ asked: Count, approved: Count, declined: Count, pending: Count }),
        helpDesk: zod_1.z.object({ opened: Count, closed: Count }),
    }),
});
//# sourceMappingURL=hr-report.js.map