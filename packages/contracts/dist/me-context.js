"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TENANCY_STATUSES = exports.MeContext = exports.MeContextTenancy = exports.MeContextBusiness = exports.MeSurface = void 0;
exports.landlordBusiness = landlordBusiness;
exports.landingFor = landingFor;
const zod_1 = require("zod");
const authz_1 = require("./authz");
const primitives_1 = require("./primitives");
const dates_1 = require("./rentals/dates");
const vocab_1 = require("./rentals/vocab");
// ===========================================================================
// Who am I, in one call (blueprint 2.5): `GET /api/v1/me/context`
// ===========================================================================
//
// Every surface a person may open comes from real records, never from a list
// of email addresses: a business membership, a tenancy, a local leader's or
// officer's seat, a broker record, a staff role. The app reads this once per
// request to pick the shell and where a person lands after signing in.
/** The surfaces a person can land on, in the order they are preferred. */
exports.MeSurface = zod_1.z.enum(["landlord", "business", "tenant", "leader", "broker", "admin", "guest"]);
/** A business the person is an active member of. */
exports.MeContextBusiness = zod_1.z.object({
    workspaceId: primitives_1.Uuid,
    orgId: primitives_1.Uuid,
    orgName: zod_1.z.string(),
    domain: primitives_1.Domain,
    role: primitives_1.OrgRole.nullable(),
    registrationStatus: primitives_1.OrgRegistrationStatus.nullable(),
    /** Approved and running: only then does it grant any permission. */
    operational: zod_1.z.boolean(),
    permissions: zod_1.z.array(authz_1.Permission),
});
/** A home the person rents: a lease naming them (through `tenants.user_id`) that is not a draft. */
exports.MeContextTenancy = zod_1.z.object({
    leaseId: primitives_1.Uuid,
    reference: zod_1.z.string(),
    status: vocab_1.LeaseStatus,
    landlordName: zod_1.z.string(),
    propertyName: zod_1.z.string(),
    unitLabel: zod_1.z.string(),
    monthlyRentRwf: zod_1.z.number().int(),
    startDate: dates_1.CalendarDay,
    endDate: dates_1.CalendarDay,
});
exports.MeContext = zod_1.z.object({
    user: zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string().nullable(), email: zod_1.z.string() }),
    businesses: zod_1.z.array(exports.MeContextBusiness),
    /** The workspace this session last chose (`POST /me/active-workspace`); a hint about order, never about access. */
    activeWorkspaceId: primitives_1.Uuid.nullable(),
    tenancies: zod_1.z.array(exports.MeContextTenancy),
    /** Seats as a local leader or a government officer. */
    oversight: zod_1.z.array(authz_1.OversightGrant),
    broker: zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string().nullable(), status: zod_1.z.string() }).nullable(),
    staff: zod_1.z.object({ isStaff: zod_1.z.boolean(), roles: zod_1.z.array(primitives_1.StaffRole) }),
    /** Where this person lands after signing in, with the business it is about (landlord and business). */
    landing: zod_1.z.object({ surface: exports.MeSurface, workspaceId: primitives_1.Uuid.nullable() }),
});
/** The leases that make someone a tenant: anything the landlord has signed and sent. */
exports.TENANCY_STATUSES = ["pending_signature", "signed", "active", "ending", "ended"];
/**
 * The residence business a landlord works in: the session's choice when it is an operational residence
 * business, else the first operational one. Null when the person runs no residence business.
 */
function landlordBusiness(businesses, activeWorkspaceId) {
    const residence = businesses.filter((b) => b.domain === "residence" && b.operational && b.role !== null);
    return residence.find((b) => b.workspaceId === activeWorkspaceId) ?? residence[0] ?? null;
}
/**
 * Where a person lands (blueprint 3.2): the business the session last chose when it runs; else a
 * residence business (the landlord's home); else any other business; else their own home as a tenant;
 * else a local leader's or officer's console; else the broker's workspace; else the admin console; else
 * the guest side. A tenancy counts once the lease is out of draft and not cancelled.
 */
function landingFor(context) {
    const running = context.businesses.filter((b) => b.operational && b.role !== null);
    const active = running.find((b) => b.workspaceId === context.activeWorkspaceId);
    if (active)
        return { surface: active.domain === "residence" ? "landlord" : "business", workspaceId: active.workspaceId };
    const landlord = landlordBusiness(context.businesses, context.activeWorkspaceId);
    if (landlord)
        return { surface: "landlord", workspaceId: landlord.workspaceId };
    const business = running[0];
    if (business)
        return { surface: "business", workspaceId: business.workspaceId };
    if (context.tenancies.some((t) => exports.TENANCY_STATUSES.includes(t.status))) {
        return { surface: "tenant", workspaceId: null };
    }
    if (context.oversight.length > 0)
        return { surface: "leader", workspaceId: null };
    if (context.broker && context.broker.status === "active")
        return { surface: "broker", workspaceId: null };
    if (context.staff.isStaff)
        return { surface: "admin", workspaceId: null };
    return { surface: "guest", workspaceId: null };
}
//# sourceMappingURL=me-context.js.map