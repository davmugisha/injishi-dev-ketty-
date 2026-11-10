import { z } from "zod";
/**
 * HR's optional features: what a small business does without and a large one
 * needs. Injishi staff switch them on or off for a business, from the admin
 * Businesses screen, the way they switch a whole product (ADR-076); the owner
 * does not. Everything starts on.
 *
 * Off hides the feature's screens and sections and refuses new work through
 * it. Nothing is deleted, so switching it on again brings back what was there.
 * A feature still carrying work (a loan being repaid, a claim waiting, an item
 * out, a vacancy open, an insurance deducting) cannot be switched off until
 * that work is done.
 */
export declare const HrFeature: z.ZodEnum<["talent", "reviews", "insurance", "loans", "claims", "assets", "announcements", "helpDesk"]>;
export type HrFeature = z.infer<typeof HrFeature>;
/** How each feature reads on the admin screen. */
export declare const HR_FEATURE_INFO: Readonly<Record<HrFeature, {
    label: string;
    detail: string;
}>>;
/** One feature as the admin screen shows it. `blockedOff` says why it cannot be switched off now. */
export declare const HrFeatureState: z.ZodObject<{
    id: z.ZodEnum<["talent", "reviews", "insurance", "loans", "claims", "assets", "announcements", "helpDesk"]>;
    label: z.ZodString;
    detail: z.ZodString;
    on: z.ZodBoolean;
    blockedOff: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: "reviews" | "loans" | "talent" | "insurance" | "claims" | "assets" | "announcements" | "helpDesk";
    label: string;
    detail: string;
    on: boolean;
    blockedOff: string | null;
}, {
    id: "reviews" | "loans" | "talent" | "insurance" | "claims" | "assets" | "announcements" | "helpDesk";
    label: string;
    detail: string;
    on: boolean;
    blockedOff: string | null;
}>;
export type HrFeatureState = z.infer<typeof HrFeatureState>;
/** `GET /admin/orgs/:orgId/hr-features`. */
export declare const HrFeatureList: z.ZodObject<{
    features: z.ZodArray<z.ZodObject<{
        id: z.ZodEnum<["talent", "reviews", "insurance", "loans", "claims", "assets", "announcements", "helpDesk"]>;
        label: z.ZodString;
        detail: z.ZodString;
        on: z.ZodBoolean;
        blockedOff: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: "reviews" | "loans" | "talent" | "insurance" | "claims" | "assets" | "announcements" | "helpDesk";
        label: string;
        detail: string;
        on: boolean;
        blockedOff: string | null;
    }, {
        id: "reviews" | "loans" | "talent" | "insurance" | "claims" | "assets" | "announcements" | "helpDesk";
        label: string;
        detail: string;
        on: boolean;
        blockedOff: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    features: {
        id: "reviews" | "loans" | "talent" | "insurance" | "claims" | "assets" | "announcements" | "helpDesk";
        label: string;
        detail: string;
        on: boolean;
        blockedOff: string | null;
    }[];
}, {
    features: {
        id: "reviews" | "loans" | "talent" | "insurance" | "claims" | "assets" | "announcements" | "helpDesk";
        label: string;
        detail: string;
        on: boolean;
        blockedOff: string | null;
    }[];
}>;
export type HrFeatureList = z.infer<typeof HrFeatureList>;
/** `GET /ops/hr/features` and `GET /me/work/:employeeId/features`: what is switched off, for screens to hide. */
export declare const HrFeaturesOff: z.ZodObject<{
    off: z.ZodArray<z.ZodEnum<["talent", "reviews", "insurance", "loans", "claims", "assets", "announcements", "helpDesk"]>, "many">;
}, "strip", z.ZodTypeAny, {
    off: ("reviews" | "loans" | "talent" | "insurance" | "claims" | "assets" | "announcements" | "helpDesk")[];
}, {
    off: ("reviews" | "loans" | "talent" | "insurance" | "claims" | "assets" | "announcements" | "helpDesk")[];
}>;
export type HrFeaturesOff = z.infer<typeof HrFeaturesOff>;
/** `PUT /admin/orgs/:orgId/hr-features/:feature`. */
export declare const SetHrFeatureRequest: z.ZodObject<{
    on: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    on: boolean;
    reason?: string | undefined;
}, {
    on: boolean;
    reason?: string | undefined;
}>;
export type SetHrFeatureRequest = z.infer<typeof SetHrFeatureRequest>;
//# sourceMappingURL=hr-features.d.ts.map