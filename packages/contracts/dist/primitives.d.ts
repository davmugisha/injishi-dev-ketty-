import { z } from "zod";
/**
 * Cross-domain primitives shared by every app and the backend.
 * Enum members mirror the Postgres enums in
 * server/api/src/database/drizzle/schema.ts EXACTLY — do not fork.
 */
/** Property domain branch. `residence` never appears in public Explore. */
export declare const Domain: z.ZodEnum<["hospitality", "residence"]>;
export type Domain = z.infer<typeof Domain>;
/** Adapter mock/live mode — every money/compliance figure carries one. */
export declare const AdapterMode: z.ZodEnum<["mock", "live"]>;
export type AdapterMode = z.infer<typeof AdapterMode>;
export declare const WorkspaceKind: z.ZodEnum<["business", "broker", "personal"]>;
export type WorkspaceKind = z.infer<typeof WorkspaceKind>;
/**
 * Staff role inside a business workspace. `housekeeper` is a real permission
 * role, not a job title: it is the only role whose surface is the housekeeping
 * phone rather than the desk (Spec 0002, D-b). Mirrors the `org_role` Postgres
 * enum after migration 0004.
 *
 * `finance` and `hr` are ADR-069 D-a: an accountant and an HR officer, each
 * with a default set of its own rather than a manager's. Their migration adds
 * each `BEFORE 'housekeeper'`, so the database's order is this order.
 */
export declare const OrgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>;
export type OrgRole = z.infer<typeof OrgRole>;
/**
 * Global identity grants. `gov_oversight` (renamed from `local_gov`, Decision B)
 * means "has a government console seat"; the specific oversight function, body,
 * title, and region scope live on `oversight_assignments` (see OversightRole).
 */
export declare const GlobalRole: z.ZodEnum<["admin", "guest", "broker", "gov_oversight"]>;
export type GlobalRole = z.infer<typeof GlobalRole>;
/** Backend staff role (schema `staff_role`). The admin UI "lens" uses a
 *  shortened label set for display; map at the UI edge, not here.
 *
 *  `trainer` (ADR-049) is the narrowest role in the set and the reason the
 *  admin console finally needs a per-section route guard: it holds four
 *  training powers and no `admin.*` power at all, so a trainer who types
 *  `/finance` must be refused rather than merely find the link missing. */
export declare const StaffRole: z.ZodEnum<["super_admin", "ops", "compliance", "finance", "trainer"]>;
export type StaffRole = z.infer<typeof StaffRole>;
export declare const OrgRegistrationStatus: z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>;
export type OrgRegistrationStatus = z.infer<typeof OrgRegistrationStatus>;
/** KYC state of a `verified_identities` row (Decision A). */
export declare const KycStatus: z.ZodEnum<["unverified", "pending", "verified", "rejected"]>;
export type KycStatus = z.infer<typeof KycStatus>;
/** Government document lifecycle within one identity (Decision A). */
export declare const IdentityDocumentStatus: z.ZodEnum<["active", "superseded"]>;
export type IdentityDocumentStatus = z.infer<typeof IdentityDocumentStatus>;
/**
 * Captured document type (schema `document_type`). Account identity is
 * restricted to `national_id | passport` (enforced by a DB check on
 * `identity_documents`); `other` remains valid only for walk-in stay capture.
 */
export declare const DocumentType: z.ZodEnum<["national_id", "passport", "other"]>;
export type DocumentType = z.infer<typeof DocumentType>;
/**
 * Government oversight functions (Decision B). Stable enum because the
 * registration/approval pipeline branches on it. The government BODY is a
 * separate admin-managed catalog (add one without a migration).
 */
export declare const OversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>;
export type OversightRole = z.infer<typeof OversightRole>;
/** Region scope of an oversight assignment (Decision B). */
export declare const OversightScopeLevel: z.ZodEnum<["country", "province", "district"]>;
export type OversightScopeLevel = z.infer<typeof OversightScopeLevel>;
/**
 * RWF money as an integer number of francs (never float). Mirrors the
 * `bigint … mode:'number'` money columns. Formatting (`RWF 45,000`) is a
 * presentation concern and lives in the shared UI layer, not here.
 */
export declare const RwfAmount: z.ZodNumber;
export type RwfAmount = z.infer<typeof RwfAmount>;
/** v1 is single-currency. */
export declare const Currency: z.ZodLiteral<"RWF">;
export type Currency = z.infer<typeof Currency>;
/** UUID identifier used for every entity except geography. */
export declare const Uuid: z.ZodString;
export type Uuid = z.infer<typeof Uuid>;
/**
 * A telephone number on a contact card: a property's front desk, a head of
 * department. As a person types it, `+250 788 123 456` or `0788123456`.
 *
 * Loose on purpose, and NOT `RwPhoneNumber` (phone.ts), which is a Rwandan
 * mobile that a sign-in code is texted to. Nothing dials or verifies this one,
 * so the rule is only "digits a person could call", spacing kept as typed.
 */
export declare const ContactPhone: z.ZodString;
export type ContactPhone = z.infer<typeof ContactPhone>;
//# sourceMappingURL=primitives.d.ts.map