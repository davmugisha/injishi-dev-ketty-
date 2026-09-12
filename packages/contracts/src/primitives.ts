import { z } from "zod";
/**
 * Cross-domain primitives shared by every app and the backend.
 * Enum members mirror the Postgres enums in
 * server/api/src/database/drizzle/schema.ts EXACTLY — do not fork.
 */
/** Property domain branch. `residence` never appears in public Explore. */
export const Domain = z.enum(["hospitality", "residence"]);
export type Domain = z.infer<typeof Domain>;
/** Adapter mock/live mode — every money/compliance figure carries one. */
export const AdapterMode = z.enum(["mock", "live"]);
export type AdapterMode = z.infer<typeof AdapterMode>;
export const WorkspaceKind = z.enum(["business", "broker", "personal"]);
export type WorkspaceKind = z.infer<typeof WorkspaceKind>;
/**
 * Staff role inside a business workspace. `housekeeper` is a real permission
 * role, not a job title: it is the only role whose surface is the housekeeping
 * phone rather than the desk (Spec 0002, D-b). Mirrors the `org_role` Postgres
 * enum after migration 0004.
 */
export const OrgRole = z.enum([
    "owner",
    "manager",
    "receptionist",
    "housekeeper",
]);
export type OrgRole = z.infer<typeof OrgRole>;
/**
 * Global identity grants. `gov_oversight` (renamed from `local_gov`, Decision B)
 * means "has a government console seat"; the specific oversight function, body,
 * title, and region scope live on `oversight_assignments` (see OversightRole).
 */
export const GlobalRole = z.enum(["admin", "guest", "broker", "gov_oversight"]);
export type GlobalRole = z.infer<typeof GlobalRole>;
/** Backend staff role (schema `staff_role`). The admin UI "lens" uses a
 *  shortened label set for display; map at the UI edge, not here. */
export const StaffRole = z.enum(["super_admin", "ops", "compliance", "finance"]);
export type StaffRole = z.infer<typeof StaffRole>;
export const OrgRegistrationStatus = z.enum([
    // D23: the entry state. The one-time registration fee settling is the only
    // exit, so nothing unpaid ever reaches a government officer's queue.
    "pending_payment",
    "submitted",
    "tin_verified",
    // Oversight gates (Decision B): field_verified -> approved sit between
    // tin_verified and active. Blocking vs advisory is a per-district policy.
    "field_verified",
    "approved",
    "active",
    "rejected",
    "suspended",
]);
export type OrgRegistrationStatus = z.infer<typeof OrgRegistrationStatus>;
/** KYC state of a `verified_identities` row (Decision A). */
export const KycStatus = z.enum([
    "unverified",
    "pending",
    "verified",
    "rejected",
]);
export type KycStatus = z.infer<typeof KycStatus>;
/** Government document lifecycle within one identity (Decision A). */
export const IdentityDocumentStatus = z.enum(["active", "superseded"]);
export type IdentityDocumentStatus = z.infer<typeof IdentityDocumentStatus>;
/**
 * Captured document type (schema `document_type`). Account identity is
 * restricted to `national_id | passport` (enforced by a DB check on
 * `identity_documents`); `other` remains valid only for walk-in stay capture.
 */
export const DocumentType = z.enum(["national_id", "passport", "other"]);
export type DocumentType = z.infer<typeof DocumentType>;
/**
 * Government oversight functions (Decision B). Stable enum because the
 * registration/approval pipeline branches on it. The government BODY is a
 * separate admin-managed catalog (add one without a migration).
 */
export const OversightRole = z.enum([
    "tax_compliance_officer",
    "business_field_verifier",
    "business_approver",
]);
export type OversightRole = z.infer<typeof OversightRole>;
/** Region scope of an oversight assignment (Decision B). */
export const OversightScopeLevel = z.enum(["country", "province", "district"]);
export type OversightScopeLevel = z.infer<typeof OversightScopeLevel>;
/**
 * RWF money as an integer number of francs (never float). Mirrors the
 * `bigint … mode:'number'` money columns. Formatting (`RWF 45,000`) is a
 * presentation concern and lives in the shared UI layer, not here.
 */
export const RwfAmount = z.number().int().nonnegative();
export type RwfAmount = z.infer<typeof RwfAmount>;
/** v1 is single-currency. */
export const Currency = z.literal("RWF");
export type Currency = z.infer<typeof Currency>;
/** UUID identifier used for every entity except geography. */
export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;