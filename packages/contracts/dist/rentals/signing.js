"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENTALS_APP_PATHS = exports.AcceptLeaseInvitationRequest = exports.LeaseInvitationPreview = exports.LeaseInvitationState = exports.LeaseInvitationToken = exports.ResendInvitationRequest = exports.SigningCodeSent = exports.INVITATION_RESEND_SECONDS = exports.LEASE_INVITATION_DAYS = exports.SIGNING_CODE_RESEND_SECONDS = exports.SIGNING_CODE_MAX_ATTEMPTS = exports.SIGNING_CODE_TTL_SECONDS = void 0;
const zod_1 = require("zod");
const primitives_1 = require("../primitives");
const dates_1 = require("./dates");
const identity_1 = require("./identity");
// ===========================================================================
// Signing a lease, and inviting the tenant to it
// ===========================================================================
//
// Both sides sign the same way (`SignLeaseRequest` in contract.ts): the typed
// name, an optional drawn signature, and a 6 digit code emailed to the signer.
// The landlord's signature sends the lease out: the tenant gets an invitation
// link by email, opens it, signs in with that address, accepts, and signs.
/** How long an emailed signing code is good for. */
exports.SIGNING_CODE_TTL_SECONDS = 600;
/** Wrong tries before a signing code stops working. */
exports.SIGNING_CODE_MAX_ATTEMPTS = 5;
/** How long after one signing code another can be sent. */
exports.SIGNING_CODE_RESEND_SECONDS = 60;
/** How long an invitation link works. */
exports.LEASE_INVITATION_DAYS = 14;
/** How long after one invitation email the landlord can send it again. */
exports.INVITATION_RESEND_SECONDS = 60;
/**
 * `POST /ops/leases/:id/sign/code` and `POST /me/tenancies/:leaseId/sign/code`.
 *
 * A second ask within `SIGNING_CODE_RESEND_SECONDS` sends nothing new
 * (`sent: false`): the code already sent still works, and the screen counts
 * down `resendInSeconds` before it offers another.
 */
exports.SigningCodeSent = zod_1.z.object({
    /** The address the code went to, partly hidden: `am••••@injishi.test`. */
    sentTo: zod_1.z.string(),
    /** A new code was emailed just now. */
    sent: zod_1.z.boolean(),
    expiresInSeconds: zod_1.z.number().int(),
    /** Seconds before another code can be asked for; 0 when it can be now. */
    resendInSeconds: zod_1.z.number().int(),
});
/**
 * `POST /ops/leases/:id/invitation/resend`: email the invitation again, with
 * a fresh link (the old link stops working).
 *
 * `email` changes where it goes, before the tenant accepts. The address is
 * part of the contract (it names the tenant's email), so a new one is an edit
 * of the lease: the landlord's signature is voided, the lease goes back to
 * draft, and signing it again sends the invitation to the new address. A
 * likely typo is refused unless `confirmEmail` says it is right.
 */
exports.ResendInvitationRequest = zod_1.z
    .object({
    email: identity_1.PersonEmail.optional(),
    confirmEmail: zod_1.z.boolean().optional(),
})
    .superRefine((v, ctx) => (0, identity_1.checkEmailTypo)(v.email, v.confirmEmail, ctx, ["email"]));
/** The token in an invitation link: 32 random bytes, base64url. */
exports.LeaseInvitationToken = zod_1.z
    .string()
    .regex(/^[A-Za-z0-9_-]{32,64}$/, "This invitation link isn't valid. Open it from your email again.");
/** Where an invitation link stands, for the person holding it. */
exports.LeaseInvitationState = zod_1.z.enum(["open", "accepted", "expired", "revoked"]);
/**
 * `GET /lease-invitations/:token` (public): what the invitation page shows
 * before anyone signs in. The token was mailed to one address, so the page
 * may show the home and the terms; the address itself is partly hidden.
 * Accepting still takes a session for that address.
 */
exports.LeaseInvitationPreview = zod_1.z.object({
    state: exports.LeaseInvitationState,
    /** Plain words for a link that is no longer open; null while it is. */
    message: zod_1.z.string().nullable(),
    /** The address the invitation went to, partly hidden. */
    invitedEmail: zod_1.z.string(),
    landlordName: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    district: zod_1.z.string().nullable(),
    monthlyRentRwf: zod_1.z.number().int(),
    depositRwf: zod_1.z.number().int(),
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
    expiresAt: zod_1.z.string(),
});
/**
 * `POST /me/lease-invitations/accept`: take a lease offered to the signed in
 * email, from the link (`token`) or from the list of invitations waiting for
 * this address (`invitationId`, `GET /me/tenancies`). Accepting twice is
 * answered like the first time.
 */
exports.AcceptLeaseInvitationRequest = zod_1.z
    .object({
    token: exports.LeaseInvitationToken.optional(),
    invitationId: primitives_1.Uuid.optional(),
})
    .refine((v) => (v.token === undefined) !== (v.invitationId === undefined), {
    message: "Open the invitation from your email again.",
    path: ["token"],
});
// --- Where emails link to in the app ----------------------------------------------
/**
 * The app's pages the rentals emails open (paths under the app's origin). The
 * API builds every link from these, and the app serves them, so the two cannot
 * drift: the invitation page, the tenant's lease page, the landlord's lease
 * record.
 */
exports.RENTALS_APP_PATHS = {
    invitation: (token) => `/invite/lease/${encodeURIComponent(token)}`,
    tenantLease: (leaseId) => `/home/${encodeURIComponent(leaseId)}/lease`,
    landlordLease: (leaseId) => `/leases/${encodeURIComponent(leaseId)}`,
};
//# sourceMappingURL=signing.js.map