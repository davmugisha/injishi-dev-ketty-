"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetHrFeatureRequest = exports.HrFeaturesOff = exports.HrFeatureList = exports.HrFeatureState = exports.HR_FEATURE_INFO = exports.HrFeature = void 0;
const zod_1 = require("zod");
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
exports.HrFeature = zod_1.z.enum([
    "talent",
    "reviews",
    "insurance",
    "loans",
    "claims",
    "assets",
    "announcements",
    "helpDesk",
]);
/** How each feature reads on the admin screen. */
exports.HR_FEATURE_INFO = {
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
exports.HrFeatureState = zod_1.z.object({
    id: exports.HrFeature,
    label: zod_1.z.string(),
    detail: zod_1.z.string(),
    on: zod_1.z.boolean(),
    blockedOff: zod_1.z.string().nullable(),
});
/** `GET /admin/orgs/:orgId/hr-features`. */
exports.HrFeatureList = zod_1.z.object({ features: zod_1.z.array(exports.HrFeatureState) });
/** `GET /ops/hr/features` and `GET /me/work/:employeeId/features`: what is switched off, for screens to hide. */
exports.HrFeaturesOff = zod_1.z.object({ off: zod_1.z.array(exports.HrFeature) });
/** `PUT /admin/orgs/:orgId/hr-features/:feature`. */
exports.SetHrFeatureRequest = zod_1.z.object({
    on: zod_1.z.boolean(),
    reason: zod_1.z.string().trim().max(300).optional(),
});
//# sourceMappingURL=hr-features.js.map