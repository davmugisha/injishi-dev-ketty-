"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenancyDetail = exports.TenancyList = exports.TenancyInvitationItem = exports.TenancyListItem = exports.TenancySignatureView = exports.TenancyPlace = exports.TenancyLandlord = void 0;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
const brokers_1 = require("./brokers");
const dates_1 = require("./dates");
const api_1 = require("./api");
const vocab_1 = require("./vocab");
// ===========================================================================
// The tenant's side: their tenancies (`/api/v1/me/tenancies`)
// ===========================================================================
//
// A tenancy is a lease seen by its tenant: the person whose account the
// tenant record is linked to (`tenants.user_id`, set when they accept the
// invitation). Drafts are never shown; another person's lease is 404.
const IsoMoment = zod_1.z.string();
/** The landlord as the tenant sees them: the business, who signs for it, how to reach them. */
exports.TenancyLandlord = zod_1.z.object({
    name: zod_1.z.string(),
    signatoryName: zod_1.z.string().nullable(),
    phone: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
});
/** Where the home is, as the contract names it. */
exports.TenancyPlace = zod_1.z.object({
    propertyName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    blockCode: zod_1.z.string().nullable(),
    /** The home in one line: `Unit B-07, Kacyiru Court, KG 7 Ave, Urugwiro village, ...`. */
    line: zod_1.z.string(),
    village: zod_1.z.string().nullable(),
    cell: zod_1.z.string().nullable(),
    sector: zod_1.z.string().nullable(),
    district: zod_1.z.string().nullable(),
    province: zod_1.z.string().nullable(),
});
/** A signature standing on the current contract version. Its evidence stays on the signed PDF. */
exports.TenancySignatureView = zod_1.z.object({
    role: vocab_1.LeaseSignerRole,
    typedName: zod_1.z.string().nullable(),
    method: vocab_1.LeaseSigningMethod,
    signedAt: IsoMoment,
    version: zod_1.z.number().int(),
});
/** One row of `GET /me/tenancies`. */
exports.TenancyListItem = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    status: vocab_1.LeaseStatus,
    landlordName: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    monthlyRentRwf: zod_1.z.number().int(),
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
    /** Out for signature and the tenant has not signed yet. */
    needsMySignature: zod_1.z.boolean(),
    /** The oldest charge still open. */
    nextDue: zod_1.z.object({ dueOn: dates_1.CalendarDay, amountRwf: zod_1.z.number().int() }).nullable(),
    /** Everything still owed on charges raised. */
    balanceRwf: zod_1.z.number().int(),
});
/** A lease sent to the signed in email and not accepted yet. */
exports.TenancyInvitationItem = zod_1.z.object({
    invitationId: primitives_1.Uuid,
    leaseId: primitives_1.Uuid,
    landlordName: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    monthlyRentRwf: zod_1.z.number().int(),
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
    sentAt: IsoMoment,
    expiresAt: IsoMoment,
});
/** `GET /me/tenancies`: the person's tenancies, newest first, and leases waiting for them to accept. */
exports.TenancyList = zod_1.z.object({
    tenancies: zod_1.z.array(exports.TenancyListItem),
    invitations: zod_1.z.array(exports.TenancyInvitationItem),
});
/** `GET /me/tenancies/:leaseId`, and what accepting an invitation or signing answers. */
exports.TenancyDetail = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    status: vocab_1.LeaseStatus,
    landlord: exports.TenancyLandlord,
    place: exports.TenancyPlace,
    tenant: zod_1.z.object({ fullName: zod_1.z.string(), email: zod_1.z.string().nullable(), phone: zod_1.z.string().nullable() }),
    terms: api_1.LeaseTermsView,
    currentVersion: api_1.LeaseVersionSummary.nullable(),
    signatures: zod_1.z.array(exports.TenancySignatureView),
    /** Out for signature and the tenant has not signed yet: the lease page offers Sign. */
    needsMySignature: zod_1.z.boolean(),
    /** Both sides signed and the signed copy is kept: the PDF is the signed one. */
    signedCopyReady: zod_1.z.boolean(),
    charges: api_1.LeaseChargesSummary,
    /** The broker who brought the tenant, rated once the tenancy starts. */
    broker: brokers_1.TenancyBrokerView.nullable(),
    signedAt: IsoMoment.nullable(),
    activatedAt: IsoMoment.nullable(),
    endedOn: dates_1.CalendarDay.nullable(),
    cancelledAt: IsoMoment.nullable(),
    cancelReason: zod_1.z.string().nullable(),
    createdAt: IsoMoment,
    updatedAt: IsoMoment,
});
//# sourceMappingURL=tenancy.js.map