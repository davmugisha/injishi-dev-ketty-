import { z } from "zod";
import { DepartmentCategory } from "./ops";
import { Domain, OrgRegistrationStatus, OrgRole, OversightRole, OversightScopeLevel, Uuid, WorkspaceKind } from "./primitives";
/**
 * The one authorization model (Spec 0002).
 *
 * Before this existed the permission matrix lived only in the operator app's
 * browser, which made it a product correctness control and never a security
 * boundary. It lives here so the API and every client resolve the SAME answer
 * from the SAME table. The server is the enforcement point; a client copy is an
 * affordance.
 *
 * This is authorization, deliberately NOT in `@injishi/auth`, which is
 * authentication only.
 */
// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------
/** What an action needs. A permission absent from a role's set is denied. */
export const Permission = z.enum([
    "reservation.approve",
    "reservation.assign",
    "stay.checkin",
    "stay.checkout",
    "folio.charge",
    "folio.payment",
    "housekeeping.set",
    "ticket.advance",
    "order.advance",
    "menu.manage",
    "team.manage",
    "money.view",
    "property.switch",
    "rent.record",
    "lease.advance",
    "deposit.return",
    "unit.manage",
    "listing.manage",
    "message.send",
    "task.assign",
    "amenity.manage",
    /**
     * Create and edit the property's departments (ADR-016, D-p).
     *
     * The twenty second permission, and owner plus manager only. A department
     * decides where revenue is reported and where an order routes, so a
     * receptionist who could rename one could quietly move a restaurant's takings
     * into Rooms.
     */
    "department.manage",
    /**
     * Connect the business's RRA EBM account and choose the catalog items its
     * sales are invoiced against (ADR-041).
     *
     * The twenty third permission, and owner plus manager only. This is the
     * taxpayer's own fiscal identity: whoever holds it decides which RRA account
     * every sale of this business is declared under, and can disconnect the
     * account and stop the declarations. A receptionist taking a booking must
     * never be able to re-point where that booking is taxed.
     */
    "ebm.manage",
    /**
     * Close a bill, which SIGNS ITS SALE with RRA (ADR-050 D-t, AC-8).
     *
     * Owner, manager and receptionist. Signing a correct sale at the desk is the
     * desk's job, and a hotel cannot wake a manager per departure. Check out
     * requires it alongside `stay.checkout`, because check out is what signs:
     * gating only the close route would leave the fiscal act reachable through
     * a permission the receptionist already held.
     */
    "folio.close",
    /**
     * Withdraw a signed sale with an `NR` refund receipt (ADR-050 D-t, AC-8).
     *
     * Owner and manager only. Creating a declaration is routine; withdrawing one
     * reduces declared turnover, and §14 wants a named person's justification.
     */
    "ebm.refund",
    /**
     * Decide an outlet's operator, owner, relationship and tax entity
     * (ADR-050 D-t). Owner and manager only, because those decide who is taxed
     * for what.
     */
    "outlet.manage",
]);
export type Permission = z.infer<typeof Permission>;
const ALL = Permission.options;
/**
 * What belongs to whoever OWNS the business rather than to whoever runs it.
 *
 * `team.manage` decides who works here. Hiring, removing and re-roling staff
 * outlives any one manager's tenure, and a manager who held it could remove the
 * people the owner put there — including, with nothing else in the way, the
 * other managers.
 *
 * UNTIL 2026-09-12 A MANAGER HELD IT, because `manager` was `new Set(ALL)` —
 * byte-identical to `owner`, so the two roles differed in name only. Nothing had
 * ever argued that a manager should decide the roster; it fell out of "manager
 * runs the property" being written as ALL.
 *
 * `ebm.manage` is deliberately NOT here. It was considered and left with the
 * manager, because [ADR-041](../../../injishi.context/dox/adrs/041-live-ebm-invoice.md)
 * D-o ratified it as owner-and-manager on 2026-09-11 and built the Settings →
 * Integrations door to match. Moving it would reverse a decision that has been
 * made and argued, which this has not.
 *
 * A manager who reaches `/ops/team` is now refused by `WorkspaceGuard`, and
 * `navFor` no longer offers the People leaf to one — the two must move together
 * or a manager gets a door that refuses them.
 */
