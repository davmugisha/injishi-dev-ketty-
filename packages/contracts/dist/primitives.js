"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactPhone = exports.Uuid = exports.Currency = exports.RwfAmount = exports.OversightScopeLevel = exports.OversightRole = exports.DocumentType = exports.IdentityDocumentStatus = exports.KycStatus = exports.OrgRegistrationStatus = exports.StaffRole = exports.GlobalRole = exports.OrgRole = exports.WorkspaceKind = exports.AdapterMode = exports.Domain = void 0;
const zod_1 = require("zod");
/**
 * Cross-domain primitives shared by every app and the backend.
 * Enum members mirror the Postgres enums in
 * server/api/src/database/drizzle/schema.ts EXACTLY — do not fork.
 */
/** Property domain branch. `residence` never appears in public Explore. */
exports.Domain = zod_1.z.enum(["hospitality", "residence"]);
/** Adapter mock/live mode — every money/compliance figure carries one. */
exports.AdapterMode = zod_1.z.enum(["mock", "live"]);
exports.WorkspaceKind = zod_1.z.enum(["business", "broker", "personal"]);
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
exports.OrgRole = zod_1.z.enum([
    "owner",
    "manager",
    "receptionist",
    "finance",
    "hr",
    "housekeeper",
]);
/**
 * Global identity grants. `gov_oversight` (renamed from `local_gov`, Decision B)
 * means "has a government console seat"; the specific oversight function, body,
 * title, and region scope live on `oversight_assignments` (see OversightRole).
 */
exports.GlobalRole = zod_1.z.enum(["admin", "guest", "broker", "gov_oversight"]);
/** Backend staff role (schema `staff_role`). The admin UI "lens" uses a
 *  shortened label set for display; map at the UI edge, not here.
 *
 *  `trainer` (ADR-049) is the narrowest role in the set and the reason the
 *  admin console finally needs a per-section route guard: it holds four
 *  training powers and no `admin.*` power at all, so a trainer who types
 *  `/finance` must be refused rather than merely find the link missing. */
exports.StaffRole = zod_1.z.enum([
    "super_admin",
    "ops",
    "compliance",
    "finance",
    "trainer",
]);
exports.OrgRegistrationStatus = zod_1.z.enum([
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
/** KYC state of a `verified_identities` row (Decision A). */
exports.KycStatus = zod_1.z.enum([
    "unverified",
    "pending",
    "verified",
    "rejected",
]);
/** Government document lifecycle within one identity (Decision A). */
exports.IdentityDocumentStatus = zod_1.z.enum(["active", "superseded"]);
/**
 * Captured document type (schema `document_type`). Account identity is
 * restricted to `national_id | passport` (enforced by a DB check on
 * `identity_documents`); `other` remains valid only for walk-in stay capture.
 */
exports.DocumentType = zod_1.z.enum(["national_id", "passport", "other"]);
/**
 * Government oversight functions (Decision B). Stable enum because the
 * registration/approval pipeline branches on it. The government BODY is a
 * separate admin-managed catalog (add one without a migration).
 */
exports.OversightRole = zod_1.z.enum([
    "tax_compliance_officer",
    "business_field_verifier",
    "business_approver",
    /** ADR-056: decides PSF membership applications. PSF, country scope only. */
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
]);
/**
 * Region scope of an oversight assignment (Decision B). Sector, cell and
 * village are the local leaders' levels; business reviewers stay on country,
 * province or district.
 */
exports.OversightScopeLevel = zod_1.z.enum(["country", "province", "district", "sector", "cell", "village"]);
/**
 * RWF money as an integer number of francs (never float). Mirrors the
 * `bigint … mode:'number'` money columns. Formatting (`RWF 45,000`) is a
 * presentation concern and lives in the shared UI layer, not here.
 */
exports.RwfAmount = zod_1.z.number().int().nonnegative();
/** v1 is single-currency. */
exports.Currency = zod_1.z.literal("RWF");
/** UUID identifier used for every entity except geography. */
exports.Uuid = zod_1.z.string().uuid();
/**
 * A telephone number on a contact card: a property's front desk, a head of
 * department. As a person types it, `+250 788 123 456` or `0788123456`.
 *
 * Loose on purpose, and NOT `RwPhoneNumber` (phone.ts), which is a Rwandan
 * mobile that a sign-in code is texted to. Nothing dials or verifies this one,
 * so the rule is only "digits a person could call", spacing kept as typed.
 */
exports.ContactPhone = zod_1.z
    .string()
    .trim()
    .max(40, "That phone number is too long.")
    .regex(/^\+?[0-9][0-9 ()-]{5,}$/, "Use a phone number like +250 788 123 456.");
//# sourceMappingURL=primitives.js.map