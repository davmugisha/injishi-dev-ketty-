import { z } from "zod";
import { Uuid } from "../primitives";
import { CalendarDay } from "./dates";
import { PersonEmail, checkEmailTypo } from "./identity";

// ===========================================================================
// Signing a lease, and inviting the tenant to it
// ===========================================================================
//
// Both sides sign the same way (`SignLeaseRequest` in contract.ts): the typed
// name, an optional drawn signature, and a 6 digit code emailed to the signer.
// The landlord's signature sends the lease out: the tenant gets an invitation
// link by email, opens it, signs in with that address, accepts, and signs.

/** How long an emailed signing code is good for. */
export const SIGNING_CODE_TTL_SECONDS = 600;
/** Wrong tries before a signing code stops working. */
export const SIGNING_CODE_MAX_ATTEMPTS = 5;
/** How long after one signing code another can be sent. */
export const SIGNING_CODE_RESEND_SECONDS = 60;
/** How long an invitation link works. */
export const LEASE_INVITATION_DAYS = 14;
/** How long after one invitation email the landlord can send it again. */
export const INVITATION_RESEND_SECONDS = 60;

/**
 * `POST /ops/leases/:id/sign/code` and `POST /me/tenancies/:leaseId/sign/code`.
 *
 * A second ask within `SIGNING_CODE_RESEND_SECONDS` sends nothing new
 * (`sent: false`): the code already sent still works, and the screen counts
 * down `resendInSeconds` before it offers another.
 */
export const SigningCodeSent = z.object({
  /** The address the code went to, partly hidden: `am••••@injishi.test`. */
  sentTo: z.string(),
  /** A new code was emailed just now. */
  sent: z.boolean(),
  expiresInSeconds: z.number().int(),
  /** Seconds before another code can be asked for; 0 when it can be now. */
  resendInSeconds: z.number().int(),
});
export type SigningCodeSent = z.infer<typeof SigningCodeSent>;

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
export const ResendInvitationRequest = z
  .object({
    email: PersonEmail.optional(),
    confirmEmail: z.boolean().optional(),
  })
  .superRefine((v, ctx) => checkEmailTypo(v.email, v.confirmEmail, ctx, ["email"]));
export type ResendInvitationRequest = z.infer<typeof ResendInvitationRequest>;

/** The token in an invitation link: 32 random bytes, base64url. */
export const LeaseInvitationToken = z
  .string()
  .regex(/^[A-Za-z0-9_-]{32,64}$/, "This invitation link isn't valid. Open it from your email again.");
export type LeaseInvitationToken = z.infer<typeof LeaseInvitationToken>;

/** Where an invitation link stands, for the person holding it. */
export const LeaseInvitationState = z.enum(["open", "accepted", "expired", "revoked"]);
export type LeaseInvitationState = z.infer<typeof LeaseInvitationState>;

/**
 * `GET /lease-invitations/:token` (public): what the invitation page shows
 * before anyone signs in. The token was mailed to one address, so the page
 * may show the home and the terms; the address itself is partly hidden.
 * Accepting still takes a session for that address.
 */
export const LeaseInvitationPreview = z.object({
  state: LeaseInvitationState,
  /** Plain words for a link that is no longer open; null while it is. */
  message: z.string().nullable(),
  /** The address the invitation went to, partly hidden. */
  invitedEmail: z.string(),
  landlordName: z.string(),
  propertyName: z.string(),
  unitLabel: z.string(),
  district: z.string().nullable(),
  monthlyRentRwf: z.number().int(),
  depositRwf: z.number().int(),
  startDate: CalendarDay,
  endDate: CalendarDay,
  expiresAt: z.string(),
});
export type LeaseInvitationPreview = z.infer<typeof LeaseInvitationPreview>;

/**
 * `POST /me/lease-invitations/accept`: take a lease offered to the signed in
 * email, from the link (`token`) or from the list of invitations waiting for
 * this address (`invitationId`, `GET /me/tenancies`). Accepting twice is
 * answered like the first time.
 */
export const AcceptLeaseInvitationRequest = z
  .object({
    token: LeaseInvitationToken.optional(),
    invitationId: Uuid.optional(),
  })
  .refine((v) => (v.token === undefined) !== (v.invitationId === undefined), {
    message: "Open the invitation from your email again.",
    path: ["token"],
  });
export type AcceptLeaseInvitationRequest = z.infer<typeof AcceptLeaseInvitationRequest>;

// --- Where emails link to in the app ----------------------------------------------

/**
 * The app's pages the rentals emails open (paths under the app's origin). The
 * API builds every link from these, and the app serves them, so the two cannot
 * drift: the invitation page, the tenant's lease page, the landlord's lease
 * record.
 */
export const RENTALS_APP_PATHS = {
  invitation: (token: string): string => `/invite/lease/${encodeURIComponent(token)}`,
  tenantLease: (leaseId: string): string => `/home/${encodeURIComponent(leaseId)}/lease`,
  landlordLease: (leaseId: string): string => `/leases/${encodeURIComponent(leaseId)}`,
} as const;
