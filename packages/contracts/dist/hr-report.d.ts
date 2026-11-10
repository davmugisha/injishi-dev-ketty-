import { z } from "zod";
/** `GET /ops/hr/report?from&to`: at most a year. */
export declare const HrReportQuery: z.ZodEffects<z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>;
export type HrReportQuery = z.infer<typeof HrReportQuery>;
/** A person as the report names them. */
export declare const HrReportPerson: z.ZodObject<{
    employeeId: z.ZodString;
    name: z.ZodString;
    job: z.ZodNullable<z.ZodString>;
    team: z.ZodNullable<z.ZodString>;
    branch: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    branch: string | null;
    employeeId: string;
    team: string | null;
    job: string | null;
}, {
    name: string;
    branch: string | null;
    employeeId: string;
    team: string | null;
    job: string | null;
}>;
export type HrReportPerson = z.infer<typeof HrReportPerson>;
export declare const HrReportAttendanceRow: z.ZodObject<{
    employeeId: z.ZodString;
    name: z.ZodString;
    job: z.ZodNullable<z.ZodString>;
    team: z.ZodNullable<z.ZodString>;
    branch: z.ZodNullable<z.ZodString>;
} & {
    /** Rostered shifts that had started by the end of the period, or by now. */
    shifts: z.ZodNumber;
    present: z.ZodNumber;
    /** Rostered, no clock-in, and no approved leave that day. */
    absent: z.ZodNumber;
    onLeave: z.ZodNumber;
    late: z.ZodNumber;
    lateMinutes: z.ZodNumber;
    leftEarly: z.ZodNumber;
    /** Clock-ins HR marked not counted: the person was not at work. */
    notCounted: z.ZodNumber;
    workedMinutes: z.ZodNumber;
    overtimeMinutes: z.ZodNumber;
    approvedOvertimeMinutes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    branch: string | null;
    employeeId: string;
    lateMinutes: number;
    workedMinutes: number;
    overtimeMinutes: number;
    approvedOvertimeMinutes: number;
    late: number;
    team: string | null;
    shifts: number;
    job: string | null;
    present: number;
    absent: number;
    onLeave: number;
    leftEarly: number;
    notCounted: number;
}, {
    name: string;
    branch: string | null;
    employeeId: string;
    lateMinutes: number;
    workedMinutes: number;
    overtimeMinutes: number;
    approvedOvertimeMinutes: number;
    late: number;
    team: string | null;
    shifts: number;
    job: string | null;
    present: number;
    absent: number;
    onLeave: number;
    leftEarly: number;
    notCounted: number;
}>;
export type HrReportAttendanceRow = z.infer<typeof HrReportAttendanceRow>;
/** One day that went wrong for one person. */
export declare const HrReportEvent: z.ZodObject<{
    employeeId: z.ZodString;
    date: z.ZodString;
    kind: z.ZodEnum<["late", "absent", "left_early", "not_counted"]>;
    /** "07:00–15:00", Kigali. */
    shift: z.ZodNullable<z.ZodString>;
    /** The clock-in, "07:24", Kigali; null for an absence. */
    clockIn: z.ZodNullable<z.ZodString>;
    /** Minutes late or early; null for an absence or a clock-in not counted. */
    minutes: z.ZodNullable<z.ZodNumber>;
    note: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    shift: string | null;
    date: string;
    kind: "late" | "absent" | "left_early" | "not_counted";
    note: string | null;
    employeeId: string;
    clockIn: string | null;
    minutes: number | null;
}, {
    shift: string | null;
    date: string;
    kind: "late" | "absent" | "left_early" | "not_counted";
    note: string | null;
    employeeId: string;
    clockIn: string | null;
    minutes: number | null;
}>;
export type HrReportEvent = z.infer<typeof HrReportEvent>;
export declare const HrReportLeave: z.ZodObject<{
    employeeId: z.ZodString;
    name: z.ZodString;
    job: z.ZodNullable<z.ZodString>;
    team: z.ZodNullable<z.ZodString>;
    branch: z.ZodNullable<z.ZodString>;
} & {
    requestId: z.ZodString;
    type: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    /** The whole request, in working days as it was counted. */
    days: z.ZodNumber;
    /** The part of it inside the period. */
    daysInPeriod: z.ZodNumber;
    status: z.ZodEnum<["approved", "requested"]>;
    reason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    status: "approved" | "requested";
    name: string;
    reason: string | null;
    startsOn: string;
    branch: string | null;
    endsOn: string;
    employeeId: string;
    days: number;
    team: string | null;
    requestId: string;
    job: string | null;
    daysInPeriod: number;
}, {
    type: string;
    status: "approved" | "requested";
    name: string;
    reason: string | null;
    startsOn: string;
    branch: string | null;
    endsOn: string;
    employeeId: string;
    days: number;
    team: string | null;
    requestId: string;
    job: string | null;
    daysInPeriod: number;
}>;
export type HrReportLeave = z.infer<typeof HrReportLeave>;
export declare const HrReportPayMonth: z.ZodObject<{
    month: z.ZodString;
    status: z.ZodString;
    people: z.ZodNumber;
    grossRwf: z.ZodNumber;
    payeRwf: z.ZodNumber;
    employeeContributionsRwf: z.ZodNumber;
    employerContributionsRwf: z.ZodNumber;
    otherDeductionsRwf: z.ZodNumber;
    netRwf: z.ZodNumber;
    /** Gross plus what the employer pays on top. */
    employerCostRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: string;
    grossRwf: number;
    people: number;
    month: string;
    netRwf: number;
    payeRwf: number;
    employeeContributionsRwf: number;
    employerContributionsRwf: number;
    otherDeductionsRwf: number;
    employerCostRwf: number;
}, {
    status: string;
    grossRwf: number;
    people: number;
    month: string;
    netRwf: number;
    payeRwf: number;
    employeeContributionsRwf: number;
    employerContributionsRwf: number;
    otherDeductionsRwf: number;
    employerCostRwf: number;
}>;
export type HrReportPayMonth = z.infer<typeof HrReportPayMonth>;
export declare const HrReport: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    /** Kigali today: a period that runs past it is counted up to it. */
    today: z.ZodString;
    people: z.ZodObject<{
        atStart: z.ZodNumber;
        atEnd: z.ZodNumber;
        joined: z.ZodArray<z.ZodObject<{
            employeeId: z.ZodString;
            name: z.ZodString;
            job: z.ZodNullable<z.ZodString>;
            team: z.ZodNullable<z.ZodString>;
            branch: z.ZodNullable<z.ZodString>;
        } & {
            on: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }, {
            name: string;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }>, "many">;
        left: z.ZodArray<z.ZodObject<{
            employeeId: z.ZodString;
            name: z.ZodString;
            job: z.ZodNullable<z.ZodString>;
            team: z.ZodNullable<z.ZodString>;
            branch: z.ZodNullable<z.ZodString>;
        } & {
            on: z.ZodString;
            reason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            reason: string | null;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }, {
            name: string;
            reason: string | null;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }>, "many">;
        byTeam: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            count: number;
        }, {
            name: string;
            count: number;
        }>, "many">;
        byBranch: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            count: number;
        }, {
            name: string;
            count: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        left: {
            name: string;
            reason: string | null;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }[];
        atStart: number;
        atEnd: number;
        joined: {
            name: string;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }[];
        byTeam: {
            name: string;
            count: number;
        }[];
        byBranch: {
            name: string;
            count: number;
        }[];
    }, {
        left: {
            name: string;
            reason: string | null;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }[];
        atStart: number;
        atEnd: number;
        joined: {
            name: string;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }[];
        byTeam: {
            name: string;
            count: number;
        }[];
        byBranch: {
            name: string;
            count: number;
        }[];
    }>;
    attendance: z.ZodObject<{
        totals: z.ZodObject<Omit<{
            employeeId: z.ZodString;
            name: z.ZodString;
            job: z.ZodNullable<z.ZodString>;
            team: z.ZodNullable<z.ZodString>;
            branch: z.ZodNullable<z.ZodString>;
        } & {
            /** Rostered shifts that had started by the end of the period, or by now. */
            shifts: z.ZodNumber;
            present: z.ZodNumber;
            /** Rostered, no clock-in, and no approved leave that day. */
            absent: z.ZodNumber;
            onLeave: z.ZodNumber;
            late: z.ZodNumber;
            lateMinutes: z.ZodNumber;
            leftEarly: z.ZodNumber;
            /** Clock-ins HR marked not counted: the person was not at work. */
            notCounted: z.ZodNumber;
            workedMinutes: z.ZodNumber;
            overtimeMinutes: z.ZodNumber;
            approvedOvertimeMinutes: z.ZodNumber;
        }, "name" | "branch" | "employeeId" | "team" | "job">, "strip", z.ZodTypeAny, {
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            shifts: number;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        }, {
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            shifts: number;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        }>;
        people: z.ZodArray<z.ZodObject<{
            employeeId: z.ZodString;
            name: z.ZodString;
            job: z.ZodNullable<z.ZodString>;
            team: z.ZodNullable<z.ZodString>;
            branch: z.ZodNullable<z.ZodString>;
        } & {
            /** Rostered shifts that had started by the end of the period, or by now. */
            shifts: z.ZodNumber;
            present: z.ZodNumber;
            /** Rostered, no clock-in, and no approved leave that day. */
            absent: z.ZodNumber;
            onLeave: z.ZodNumber;
            late: z.ZodNumber;
            lateMinutes: z.ZodNumber;
            leftEarly: z.ZodNumber;
            /** Clock-ins HR marked not counted: the person was not at work. */
            notCounted: z.ZodNumber;
            workedMinutes: z.ZodNumber;
            overtimeMinutes: z.ZodNumber;
            approvedOvertimeMinutes: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            name: string;
            branch: string | null;
            employeeId: string;
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            team: string | null;
            shifts: number;
            job: string | null;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        }, {
            name: string;
            branch: string | null;
            employeeId: string;
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            team: string | null;
            shifts: number;
            job: string | null;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        }>, "many">;
        events: z.ZodArray<z.ZodObject<{
            employeeId: z.ZodString;
            date: z.ZodString;
            kind: z.ZodEnum<["late", "absent", "left_early", "not_counted"]>;
            /** "07:00–15:00", Kigali. */
            shift: z.ZodNullable<z.ZodString>;
            /** The clock-in, "07:24", Kigali; null for an absence. */
            clockIn: z.ZodNullable<z.ZodString>;
            /** Minutes late or early; null for an absence or a clock-in not counted. */
            minutes: z.ZodNullable<z.ZodNumber>;
            note: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            shift: string | null;
            date: string;
            kind: "late" | "absent" | "left_early" | "not_counted";
            note: string | null;
            employeeId: string;
            clockIn: string | null;
            minutes: number | null;
        }, {
            shift: string | null;
            date: string;
            kind: "late" | "absent" | "left_early" | "not_counted";
            note: string | null;
            employeeId: string;
            clockIn: string | null;
            minutes: number | null;
        }>, "many">;
        /** Monday first. */
        byWeekday: z.ZodArray<z.ZodObject<{
            day: z.ZodString;
            late: z.ZodNumber;
            absent: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            day: string;
            late: number;
            absent: number;
        }, {
            day: string;
            late: number;
            absent: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        people: {
            name: string;
            branch: string | null;
            employeeId: string;
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            team: string | null;
            shifts: number;
            job: string | null;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        }[];
        events: {
            shift: string | null;
            date: string;
            kind: "late" | "absent" | "left_early" | "not_counted";
            note: string | null;
            employeeId: string;
            clockIn: string | null;
            minutes: number | null;
        }[];
        totals: {
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            shifts: number;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        };
        byWeekday: {
            day: string;
            late: number;
            absent: number;
        }[];
    }, {
        people: {
            name: string;
            branch: string | null;
            employeeId: string;
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            team: string | null;
            shifts: number;
            job: string | null;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        }[];
        events: {
            shift: string | null;
            date: string;
            kind: "late" | "absent" | "left_early" | "not_counted";
            note: string | null;
            employeeId: string;
            clockIn: string | null;
            minutes: number | null;
        }[];
        totals: {
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            shifts: number;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        };
        byWeekday: {
            day: string;
            late: number;
            absent: number;
        }[];
    }>;
    leave: z.ZodObject<{
        byType: z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            people: z.ZodNumber;
            days: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: string;
            people: number;
            days: number;
        }, {
            type: string;
            people: number;
            days: number;
        }>, "many">;
        taken: z.ZodArray<z.ZodObject<{
            employeeId: z.ZodString;
            name: z.ZodString;
            job: z.ZodNullable<z.ZodString>;
            team: z.ZodNullable<z.ZodString>;
            branch: z.ZodNullable<z.ZodString>;
        } & {
            requestId: z.ZodString;
            type: z.ZodString;
            startsOn: z.ZodString;
            endsOn: z.ZodString;
            /** The whole request, in working days as it was counted. */
            days: z.ZodNumber;
            /** The part of it inside the period. */
            daysInPeriod: z.ZodNumber;
            status: z.ZodEnum<["approved", "requested"]>;
            reason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: string;
            status: "approved" | "requested";
            name: string;
            reason: string | null;
            startsOn: string;
            branch: string | null;
            endsOn: string;
            employeeId: string;
            days: number;
            team: string | null;
            requestId: string;
            job: string | null;
            daysInPeriod: number;
        }, {
            type: string;
            status: "approved" | "requested";
            name: string;
            reason: string | null;
            startsOn: string;
            branch: string | null;
            endsOn: string;
            employeeId: string;
            days: number;
            team: string | null;
            requestId: string;
            job: string | null;
            daysInPeriod: number;
        }>, "many">;
        /** Leave asked in the period, by what came of it. */
        asked: z.ZodObject<{
            approved: z.ZodNumber;
            declined: z.ZodNumber;
            pending: z.ZodNumber;
            cancelled: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            approved: number;
            pending: number;
            declined: number;
            cancelled: number;
        }, {
            approved: number;
            pending: number;
            declined: number;
            cancelled: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        taken: {
            type: string;
            status: "approved" | "requested";
            name: string;
            reason: string | null;
            startsOn: string;
            branch: string | null;
            endsOn: string;
            employeeId: string;
            days: number;
            team: string | null;
            requestId: string;
            job: string | null;
            daysInPeriod: number;
        }[];
        byType: {
            type: string;
            people: number;
            days: number;
        }[];
        asked: {
            approved: number;
            pending: number;
            declined: number;
            cancelled: number;
        };
    }, {
        taken: {
            type: string;
            status: "approved" | "requested";
            name: string;
            reason: string | null;
            startsOn: string;
            branch: string | null;
            endsOn: string;
            employeeId: string;
            days: number;
            team: string | null;
            requestId: string;
            job: string | null;
            daysInPeriod: number;
        }[];
        byType: {
            type: string;
            people: number;
            days: number;
        }[];
        asked: {
            approved: number;
            pending: number;
            declined: number;
            cancelled: number;
        };
    }>;
    /** The six months to the period's last; null for a reader without payroll access. */
    pay: z.ZodNullable<z.ZodArray<z.ZodObject<{
        month: z.ZodString;
        status: z.ZodString;
        people: z.ZodNumber;
        grossRwf: z.ZodNumber;
        payeRwf: z.ZodNumber;
        employeeContributionsRwf: z.ZodNumber;
        employerContributionsRwf: z.ZodNumber;
        otherDeductionsRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        /** Gross plus what the employer pays on top. */
        employerCostRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: string;
        grossRwf: number;
        people: number;
        month: string;
        netRwf: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        employerCostRwf: number;
    }, {
        status: string;
        grossRwf: number;
        people: number;
        month: string;
        netRwf: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        employerCostRwf: number;
    }>, "many">>;
    requests: z.ZodObject<{
        claims: z.ZodObject<{
            asked: z.ZodNumber;
            approved: z.ZodNumber;
            approvedRwf: z.ZodNumber;
            pending: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            approved: number;
            pending: number;
            asked: number;
            approvedRwf: number;
        }, {
            approved: number;
            pending: number;
            asked: number;
            approvedRwf: number;
        }>;
        corrections: z.ZodObject<{
            asked: z.ZodNumber;
            approved: z.ZodNumber;
            declined: z.ZodNumber;
            pending: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            approved: number;
            pending: number;
            declined: number;
            asked: number;
        }, {
            approved: number;
            pending: number;
            declined: number;
            asked: number;
        }>;
        helpDesk: z.ZodObject<{
            opened: z.ZodNumber;
            closed: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            closed: number;
            opened: number;
        }, {
            closed: number;
            opened: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        claims: {
            approved: number;
            pending: number;
            asked: number;
            approvedRwf: number;
        };
        helpDesk: {
            closed: number;
            opened: number;
        };
        corrections: {
            approved: number;
            pending: number;
            declined: number;
            asked: number;
        };
    }, {
        claims: {
            approved: number;
            pending: number;
            asked: number;
            approvedRwf: number;
        };
        helpDesk: {
            closed: number;
            opened: number;
        };
        corrections: {
            approved: number;
            pending: number;
            declined: number;
            asked: number;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    people: {
        left: {
            name: string;
            reason: string | null;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }[];
        atStart: number;
        atEnd: number;
        joined: {
            name: string;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }[];
        byTeam: {
            name: string;
            count: number;
        }[];
        byBranch: {
            name: string;
            count: number;
        }[];
    };
    requests: {
        claims: {
            approved: number;
            pending: number;
            asked: number;
            approvedRwf: number;
        };
        helpDesk: {
            closed: number;
            opened: number;
        };
        corrections: {
            approved: number;
            pending: number;
            declined: number;
            asked: number;
        };
    };
    from: string;
    to: string;
    pay: {
        status: string;
        grossRwf: number;
        people: number;
        month: string;
        netRwf: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        employerCostRwf: number;
    }[] | null;
    today: string;
    leave: {
        taken: {
            type: string;
            status: "approved" | "requested";
            name: string;
            reason: string | null;
            startsOn: string;
            branch: string | null;
            endsOn: string;
            employeeId: string;
            days: number;
            team: string | null;
            requestId: string;
            job: string | null;
            daysInPeriod: number;
        }[];
        byType: {
            type: string;
            people: number;
            days: number;
        }[];
        asked: {
            approved: number;
            pending: number;
            declined: number;
            cancelled: number;
        };
    };
    attendance: {
        people: {
            name: string;
            branch: string | null;
            employeeId: string;
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            team: string | null;
            shifts: number;
            job: string | null;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        }[];
        events: {
            shift: string | null;
            date: string;
            kind: "late" | "absent" | "left_early" | "not_counted";
            note: string | null;
            employeeId: string;
            clockIn: string | null;
            minutes: number | null;
        }[];
        totals: {
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            shifts: number;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        };
        byWeekday: {
            day: string;
            late: number;
            absent: number;
        }[];
    };
}, {
    people: {
        left: {
            name: string;
            reason: string | null;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }[];
        atStart: number;
        atEnd: number;
        joined: {
            name: string;
            branch: string | null;
            employeeId: string;
            on: string;
            team: string | null;
            job: string | null;
        }[];
        byTeam: {
            name: string;
            count: number;
        }[];
        byBranch: {
            name: string;
            count: number;
        }[];
    };
    requests: {
        claims: {
            approved: number;
            pending: number;
            asked: number;
            approvedRwf: number;
        };
        helpDesk: {
            closed: number;
            opened: number;
        };
        corrections: {
            approved: number;
            pending: number;
            declined: number;
            asked: number;
        };
    };
    from: string;
    to: string;
    pay: {
        status: string;
        grossRwf: number;
        people: number;
        month: string;
        netRwf: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        employerCostRwf: number;
    }[] | null;
    today: string;
    leave: {
        taken: {
            type: string;
            status: "approved" | "requested";
            name: string;
            reason: string | null;
            startsOn: string;
            branch: string | null;
            endsOn: string;
            employeeId: string;
            days: number;
            team: string | null;
            requestId: string;
            job: string | null;
            daysInPeriod: number;
        }[];
        byType: {
            type: string;
            people: number;
            days: number;
        }[];
        asked: {
            approved: number;
            pending: number;
            declined: number;
            cancelled: number;
        };
    };
    attendance: {
        people: {
            name: string;
            branch: string | null;
            employeeId: string;
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            team: string | null;
            shifts: number;
            job: string | null;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        }[];
        events: {
            shift: string | null;
            date: string;
            kind: "late" | "absent" | "left_early" | "not_counted";
            note: string | null;
            employeeId: string;
            clockIn: string | null;
            minutes: number | null;
        }[];
        totals: {
            lateMinutes: number;
            workedMinutes: number;
            overtimeMinutes: number;
            approvedOvertimeMinutes: number;
            late: number;
            shifts: number;
            present: number;
            absent: number;
            onLeave: number;
            leftEarly: number;
            notCounted: number;
        };
        byWeekday: {
            day: string;
            late: number;
            absent: number;
        }[];
    };
}>;
export type HrReport = z.infer<typeof HrReport>;
//# sourceMappingURL=hr-report.d.ts.map