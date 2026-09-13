import { z } from "zod";
import { Domain, OrgRegistrationStatus, OrgRole, OversightRole, WorkspaceKind } from "./primitives";
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
/** What an action needs. A permission absent from a role's set is denied. */
export declare const Permission: z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "property.switch", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage"]>;
export type Permission = z.infer<typeof Permission>;
/** Does this role hold this permission? The single predicate both sides use. */
export declare function can(role: OrgRole, permission: Permission): boolean;
/** Every permission a role holds, as a stable sorted list. */
export declare function permissionsForRole(role: OrgRole): Permission[];
/** Plain wording for the denial message. Names the missing capability. */
export declare const PERMISSION_LABEL: Readonly<Record<Permission, string>>;
/**
 * One workspace a person may act in, with the permissions that apply THERE.
 *
 * The six workspaces an operator sees are not six kinds of row. Host and
 * Landlord are both `business`, told apart by the org's domain. This shape is
 * what `GET /api/v1/me/workspaces` returns.
 */
export declare const WorkspaceAccess: z.ZodObject<{
    workspaceId: z.ZodString;
    kind: z.ZodEnum<["business", "broker", "personal"]>;
    /** Set only for `business` workspaces. */
    orgId: z.ZodNullable<z.ZodString>;
    orgName: z.ZodNullable<z.ZodString>;
    /** Host vs Landlord. Set only for `business`. */
    domain: z.ZodNullable<z.ZodEnum<["hospitality", "residence"]>>;
    /** The person's role in that org. Set only for `business`. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
    /**
     * Where the org sits in the registration pipeline. Set only for `business`.
     *
     * This is on the wire because it is not decoration: it is what decides
     * whether `permissions` is populated at all (see `isOperational`). A client
     * renders the pending pipeline from it; the server refuses from it.
     */
    registrationStatus: z.ZodNullable<z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>>;
    /** Resolved for this workspace, never global to the person. */
    permissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "property.switch", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage"]>, "many">;
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
    departments: z.ZodArray<z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>, "many">;
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
    propertyName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    domain: "hospitality" | "residence" | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
    orgId: string | null;
    orgName: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    workspaceId: string;
    kind: "business" | "broker" | "personal";
    propertyName: string | null;
    departments: ("rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr")[];
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "property.switch" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage")[];
}, {
    domain: "hospitality" | "residence" | null;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
    orgId: string | null;
    orgName: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    workspaceId: string;
    kind: "business" | "broker" | "personal";
    propertyName: string | null;
    departments: ("rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities" | "hr")[];
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "property.switch" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage")[];
}>;
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
export declare function isOperational(registrationStatus: OrgRegistrationStatus | null): boolean;
/** Plain wording for why a pending workspace refused. Names the stage. */
export declare const REGISTRATION_STAGE_MESSAGE: Readonly<Record<OrgRegistrationStatus, string>>;
/** What the operator app calls this workspace. */
export declare function workspaceLabel(a: {
    kind: WorkspaceKind;
    domain: Domain | null;
    orgName: string | null;
}): string;
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
export declare function permissionsForWorkspace(input: {
    kind: WorkspaceKind;
    orgRole: OrgRole | null;
    registrationStatus: OrgRegistrationStatus | null;
}): Permission[];
/** Refuse unless the workspace grants it. The one predicate a guard calls. */
export declare function workspaceAllows(access: Pick<WorkspaceAccess, "permissions">, permission: Permission): boolean;
/**
 * An active oversight grant. Authority comes from THIS, never from a role name:
 * a function, the body that assigned it, that body's own job title, and a
 * region. A revoked grant is simply absent from the resolved list, which is why
 * "no assignment" and "no console" are the same thing.
 */
export declare const OversightGrant: z.ZodObject<{
    oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver"]>;
    governmentBodyCode: z.ZodString;
    governmentTitle: z.ZodNullable<z.ZodString>;
    scopeLevel: z.ZodEnum<["country", "province", "district"]>;
    provinceId: z.ZodNullable<z.ZodNumber>;
    districtId: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    districtId: number | null;
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver";
    governmentBodyCode: string;
    governmentTitle: string | null;
    scopeLevel: "country" | "province" | "district";
    provinceId: number | null;
}, {
    districtId: number | null;
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver";
    governmentBodyCode: string;
    governmentTitle: string | null;
    scopeLevel: "country" | "province" | "district";
    provinceId: number | null;
}>;
export type OversightGrant = z.infer<typeof OversightGrant>;
/** Which console a function opens. */
export declare function oversightConsoleFor(role: OversightRole): "verification" | "approval" | "tax";
/**
 * Is a business inside this grant's region?
 *
 * Scope is a BOUNDARY, not a display filter: an out of region business must be
 * unreachable, not merely unlisted. Callers apply this at the query, and use
 * this predicate as the second line for a single record.
 */
export declare function withinScope(grant: Pick<OversightGrant, "scopeLevel" | "provinceId" | "districtId">, target: {
    provinceId: number | null;
    districtId: number | null;
}): boolean;
/**
 * Separation of duties: an officer may not approve a business they field
 * verified themselves. The database carries the same rule as a CHECK; this is
 * the copy that can explain itself to a person.
 */
export declare function violatesSeparationOfDuties(input: {
    actorUserId: string;
    fieldVerifiedByUserId: string | null;
}): boolean;
export declare const SEPARATION_OF_DUTIES_MESSAGE: string;
/**
 * May this person take on a privileged role (host, landlord, staff, broker,
 * officer)? Browsing and booking never call this: the demand side stays email
 * OTP only, by decision. No document means no elevation.
 */
export declare function mayElevate(identity: {
    kycStatus: string;
    activeDocumentCount: number;
}): boolean;
export declare const ELEVATION_REFUSED_MESSAGE = "This needs a verified identity. Add a national ID or passport to continue.";
//# sourceMappingURL=authz.d.ts.map