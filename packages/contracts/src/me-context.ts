import { z } from "zod";
import { OversightGrant, Permission } from "./authz";
import { Domain, OrgRegistrationStatus, OrgRole, StaffRole, Uuid } from "./primitives";
import { CalendarDay } from "./rentals/dates";
import { LeaseStatus } from "./rentals/vocab";

// ===========================================================================
// Who am I, in one call (blueprint 2.5): `GET /api/v1/me/context`
// ===========================================================================
//
// Every surface a person may open comes from real records, never from a list
// of email addresses: a business membership, a tenancy, a local leader's or
// officer's seat, a broker record, a staff role. The app reads this once per
// request to pick the shell and where a person lands after signing in.

/** The surfaces a person can land on, in the order they are preferred. */
export const MeSurface = z.enum(["landlord", "business", "tenant", "leader", "broker", "admin", "guest"]);
export type MeSurface = z.infer<typeof MeSurface>;

/** A business the person is an active member of. */
export const MeContextBusiness = z.object({
  workspaceId: Uuid,
  orgId: Uuid,
  orgName: z.string(),
  domain: Domain,
  role: OrgRole.nullable(),
  registrationStatus: OrgRegistrationStatus.nullable(),
  /** Approved and running: only then does it grant any permission. */
  operational: z.boolean(),
  permissions: z.array(Permission),
  /** A landlord business's lease signatory, as their ID names them; null until set or for other businesses. */
  signatoryName: z.string().nullable(),
});
export type MeContextBusiness = z.infer<typeof MeContextBusiness>;

/** A home the person rents: a lease naming them (through `tenants.user_id`) that is not a draft. */
export const MeContextTenancy = z.object({
  leaseId: Uuid,
  reference: z.string(),
  status: LeaseStatus,
  landlordName: z.string(),
  propertyName: z.string(),
  unitLabel: z.string(),
  monthlyRentRwf: z.number().int(),
  startDate: CalendarDay,
  endDate: CalendarDay,
});
export type MeContextTenancy = z.infer<typeof MeContextTenancy>;

export const MeContext = z.object({
  user: z.object({ id: Uuid, name: z.string().nullable(), email: z.string() }),
  businesses: z.array(MeContextBusiness),
  /** The workspace this session last chose (`POST /me/active-workspace`); a hint about order, never about access. */
  activeWorkspaceId: Uuid.nullable(),
  tenancies: z.array(MeContextTenancy),
  /** Seats as a local leader or a government officer. */
  oversight: z.array(OversightGrant),
  broker: z.object({ id: Uuid, name: z.string().nullable(), status: z.string() }).nullable(),
  staff: z.object({ isStaff: z.boolean(), roles: z.array(StaffRole) }),
  /** Where this person lands after signing in, with the business it is about (landlord and business). */
  landing: z.object({ surface: MeSurface, workspaceId: Uuid.nullable() }),
});
export type MeContext = z.infer<typeof MeContext>;

/** The leases that make someone a tenant: anything the landlord has signed and sent. */
export const TENANCY_STATUSES = ["pending_signature", "signed", "active", "ending", "ended"] as const;

/**
 * The residence business a landlord works in: the session's choice when it is an operational residence
 * business, else the first operational one. Null when the person runs no residence business.
 */
export function landlordBusiness(
  businesses: readonly MeContextBusiness[],
  activeWorkspaceId: string | null,
): MeContextBusiness | null {
  const residence = businesses.filter((b) => b.domain === "residence" && b.operational && b.role !== null);
  return residence.find((b) => b.workspaceId === activeWorkspaceId) ?? residence[0] ?? null;
}

/**
 * Where a person lands (blueprint 3.2): the business the session last chose when it runs; else a
 * residence business (the landlord's home); else any other business; else their own home as a tenant;
 * else a local leader's or officer's console; else the broker's workspace; else the admin console; else
 * the guest side. A tenancy counts once the lease is out of draft and not cancelled.
 */
export function landingFor(
  context: Pick<MeContext, "businesses" | "activeWorkspaceId" | "tenancies" | "oversight" | "broker" | "staff">,
): MeContext["landing"] {
  const running = context.businesses.filter((b) => b.operational && b.role !== null);
  const active = running.find((b) => b.workspaceId === context.activeWorkspaceId);
  if (active) return { surface: active.domain === "residence" ? "landlord" : "business", workspaceId: active.workspaceId };
  const landlord = landlordBusiness(context.businesses, context.activeWorkspaceId);
  if (landlord) return { surface: "landlord", workspaceId: landlord.workspaceId };
  const business = running[0];
  if (business) return { surface: "business", workspaceId: business.workspaceId };
  if (context.tenancies.some((t) => (TENANCY_STATUSES as readonly string[]).includes(t.status))) {
    return { surface: "tenant", workspaceId: null };
  }
  if (context.oversight.length > 0) return { surface: "leader", workspaceId: null };
  if (context.broker && context.broker.status === "active") return { surface: "broker", workspaceId: null };
  if (context.staff.isStaff) return { surface: "admin", workspaceId: null };
  return { surface: "guest", workspaceId: null };
}
