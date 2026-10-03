import { z } from "zod";
/**
 * The HR module's pay side (ADR-058, first thread): pay runs and payslips.
 *
 * Every route here needs `payroll.run`. A draft run is only a preview: confirm
 * computes it again inside its own transaction and freezes what it computed, and
 * a confirmed run never changes (AC-Y3). A mistake is an adjustment on a later
 * run, which arrives with `058-payroll.md`.
 *
 * Money is whole Rwandan francs. The PAYE bands and RSSB contributions are
 * `config_entries` rows read at compute time; the run records which rows and
 * versions it used, so an old payslip can say which rule made it.
 */
/** `YYYY-MM`. */
export declare const PayPeriod: z.ZodString;
export type PayPeriod = z.infer<typeof PayPeriod>;
export declare const PayRunStatus: z.ZodEnum<["draft", "confirmed"]>;
export type PayRunStatus = z.infer<typeof PayRunStatus>;
/**
 * Which column a line counts towards.
 *
 * `earning` adds to gross (a negative earning, such as unpaid leave, takes
 * from it). `employee` is withheld from the person: PAYE and their share of each
 * contribution. `employer` is the business's share, shown and declared and
 * never deducted.
 */
export declare const PayslipLineSide: z.ZodEnum<["earning", "employee", "employer"]>;
export type PayslipLineSide = z.infer<typeof PayslipLineSide>;
export declare const PayslipLine: z.ZodObject<{
    /** `wage`, `unpaid_leave`, `paye`, or a contribution code from the RSSB rule. */
    code: z.ZodString;
    label: z.ZodString;
    /** The contract a wage line belongs to; null for a line of the whole payslip. */
    contractId: z.ZodNullable<z.ZodString>;
    /** How the amount was reached, in words a person can check. */
    basis: z.ZodString;
    amountRwf: z.ZodNumber;
    side: z.ZodEnum<["earning", "employee", "employer"]>;
}, "strip", z.ZodTypeAny, {
    code: string;
    amountRwf: number;
    label: string;
    contractId: string | null;
    basis: string;
    side: "employee" | "earning" | "employer";
}, {
    code: string;
    amountRwf: number;
    label: string;
    contractId: string | null;
    basis: string;
    side: "employee" | "earning" | "employer";
}>;
export type PayslipLine = z.infer<typeof PayslipLine>;
export declare const Payslip: z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    employeeNumber: z.ZodString;
    displayName: z.ZodString;
    /** The contract in force on the person's last payable day in the month. */
    contractId: z.ZodString;
    payableDays: z.ZodNumber;
    grossRwf: z.ZodNumber;
    payeRwf: z.ZodNumber;
    employeeContributionsRwf: z.ZodNumber;
    employerContributionsRwf: z.ZodNumber;
    otherDeductionsRwf: z.ZodNumber;
    netRwf: z.ZodNumber;
    lines: z.ZodArray<z.ZodObject<{
        /** `wage`, `unpaid_leave`, `paye`, or a contribution code from the RSSB rule. */
        code: z.ZodString;
        label: z.ZodString;
        /** The contract a wage line belongs to; null for a line of the whole payslip. */
        contractId: z.ZodNullable<z.ZodString>;
        /** How the amount was reached, in words a person can check. */
        basis: z.ZodString;
        amountRwf: z.ZodNumber;
        side: z.ZodEnum<["earning", "employee", "employer"]>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        amountRwf: number;
        label: string;
        contractId: string | null;
        basis: string;
        side: "employee" | "earning" | "employer";
    }, {
        code: string;
        amountRwf: number;
        label: string;
        contractId: string | null;
        basis: string;
        side: "employee" | "earning" | "employer";
    }>, "many">;
    status: z.ZodEnum<["draft", "confirmed"]>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "confirmed";
    id: string;
    grossRwf: number;
    lines: {
        code: string;
        amountRwf: number;
        label: string;
        contractId: string | null;
        basis: string;
        side: "employee" | "earning" | "employer";
    }[];
    employeeId: string;
    displayName: string;
    employeeNumber: string;
    contractId: string;
    payableDays: number;
    payeRwf: number;
    employeeContributionsRwf: number;
    employerContributionsRwf: number;
    otherDeductionsRwf: number;
    netRwf: number;
}, {
    status: "draft" | "confirmed";
    id: string;
    grossRwf: number;
    lines: {
        code: string;
        amountRwf: number;
        label: string;
        contractId: string | null;
        basis: string;
        side: "employee" | "earning" | "employer";
    }[];
    employeeId: string;
    displayName: string;
    employeeNumber: string;
    contractId: string;
    payableDays: number;
    payeRwf: number;
    employeeContributionsRwf: number;
    employerContributionsRwf: number;
    otherDeductionsRwf: number;
    netRwf: number;
}>;
export type Payslip = z.infer<typeof Payslip>;
/** The rule rows a run was computed from, so the figures can be traced. */
export declare const PayRunRuleVersion: z.ZodObject<{
    configType: z.ZodString;
    configEntryId: z.ZodString;
    version: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    configType: string;
    version: number;
    configEntryId: string;
}, {
    configType: string;
    version: number;
    configEntryId: string;
}>;
export type PayRunRuleVersion = z.infer<typeof PayRunRuleVersion>;
/** Why a run cannot be confirmed yet. Every blocker is listed, never only the first. */
export declare const PayRunBlockerCode: z.ZodEnum<["missing_rssb_number", "missing_id", "open_attendance", "unvalidated_self_attendance"]>;
export type PayRunBlockerCode = z.infer<typeof PayRunBlockerCode>;
export declare const PayRunBlocker: z.ZodObject<{
    code: z.ZodEnum<["missing_rssb_number", "missing_id", "open_attendance", "unvalidated_self_attendance"]>;
    employeeId: z.ZodString;
    displayName: z.ZodString;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_self_attendance";
    message: string;
    employeeId: string;
    displayName: string;
}, {
    code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_self_attendance";
    message: string;
    employeeId: string;
    displayName: string;
}>;
export type PayRunBlocker = z.infer<typeof PayRunBlocker>;
export declare const PayRun: z.ZodObject<{
    id: z.ZodString;
    period: z.ZodString;
    periodStart: z.ZodString;
    status: z.ZodEnum<["draft", "confirmed"]>;
    computedAt: z.ZodString;
    ruleVersions: z.ZodArray<z.ZodObject<{
        configType: z.ZodString;
        configEntryId: z.ZodString;
        version: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        configType: string;
        version: number;
        configEntryId: string;
    }, {
        configType: string;
        version: number;
        configEntryId: string;
    }>, "many">;
    confirmedAt: z.ZodNullable<z.ZodString>;
    confirmedByUserId: z.ZodNullable<z.ZodString>;
    headcount: z.ZodNumber;
    grossRwf: z.ZodNumber;
    netRwf: z.ZodNumber;
    payeRwf: z.ZodNumber;
    employeeContributionsRwf: z.ZodNumber;
    employerContributionsRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "confirmed";
    id: string;
    periodStart: string;
    grossRwf: number;
    confirmedAt: string | null;
    payeRwf: number;
    employeeContributionsRwf: number;
    employerContributionsRwf: number;
    netRwf: number;
    period: string;
    computedAt: string;
    ruleVersions: {
        configType: string;
        version: number;
        configEntryId: string;
    }[];
    confirmedByUserId: string | null;
    headcount: number;
}, {
    status: "draft" | "confirmed";
    id: string;
    periodStart: string;
    grossRwf: number;
    confirmedAt: string | null;
    payeRwf: number;
    employeeContributionsRwf: number;
    employerContributionsRwf: number;
    netRwf: number;
    period: string;
    computedAt: string;
    ruleVersions: {
        configType: string;
        version: number;
        configEntryId: string;
    }[];
    confirmedByUserId: string | null;
    headcount: number;
}>;
export type PayRun = z.infer<typeof PayRun>;
export declare const PayRunList: z.ZodObject<{
    runs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        period: z.ZodString;
        periodStart: z.ZodString;
        status: z.ZodEnum<["draft", "confirmed"]>;
        computedAt: z.ZodString;
        ruleVersions: z.ZodArray<z.ZodObject<{
            configType: z.ZodString;
            configEntryId: z.ZodString;
            version: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            configType: string;
            version: number;
            configEntryId: string;
        }, {
            configType: string;
            version: number;
            configEntryId: string;
        }>, "many">;
        confirmedAt: z.ZodNullable<z.ZodString>;
        confirmedByUserId: z.ZodNullable<z.ZodString>;
        headcount: z.ZodNumber;
        grossRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        payeRwf: z.ZodNumber;
        employeeContributionsRwf: z.ZodNumber;
        employerContributionsRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }, {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    runs: {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }[];
}, {
    runs: {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }[];
}>;
export type PayRunList = z.infer<typeof PayRunList>;
/** `GET /ops/pay-runs/:id`: the run, its payslips, and what blocks confirming it. */
export declare const PayRunDetail: z.ZodObject<{
    run: z.ZodObject<{
        id: z.ZodString;
        period: z.ZodString;
        periodStart: z.ZodString;
        status: z.ZodEnum<["draft", "confirmed"]>;
        computedAt: z.ZodString;
        ruleVersions: z.ZodArray<z.ZodObject<{
            configType: z.ZodString;
            configEntryId: z.ZodString;
            version: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            configType: string;
            version: number;
            configEntryId: string;
        }, {
            configType: string;
            version: number;
            configEntryId: string;
        }>, "many">;
        confirmedAt: z.ZodNullable<z.ZodString>;
        confirmedByUserId: z.ZodNullable<z.ZodString>;
        headcount: z.ZodNumber;
        grossRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        payeRwf: z.ZodNumber;
        employeeContributionsRwf: z.ZodNumber;
        employerContributionsRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }, {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }>;
    payslips: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        employeeNumber: z.ZodString;
        displayName: z.ZodString;
        /** The contract in force on the person's last payable day in the month. */
        contractId: z.ZodString;
        payableDays: z.ZodNumber;
        grossRwf: z.ZodNumber;
        payeRwf: z.ZodNumber;
        employeeContributionsRwf: z.ZodNumber;
        employerContributionsRwf: z.ZodNumber;
        otherDeductionsRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        lines: z.ZodArray<z.ZodObject<{
            /** `wage`, `unpaid_leave`, `paye`, or a contribution code from the RSSB rule. */
            code: z.ZodString;
            label: z.ZodString;
            /** The contract a wage line belongs to; null for a line of the whole payslip. */
            contractId: z.ZodNullable<z.ZodString>;
            /** How the amount was reached, in words a person can check. */
            basis: z.ZodString;
            amountRwf: z.ZodNumber;
            side: z.ZodEnum<["earning", "employee", "employer"]>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "employee" | "earning" | "employer";
        }, {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "employee" | "earning" | "employer";
        }>, "many">;
        status: z.ZodEnum<["draft", "confirmed"]>;
    }, "strip", z.ZodTypeAny, {
        status: "draft" | "confirmed";
        id: string;
        grossRwf: number;
        lines: {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "employee" | "earning" | "employer";
        }[];
        employeeId: string;
        displayName: string;
        employeeNumber: string;
        contractId: string;
        payableDays: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        netRwf: number;
    }, {
        status: "draft" | "confirmed";
        id: string;
        grossRwf: number;
        lines: {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "employee" | "earning" | "employer";
        }[];
        employeeId: string;
        displayName: string;
        employeeNumber: string;
        contractId: string;
        payableDays: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        netRwf: number;
    }>, "many">;
    blockers: z.ZodArray<z.ZodObject<{
        code: z.ZodEnum<["missing_rssb_number", "missing_id", "open_attendance", "unvalidated_self_attendance"]>;
        employeeId: z.ZodString;
        displayName: z.ZodString;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_self_attendance";
        message: string;
        employeeId: string;
        displayName: string;
    }, {
        code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_self_attendance";
        message: string;
        employeeId: string;
        displayName: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    run: {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    };
    payslips: {
        status: "draft" | "confirmed";
        id: string;
        grossRwf: number;
        lines: {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "employee" | "earning" | "employer";
        }[];
        employeeId: string;
        displayName: string;
        employeeNumber: string;
        contractId: string;
        payableDays: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        netRwf: number;
    }[];
    blockers: {
        code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_self_attendance";
        message: string;
        employeeId: string;
        displayName: string;
    }[];
}, {
    run: {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    };
    payslips: {
        status: "draft" | "confirmed";
        id: string;
        grossRwf: number;
        lines: {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "employee" | "earning" | "employer";
        }[];
        employeeId: string;
        displayName: string;
        employeeNumber: string;
        contractId: string;
        payableDays: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        netRwf: number;
    }[];
    blockers: {
        code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_self_attendance";
        message: string;
        employeeId: string;
        displayName: string;
    }[];
}>;
export type PayRunDetail = z.infer<typeof PayRunDetail>;
export declare const CreatePayRunRequest: z.ZodObject<{
    period: z.ZodString;
}, "strip", z.ZodTypeAny, {
    period: string;
}, {
    period: string;
}>;
export type CreatePayRunRequest = z.infer<typeof CreatePayRunRequest>;
//# sourceMappingURL=payroll.d.ts.map