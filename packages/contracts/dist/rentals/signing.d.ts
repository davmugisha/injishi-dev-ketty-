import { z } from "zod";
/** How long an emailed signing code is good for. */
export declare const SIGNING_CODE_TTL_SECONDS = 600;
/** Wrong tries before a signing code stops working. */
export declare const SIGNING_CODE_MAX_ATTEMPTS = 5;
/** How long after one signing code another can be sent. */
export declare const SIGNING_CODE_RESEND_SECONDS = 60;
/** How long an invitation link works. */
export declare const LEASE_INVITATION_DAYS = 14;
/** How long after one invitation email the landlord can send it again. */
export declare const INVITATION_RESEND_SECONDS = 60;
/**
 * `POST /ops/leases/:id/sign/code` and `POST /me/tenancies/:leaseId/sign/code`.
 *
 * A second ask within `SIGNING_CODE_RESEND_SECONDS` sends nothing new
 * (`sent: false`): the code already sent still works, and the screen counts
 * down `resendInSeconds` before it offers another.
 */
export declare const SigningCodeSent: z.ZodObject<{
    /** The address the code went to, partly hidden: `am••••@injishi.test`. */
    sentTo: z.ZodString;
    /** A new code was emailed just now. */
    sent: z.ZodBoolean;
    expiresInSeconds: z.ZodNumber;
    /** Seconds before another code can be asked for; 0 when it can be now. */
    resendInSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sent: boolean;
    expiresInSeconds: number;
    sentTo: string;
    resendInSeconds: number;
}, {
    sent: boolean;
    expiresInSeconds: number;
    sentTo: string;
    resendInSeconds: number;
}>;
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
export declare const ResendInvitationRequest: z.ZodEffects<z.ZodObject<{
    email: z.ZodOptional<z.ZodString>;
    confirmEmail: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    confirmEmail?: boolean | undefined;
}, {
    email?: string | undefined;
    confirmEmail?: boolean | undefined;
}>, {
    email?: string | undefined;
    confirmEmail?: boolean | undefined;
}, {
    email?: string | undefined;
    confirmEmail?: boolean | undefined;
}>;
export type ResendInvitationRequest = z.infer<typeof ResendInvitationRequest>;
/** The token in an invitation link: 32 random bytes, base64url. */
export declare const LeaseInvitationToken: z.ZodString;
export type LeaseInvitationToken = z.infer<typeof LeaseInvitationToken>;
/** Where an invitation link stands, for the person holding it. */
export declare const LeaseInvitationState: z.ZodEnum<["open", "accepted", "expired", "revoked"]>;
export type LeaseInvitationState = z.infer<typeof LeaseInvitationState>;
/**
 * `GET /lease-invitations/:token` (public): what the invitation page shows
 * before anyone signs in. The token was mailed to one address, so the page
 * may show the home and the terms; the address itself is partly hidden.
 * Accepting still takes a session for that address.
 */
export declare const LeaseInvitationPreview: z.ZodObject<{
    state: z.ZodEnum<["open", "accepted", "expired", "revoked"]>;
    /** Plain words for a link that is no longer open; null while it is. */
    message: z.ZodNullable<z.ZodString>;
    /** The address the invitation went to, partly hidden. */
    invitedEmail: z.ZodString;
    landlordName: z.ZodString;
    propertyName: z.ZodString;
    unitLabel: z.ZodString;
    district: z.ZodNullable<z.ZodString>;
    monthlyRentRwf: z.ZodNumber;
    depositRwf: z.ZodNumber;
    startDate: z.ZodEffects<z.ZodString, string, string>;
    endDate: z.ZodEffects<z.ZodString, string, string>;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string | null;
    district: string | null;
    propertyName: string;
    state: "expired" | "open" | "accepted" | "revoked";
    expiresAt: string;
    unitLabel: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    landlordName: string;
    depositRwf: number;
    invitedEmail: string;
}, {
    message: string | null;
    district: string | null;
    propertyName: string;
    state: "expired" | "open" | "accepted" | "revoked";
    expiresAt: string;
    unitLabel: string;
    monthlyRentRwf: number;
    startDate: string;
    endDate: string;
    landlordName: string;
    depositRwf: number;
    invitedEmail: string;
}>;
export type LeaseInvitationPreview = z.infer<typeof LeaseInvitationPreview>;
/**
 * `POST /me/lease-invitations/accept`: take a lease offered to the signed in
 * email, from the link (`token`) or from the list of invitations waiting for
 * this address (`invitationId`, `GET /me/tenancies`). Accepting twice is
 * answered like the first time.
 */
export declare const AcceptLeaseInvitationRequest: z.ZodEffects<z.ZodObject<{
    token: z.ZodOptional<z.ZodString>;
    invitationId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    token?: string | undefined;
    invitationId?: string | undefined;
}, {
    token?: string | undefined;
    invitationId?: string | undefined;
}>, {
    token?: string | undefined;
    invitationId?: string | undefined;
}, {
    token?: string | undefined;
    invitationId?: string | undefined;
}>;
export type AcceptLeaseInvitationRequest = z.infer<typeof AcceptLeaseInvitationRequest>;
/**
 * The app's pages the rentals emails open (paths under the app's origin). The
 * API builds every link from these, and the app serves them, so the two cannot
 * drift: the invitation page, the tenant's lease page, the landlord's lease
 * record.
 */
export declare const RENTALS_APP_PATHS: {
    readonly invitation: (token: string) => string;
    readonly tenantLease: (leaseId: string) => string;
    readonly landlordLease: (leaseId: string) => string;
};
//# sourceMappingURL=signing.d.ts.map