"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePayRunRequest = exports.PayRunDetail = exports.PayRun = exports.PayRunBlocker = exports.PayRunRemedy = exports.PayRunBlockerCode = exports.PayRunRuleVersion = exports.Payslip = exports.PayslipLine = exports.PayslipLineRef = exports.PayslipLineSide = exports.PayRunStatus = exports.PayPeriod = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const primitives_1 = require("./primitives");
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
exports.PayPeriod = zod_1.z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A pay period is YYYY-MM.");
exports.PayRunStatus = zod_1.z.enum(["draft", "confirmed"]);
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
exports.PayslipLineSide = zod_1.z.enum(["earning", "employee", "employer", "deduction", "passthrough"]);
/** What a line pays for or takes back, so the row behind it can be marked paid at confirm. */
exports.PayslipLineRef = zod_1.z.object({
    kind: zod_1.z.enum(["loan_installment", "loan", "claim", "adjustment", "leave_type"]),
    id: primitives_1.Uuid,
});
exports.PayslipLine = zod_1.z.object({
    /**
     * `wage`, `daily_wage`, `hourly_wage`, `paid_leave`, `unpaid_leave`,
     * `partly_paid_leave`, `overtime`, `allowance:<code>`, `deduction:<code>`,
     * `loan`, `loan_paid_out`, `reimbursement`, `leave_encashment`,
     * `settlement_leave`, `settlement_notice`, `settlement_severance`,
     * `adjustment`, `paye`, or a contribution code from the RSSB rule.
     */
    code: zod_1.z.string(),
    label: zod_1.z.string(),
    /** The contract a wage line belongs to; null for a line of the whole payslip. */
    contractId: primitives_1.Uuid.nullable(),
    /** How the amount was reached, in words a person can check. */
    basis: zod_1.z.string(),
    amountRwf: zod_1.z.number().int(),
    side: exports.PayslipLineSide,
    /** An earning: whether it is taxed. Absent on a line written before 058-payroll, which was. */
    taxable: zod_1.z.boolean().optional(),
    /** An earning: whether it counts in the contribution base. */
    contributable: zod_1.z.boolean().optional(),
    /** A deduction taken before tax, which lowers the taxable base. */
    beforeTax: zod_1.z.boolean().optional(),
    /** The PAYE line: the base the bands were applied to, for the declaration. */
    taxBase: zod_1.z.number().int().optional(),
    ref: exports.PayslipLineRef.optional(),
});
exports.Payslip = zod_1.z.object({
    id: primitives_1.Uuid,
    employeeId: primitives_1.Uuid,
    employeeNumber: zod_1.z.string(),
    displayName: zod_1.z.string(),
    /** The contract in force on the person's last payable day in the month. */
    contractId: primitives_1.Uuid,
    payableDays: zod_1.z.number(),
    grossRwf: zod_1.z.number().int(),
    payeRwf: zod_1.z.number().int(),
    employeeContributionsRwf: zod_1.z.number().int(),
    employerContributionsRwf: zod_1.z.number().int(),
    otherDeductionsRwf: zod_1.z.number().int(),
    /** Money paid with the net that is not income (058-payroll AC-PY6a). */
    nonIncomeRwf: zod_1.z.number().int(),
    netRwf: zod_1.z.number().int(),
    lines: zod_1.z.array(exports.PayslipLine),
    status: exports.PayRunStatus,
    /** Paid status, on a confirmed payslip only (058-payroll AC-PY10). */
    paidAt: zod_1.z.string().nullable(),
    paidMethod: zod_1.z.enum(["bank", "momo", "cash"]).nullable(),
    paidReference: zod_1.z.string().nullable(),
    sentAt: zod_1.z.string().nullable(),
});
/** The rule rows a run was computed from, so the figures can be traced. */
exports.PayRunRuleVersion = zod_1.z.object({
    configType: zod_1.z.string(),
    configEntryId: primitives_1.Uuid,
    version: zod_1.z.number().int(),
});
/** Why a run cannot be confirmed yet. Every blocker is listed, never only the first. */
exports.PayRunBlockerCode = zod_1.z.enum([
    "missing_rssb_number",
    "missing_id",
    "open_attendance",
    /** A closed record nobody has validated: a self or phone clock in, or one the sweep closed (058-time AC-TM16). */
    "unvalidated_attendance",
    // 058-payroll.
    /** Net would be below zero (AC-PY7): defer an installment, waive an adjustment, or hold the payslip. */
    "negative_net",
    /** Approved overtime in the month and no `hr.rw.overtime` row in force (AC-PY4). */
    "missing_overtime_rule",
    /** Approved overtime on a day whose kind is unknown, because that year's holidays were not recorded. */
    "overtime_day_unknown",
    /** A leaver's settlement needs `hr.rw.final_settlement` and none is in force (AC-PY13). */
    "missing_settlement_rule",
    /** The business's RSSB employer number is not in HR settings (AC-PY14). */
    "missing_rssb_employer_number",
]);
/** What a person can do about a negative net (AC-PY7). */
exports.PayRunRemedy = zod_1.z.enum(["defer_installment", "waive_adjustment", "hold_payslip"]);
exports.PayRunBlocker = zod_1.z.object({
    code: exports.PayRunBlockerCode,
    /** Null for a blocker of the whole run, such as a missing rule. */
    employeeId: primitives_1.Uuid.nullable(),
    displayName: zod_1.z.string(),
    message: zod_1.z.string(),
    remedies: zod_1.z.array(exports.PayRunRemedy).optional(),
});
exports.PayRun = zod_1.z.object({
    id: primitives_1.Uuid,
    period: exports.PayPeriod,
    periodStart: booking_1.IsoDate,
    status: exports.PayRunStatus,
    computedAt: zod_1.z.string(),
    ruleVersions: zod_1.z.array(exports.PayRunRuleVersion),
    confirmedAt: zod_1.z.string().nullable(),
    confirmedByUserId: primitives_1.Uuid.nullable(),
    headcount: zod_1.z.number().int(),
    grossRwf: zod_1.z.number().int(),
    netRwf: zod_1.z.number().int(),
    payeRwf: zod_1.z.number().int(),
    employeeContributionsRwf: zod_1.z.number().int(),
    employerContributionsRwf: zod_1.z.number().int(),
});
/** `GET /ops/pay-runs/:id`: the run, its payslips, and what blocks confirming it. */
exports.PayRunDetail = zod_1.z.object({
    run: exports.PayRun,
    payslips: zod_1.z.array(exports.Payslip),
    blockers: zod_1.z.array(exports.PayRunBlocker),
});
exports.CreatePayRunRequest = zod_1.z.object({ period: exports.PayPeriod });
//# sourceMappingURL=payroll.js.map