const OWNER_ONLY: readonly Permission[] = ["team.manage"];
/**
 * Role to permissions, inside a business workspace.
 *
 * owner runs and OWNS the property: everything, the roster included.
 * manager runs the property: everything operational, money and the fiscal
 * account included — but does not decide who works here (`OWNER_ONLY`).
 * receptionist works the front desk and takes service orders: no money, no
 * team, no housekeeping board, no menu editing.
 * housekeeper is the phone: room status and maintenance tickets only.
 */
const ROLE_PERMISSIONS = {
    owner: new Set(ALL),
    manager: new Set(ALL.filter((p) => !OWNER_ONLY.includes(p))),
    receptionist: new Set([
        "reservation.approve",
        "reservation.assign",
        "stay.checkin",
        "stay.checkout",
        "folio.charge",
        "folio.payment",
        "folio.close",
        "order.advance",
        "message.send",
    ]),
    housekeeper: new Set(["housekeeping.set", "ticket.advance"]),
};
/** Does this role hold this permission? The single predicate both sides use. */
export function can(role: OrgRole, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}
/** Every permission a role holds, as a stable sorted list. */
export function permissionsForRole(role: OrgRole): Permission[] {
    return ALL.filter((p) => can(role, p));
}
/** Plain wording for the denial message. Names the missing capability. */
export const PERMISSION_LABEL: Readonly<Record<Permission, string>> = {
    "reservation.approve": "approve reservations",
    "reservation.assign": "assign rooms",
    "stay.checkin": "check guests in",
    "stay.checkout": "check guests out",
    "folio.charge": "add charges to a bill",
    "folio.payment": "record payments",
    "housekeeping.set": "set room status",
    "ticket.advance": "update maintenance tickets",
    "order.advance": "update service orders",
    "menu.manage": "edit the menu",
    "team.manage": "manage the team",
    "money.view": "view money",
    "property.switch": "switch property",
    "rent.record": "record rent",
    "lease.advance": "advance leases",
    "deposit.return": "return deposits",
    "unit.manage": "change unit rents",
    "listing.manage": "manage listings and inventory",
    "message.send": "reply to messages",
    "task.assign": "assign cleaning tasks",
    "amenity.manage": "change what the property offers",
    "department.manage": "manage departments",
    "ebm.manage": "connect the RRA EBM account",
    "folio.close": "close a bill and sign its receipt",
    "ebm.refund": "refund a signed receipt",
    "outlet.manage": "manage outlets",
};
// ---------------------------------------------------------------------------
// Workspace access
// ---------------------------------------------------------------------------
/**
 * One workspace a person may act in, with the permissions that apply THERE.
 *
 * The six workspaces an operator sees are not six kinds of row. Host and
 * Landlord are both `business`, told apart by the org's domain. This shape is
 * what `GET /api/v1/me/workspaces` returns.
 */
export const WorkspaceAccess = z.object({
    workspaceId: Uuid,
    kind: WorkspaceKind,
    /** Set only for `business` workspaces. */
    orgId: Uuid.nullable(),
    orgName: z.string().nullable(),
    /** Host vs Landlord. Set only for `business`. */
    domain: Domain.nullable(),
    /** The person's role in that org. Set only for `business`. */
    orgRole: OrgRole.nullable(),
    /**
     * Where the org sits in the registration pipeline. Set only for `business`.
     *
     * This is on the wire because it is not decoration: it is what decides
     * whether `permissions` is populated at all (see `isOperational`). A client
     * renders the pending pipeline from it; the server refuses from it.
     */
    registrationStatus: OrgRegistrationStatus.nullable(),
    /** Resolved for this workspace, never global to the person. */
    permissions: z.array(Permission),
    /**
     * The USALI categories this business actually runs (ADR-035, D-a).
     *
     * On the grant because it decides which SECTIONS a nav has, and screen
     * access in the operator app is derived from the nav. It used to be read
     * from `data/demo.ts`, so a fixture decided which doors a real hotel had:
     * a property with no `fnb` department still got the Services door, and one
     * that ran a restaurant might not.
     *
     * Empty for `broker` and `personal`, which run no departments, and for a
     * business whose departments have not been seeded. Empty means "no optional
     * section", never "everything" — a nav must fail closed.
     *
     * Categories, not names. The names are an editable per property catalog
     * (D14) and two hotels spell the same department differently; the category
     * is the stable vocabulary both sides already share.
     */
    departments: z.array(DepartmentCategory),
    /**
     * What this workspace's property is called (ADR-035).
     *
     * **On the grant, and NOT read from `/inventory/properties`, because that
     * controller is gated on `listing.manage`.** The operator topbar says which
     * business and which property you are in on every screen, and a receptionist
     * — who may not manage listings — was getting a 403 on every page load for a
     * name. Identity is not a listing operation.
     *
     * THE FIRST property, because nothing yet says which one is in view and a
     * workspace may hold several. The guess is made ONCE, here, rather than
     * differently in each screen that needs it.
     *
     * Null for `broker` and `personal`, which have no property, and for a
     * business that has not created one yet.
     */
    propertyName: z.string().nullable(),
});
export type WorkspaceAccess = z.infer<typeof WorkspaceAccess>;
/**
 * May this org's workspace actually DO anything yet?
 *
 * Only `active`. A business that has paid but is not approved, or is approved
 * but suspended, is openable and readable — the registrant watches the pipeline
 * from inside it (F-S03 §6) — but holds no permission, so it can list no
 * inventory, take no money, and invite no staff. "Registration gates listing"
 * is enforced here rather than by hiding the workspace, because hiding it would
 * take away the one screen that explains the wait.
 */
