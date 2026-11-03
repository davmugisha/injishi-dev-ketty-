import { z } from "zod";
/**
 * Cross-domain primitives shared by every app and the backend.
 * Enum members mirror the Postgres enums in
 * server/api/src/database/drizzle/schema.ts EXACTLY — do not fork.
 */
/**
 * Property domain branch. `residence` never appears in public Explore.
 *
 * `enterprise` is a business of any sector (a factory, a trader, a service)
 * that registers on Injishi to join the Private Sector Federation through it.
 * It lists nothing, so it never appears in Explore either, and it has no rooms,
 * no leases and no officer visit: its registration ends at the fee.
 */
export const Domain = z.enum(["hospitality", "residence", "enterprise"]);
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
 *
 * `finance` and `hr` are ADR-069 D-a: an accountant and an HR officer, each
 * with a default set of its own rather than a manager's. Their migration adds
 * each `BEFORE 'housekeeper'`, so the database's order is this order.
 */
export const OrgRole = z.enum([
    "owner",
    "manager",
    "receptionist",
    "finance",
    "hr",
    "housekeeper",
    // The bar and restaurant floor (POS spec, phase 1).
    "cashier",
    "waiter",
    "bartender",
    "kitchen",
    "stock_controller",
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
 *  shortened label set for display; map at the UI edge, not here.
 *
 *  `trainer` (ADR-049) is the narrowest role in the set and the reason the
 *  admin console finally needs a per-section route guard: it holds four
 *  training powers and no `admin.*` power at all, so a trainer who types
 *  `/finance` must be refused rather than merely find the link missing. */
export const StaffRole = z.enum([
    "super_admin",
    "ops",
    "compliance",
    "finance",
    "trainer",
]);
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
    /**
     * ADR-056: decides PSF membership applications. Posted at PSF, for the whole
     * country or for one province or district, which bounds what it sees.
     */
    "psf_membership_officer",
    /**
     * The local leaders a guest staying in a rented home is reported to (P5): the
     * Umudugudu leader of a village, the sector DASSO officer, the cell executive
     * secretary, the district officer (Rwandan guests) and the district
     * immigration officer (guests from abroad). Each covers exactly one level of
     * the map (`LEADER_ROLE_SCOPE` in `guests.ts`).
     */
    "village_leader",
    "dasso",
    "cell_executive",
    "district_officer",
    "district_immigration",
    // The local government chain gains the sector executive secretary, and the
    // immigration directorate (DGIE) its province and headquarters levels: DGIE
    // reads guests from abroad only, the local government every guest.
    "sector_executive",
    "dgie_province",
    "dgie_national",
    // The chains settled (2026-10-26): village, cell, district, for local government (every guest)
    // and for DGIE (guests from abroad). DGIE's village and cell officers.
    "dgie_village",
    "dgie_cell",
    /**
     * A PSF BDE (Business Development & Empowerment) (2026-11-02, migration 0129): reads one
     * district's PSF console and decides nothing. Appointed by the district's
     * Province Manager. Last, in the order the database enum appends it.
     */
    "psf_business_officer",
]);
export type OversightRole = z.infer<typeof OversightRole>;
/**
 * Region scope of an oversight assignment (Decision B). Sector, cell and
 * village are the local leaders' levels; business reviewers stay on country,
 * province or district.
 */
export const OversightScopeLevel = z.enum(["country", "province", "district", "sector", "cell", "village"]);
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
/**
 * A telephone number on a contact card: a property's front desk, a head of
 * department. As a person types it, `+250 788 123 456` or `0788123456`.
 *
 * Loose on purpose, and NOT `RwPhoneNumber` (phone.ts), which is a Rwandan
 * mobile that a sign-in code is texted to. Nothing dials or verifies this one,
 * so the rule is only "digits a person could call", spacing kept as typed.
 */
export const ContactPhone = z
    .string()
    .trim()
    .max(40, "That phone number is too long.")
    .regex(/^\+?[0-9][0-9 ()-]{5,}$/, "Use a phone number like +250 788 123 456.");
export type ContactPhone = z.infer<typeof ContactPhone>;