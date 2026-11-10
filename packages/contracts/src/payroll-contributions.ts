import { z } from "zod";

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

export const ContributionBaseKind = z.enum(["gross", "basic", "contributable", "net"]);
export type ContributionBaseKind = z.infer<typeof ContributionBaseKind>;

export const PayrollContribution = z.object({
    code: z.string(),
    label: z.string(),
    base: ContributionBaseKind,
    /** Decimal shares, 0.06 for 6%. */
    employeeRate: z.number(),
    employerRate: z.number(),
    capRwf: z.number().int().nullable(),
    optional: z.boolean(),
    /** Whether it applies to this business's pay now. */
    enabled: z.boolean(),
    /** An optional one the business has not chosen on or off: it follows the rule's default. */
    byDefault: z.boolean(),
});
export type PayrollContribution = z.infer<typeof PayrollContribution>;

export const PRIVATE_HEALTH_CODE = "private_health";

export const PrivateHealthChoice = z.object({
    enabled: z.boolean(),
    provider: z.string().nullable(),
    employeeAmountRwf: z.number().int().nonnegative(),
    employerAmountRwf: z.number().int().nonnegative(),
});
export type PrivateHealthChoice = z.infer<typeof PrivateHealthChoice>;

export const PayrollContributionList = z.object({
    /** The RSSB rule version these come from, and the day it took effect. */
    ruleVersion: z.number().int().nullable(),
    effectiveFrom: z.string().nullable(),
    /** The note on the rule row: where its figures come from, and whether they are confirmed. */
    note: z.string().nullable(),
    contributions: z.array(PayrollContribution),
    /** The PAYE rule in force, so a screen can show take-home pay on an example salary. */
    paye: z
        .object({
            taxableBase: z.string(),
            bands: z.array(z.object({ fromRwf: z.number(), toRwf: z.number().nullable(), rate: z.number() })),
        })
        .nullable(),
    privateHealth: PrivateHealthChoice,
    /** The person reading may change these. */
    canChoose: z.boolean(),
});
export type PayrollContributionList = z.infer<typeof PayrollContributionList>;

const Premium = z.number().int().nonnegative().max(10_000_000);

/** `PUT /ops/payroll-contributions/:code`: switch an optional contribution, or set the private insurer. */
export const SetPayrollContributionRequest = z
    .object({
        enabled: z.boolean(),
        provider: z.string().trim().max(120).nullable().optional(),
        employeeAmountRwf: Premium.optional(),
        employerAmountRwf: Premium.optional(),
    })
    .strict();
export type SetPayrollContributionRequest = z.infer<typeof SetPayrollContributionRequest>;