export function isOperational(registrationStatus: OrgRegistrationStatus | null): boolean {
    return registrationStatus === "active";
}
/** Plain wording for why a pending workspace refused. Names the stage. */
export const REGISTRATION_STAGE_MESSAGE: Readonly<Record<OrgRegistrationStatus, string>> = {
    pending_payment: "Pay your registration fee to start verification. Nothing is reviewed until it clears.",
    submitted: "We're checking your TIN with RRA. This usually takes seconds.",
    tin_verified: "TIN verified. A district field verifier will confirm your business next.",
    field_verified: "Verified — awaiting approval.",
    approved: "Approved. Waiting for the owner to claim this business.",
    active: "Active.",
    rejected: "Rejected. Correct the details and resubmit — there's no new fee.",
    suspended: "Suspended by Injishi. Contact support to reinstate.",
};
/** What the operator app calls this workspace. */
export function workspaceLabel(a: {
    kind: WorkspaceKind;
    domain: Domain | null;
    orgName: string | null;
}): string {
    if (a.kind === "broker")
        return "Broker";
    if (a.kind === "personal")
        return "Personal";
    return a.orgName ?? (a.domain === "residence" ? "Landlord" : "Host");
}
/**
 * The permissions that apply in a workspace.
 *
 * Business workspaces resolve from the org role, **and only once the org is
 * `active`** — an owner of a business still in the registration pipeline holds
 * the role but none of its powers (D20, D23). Before this gate existed, an org
 * sitting at `submitted` handed its owner all 21 permissions, which is exactly
 * the "no listing before approval" rule failing open.
 *
 * Broker and Personal resolve to an empty set on purpose: the matrix above is
 * the BUSINESS OPERATOR matrix, and inventing broker or guest permissions here
 * would be a design decision, not an implementation of one. They are added when
 * their features are specced.
 */
export function permissionsForWorkspace(input: {
    kind: WorkspaceKind;
    orgRole: OrgRole | null;
    registrationStatus: OrgRegistrationStatus | null;
}): Permission[] {
    if (input.kind !== "business" || input.orgRole === null)
        return [];
    if (!isOperational(input.registrationStatus))
        return [];
    return permissionsForRole(input.orgRole);
}
/** Refuse unless the workspace grants it. The one predicate a guard calls. */
export function workspaceAllows(access: Pick<WorkspaceAccess, "permissions">, permission: Permission): boolean {
    return access.permissions.includes(permission);
}
// ---------------------------------------------------------------------------
// Government oversight
// ---------------------------------------------------------------------------
/**
 * An active oversight grant. Authority comes from THIS, never from a role name:
 * a function, the body that assigned it, that body's own job title, and a
 * region. A revoked grant is simply absent from the resolved list, which is why
 * "no assignment" and "no console" are the same thing.
 */
