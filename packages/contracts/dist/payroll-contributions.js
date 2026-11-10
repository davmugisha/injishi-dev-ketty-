"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetPayrollContributionRequest = exports.PayrollContributionList = exports.PrivateHealthChoice = exports.PRIVATE_HEALTH_CODE = exports.PayrollContribution = exports.ContributionBaseKind = void 0;
const zod_1 = require("zod");
/**
 * The contributions a business pays on its staff's pay, and the ones it chooses (058-payroll).
 *
 * The RSSB rule in force lists every contribution with its two shares. Pension, maternity leave
 * and occupational hazards always apply. An optional one (CBHI, RSSB's medical scheme) applies
 * where the business switched it on, or by the rule's default where it made no choice. A private
 * health insurer is the business's own: a fixed monthly premium per person, each side's part.
 *
 * Reading needs `payroll.draft`; choosing needs `payroll.run` (the owner by default). A choice
 * applies to runs not yet confirmed.
 */
exports.ContributionBaseKind = zod_1.z.enum(["gross", "basic", "contributable", "net"]);
exports.PayrollContribution = zod_1.z.object({
    code: zod_1.z.string(),
    label: zod_1.z.string(),
    base: exports.ContributionBaseKind,
    /** Decimal shares, 0.06 for 6%. */
    employeeRate: zod_1.z.number(),
    employerRate: zod_1.z.number(),
    capRwf: zod_1.z.number().int().nullable(),
    optional: zod_1.z.boolean(),
    /** Whether it applies to this business's pay now. */
    enabled: zod_1.z.boolean(),
    /** An optional one the business has not chosen on or off: it follows the rule's default. */
    byDefault: zod_1.z.boolean(),
});
exports.PRIVATE_HEALTH_CODE = "private_health";
exports.PrivateHealthChoice = zod_1.z.object({
    enabled: zod_1.z.boolean(),
    provider: zod_1.z.string().nullable(),
    employeeAmountRwf: zod_1.z.number().int().nonnegative(),
    employerAmountRwf: zod_1.z.number().int().nonnegative(),
});
exports.PayrollContributionList = zod_1.z.object({
    /** The RSSB rule version these come from, and the day it took effect. */
    ruleVersion: zod_1.z.number().int().nullable(),
    effectiveFrom: zod_1.z.string().nullable(),
    /** The note on the rule row: where its figures come from, and whether they are confirmed. */
    note: zod_1.z.string().nullable(),
    contributions: zod_1.z.array(exports.PayrollContribution),
    /** The PAYE rule in force, so a screen can show take-home pay on an example salary. */
    paye: zod_1.z
        .object({
        taxableBase: zod_1.z.string(),
        bands: zod_1.z.array(zod_1.z.object({ fromRwf: zod_1.z.number(), toRwf: zod_1.z.number().nullable(), rate: zod_1.z.number() })),
    })
        .nullable(),
    privateHealth: exports.PrivateHealthChoice,
    /** The person reading may change these. */
    canChoose: zod_1.z.boolean(),
});
const Premium = zod_1.z.number().int().nonnegative().max(10000000);
/** `PUT /ops/payroll-contributions/:code`: switch an optional contribution, or set the private insurer. */
exports.SetPayrollContributionRequest = zod_1.z
    .object({
    enabled: zod_1.z.boolean(),
    provider: zod_1.z.string().trim().max(120).nullable().optional(),
    employeeAmountRwf: Premium.optional(),
    employerAmountRwf: Premium.optional(),
})
    .strict();
//# sourceMappingURL=payroll-contributions.js.map