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
 * never deducted. `deduction` is withheld besides those (a deduction, a loan
 * installment, a fine). `passthrough` is money that is not income, such as a
 * reimbursement or a loan paid out: paid with the net, outside gross, never
 * taxed or declared (058-payroll AC-PY6a).
 */
export declare const PayslipLineSide: z.ZodEnum<["earning", "employee", "employer", "deduction", "passthrough"]>;
export type PayslipLineSide = z.infer<typeof PayslipLineSide>;
/** What a line pays for or takes back, so the row behind it can be marked paid at confirm. */
export declare const PayslipLineRef: z.ZodObject<{
    kind: z.ZodEnum<["loan_installment", "loan", "claim", "adjustment", "leave_type"]>;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
    id: string;
}, {
    kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
    id: string;
}>;
export type PayslipLineRef = z.infer<typeof PayslipLineRef>;
export declare const PayslipLine: z.ZodObject<{
    /**
     * `wage`, `daily_wage`, `hourly_wage`, `paid_leave`, `unpaid_leave`,
     * `partly_paid_leave`, `overtime`, `allowance:<code>`, `deduction:<code>`,
     * `loan`, `loan_paid_out`, `reimbursement`, `leave_encashment`,
     * `settlement_leave`, `settlement_notice`, `settlement_severance`,
     * `adjustment`, `paye`, or a contribution code from the RSSB rule.
     */
    code: z.ZodString;
    label: z.ZodString;
    /** The contract a wage line belongs to; null for a line of the whole payslip. */
    contractId: z.ZodNullable<z.ZodString>;
    /** How the amount was reached, in words a person can check. */
    basis: z.ZodString;
    amountRwf: z.ZodNumber;
    side: z.ZodEnum<["earning", "employee", "employer", "deduction", "passthrough"]>;
    /** An earning: whether it is taxed. Absent on a line written before 058-payroll, which was. */
    taxable: z.ZodOptional<z.ZodBoolean>;
    /** An earning: whether it counts in the contribution base. */
    contributable: z.ZodOptional<z.ZodBoolean>;
    /** A deduction taken before tax, which lowers the taxable base. */
    beforeTax: z.ZodOptional<z.ZodBoolean>;
    /** The PAYE line: the base the bands were applied to, for the declaration. */
    taxBase: z.ZodOptional<z.ZodNumber>;
    ref: z.ZodOptional<z.ZodObject<{
        kind: z.ZodEnum<["loan_installment", "loan", "claim", "adjustment", "leave_type"]>;
        id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
        id: string;
    }, {
        kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
        id: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    amountRwf: number;
    label: string;
    contractId: string | null;
    basis: string;
    side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
    ref?: {
        kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
        id: string;
    } | undefined;
    taxable?: boolean | undefined;
    contributable?: boolean | undefined;
    beforeTax?: boolean | undefined;
    taxBase?: number | undefined;
}, {
    code: string;
    amountRwf: number;
    label: string;
    contractId: string | null;
    basis: string;
    side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
    ref?: {
        kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
        id: string;
    } | undefined;
    taxable?: boolean | undefined;
    contributable?: boolean | undefined;
    beforeTax?: boolean | undefined;
    taxBase?: number | undefined;
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
    /** Money paid with the net that is not income (058-payroll AC-PY6a). */
    nonIncomeRwf: z.ZodNumber;
    netRwf: z.ZodNumber;
    lines: z.ZodArray<z.ZodObject<{
        /**
         * `wage`, `daily_wage`, `hourly_wage`, `paid_leave`, `unpaid_leave`,
         * `partly_paid_leave`, `overtime`, `allowance:<code>`, `deduction:<code>`,
         * `loan`, `loan_paid_out`, `reimbursement`, `leave_encashment`,
         * `settlement_leave`, `settlement_notice`, `settlement_severance`,
         * `adjustment`, `paye`, or a contribution code from the RSSB rule.
         */
        code: z.ZodString;
        label: z.ZodString;
        /** The contract a wage line belongs to; null for a line of the whole payslip. */
        contractId: z.ZodNullable<z.ZodString>;
        /** How the amount was reached, in words a person can check. */
        basis: z.ZodString;
        amountRwf: z.ZodNumber;
        side: z.ZodEnum<["earning", "employee", "employer", "deduction", "passthrough"]>;
        /** An earning: whether it is taxed. Absent on a line written before 058-payroll, which was. */
        taxable: z.ZodOptional<z.ZodBoolean>;
        /** An earning: whether it counts in the contribution base. */
        contributable: z.ZodOptional<z.ZodBoolean>;
        /** A deduction taken before tax, which lowers the taxable base. */
        beforeTax: z.ZodOptional<z.ZodBoolean>;
        /** The PAYE line: the base the bands were applied to, for the declaration. */
        taxBase: z.ZodOptional<z.ZodNumber>;
        ref: z.ZodOptional<z.ZodObject<{
            kind: z.ZodEnum<["loan_installment", "loan", "claim", "adjustment", "leave_type"]>;
            id: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
            id: string;
        }, {
            kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
            id: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        amountRwf: number;
        label: string;
        contractId: string | null;
        basis: string;
        side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
        ref?: {
            kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
            id: string;
        } | undefined;
        taxable?: boolean | undefined;
        contributable?: boolean | undefined;
        beforeTax?: boolean | undefined;
        taxBase?: number | undefined;
    }, {
        code: string;
        amountRwf: number;
        label: string;
        contractId: string | null;
        basis: string;
        side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
        ref?: {
            kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
            id: string;
        } | undefined;
        taxable?: boolean | undefined;
        contributable?: boolean | undefined;
        beforeTax?: boolean | undefined;
        taxBase?: number | undefined;
    }>, "many">;
    status: z.ZodEnum<["draft", "confirmed"]>;
    /** Paid status, on a confirmed payslip only (058-payroll AC-PY10). */
    paidAt: z.ZodNullable<z.ZodString>;
    paidMethod: z.ZodNullable<z.ZodEnum<["bank", "momo", "cash"]>>;
    paidReference: z.ZodNullable<z.ZodString>;
    sentAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "draft" | "confirmed";
    id: string;
    grossRwf: number;
    paidAt: string | null;
    contractId: string;
    employeeId: string;
    employeeNumber: string;
    displayName: string;
    payableDays: number;
    payeRwf: number;
    employeeContributionsRwf: number;
    employerContributionsRwf: number;
    otherDeductionsRwf: number;
    nonIncomeRwf: number;
    netRwf: number;
    lines: {
        code: string;
        amountRwf: number;
        label: string;
        contractId: string | null;
        basis: string;
        side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
        ref?: {
            kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
            id: string;
        } | undefined;
        taxable?: boolean | undefined;
        contributable?: boolean | undefined;
        beforeTax?: boolean | undefined;
        taxBase?: number | undefined;
    }[];
    paidMethod: "cash" | "bank" | "momo" | null;
    paidReference: string | null;
    sentAt: string | null;
}, {
    status: "draft" | "confirmed";
    id: string;
    grossRwf: number;
    paidAt: string | null;
    contractId: string;
    employeeId: string;
    employeeNumber: string;
    displayName: string;
    payableDays: number;
    payeRwf: number;
    employeeContributionsRwf: number;
    employerContributionsRwf: number;
    otherDeductionsRwf: number;
    nonIncomeRwf: number;
    netRwf: number;
    lines: {
        code: string;
        amountRwf: number;
        label: string;
        contractId: string | null;
        basis: string;
        side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
        ref?: {
            kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
            id: string;
        } | undefined;
        taxable?: boolean | undefined;
        contributable?: boolean | undefined;
        beforeTax?: boolean | undefined;
        taxBase?: number | undefined;
    }[];
    paidMethod: "cash" | "bank" | "momo" | null;
    paidReference: string | null;
    sentAt: string | null;
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
export declare const PayRunBlockerCode: z.ZodEnum<["missing_rssb_number", "missing_id", "open_attendance", "unvalidated_attendance", "negative_net", "missing_overtime_rule", "overtime_day_unknown", "missing_settlement_rule", "missing_rssb_employer_number"]>;
export type PayRunBlockerCode = z.infer<typeof PayRunBlockerCode>;
/** What a person can do about a negative net (AC-PY7). */
export declare const PayRunRemedy: z.ZodEnum<["defer_installment", "waive_adjustment", "hold_payslip"]>;
export type PayRunRemedy = z.infer<typeof PayRunRemedy>;
export declare const PayRunBlocker: z.ZodObject<{
    code: z.ZodEnum<["missing_rssb_number", "missing_id", "open_attendance", "unvalidated_attendance", "negative_net", "missing_overtime_rule", "overtime_day_unknown", "missing_settlement_rule", "missing_rssb_employer_number"]>;
    /** Null for a blocker of the whole run, such as a missing rule. */
    employeeId: z.ZodNullable<z.ZodString>;
    displayName: z.ZodString;
    message: z.ZodString;
    remedies: z.ZodOptional<z.ZodArray<z.ZodEnum<["defer_installment", "waive_adjustment", "hold_payslip"]>, "many">>;
}, "strip", z.ZodTypeAny, {
    code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_attendance" | "negative_net" | "missing_overtime_rule" | "overtime_day_unknown" | "missing_settlement_rule" | "missing_rssb_employer_number";
    message: string;
    employeeId: string | null;
    displayName: string;
    remedies?: ("defer_installment" | "waive_adjustment" | "hold_payslip")[] | undefined;
}, {
    code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_attendance" | "negative_net" | "missing_overtime_rule" | "overtime_day_unknown" | "missing_settlement_rule" | "missing_rssb_employer_number";
    message: string;
    employeeId: string | null;
    displayName: string;
    remedies?: ("defer_installment" | "waive_adjustment" | "hold_payslip")[] | undefined;
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
        /** Money paid with the net that is not income (058-payroll AC-PY6a). */
        nonIncomeRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        lines: z.ZodArray<z.ZodObject<{
            /**
             * `wage`, `daily_wage`, `hourly_wage`, `paid_leave`, `unpaid_leave`,
             * `partly_paid_leave`, `overtime`, `allowance:<code>`, `deduction:<code>`,
             * `loan`, `loan_paid_out`, `reimbursement`, `leave_encashment`,
             * `settlement_leave`, `settlement_notice`, `settlement_severance`,
             * `adjustment`, `paye`, or a contribution code from the RSSB rule.
             */
            code: z.ZodString;
            label: z.ZodString;
            /** The contract a wage line belongs to; null for a line of the whole payslip. */
            contractId: z.ZodNullable<z.ZodString>;
            /** How the amount was reached, in words a person can check. */
            basis: z.ZodString;
            amountRwf: z.ZodNumber;
            side: z.ZodEnum<["earning", "employee", "employer", "deduction", "passthrough"]>;
            /** An earning: whether it is taxed. Absent on a line written before 058-payroll, which was. */
            taxable: z.ZodOptional<z.ZodBoolean>;
            /** An earning: whether it counts in the contribution base. */
            contributable: z.ZodOptional<z.ZodBoolean>;
            /** A deduction taken before tax, which lowers the taxable base. */
            beforeTax: z.ZodOptional<z.ZodBoolean>;
            /** The PAYE line: the base the bands were applied to, for the declaration. */
            taxBase: z.ZodOptional<z.ZodNumber>;
            ref: z.ZodOptional<z.ZodObject<{
                kind: z.ZodEnum<["loan_installment", "loan", "claim", "adjustment", "leave_type"]>;
                id: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
                id: string;
            }, {
                kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
                id: string;
            }>>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
            ref?: {
                kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
                id: string;
            } | undefined;
            taxable?: boolean | undefined;
            contributable?: boolean | undefined;
            beforeTax?: boolean | undefined;
            taxBase?: number | undefined;
        }, {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
            ref?: {
                kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
                id: string;
            } | undefined;
            taxable?: boolean | undefined;
            contributable?: boolean | undefined;
            beforeTax?: boolean | undefined;
            taxBase?: number | undefined;
        }>, "many">;
        status: z.ZodEnum<["draft", "confirmed"]>;
        /** Paid status, on a confirmed payslip only (058-payroll AC-PY10). */
        paidAt: z.ZodNullable<z.ZodString>;
        paidMethod: z.ZodNullable<z.ZodEnum<["bank", "momo", "cash"]>>;
        paidReference: z.ZodNullable<z.ZodString>;
        sentAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "draft" | "confirmed";
        id: string;
        grossRwf: number;
        paidAt: string | null;
        contractId: string;
        employeeId: string;
        employeeNumber: string;
        displayName: string;
        payableDays: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        nonIncomeRwf: number;
        netRwf: number;
        lines: {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
            ref?: {
                kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
                id: string;
            } | undefined;
            taxable?: boolean | undefined;
            contributable?: boolean | undefined;
            beforeTax?: boolean | undefined;
            taxBase?: number | undefined;
        }[];
        paidMethod: "cash" | "bank" | "momo" | null;
        paidReference: string | null;
        sentAt: string | null;
    }, {
        status: "draft" | "confirmed";
        id: string;
        grossRwf: number;
        paidAt: string | null;
        contractId: string;
        employeeId: string;
        employeeNumber: string;
        displayName: string;
        payableDays: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        nonIncomeRwf: number;
        netRwf: number;
        lines: {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
            ref?: {
                kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
                id: string;
            } | undefined;
            taxable?: boolean | undefined;
            contributable?: boolean | undefined;
            beforeTax?: boolean | undefined;
            taxBase?: number | undefined;
        }[];
        paidMethod: "cash" | "bank" | "momo" | null;
        paidReference: string | null;
        sentAt: string | null;
    }>, "many">;
    blockers: z.ZodArray<z.ZodObject<{
        code: z.ZodEnum<["missing_rssb_number", "missing_id", "open_attendance", "unvalidated_attendance", "negative_net", "missing_overtime_rule", "overtime_day_unknown", "missing_settlement_rule", "missing_rssb_employer_number"]>;
        /** Null for a blocker of the whole run, such as a missing rule. */
        employeeId: z.ZodNullable<z.ZodString>;
        displayName: z.ZodString;
        message: z.ZodString;
        remedies: z.ZodOptional<z.ZodArray<z.ZodEnum<["defer_installment", "waive_adjustment", "hold_payslip"]>, "many">>;
    }, "strip", z.ZodTypeAny, {
        code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_attendance" | "negative_net" | "missing_overtime_rule" | "overtime_day_unknown" | "missing_settlement_rule" | "missing_rssb_employer_number";
        message: string;
        employeeId: string | null;
        displayName: string;
        remedies?: ("defer_installment" | "waive_adjustment" | "hold_payslip")[] | undefined;
    }, {
        code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_attendance" | "negative_net" | "missing_overtime_rule" | "overtime_day_unknown" | "missing_settlement_rule" | "missing_rssb_employer_number";
        message: string;
        employeeId: string | null;
        displayName: string;
        remedies?: ("defer_installment" | "waive_adjustment" | "hold_payslip")[] | undefined;
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
        paidAt: string | null;
        contractId: string;
        employeeId: string;
        employeeNumber: string;
        displayName: string;
        payableDays: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        nonIncomeRwf: number;
        netRwf: number;
        lines: {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
            ref?: {
                kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
                id: string;
            } | undefined;
            taxable?: boolean | undefined;
            contributable?: boolean | undefined;
            beforeTax?: boolean | undefined;
            taxBase?: number | undefined;
        }[];
        paidMethod: "cash" | "bank" | "momo" | null;
        paidReference: string | null;
        sentAt: string | null;
    }[];
    blockers: {
        code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_attendance" | "negative_net" | "missing_overtime_rule" | "overtime_day_unknown" | "missing_settlement_rule" | "missing_rssb_employer_number";
        message: string;
        employeeId: string | null;
        displayName: string;
        remedies?: ("defer_installment" | "waive_adjustment" | "hold_payslip")[] | undefined;
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
        paidAt: string | null;
        contractId: string;
        employeeId: string;
        employeeNumber: string;
        displayName: string;
        payableDays: number;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        otherDeductionsRwf: number;
        nonIncomeRwf: number;
        netRwf: number;
        lines: {
            code: string;
            amountRwf: number;
            label: string;
            contractId: string | null;
            basis: string;
            side: "passthrough" | "employee" | "earning" | "employer" | "deduction";
            ref?: {
                kind: "adjustment" | "loan_installment" | "loan" | "claim" | "leave_type";
                id: string;
            } | undefined;
            taxable?: boolean | undefined;
            contributable?: boolean | undefined;
            beforeTax?: boolean | undefined;
            taxBase?: number | undefined;
        }[];
        paidMethod: "cash" | "bank" | "momo" | null;
        paidReference: string | null;
        sentAt: string | null;
    }[];
    blockers: {
        code: "missing_rssb_number" | "missing_id" | "open_attendance" | "unvalidated_attendance" | "negative_net" | "missing_overtime_rule" | "overtime_day_unknown" | "missing_settlement_rule" | "missing_rssb_employer_number";
        message: string;
        employeeId: string | null;
        displayName: string;
        remedies?: ("defer_installment" | "waive_adjustment" | "hold_payslip")[] | undefined;
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