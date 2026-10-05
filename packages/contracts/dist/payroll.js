"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePayRunRequest = exports.PayRunDetail = exports.PayRun = exports.PayRunBlocker = exports.PayRunBlockerCode = exports.PayRunRuleVersion = exports.Payslip = exports.PayslipLine = exports.PayslipLineSide = exports.PayRunStatus = exports.PayPeriod = void 0;
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
 * never deducted.
 */
exports.PayslipLineSide = zod_1.z.enum(["earning", "employee", "employer"]);
exports.PayslipLine = zod_1.z.object({
    /** `wage`, `unpaid_leave`, `paye`, or a contribution code from the RSSB rule. */
    code: zod_1.z.string(),
    label: zod_1.z.string(),
    /** The contract a wage line belongs to; null for a line of the whole payslip. */
    contractId: primitives_1.Uuid.nullable(),
    /** How the amount was reached, in words a person can check. */
    basis: zod_1.z.string(),
    amountRwf: zod_1.z.number().int(),
    side: exports.PayslipLineSide,
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
    netRwf: zod_1.z.number().int(),
    lines: zod_1.z.array(exports.PayslipLine),
    status: exports.PayRunStatus,
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
    "unvalidated_self_attendance",
]);
exports.PayRunBlocker = zod_1.z.object({
    code: exports.PayRunBlockerCode,
    employeeId: primitives_1.Uuid,
    displayName: zod_1.z.string(),
    message: zod_1.z.string(),
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