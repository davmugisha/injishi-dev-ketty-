import { z } from "zod";
import { Domain, OrgRegistrationStatus, OrgRole, OversightRole, OversightScopeLevel, WorkspaceKind } from "./primitives";
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
export declare const Permission: z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>;
export type Permission = z.infer<typeof Permission>;
/** Does this role hold this permission? The single predicate both sides use. */
export declare function can(role: OrgRole, permission: Permission): boolean;
/** Every permission a role holds, as a stable sorted list. */
export declare function permissionsForRole(role: OrgRole): Permission[];
/** Plain wording for the denial message. Names the missing capability. */
export declare const PERMISSION_LABEL: Readonly<Record<Permission, string>>;
/**
 * The roles a business may customise, and the fact that `owner` is not one.
 *
 * The six roles above are the PLATFORM's defaults: what a hotel means by
 * "receptionist" before anybody says otherwise. `finance` and `hr` (ADR-069
 * D-a) are customisable like the rest, and appear on the Roles screen with
 * their own defaults beside the others. The defaults were the whole model, and
 * two real properties never agree with them — one lets the front desk read the
 * month's takings, another does not let a manager withdraw a signed receipt.
 * The choice belongs to whoever owns the business, so a business may move a
 * permission on or off any of its staff roles, and the default set stays the
 * starting point rather than the ceiling.
 *
 * `owner` is excluded exactly as `InvitableOrgRole` excludes it, and for a
 * stronger reason: the customisation screen sits behind `team.manage`, which
 * only an owner holds, so an owner who could edit `owner` could remove their
 * own access to the screen that would put it back. There is no other door.
 */
export declare const CustomisableOrgRole: z.ZodEnum<["manager", "receptionist", "finance", "hr", "housekeeper"]>;
export type CustomisableOrgRole = z.infer<typeof CustomisableOrgRole>;
/** Is this a role a business may customise? Narrows, so callers stay honest. */
export declare function isCustomisableOrgRole(role: OrgRole): role is CustomisableOrgRole;
/**
 * One deliberate departure from the default set, for one role of one business.
 *
 * A DELTA rather than a stored permission list, and that is the design decision
 * rather than an implementation detail. A stored list would freeze the role at
 * the day it was edited: the twenty sixth permission, added to the platform next
 * quarter, would reach every business that had never opened this screen and no
 * business that had. A delta says only what this owner CHANGED, so a role that
 * was never customised for a permission still inherits the platform's answer for
 * it, and the two kinds of fact stay apart.
 */
export declare const RolePermissionOverride: z.ZodObject<{
    orgRole: z.ZodEnum<["manager", "receptionist", "finance", "hr", "housekeeper"]>;
    permission: z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>;
    /** True grants a permission the default set withholds; false withdraws one it gives. */
    granted: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper";
    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run";
    granted: boolean;
}, {
    orgRole: "manager" | "receptionist" | "finance" | "hr" | "housekeeper";
    permission: "reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run";
    granted: boolean;
}>;
export type RolePermissionOverride = z.infer<typeof RolePermissionOverride>;
/**
 * The permissions no business may move, and why each one is here.
 *
 * `team.manage` is the whole list, and it is `OWNER_ONLY` restated rather than a
 * second register: granting it to a manager would hand that manager this very
 * screen, from which they could grant themselves the rest and re-role the owner
 * out of their own business. Every other permission is an operational choice an
 * owner is entitled to make; this one is the lock on the door, so it cannot be
 * handed through the door.
 *
 * Locked means locked in BOTH directions. An owner cannot grant it to a
 * manager, and the question of withdrawing it from `owner` cannot arise,
 * because `owner` is not customisable at all.
 */
export declare const LOCKED_PERMISSIONS: readonly Permission[];
/** May an override move this permission at all? */
export declare function isLockedPermission(permission: Permission): boolean;
/** Why a locked permission is locked, in words a screen can print. */
export declare const LOCKED_PERMISSION_REASON: Readonly<Record<string, string>>;
/**
 * Every permission a role holds AT ONE BUSINESS: the defaults, plus what that
 * business granted, minus what it withdrew.
 *
 * Overrides for other roles are ignored rather than refused, so a caller may
 * hand in the whole business's set and ask about one role. A locked permission
 * is ignored in both directions whatever a stored row says: the row should never
 * exist, and if one ever did — a bad migration, a hand edited database — the
 * model must still refuse to resolve it into a grant. That is the difference
 * between validating an input and enforcing an invariant, and only the second
 * one survives a database somebody else wrote to.
 *
 * The answer keeps `Permission.options` order, like `permissionsForRole`, so
 * two grants that hold the same powers are the same array.
 */
