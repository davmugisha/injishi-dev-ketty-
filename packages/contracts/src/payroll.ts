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
 * never deducted.
 */
export const PayslipLineSide = z.enum(["earning", "employee", "employer"]);
export type PayslipLineSide = z.infer<typeof PayslipLineSide>;
export const PayslipLine = z.object({
    /** `wage`, `unpaid_leave`, `partly_paid_leave`, `paye`, or a contribution code from the RSSB rule. */
    code: z.string(),
    label: z.string(),
    /** The contract a wage line belongs to; null for a line of the whole payslip. */
    contractId: Uuid.nullable(),
    /** How the amount was reached, in words a person can check. */
    basis: z.string(),
    amountRwf: z.number().int(),
    side: PayslipLineSide,
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
    netRwf: z.number().int(),
    lines: z.array(PayslipLine),
    status: PayRunStatus,
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
]);
export type PayRunBlockerCode = z.infer<typeof PayRunBlockerCode>;
export const PayRunBlocker = z.object({
    code: PayRunBlockerCode,
    employeeId: Uuid,
    displayName: z.string(),
    message: z.string(),
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
