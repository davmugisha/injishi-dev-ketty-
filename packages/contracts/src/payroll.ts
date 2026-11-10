import { z } from "zod";
import { IsoDate } from "./booking";
import { Uuid } from "./primitives";
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
export const PayPeriod = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "A pay period is YYYY-MM.");
export type PayPeriod = z.infer<typeof PayPeriod>;
export const PayRunStatus = z.enum(["draft", "confirmed"]);
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
export const PayslipLineSide = z.enum(["earning", "employee", "employer", "deduction", "passthrough"]);
export type PayslipLineSide = z.infer<typeof PayslipLineSide>;
/** What a line pays for or takes back, so the row behind it can be marked paid at confirm. */
export const PayslipLineRef = z.object({
    kind: z.enum(["loan_installment", "loan", "claim", "adjustment", "leave_type"]),
    id: Uuid,
});
export type PayslipLineRef = z.infer<typeof PayslipLineRef>;
export const PayslipLine = z.object({
    /**
     * `wage`, `daily_wage`, `hourly_wage`, `paid_leave`, `unpaid_leave`,
     * `partly_paid_leave`, `overtime`, `allowance:<code>`, `deduction:<code>`,
     * `loan`, `loan_paid_out`, `reimbursement`, `leave_encashment`,
     * `settlement_leave`, `settlement_notice`, `settlement_severance`,
     * `adjustment`, `paye`, or a contribution code from the RSSB rule.
     */
    code: z.string(),
    label: z.string(),
    /** The contract a wage line belongs to; null for a line of the whole payslip. */
    contractId: Uuid.nullable(),
    /** How the amount was reached, in words a person can check. */
    basis: z.string(),
    amountRwf: z.number().int(),
    side: PayslipLineSide,
    /** An earning: whether it is taxed. Absent on a line written before 058-payroll, which was. */
    taxable: z.boolean().optional(),
    /** An earning: whether it counts in the contribution base. */
    contributable: z.boolean().optional(),
    /** A deduction taken before tax, which lowers the taxable base. */
    beforeTax: z.boolean().optional(),
    /** The PAYE line: the base the bands were applied to, for the declaration. */
    taxBase: z.number().int().optional(),
    ref: PayslipLineRef.optional(),
});
export type PayslipLine = z.infer<typeof PayslipLine>;
export const Payslip = z.object({
    id: Uuid,
    employeeId: Uuid,
    employeeNumber: z.string(),
    displayName: z.string(),
    /** The contract in force on the person's last payable day in the month. */
    contractId: Uuid,
    payableDays: z.number(),
    grossRwf: z.number().int(),
    payeRwf: z.number().int(),
    employeeContributionsRwf: z.number().int(),
    employerContributionsRwf: z.number().int(),
    otherDeductionsRwf: z.number().int(),
    /** Money paid with the net that is not income (058-payroll AC-PY6a). */
    nonIncomeRwf: z.number().int(),
    netRwf: z.number().int(),
    lines: z.array(PayslipLine),
    status: PayRunStatus,
    /** Paid status, on a confirmed payslip only (058-payroll AC-PY10). */
    paidAt: z.string().nullable(),
    paidMethod: z.enum(["bank", "momo", "cash"]).nullable(),
    paidReference: z.string().nullable(),
    sentAt: z.string().nullable(),
    /** The owner's payslip, read by someone without `team.manage`: every figure is zero and it has no lines. */
    confidential: z.boolean().optional(),
});
export type Payslip = z.infer<typeof Payslip>;
/** The rule rows a run was computed from, so the figures can be traced. */
export const PayRunRuleVersion = z.object({
    configType: z.string(),
    configEntryId: Uuid,
    version: z.number().int(),
});
export type PayRunRuleVersion = z.infer<typeof PayRunRuleVersion>;
/** Why a run cannot be confirmed yet. Every blocker is listed, never only the first. */
export const PayRunBlockerCode = z.enum([
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
export type PayRunBlockerCode = z.infer<typeof PayRunBlockerCode>;
/** What a person can do about a negative net (AC-PY7). */
export const PayRunRemedy = z.enum(["defer_installment", "waive_adjustment", "hold_payslip"]);
export type PayRunRemedy = z.infer<typeof PayRunRemedy>;
export const PayRunBlocker = z.object({
    code: PayRunBlockerCode,
    /** Null for a blocker of the whole run, such as a missing rule. */
    employeeId: Uuid.nullable(),
    displayName: z.string(),
    message: z.string(),
    remedies: z.array(PayRunRemedy).optional(),
    /** A clock record that stops the month: clocked out or validated, it stops no more. */
    record: z.object({ id: Uuid, workDate: IsoDate, clockInAt: z.string() }).optional(),
});
export type PayRunBlocker = z.infer<typeof PayRunBlocker>;
export const PayRun = z.object({
    id: Uuid,
    period: PayPeriod,
    periodStart: IsoDate,
    status: PayRunStatus,
    computedAt: z.string(),
    ruleVersions: z.array(PayRunRuleVersion),
    confirmedAt: z.string().nullable(),
    confirmedByUserId: Uuid.nullable(),
    /** The name of who confirmed it, or their email when the account has no name. */
    confirmedByName: z.string().nullable(),
    /**
     * Handed to whoever confirms (`POST .../submit`). A submitted draft is
     * locked until it is confirmed or withdrawn; null while it is prepared.
     */
    submittedAt: z.string().nullable(),
    submittedByName: z.string().nullable(),
    /** What whoever submitted said to whoever confirms. */
    submitNote: z.string().nullable(),
    headcount: z.number().int(),
    grossRwf: z.number().int(),
    netRwf: z.number().int(),
    payeRwf: z.number().int(),
    employeeContributionsRwf: z.number().int(),
    employerContributionsRwf: z.number().int(),
});
export type PayRun = z.infer<typeof PayRun>;
/** `GET /ops/pay-runs/:id`: the run, its payslips, and what blocks confirming it. */
export const PayRunDetail = z.object({
    run: PayRun,
    payslips: z.array(Payslip),
    blockers: z.array(PayRunBlocker),
});
export type PayRunDetail = z.infer<typeof PayRunDetail>;
export const CreatePayRunRequest = z.object({ period: PayPeriod });
export type CreatePayRunRequest = z.infer<typeof CreatePayRunRequest>;
/** `POST /ops/pay-runs/:id/submit`: hand the draft to whoever confirms, with a word if there is one. */
export const SubmitPayRunRequest = z.object({ note: z.string().trim().max(500).nullable().optional() });
export type SubmitPayRunRequest = z.infer<typeof SubmitPayRunRequest>;
/** `POST /ops/pay-runs/:id/withdraw`: take a submitted draft back to change it; whoever confirms says why. */
export const WithdrawPayRunRequest = z.object({ reason: z.string().trim().max(500).nullable().optional() });
export type WithdrawPayRunRequest = z.infer<typeof WithdrawPayRunRequest>;