export declare function effectivePermissionsForRole(role: OrgRole, overrides?: readonly RolePermissionOverride[]): Permission[];
/**
 * Narrow one STORED row into an override the model will resolve, or null.
 *
 * The one place a database row becomes a permission decision, so the API service
 * that edits the table and the resolver that reads it on every request cannot
 * narrow it two different ways.
 *
 * Three rows are dropped rather than refused, and each for its own reason:
 * a role this release does not have, a permission this release does not have —
 * `permission` is stored as text because the vocabulary changes with a release
 * and not with a migration, so a rolled back deploy legitimately leaves rows
 * from a newer one — and `owner`, which is not customisable at all. Dropping is
 * safe in both directions: an unrecognised grant grants nothing and an
 * unrecognised withdrawal withdraws nothing.
 *
 * A LOCKED permission is deliberately NOT dropped here, because dropping it
 * would make this the place the lock is enforced. It is enforced in
 * `effectivePermissionsForRole`, which is what every consumer resolves through;
 * a caller listing the stored rows should see a row that should not exist rather
 * than be told there is none.
 */
export declare function parseRolePermissionOverride(row: {
    orgRole: string;
    permission: string;
    granted: boolean;
}): RolePermissionOverride | null;
/**
 * How a screen groups the permissions, so a person reads a job rather than a
 * list of twenty five dotted names.
 *
 * In the contract beside the permissions themselves because it is the same
 * class of fact as `PERMISSION_LABEL`: wording that must not fork between the
 * operator app and anything else that ever renders this. It grants nothing.
 */
export declare const PERMISSION_AREA: z.ZodEnum<["front_desk", "rooms", "services", "money", "property", "people"]>;
export type PermissionArea = z.infer<typeof PERMISSION_AREA>;
/** What each area is called. */
export declare const PERMISSION_AREA_LABEL: Readonly<Record<PermissionArea, string>>;
/** Which area each permission belongs to. Every permission has exactly one. */
export declare const PERMISSION_AREA_OF: Readonly<Record<Permission, PermissionArea>>;
/**
 * One staff role, with the platform's answer and this business's beside it.
 *
 * **Three permission arrays, and none of them is redundant.** `basePermissions`
 * is what the platform says the role means; `permissions` is what it means here;
 * `lockedPermissions` is the subset of the first that no owner may move. A
 * screen that had only the effective array could render a set of toggles, but it
 * could not say which of them had been CHANGED — and "we changed this" is the
 * one thing an owner reviewing their own policy needs to see. It is also why the
 * difference is computed from two arrays on the wire rather than sent as a third
 * list of deltas: the two arrays are what the server actually resolved, so they
 * cannot disagree with each other.
 *
 * `memberCount` is how many ACTIVE people hold the role right now. It is here
 * because withdrawing a permission is not an abstract act: it changes what four
 * named colleagues can do on their next page load, and a screen that hides the
 * number invites the owner to find out afterwards.
 *
 * `customisable` is false for `owner` alone, and the screen renders that row
 * read only rather than hiding it. An owner looking for "why can nobody else
 * close the month" must be able to see the owner's own set.
 */
