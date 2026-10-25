import { z } from "zod";
import { Uuid } from "../primitives";
import { TenancyBrokerView } from "./brokers";
import { CalendarDay } from "./dates";
import { LeaseChargesSummary, LeaseTermsView, LeaseVersionSummary } from "./api";
import { LeaseSignerRole, LeaseSigningMethod, LeaseStatus } from "./vocab";

// ===========================================================================
// The tenant's side: their tenancies (`/api/v1/me/tenancies`)
// ===========================================================================
//
// A tenancy is a lease seen by its tenant: the person whose account the
// tenant record is linked to (`tenants.user_id`, set when they accept the
// invitation). Drafts are never shown; another person's lease is 404.

const IsoMoment = z.string();

/** The landlord as the tenant sees them: the business, who signs for it, how to reach them. */
export const TenancyLandlord = z.object({
  name: z.string(),
  signatoryName: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
});
export type TenancyLandlord = z.infer<typeof TenancyLandlord>;

/** Where the home is, as the contract names it. */
export const TenancyPlace = z.object({
  propertyName: z.string(),
  unitLabel: z.string(),
  blockCode: z.string().nullable(),
  /** The home in one line: `Unit B-07, Kacyiru Court, KG 7 Ave, Urugwiro village, ...`. */
  line: z.string(),
  village: z.string().nullable(),
  cell: z.string().nullable(),
  sector: z.string().nullable(),
  district: z.string().nullable(),
  province: z.string().nullable(),
});
export type TenancyPlace = z.infer<typeof TenancyPlace>;

/** A signature standing on the current contract version. Its evidence stays on the signed PDF. */
export const TenancySignatureView = z.object({
  role: LeaseSignerRole,
  typedName: z.string().nullable(),
  method: LeaseSigningMethod,
  signedAt: IsoMoment,
  version: z.number().int(),
});
export type TenancySignatureView = z.infer<typeof TenancySignatureView>;

/** One row of `GET /me/tenancies`. */
export const TenancyListItem = z.object({
  id: Uuid,
  reference: z.string(),
  status: LeaseStatus,
  landlordName: z.string(),
  propertyName: z.string(),
  unitLabel: z.string(),
  monthlyRentRwf: z.number().int(),
  startDate: CalendarDay,
  endDate: CalendarDay,
  /** Out for signature and the tenant has not signed yet. */
  needsMySignature: z.boolean(),
  /** The oldest charge still open. */
  nextDue: z.object({ dueOn: CalendarDay, amountRwf: z.number().int() }).nullable(),
  /** Everything still owed on charges raised. */
  balanceRwf: z.number().int(),
});
export type TenancyListItem = z.infer<typeof TenancyListItem>;

/** A lease sent to the signed in email and not accepted yet. */
export const TenancyInvitationItem = z.object({
  invitationId: Uuid,
  leaseId: Uuid,
  landlordName: z.string(),
  propertyName: z.string(),
  unitLabel: z.string(),
  monthlyRentRwf: z.number().int(),
  startDate: CalendarDay,
  endDate: CalendarDay,
  sentAt: IsoMoment,
  expiresAt: IsoMoment,
});
export type TenancyInvitationItem = z.infer<typeof TenancyInvitationItem>;

/** `GET /me/tenancies`: the person's tenancies, newest first, and leases waiting for them to accept. */
export const TenancyList = z.object({
  tenancies: z.array(TenancyListItem),
  invitations: z.array(TenancyInvitationItem),
});
export type TenancyList = z.infer<typeof TenancyList>;

/** `GET /me/tenancies/:leaseId`, and what accepting an invitation or signing answers. */
export const TenancyDetail = z.object({
  id: Uuid,
  reference: z.string(),
  status: LeaseStatus,
  landlord: TenancyLandlord,
  place: TenancyPlace,
  tenant: z.object({ fullName: z.string(), email: z.string().nullable(), phone: z.string().nullable() }),
  terms: LeaseTermsView,
  currentVersion: LeaseVersionSummary.nullable(),
  signatures: z.array(TenancySignatureView),
  /** Out for signature and the tenant has not signed yet: the lease page offers Sign. */
  needsMySignature: z.boolean(),
  /** Both sides signed and the signed copy is kept: the PDF is the signed one. */
  signedCopyReady: z.boolean(),
  charges: LeaseChargesSummary,
  /** The broker who brought the tenant, rated once the tenancy starts. */
  broker: TenancyBrokerView.nullable(),
  signedAt: IsoMoment.nullable(),
  activatedAt: IsoMoment.nullable(),
  endedOn: CalendarDay.nullable(),
  cancelledAt: IsoMoment.nullable(),
  cancelReason: z.string().nullable(),
  createdAt: IsoMoment,
  updatedAt: IsoMoment,
});
export type TenancyDetail = z.infer<typeof TenancyDetail>;
