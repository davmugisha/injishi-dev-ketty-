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
export const HrFeature = z.enum([
    "talent",
    "reviews",
    "insurance",
    "loans",
    "claims",
    "assets",
    "announcements",
    "helpDesk",
]);
export type HrFeature = z.infer<typeof HrFeature>;
/** How each feature reads on the admin screen. */
export const HR_FEATURE_INFO: Readonly<Record<HrFeature, {
    label: string;
    detail: string;
}>> = {
    talent: { label: "Talent", detail: "Vacancies, candidates, interviews and offers." },
    reviews: { label: "Performance reviews", detail: "Review cycles, and staff writing their self-review." },
    insurance: { label: "Health insurance options", detail: "RSSB medical scheme and private insurance on Payroll rules. Statutory contributions stay." },
    loans: { label: "Loans and advances", detail: "Lending staff money, repaid from their pay." },
    claims: { label: "Expense claims", detail: "Staff asking for money back, paid with their pay." },
    assets: { label: "Things lent", detail: "Uniforms, phones, keys and tools lent to staff." },
    announcements: { label: "Announcements", detail: "Posts from HR on staff phones and Me." },
    helpDesk: { label: "Help desk", detail: "Staff questions to HR, and HR's answers." },
};
/** One feature as the admin screen shows it. `blockedOff` says why it cannot be switched off now. */
export const HrFeatureState = z.object({
    id: HrFeature,
    label: z.string(),
    detail: z.string(),
    on: z.boolean(),
    blockedOff: z.string().nullable(),
});
export type HrFeatureState = z.infer<typeof HrFeatureState>;
/** `GET /admin/orgs/:orgId/hr-features`. */
export const HrFeatureList = z.object({ features: z.array(HrFeatureState) });
export type HrFeatureList = z.infer<typeof HrFeatureList>;
/** `GET /ops/hr/features` and `GET /me/work/:employeeId/features`: what is switched off, for screens to hide. */
export const HrFeaturesOff = z.object({ off: z.array(HrFeature) });
export type HrFeaturesOff = z.infer<typeof HrFeaturesOff>;
/** `PUT /admin/orgs/:orgId/hr-features/:feature`. */
export const SetHrFeatureRequest = z.object({
    on: z.boolean(),
    reason: z.string().trim().max(300).optional(),
});
export type SetHrFeatureRequest = z.infer<typeof SetHrFeatureRequest>;