export declare const OperatorRolePermissions: z.ZodObject<{
    orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper"]>;
    /** `ORG_ROLE_LABEL[orgRole]` (in `ops.ts`), resolved server side so one table words it. */
    label: z.ZodString;
    customisable: z.ZodBoolean;
    /** The platform default for this role. */
    basePermissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>, "many">;
    /** What the role actually holds here: the default, plus grants, minus withdrawals. */
    permissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>, "many">;
    /** Permissions this business may not move in either direction. */
    lockedPermissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>, "many">;
    /** Active memberships holding this role. */
    memberCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    label: string;
    memberCount: number;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper";
    customisable: boolean;
    basePermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    lockedPermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
}, {
    label: string;
    memberCount: number;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper";
    customisable: boolean;
    basePermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    lockedPermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
}>;
export type OperatorRolePermissions = z.infer<typeof OperatorRolePermissions>;
export declare const OperatorRoleList: z.ZodObject<{
    roles: z.ZodArray<z.ZodObject<{
        orgRole: z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper"]>;
        /** `ORG_ROLE_LABEL[orgRole]` (in `ops.ts`), resolved server side so one table words it. */
        label: z.ZodString;
        customisable: z.ZodBoolean;
        /** The platform default for this role. */
        basePermissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>, "many">;
        /** What the role actually holds here: the default, plus grants, minus withdrawals. */
        permissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>, "many">;
        /** Permissions this business may not move in either direction. */
        lockedPermissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>, "many">;
        /** Active memberships holding this role. */
        memberCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        label: string;
        memberCount: number;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper";
        customisable: boolean;
        basePermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
        permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
        lockedPermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    }, {
        label: string;
        memberCount: number;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper";
        customisable: boolean;
        basePermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
        permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
        lockedPermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    roles: {
        label: string;
        memberCount: number;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper";
        customisable: boolean;
        basePermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
        permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
        lockedPermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    }[];
}, {
    roles: {
        label: string;
        memberCount: number;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper";
        customisable: boolean;
        basePermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
        permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
        lockedPermissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    }[];
}>;
export type OperatorRoleList = z.infer<typeof OperatorRoleList>;
/**
 * Set what a role may do here: the WHOLE set it should hold, not a delta.
 *
 * The client sends the state it wants and the server works out which
 * departures from the default that implies. Sending deltas from the browser
 * would make the client the author of the diff, and a client whose copy of the
 * default set was one release stale would then write a delta that meant
 * something else — the exact failure the stored-list design was rejected for.
 *
 * An empty array is legal and means a role that may do nothing. It is not the
 * same as deleting the role, and the screen says so before it saves.
 */
export declare const SetRolePermissionsRequest: z.ZodObject<{
    permissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>, "many">;
}, "strip", z.ZodTypeAny, {
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
}, {
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
}>;
export type SetRolePermissionsRequest = z.infer<typeof SetRolePermissionsRequest>;
/**
 * One workspace a person may act in, with the permissions that apply THERE.
 *
 * The six workspaces an operator sees are not six kinds of row. Host and
 * Landlord are both `business`, told apart by the org's domain. This shape is
 * what `GET /api/v1/me/workspaces` returns.
 */
/** Whether a member covers every branch of their business or only some (ADR-054). */
export declare const BranchCoverage: z.ZodEnum<["all", "limited"]>;
export type BranchCoverage = z.infer<typeof BranchCoverage>;
/** One branch a member covers, as the grant carries it (ADR-054 AC-S3). */
export declare const WorkspaceBranch: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    districtName: z.ZodNullable<z.ZodString>;
    isHeadOffice: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    districtName: string | null;
    isHeadOffice: boolean;
}, {
    name: string;
    id: string;
    districtName: string | null;
    isHeadOffice: boolean;
}>;
export type WorkspaceBranch = z.infer<typeof WorkspaceBranch>;
export declare const WorkspaceAccess: z.ZodObject<{
    workspaceId: z.ZodString;
    kind: z.ZodEnum<["business", "broker", "personal"]>;
    /** Set only for `business` workspaces. */
    orgId: z.ZodNullable<z.ZodString>;
    orgName: z.ZodNullable<z.ZodString>;
    /** Host vs Landlord. Set only for `business`. */
    domain: z.ZodNullable<z.ZodEnum<["hospitality", "residence"]>>;
    /** The person's role in that org. Set only for `business`. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper"]>>;
    /**
     * Where the org sits in the registration pipeline. Set only for `business`.
     *
     * This is on the wire because it is not decoration: it is what decides
     * whether `permissions` is populated at all (see `isOperational`). A client
     * renders the pending pipeline from it; the server refuses from it.
     */
    registrationStatus: z.ZodNullable<z.ZodEnum<["pending_payment", "submitted", "tin_verified", "field_verified", "approved", "active", "rejected", "suspended"]>>;
    /** Resolved for this workspace, never global to the person. */
    permissions: z.ZodArray<z.ZodEnum<["reservation.approve", "reservation.assign", "stay.checkin", "stay.checkout", "folio.charge", "folio.payment", "housekeeping.set", "ticket.advance", "order.advance", "menu.manage", "team.manage", "money.view", "rent.record", "lease.advance", "deposit.return", "unit.manage", "listing.manage", "message.send", "task.assign", "amenity.manage", "department.manage", "ebm.manage", "folio.close", "ebm.refund", "outlet.manage", "refund.decide", "offer.manage", "people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.draft", "payroll.run"]>, "many">;
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
     * The head office's name when this member covers it, else the first covered
     * branch by name (ADR-054 AC-S3). Made ONCE, here, rather than differently
     * in each screen that needs it.
     *
     * Null for `broker` and `personal`, which have no property, and for a
     * business that has not created one yet.
     */
    propertyName: z.ZodNullable<z.ZodString>;
    /**
     * The active branches this member covers, head office first then by name
     * (ADR-054 AC-S3). Every branch when `branchCoverage` is `all`. Empty for
     * `broker` and `personal`, and for a business with no property yet.
     *
     * Seeing a branch is COVERAGE, not a permission: the switcher reads this,
     * and the API narrows rows by the same list.
     */
    branches: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        districtName: z.ZodNullable<z.ZodString>;
        isHeadOffice: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        districtName: string | null;
        isHeadOffice: boolean;
    }, {
        name: string;
        id: string;
        districtName: string | null;
        isHeadOffice: boolean;
    }>, "many">;
    /** `limited` when the member is limited to some branches. Null outside `business`. */
    branchCoverage: z.ZodNullable<z.ZodEnum<["all", "limited"]>>;
    /**
     * Whether this person may see and act on the business's PSF membership
     * (ADR-056). Computed on the server by `isPsfApplicant`, which reads the
     * owner membership and the on behalf claim, never a permission: a pending
     * business holds none (ADR-053 rule 2), and the application must be
     * reachable at every registration stage. Null outside hospitality.
     *
     * Defaults to null when absent, so a client built after this field landed
     * still parses a grant from an API built before it.
     */
    psfMembership: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        canManage: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        canManage: boolean;
    }, {
        canManage: boolean;
    }>>>;
}, "strip", z.ZodTypeAny, {
    kind: "business" | "broker" | "personal";
    domain: "hospitality" | "residence" | null;
    branches: {
        name: string;
        id: string;
        districtName: string | null;
        isHeadOffice: boolean;
    }[];
    orgId: string | null;
    workspaceId: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
    orgName: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | null;
    propertyName: string | null;
    departments: ("hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities")[];
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    branchCoverage: "limited" | "all" | null;
    psfMembership: {
        canManage: boolean;
    } | null;
}, {
    kind: "business" | "broker" | "personal";
    domain: "hospitality" | "residence" | null;
    branches: {
        name: string;
        id: string;
        districtName: string | null;
        isHeadOffice: boolean;
    }[];
    orgId: string | null;
    workspaceId: string;
    registrationStatus: "pending_payment" | "submitted" | "tin_verified" | "field_verified" | "approved" | "active" | "rejected" | "suspended" | null;
    orgName: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | null;
    propertyName: string | null;
    departments: ("hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities")[];
    permissions: ("reservation.approve" | "reservation.assign" | "stay.checkin" | "stay.checkout" | "folio.charge" | "folio.payment" | "housekeeping.set" | "ticket.advance" | "order.advance" | "menu.manage" | "team.manage" | "money.view" | "rent.record" | "lease.advance" | "deposit.return" | "unit.manage" | "listing.manage" | "message.send" | "task.assign" | "amenity.manage" | "department.manage" | "ebm.manage" | "folio.close" | "ebm.refund" | "outlet.manage" | "refund.decide" | "offer.manage" | "people.view" | "people.manage" | "roster.manage" | "attendance.record" | "attendance.approve" | "leave.approve" | "payroll.draft" | "payroll.run")[];
    branchCoverage: "limited" | "all" | null;
    psfMembership?: {
        canManage: boolean;
    } | null | undefined;
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
 *
 * `roleOverrides` is what THIS business decided its roles mean. It is optional
 * and defaults to none, so every existing caller keeps the platform defaults and
 * a business that has never opened the Roles screen is unaffected. It is applied
 * INSIDE the registration gate rather than beside it: an org that is not
 * `active` holds nothing, and a business cannot grant its way past its own
 * approval.
 */
export declare function permissionsForWorkspace(input: {
    kind: WorkspaceKind;
    orgRole: OrgRole | null;
    registrationStatus: OrgRegistrationStatus | null;
    roleOverrides?: readonly RolePermissionOverride[];
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
    oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>;
    governmentBodyCode: z.ZodString;
    governmentTitle: z.ZodNullable<z.ZodString>;
    scopeLevel: z.ZodEnum<["country", "province", "district"]>;
    provinceId: z.ZodNullable<z.ZodNumber>;
    districtId: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    provinceId: number | null;
    districtId: number | null;
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    governmentBodyCode: string;
    governmentTitle: string | null;
    scopeLevel: "country" | "province" | "district";
}, {
    provinceId: number | null;
    districtId: number | null;
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    governmentBodyCode: string;
    governmentTitle: string | null;
    scopeLevel: "country" | "province" | "district";
}>;
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
export declare const OversightConsoleGrant: z.ZodObject<{
    /** The assignment row, so a console can name the seat it is rendering. */
    assignmentId: z.ZodString;
    console: z.ZodEnum<["verification", "approval", "tax", "membership"]>;
    oversightRole: z.ZodEnum<["tax_compliance_officer", "business_field_verifier", "business_approver", "psf_membership_officer"]>;
    bodyCode: z.ZodString;
    bodyName: z.ZodNullable<z.ZodString>;
    title: z.ZodNullable<z.ZodString>;
    scopeLevel: z.ZodEnum<["country", "province", "district"]>;
    provinceId: z.ZodNullable<z.ZodNumber>;
    districtId: z.ZodNullable<z.ZodNumber>;
    scopeLabel: z.ZodString;
}, "strip", z.ZodTypeAny, {
    provinceId: number | null;
    districtId: number | null;
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    title: string | null;
    scopeLevel: "country" | "province" | "district";
    scopeLabel: string;
    assignmentId: string;
    console: "membership" | "tax" | "verification" | "approval";
    bodyCode: string;
    bodyName: string | null;
}, {
    provinceId: number | null;
    districtId: number | null;
    oversightRole: "tax_compliance_officer" | "business_field_verifier" | "business_approver" | "psf_membership_officer";
    title: string | null;
    scopeLevel: "country" | "province" | "district";
    scopeLabel: string;
    assignmentId: string;
    console: "membership" | "tax" | "verification" | "approval";
    bodyCode: string;
    bodyName: string | null;
}>;
export type OversightConsoleGrant = z.infer<typeof OversightConsoleGrant>;
/** How a country-level scope reads on the officer's own console. */
export declare const OVERSIGHT_COUNTRY_SCOPE_LABEL = "Rwanda";
/**
 * The honest refusal for a posting whose console is not built (ADR-053, AC-G7).
 *
 * A tax compliance officer used to be shown an empty queue that answered 403 to
 * every action, which reads as "your access is broken" rather than "this does not
 * exist yet". Recording the posting is still right — it is real information and
 * admin should be able to enter it — so the grant stays and the screen says so.
 */
export declare const OVERSIGHT_CONSOLE_NOT_BUILT_MESSAGE: string;
/** Which console a function opens. */
export declare function oversightConsoleFor(role: OversightRole): "verification" | "approval" | "tax" | "membership";
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
export declare function districtScopeOf(grants: readonly Pick<OversightGrant, "scopeLevel" | "provinceId" | "districtId">[], provinceDistricts: ProvinceDistricts): number[] | null;
/**
 * Is a business in this district inside that scope?
 *
 * Scope is a BOUNDARY, not a display filter: an out of region business must be
 * unreachable, not merely unlisted. A business with no district is inside only a
 * country scope, because no narrower grant can be shown to cover it.
 */
export declare function scopeCoversDistrict(scope: readonly number[] | null, districtId: number | null): boolean;
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
export declare function oversightScopesOverlap(a: OversightScope, b: OversightScope): boolean;
/** The opposing gate role, the one a person may not also hold in the same place. */
export declare function opposingGateRole(role: OversightRole): OversightRole | null;
export declare const OVERSIGHT_SCOPE_CONFLICT_MESSAGE: string;
export declare const OVERSIGHT_ORG_ROLE_CONFLICT_MESSAGE: string;
export declare const OVERSIGHT_OWN_BUSINESS_MESSAGE: string;
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
export declare const ELEVATION_REFUSED_MESSAGE = "This needs a verified identity. Validate your National ID or scan your passport on the About you step, then try again.";
//# sourceMappingURL=authz.d.ts.map