export const OversightGrant = z.object({
    oversightRole: OversightRole,
    governmentBodyCode: z.string(),
    governmentTitle: z.string().nullable(),
    scopeLevel: OversightScopeLevel,
    provinceId: z.number().int().nullable(),
    districtId: z.number().int().nullable(),
});
export type OversightGrant = z.infer<typeof OversightGrant>;
/**
 * A grant as the OFFICER'S OWN CONSOLE renders it (ADR-053, AC-G5).
 *
 * `OversightGrant` above is the authority: the few fields a guard and a scope
 * check need. This is the same seat with the words a person reads attached, and
 * it exists because the console used to render all of them from a static fixture
 * — two hardcoded officers with invented names, bodies and districts.
 *
 * **Three layers of name coexist here on purpose.** `oversightRole` is the
 * database's name and what the pipeline branches on. `bodyName` is the
 * institution as a citizen knows it. `title` is what that institution actually
 * calls the post. Collapsing any two of them loses the only one the officer would
 * recognise as their job.
 *
 * `scopeLabel` is the region IN WORDS, and `country` reads as Rwanda rather than
 * as null: an officer who cannot see which district they cover cannot tell whether
 * a missing business is out of scope or a bug. (The ADMIN console's
 * `AdminOversightGrant.scopeLabel` is null for a country grant instead, because
 * there it sits in a column of region names and "Rwanda" would read as a region.)
 */
export const OversightConsoleGrant = z.object({
    /** The assignment row, so a console can name the seat it is rendering. */
    assignmentId: Uuid,
    console: z.enum(["verification", "approval", "tax"]),
    oversightRole: OversightRole,
    bodyCode: z.string(),
    bodyName: z.string().nullable(),
    title: z.string().nullable(),
    scopeLevel: OversightScopeLevel,
    provinceId: z.number().int().nullable(),
    districtId: z.number().int().nullable(),
    scopeLabel: z.string(),
});
export type OversightConsoleGrant = z.infer<typeof OversightConsoleGrant>;
/** How a country-level scope reads on the officer's own console. */
export const OVERSIGHT_COUNTRY_SCOPE_LABEL = "Rwanda";
/**
 * The honest refusal for a posting whose console is not built (ADR-053, AC-G7).
 *
 * A tax compliance officer used to be shown an empty queue that answered 403 to
 * every action, which reads as "your access is broken" rather than "this does not
 * exist yet". Recording the posting is still right — it is real information and
 * admin should be able to enter it — so the grant stays and the screen says so.
 */
export const OVERSIGHT_CONSOLE_NOT_BUILT_MESSAGE: string = "Your appointment is recorded, and the console for it is not built yet. " +
    "Tax compliance review is not available in this release.";
/** Which console a function opens. */
export function oversightConsoleFor(role: OversightRole): "verification" | "approval" | "tax" {
    switch (role) {
        case "business_field_verifier":
            return "verification";
        case "business_approver":
            return "approval";
        case "tax_compliance_officer":
            return "tax";
    }
}
/**
 * Every district a province holds, as the caller read it from `districts`.
 *
 * Passed in rather than known here, because the geography is rows in a database
 * and this package reads none. Only the provinces a set of grants names need to
 * be present.
 */
export type ProvinceDistricts = ReadonlyMap<number, readonly number[]>;
/**
 * The districts a set of grants covers: THE one definition of oversight region
 * scope (ADR-053, AC-G8).
 *
 * `null` means everywhere, and it is not "none": a country grant adds no
 * predicate at all, and collapsing that to an empty list would hide every
 * business from the officer who can see the most. A province grant covers that
 * province's districts, and a district grant covers that district.
 *
 * Both halves of scope read this. The queue lists what is inside the set, and a
 * gate act on one business asks `scopeCoversDistrict` of the same set. They used
 * to be two pieces of code, `withinScope` for the single record and a hand rolled
 * expansion for the list, which is one boundary written twice.
 */
export function districtScopeOf(grants: readonly Pick<OversightGrant, "scopeLevel" | "provinceId" | "districtId">[], provinceDistricts: ProvinceDistricts): number[] | null {
    if (grants.some((g) => g.scopeLevel === "country"))
        return null;
    const ids = new Set<number>();
    for (const g of grants) {
        if (g.scopeLevel === "district" && g.districtId !== null)
            ids.add(g.districtId);
        if (g.scopeLevel === "province" && g.provinceId !== null) {
            for (const id of provinceDistricts.get(g.provinceId) ?? [])
                ids.add(id);
        }
    }
    return [...ids].sort((a, b) => a - b);
}
/**
 * Is a business in this district inside that scope?
 *
 * Scope is a BOUNDARY, not a display filter: an out of region business must be
 * unreachable, not merely unlisted. A business with no district is inside only a
 * country scope, because no narrower grant can be shown to cover it.
 */
