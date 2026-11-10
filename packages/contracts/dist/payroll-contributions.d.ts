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
export declare const ContributionBaseKind: z.ZodEnum<["gross", "basic", "contributable", "net"]>;
export type ContributionBaseKind = z.infer<typeof ContributionBaseKind>;
export declare const PayrollContribution: z.ZodObject<{
    code: z.ZodString;
    label: z.ZodString;
    base: z.ZodEnum<["gross", "basic", "contributable", "net"]>;
    /** Decimal shares, 0.06 for 6%. */
    employeeRate: z.ZodNumber;
    employerRate: z.ZodNumber;
    capRwf: z.ZodNullable<z.ZodNumber>;
    optional: z.ZodBoolean;
    /** Whether it applies to this business's pay now. */
    enabled: z.ZodBoolean;
    /** An optional one the business has not chosen on or off: it follows the rule's default. */
    byDefault: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    label: string;
    enabled: boolean;
    capRwf: number | null;
    base: "basic" | "contributable" | "gross" | "net";
    employeeRate: number;
    employerRate: number;
    optional: boolean;
    byDefault: boolean;
}, {
    code: string;
    label: string;
    enabled: boolean;
    capRwf: number | null;
    base: "basic" | "contributable" | "gross" | "net";
    employeeRate: number;
    employerRate: number;
    optional: boolean;
    byDefault: boolean;
}>;
export type PayrollContribution = z.infer<typeof PayrollContribution>;
export declare const PRIVATE_HEALTH_CODE = "private_health";
export declare const PrivateHealthChoice: z.ZodObject<{
    enabled: z.ZodBoolean;
    provider: z.ZodNullable<z.ZodString>;
    employeeAmountRwf: z.ZodNumber;
    employerAmountRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    provider: string | null;
    employeeAmountRwf: number;
    employerAmountRwf: number;
}, {
    enabled: boolean;
    provider: string | null;
    employeeAmountRwf: number;
    employerAmountRwf: number;
}>;
export type PrivateHealthChoice = z.infer<typeof PrivateHealthChoice>;
export declare const PayrollContributionList: z.ZodObject<{
    /** The RSSB rule version these come from, and the day it took effect. */
    ruleVersion: z.ZodNullable<z.ZodNumber>;
    effectiveFrom: z.ZodNullable<z.ZodString>;
    /** The note on the rule row: where its figures come from, and whether they are confirmed. */
    note: z.ZodNullable<z.ZodString>;
    contributions: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        label: z.ZodString;
        base: z.ZodEnum<["gross", "basic", "contributable", "net"]>;
        /** Decimal shares, 0.06 for 6%. */
        employeeRate: z.ZodNumber;
        employerRate: z.ZodNumber;
        capRwf: z.ZodNullable<z.ZodNumber>;
        optional: z.ZodBoolean;
        /** Whether it applies to this business's pay now. */
        enabled: z.ZodBoolean;
        /** An optional one the business has not chosen on or off: it follows the rule's default. */
        byDefault: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: string;
        label: string;
        enabled: boolean;
        capRwf: number | null;
        base: "basic" | "contributable" | "gross" | "net";
        employeeRate: number;
        employerRate: number;
        optional: boolean;
        byDefault: boolean;
    }, {
        code: string;
        label: string;
        enabled: boolean;
        capRwf: number | null;
        base: "basic" | "contributable" | "gross" | "net";
        employeeRate: number;
        employerRate: number;
        optional: boolean;
        byDefault: boolean;
    }>, "many">;
    /** The PAYE rule in force, so a screen can show take-home pay on an example salary. */
    paye: z.ZodNullable<z.ZodObject<{
        taxableBase: z.ZodString;
        bands: z.ZodArray<z.ZodObject<{
            fromRwf: z.ZodNumber;
            toRwf: z.ZodNullable<z.ZodNumber>;
            rate: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            fromRwf: number;
            rate: number;
            toRwf: number | null;
        }, {
            fromRwf: number;
            rate: number;
            toRwf: number | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        bands: {
            fromRwf: number;
            rate: number;
            toRwf: number | null;
        }[];
        taxableBase: string;
    }, {
        bands: {
            fromRwf: number;
            rate: number;
            toRwf: number | null;
        }[];
        taxableBase: string;
    }>>;
    privateHealth: z.ZodObject<{
        enabled: z.ZodBoolean;
        provider: z.ZodNullable<z.ZodString>;
        employeeAmountRwf: z.ZodNumber;
        employerAmountRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        provider: string | null;
        employeeAmountRwf: number;
        employerAmountRwf: number;
    }, {
        enabled: boolean;
        provider: string | null;
        employeeAmountRwf: number;
        employerAmountRwf: number;
    }>;
    /** The person reading may change these. */
    canChoose: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    note: string | null;
    effectiveFrom: string | null;
    paye: {
        bands: {
            fromRwf: number;
            rate: number;
            toRwf: number | null;
        }[];
        taxableBase: string;
    } | null;
    ruleVersion: number | null;
    contributions: {
        code: string;
        label: string;
        enabled: boolean;
        capRwf: number | null;
        base: "basic" | "contributable" | "gross" | "net";
        employeeRate: number;
        employerRate: number;
        optional: boolean;
        byDefault: boolean;
    }[];
    privateHealth: {
        enabled: boolean;
        provider: string | null;
        employeeAmountRwf: number;
        employerAmountRwf: number;
    };
    canChoose: boolean;
}, {
    note: string | null;
    effectiveFrom: string | null;
    paye: {
        bands: {
            fromRwf: number;
            rate: number;
            toRwf: number | null;
        }[];
        taxableBase: string;
    } | null;
    ruleVersion: number | null;
    contributions: {
        code: string;
        label: string;
        enabled: boolean;
        capRwf: number | null;
        base: "basic" | "contributable" | "gross" | "net";
        employeeRate: number;
        employerRate: number;
        optional: boolean;
        byDefault: boolean;
    }[];
    privateHealth: {
        enabled: boolean;
        provider: string | null;
        employeeAmountRwf: number;
        employerAmountRwf: number;
    };
    canChoose: boolean;
}>;
export type PayrollContributionList = z.infer<typeof PayrollContributionList>;
/** `PUT /ops/payroll-contributions/:code`: switch an optional contribution, or set the private insurer. */
export declare const SetPayrollContributionRequest: z.ZodObject<{
    enabled: z.ZodBoolean;
    provider: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    employeeAmountRwf: z.ZodOptional<z.ZodNumber>;
    employerAmountRwf: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    enabled: boolean;
    provider?: string | null | undefined;
    employeeAmountRwf?: number | undefined;
    employerAmountRwf?: number | undefined;
}, {
    enabled: boolean;
    provider?: string | null | undefined;
    employeeAmountRwf?: number | undefined;
    employerAmountRwf?: number | undefined;
}>;
export type SetPayrollContributionRequest = z.infer<typeof SetPayrollContributionRequest>;
//# sourceMappingURL=payroll-contributions.d.ts.map