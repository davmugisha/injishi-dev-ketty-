import { z } from "zod";
/**
 * The HR report (058, HR reports): everything that took place at a business
 * over a period, in one read. Who joined and who left, attendance per person
 * with every late, missed and not counted day, leave taken by type, what pay
 * cost month by month, and the requests people made.
 *
 * Index contract 7 holds here as in the insights: people come in name order and
 * a figure is never a sort key, a threshold or a colour.
 */
const Uuid = z.string().uuid();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
const IsoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A month is YYYY-MM.");
const Count = z.number().int();

/** `GET /ops/hr/report?from&to`: at most a year. */
export const HrReportQuery = z
    .object({ from: IsoDate, to: IsoDate })
    .superRefine((b, ctx) => {
        if (b.to < b.from)
            ctx.addIssue({ code: "custom", message: "The range ends before it starts.", path: ["to"] });
        else if (Date.parse(`${b.to}T00:00:00Z`) - Date.parse(`${b.from}T00:00:00Z`) > 366 * 86_400_000)
            ctx.addIssue({ code: "custom", message: "Choose at most a year.", path: ["to"] });
    });
export type HrReportQuery = z.infer<typeof HrReportQuery>;

/** A person as the report names them. */
export const HrReportPerson = z.object({
    employeeId: Uuid,
    name: z.string(),
    job: z.string().nullable(),
    team: z.string().nullable(),
    branch: z.string().nullable(),
});
export type HrReportPerson = z.infer<typeof HrReportPerson>;

export const HrReportAttendanceRow = HrReportPerson.extend({
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
export type HrReportAttendanceRow = z.infer<typeof HrReportAttendanceRow>;

/** One day that went wrong for one person. */
export const HrReportEvent = z.object({
    employeeId: Uuid,
    date: IsoDate,
    kind: z.enum(["late", "absent", "left_early", "not_counted"]),
    /** "07:00–15:00", Kigali. */
    shift: z.string().nullable(),
    /** The clock-in, "07:24", Kigali; null for an absence. */
    clockIn: z.string().nullable(),
    /** Minutes late or early; null for an absence or a clock-in not counted. */
    minutes: Count.nullable(),
    note: z.string().nullable(),
});
export type HrReportEvent = z.infer<typeof HrReportEvent>;

export const HrReportLeave = HrReportPerson.extend({
    requestId: Uuid,
    type: z.string(),
    startsOn: IsoDate,
    endsOn: IsoDate,
    /** The whole request, in working days as it was counted. */
    days: z.number(),
    /** The part of it inside the period. */
    daysInPeriod: z.number(),
    status: z.enum(["approved", "requested"]),
    reason: z.string().nullable(),
});
export type HrReportLeave = z.infer<typeof HrReportLeave>;

export const HrReportPayMonth = z.object({
    month: IsoMonth,
    status: z.string(),
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
export type HrReportPayMonth = z.infer<typeof HrReportPayMonth>;

export const HrReport = z.object({
    from: IsoDate,
    to: IsoDate,
    /** Kigali today: a period that runs past it is counted up to it. */
    today: IsoDate,
    people: z.object({
        atStart: Count,
        atEnd: Count,
        joined: z.array(HrReportPerson.extend({ on: IsoDate })),
        left: z.array(HrReportPerson.extend({ on: IsoDate, reason: z.string().nullable() })),
        byTeam: z.array(z.object({ name: z.string(), count: Count })),
        byBranch: z.array(z.object({ name: z.string(), count: Count })),
    }),
    attendance: z.object({
        totals: HrReportAttendanceRow.omit({ employeeId: true, name: true, job: true, team: true, branch: true }),
        people: z.array(HrReportAttendanceRow),
        events: z.array(HrReportEvent),
        /** Monday first. */
        byWeekday: z.array(z.object({ day: z.string(), late: Count, absent: Count })),
    }),
    leave: z.object({
        byType: z.array(z.object({ type: z.string(), people: Count, days: z.number() })),
        taken: z.array(HrReportLeave),
        /** Leave asked in the period, by what came of it. */
        asked: z.object({ approved: Count, declined: Count, pending: Count, cancelled: Count }),
    }),
    /** The six months to the period's last; null for a reader without payroll access. */
    pay: z.array(HrReportPayMonth).nullable(),
    requests: z.object({
        claims: z.object({ asked: Count, approved: Count, approvedRwf: Count, pending: Count }),
        corrections: z.object({ asked: Count, approved: Count, declined: Count, pending: Count }),
        helpDesk: z.object({ opened: Count, closed: Count }),
    }),
});
export type HrReport = z.infer<typeof HrReport>;