export function scopeCoversDistrict(scope: readonly number[] | null, districtId: number | null): boolean {
    if (scope === null)
        return true;
    return districtId !== null && scope.includes(districtId);
}
/**
 * A grant's region, with a district grant's province resolved alongside it.
 *
 * The province is REQUIRED on a district scope and the caller reads it from
 * `districts.province_id`, because containment cannot be decided without it: a
 * province grant contains a district grant exactly when the district sits in
 * that province, and the grant row itself only records the district.
 */
export interface OversightScope {
    scopeLevel: OversightScopeLevel;
    provinceId: number | null;
    districtId: number | null;
}
/**
 * Do two grants cover any of the same ground? (ADR-053, AC-G2)
 *
 * Separation of duties is a SCOPE question, not an equality one. A person
 * holding `business_field_verifier` over the whole country and
 * `business_approver` in Gasabo can field verify a Gasabo business and then
 * approve their own work, and the two rows look nothing alike. The partial unique
 * index on the table catches only the identical case and its own comment concedes
 * this, which is why the rule lives here and the index stays as the backstop.
 *
 * Containment runs in BOTH directions on purpose: country contains every
 * province and district, a province contains its districts, and a district
 * contains itself.
 */
export function oversightScopesOverlap(a: OversightScope, b: OversightScope): boolean {
    // A country grant covers the whole map, so it meets everything.
    if (a.scopeLevel === "country" || b.scopeLevel === "country") return true;
    if (a.scopeLevel === "province" && b.scopeLevel === "province")
        return a.provinceId !== null && a.provinceId === b.provinceId;
    if (a.scopeLevel === "district" && b.scopeLevel === "district")
        return a.districtId !== null && a.districtId === b.districtId;
    // One province, one district: they meet when the district is in the province.
    const province = a.scopeLevel === "province" ? a : b;
    const district = a.scopeLevel === "province" ? b : a;
    return province.provinceId !== null && province.provinceId === district.provinceId;
}
/** The opposing gate role, the one a person may not also hold in the same place. */
export function opposingGateRole(role: OversightRole): OversightRole | null {
    switch (role) {
        case "business_field_verifier":
            return "business_approver";
        case "business_approver":
            return "business_field_verifier";
        // A tax compliance posting gates nothing in the registration pipeline, so
        // it opposes nothing. Holding it alongside either gate role is fine.
        case "tax_compliance_officer":
            return null;
    }
}
export const OVERSIGHT_SCOPE_CONFLICT_MESSAGE: string = "This person already holds the opposing role somewhere inside this region. " +
    "One person cannot both field-verify and approve the same business.";
export const OVERSIGHT_ORG_ROLE_CONFLICT_MESSAGE: string = "This person holds a role in a business inside this region. " +
    "An officer cannot gate the registration of their own competitors.";
export const OVERSIGHT_OWN_BUSINESS_MESSAGE: string = "You hold a role in this business, so you cannot decide its registration.";
/**
 * Separation of duties: an officer may not approve a business they field
 * verified themselves. The database carries the same rule as a CHECK; this is
 * the copy that can explain itself to a person.
 */
export function violatesSeparationOfDuties(input: {
    actorUserId: string;
    fieldVerifiedByUserId: string | null;
}): boolean {
    return (input.fieldVerifiedByUserId !== null &&
        input.fieldVerifiedByUserId === input.actorUserId);
}
export const SEPARATION_OF_DUTIES_MESSAGE: string = "You field-verified this business — a different officer must approve it. " +
    "This keeps one person from checking and approving their own work.";
// ---------------------------------------------------------------------------
// KYC elevation
// ---------------------------------------------------------------------------
/**
 * May this person take on a privileged role (host, landlord, staff, broker,
 * officer)? Browsing and booking never call this: the demand side stays email
 * OTP only, by decision. No document means no elevation.
 */
export function mayElevate(identity: {
    kycStatus: string;
    activeDocumentCount: number;
}): boolean {
    return identity.kycStatus === "verified" && identity.activeDocumentCount > 0;
}
export const ELEVATION_REFUSED_MESSAGE = "This needs a verified identity. Add a national ID or passport to continue.";