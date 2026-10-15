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
    // `property.switch` was here. Seeing a branch is coverage, not a capability:
    // the switcher reads `branches` from the grant (ADR-054 AC-S4).
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
     * The twenty third permission: owner, manager and finance. This is the
     * taxpayer's own fiscal identity: whoever holds it decides which RRA account
     * every sale of this business is declared under, and can disconnect the
     * account and stop the declarations. A receptionist taking a booking must
     * never be able to re-point where that booking is taxed. The accountant
     * keeps it (ADR-069 D-b): the account and its item mapping, on Settings →
     * Integrations.
     */
    "ebm.manage",
    /**
     * Close a bill, which SIGNS ITS SALE with RRA (ADR-050 D-t, AC-8).
     *
     * Owner, manager, receptionist and finance (ADR-069 D-b). Signing a correct
     * sale at the desk is the desk's job, and a hotel cannot wake a manager per
     * departure; closing a bill left open is the accountant's. Check out
     * requires it alongside `stay.checkout`, because check out is what signs:
     * gating only the close route would leave the fiscal act reachable through
     * a permission the receptionist already held.
     */
    "folio.close",
    /**
     * Withdraw a signed sale with an `NR` refund receipt (ADR-050 D-t, AC-8).
     *
     * Owner, manager and finance (ADR-069 D-b), never the desk. Creating a
     * declaration is routine; withdrawing one reduces declared turnover, and §14
     * wants a named person's justification.
     */
    "ebm.refund",
    /**
     * Decide an outlet's operator, owner, relationship and tax entity
     * (ADR-050 D-t). Owner and manager only, because those decide who is taxed
     * for what.
     */
    "outlet.manage",
    /**
     * Answer a guest's request for money back on a stay that has already begun
     * (§6.8).
     *
     * OWNER, MANAGER AND FINANCE (ADR-069 D-b), never the desk. A booking
     * cancellation is arithmetic — `cancellationRefund` reads a locked tier and a
     * clock, and nobody exercises judgement — but this is the opposite: the
     * entitlement the rules compute is a SUGGESTION, and the person deciding may
     * approve more than it (goodwill) or refuse what it owed by citing a rule the
     * engine cannot see. That is a discretionary spend of the business's money in
     * front of an unhappy guest, which is exactly the decision a receptionist
     * must be able to escalate rather than be pressed into making at the
     * counter.
     */
    "refund.decide",
    /**
     * Create and retire the property's offers, which is setting prices
     * downwards (§6.8).
     *
     * OWNER AND MANAGER, for the reason `menu.manage` is: a discount is a price,
     * and whoever can write "50% off, no end date, unlimited redemptions" can
     * give the property's revenue away without anyone approving a single
     * transaction. Redeeming one is the guest's own action and carries no
     * permission at all.
     */
    "offer.manage",
    /**
     * The HR module (ADR-058, cross child contract 4). Seven permissions in the
     * `people` area, and ADR-069 D-e's `payroll.draft` makes eight, each
     * moveable per role under ADR-055.
     *
     * `people.view` reads the HR file WITHOUT the sensitive fields (date of
     * birth, ID number, RSSB number, wages). Only `people.manage` and
     * `payroll.run` see those, and the API answers with a different schema for
     * each, so a missed check cannot leak a field. `payroll.draft` sees the
     * wages a pay run computes and none of the file's other sensitive fields.
     */
    "people.view",
    /**
     * Create and edit HR files and contracts, see the sensitive fields, and
     * offboard. The owner's and `hr`'s by default (ADR-069 D-b), and in
     * `OWNER_BY_DEFAULT` below so a manager does not inherit it; grantable: an
     * owner may hand it to a manager. Offboarding a person who holds an account
     * still needs `team.manage` as well, which cannot be granted.
     */
    "people.manage",
    /** Shift templates and the roster. */
    "roster.manage",
    /**
     * Clock a person in and out. Held by the front desk, which is who is at the
     * door when the night shift arrives. Reads return roster cards only, so
     * this exposes no field of the HR file.
     */
    "attendance.record",
    /** Correct an attendance record, and validate a self clock in. */
    "attendance.approve",
    /** Decide leave, and file leave on someone's behalf. */
    "leave.approve",
    /**
     * Build and revise a DRAFT pay run, and see the wages that takes (ADR-069
     * D-e): list the runs, create a month's draft, read a run with its payslips,
     * recompute it, hold one person out of it, and read the payroll dashboard
     * and the national rules a draft is computed by. Never the confirm.
     *
     * The owner's and `hr`'s by default, so whoever prepares the month is not
     * whoever signs it. In `OWNER_BY_DEFAULT` below, and that is required rather
     * than stylistic: `manager` is every permission minus `OWNER_ONLY` minus
     * `OWNER_BY_DEFAULT`, so leaving it out would hand it to every manager.
     *
     * A draft route admits this OR `payroll.run`, so a role a business granted
     * `payroll.run` before the split still prepares the month it confirms and
     * no override row needs migrating. Alone it never reaches an ID number, a
     * date of birth, an RSSB number or a pay account.
     */
    "payroll.draft",
    /**
     * CONFIRM the pay run (ADR-069 D-e), and everything a confirmed run
     * produces: payslips, bank and mobile money files, the RSSB and PAYE
     * declarations, loans, claims and adjustments, how pay is computed, and the
     * sensitive fields they need. A draft route admits it too, so it still does
     * everything it did before `payroll.draft` existed.
     *
     * OWNER BY DEFAULT, like `people.manage`: what the business pays each person
     * is the owner's to disclose, and to sign. No other default role holds it.
     */
    "payroll.run",
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
 * What only an owner holds BY DEFAULT, and an owner may still grant (ADR-058,
 * cross child contract 4).
 *
 * Different from `OWNER_ONLY` in kind, not degree. `team.manage` is the lock on
 * the door and can never be granted; these are disclosures (a person's ID
 * number, what each colleague earns) that a hotel may well want its general
 * manager to hold, so they start with the owner and move with an ADR-055
 * override like any other permission.
 *
 * `payroll.draft` (ADR-069 D-e) is here because `manager` is derived by
 * subtraction: a permission left off this list is a permission every manager
 * holds. `hr` holds `people.manage` and `payroll.draft` by its own set, not by
 * inheriting from here, and `payroll.run` stays the owner's alone.
 */
const OWNER_BY_DEFAULT: readonly Permission[] = ["people.manage", "payroll.draft", "payroll.run"];
/**
 * Role to permissions, inside a business workspace.
 *
 * owner runs and OWNS the property: everything, the roster included.
 * manager runs the property: everything operational, money and the fiscal
 * account included — but does not decide who works here (`OWNER_ONLY`), and by
 * default neither reads HR files in full nor drafts or confirms payroll
 * (`OWNER_BY_DEFAULT`).
 * receptionist works the front desk and takes service orders: no money, no
 * team, no housekeeping board, no menu editing. Clocks staff in and out.
 * finance is the accountant (ADR-069 D-b): reads the money, posts and voids
 * charges, records payments, closes bills, keeps the EBM account, withdraws a
 * signed sale and answers refund requests. No rooms, no reservations to
 * write, no rates, no staff files, no guest inbox.
 * hr is the HR officer (ADR-069 D-b): reads and keeps the staff files, the
 * roster, attendance and leave, and DRAFTS the pay run; the owner confirms it.
 * No money, no folios, no reservations, no guest inbox.
 * housekeeper is the phone: room status and maintenance tickets only.
 *
 * Neither `finance` nor `hr` holds `team.manage`, and no override can give it
 * to them (`LOCKED_PERMISSIONS`). Typed by `OrgRole`, so a role added to the
 * enum without a set here does not compile.
 */
const ROLE_PERMISSIONS: Readonly<Record<OrgRole, ReadonlySet<Permission>>> = {
    owner: new Set(ALL),
    manager: new Set(
        ALL.filter((p) => !OWNER_ONLY.includes(p) && !OWNER_BY_DEFAULT.includes(p)),
    ),
    receptionist: new Set<Permission>([
        "reservation.approve",
        "reservation.assign",
        "stay.checkin",
        "stay.checkout",
        "folio.charge",
        "folio.payment",
        "folio.close",
        "order.advance",
        "message.send",
        "attendance.record",
    ]),
    finance: new Set<Permission>([
        "money.view",
        "folio.charge",
        "folio.payment",
        "folio.close",
        "ebm.manage",
        "ebm.refund",
        "refund.decide",
    ]),
    hr: new Set<Permission>([
        "people.view",
        "people.manage",
        "roster.manage",
        "attendance.record",
        "attendance.approve",
        "leave.approve",
        "payroll.draft",
    ]),
    housekeeper: new Set<Permission>(["housekeeping.set", "ticket.advance"]),
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
    "refund.decide": "answer a guest's refund request",
    "offer.manage": "create and retire offers",
    "people.view": "view staff files",
    "people.manage": "manage staff files and contracts",
    "roster.manage": "manage the roster",
    "attendance.record": "clock staff in and out",
    "attendance.approve": "correct and approve attendance",
    "leave.approve": "decide leave",
    "payroll.draft": "draft the pay run",
    "payroll.run": "confirm the pay run",
};
// ---------------------------------------------------------------------------
// A business's own role customisation
// ---------------------------------------------------------------------------
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
export const CustomisableOrgRole = OrgRole.exclude(["owner"]);
export type CustomisableOrgRole = z.infer<typeof CustomisableOrgRole>;
/** Is this a role a business may customise? Narrows, so callers stay honest. */
export function isCustomisableOrgRole(role: OrgRole): role is CustomisableOrgRole {
    return role !== "owner";
}
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
export const RolePermissionOverride = z.object({
    orgRole: CustomisableOrgRole,
    permission: Permission,
    /** True grants a permission the default set withholds; false withdraws one it gives. */
    granted: z.boolean(),
});
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
export const LOCKED_PERMISSIONS: readonly Permission[] = OWNER_ONLY;
/** May an override move this permission at all? */
export function isLockedPermission(permission: Permission): boolean {
    return LOCKED_PERMISSIONS.includes(permission);
}
/** Why a locked permission is locked, in words a screen can print. */
export const LOCKED_PERMISSION_REASON: Readonly<Record<string, string>> = {
    "team.manage": "Only an owner manages the team. Granting it here would let that role change roles — including yours.",
};
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
export function effectivePermissionsForRole(role: OrgRole, overrides: readonly RolePermissionOverride[] = []): Permission[] {
    const held = new Set<Permission>(permissionsForRole(role));
    if (isCustomisableOrgRole(role)) {
        for (const override of overrides) {
            if (override.orgRole !== role)
                continue;
            if (isLockedPermission(override.permission))
                continue;
            if (override.granted)
                held.add(override.permission);
            else
                held.delete(override.permission);
        }
    }
    return ALL.filter((p) => held.has(p));
}
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
export function parseRolePermissionOverride(row: {
    orgRole: string;
    permission: string;
    granted: boolean;
}): RolePermissionOverride | null {
    const parsed = RolePermissionOverride.safeParse(row);
    return parsed.success ? parsed.data : null;
}
/**
 * How a screen groups the permissions, so a person reads a job rather than a
 * list of twenty five dotted names.
 *
 * In the contract beside the permissions themselves because it is the same
 * class of fact as `PERMISSION_LABEL`: wording that must not fork between the
 * operator app and anything else that ever renders this. It grants nothing.
 */
export const PERMISSION_AREA = z.enum([
    "front_desk",
    "rooms",
    "services",
    "money",
    "property",
    "people",
]);
export type PermissionArea = z.infer<typeof PERMISSION_AREA>;
/** What each area is called. */
export const PERMISSION_AREA_LABEL: Readonly<Record<PermissionArea, string>> = {
    front_desk: "Front desk",
    rooms: "Rooms & housekeeping",
    services: "Services & outlets",
    money: "Money & tax",
    property: "Property & listings",
    people: "People",
};
/** Which area each permission belongs to. Every permission has exactly one. */
export const PERMISSION_AREA_OF: Readonly<Record<Permission, PermissionArea>> = {
    "reservation.approve": "front_desk",
    "reservation.assign": "front_desk",
    "stay.checkin": "front_desk",
    "stay.checkout": "front_desk",
    "message.send": "front_desk",
    "housekeeping.set": "rooms",
    "ticket.advance": "rooms",
    "task.assign": "rooms",
    "order.advance": "services",
    "menu.manage": "services",
    "outlet.manage": "services",
    "folio.charge": "money",
    "folio.payment": "money",
    "folio.close": "money",
    "money.view": "money",
    "ebm.manage": "money",
    "ebm.refund": "money",
    "refund.decide": "money",
    "rent.record": "money",
    "lease.advance": "property",
    "deposit.return": "property",
    "unit.manage": "property",
    "listing.manage": "property",
    "amenity.manage": "property",
    "offer.manage": "property",
    "department.manage": "people",
    "team.manage": "people",
    "people.view": "people",
    "people.manage": "people",
    "roster.manage": "people",
    "attendance.record": "people",
    "attendance.approve": "people",
    "leave.approve": "people",
    "payroll.draft": "people",
    "payroll.run": "people",
};
// ---------------------------------------------------------------------------
// What each role may do, at THIS business
// ---------------------------------------------------------------------------
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
export const OperatorRolePermissions = z.object({
    orgRole: OrgRole,
    /** `ORG_ROLE_LABEL[orgRole]` (in `ops.ts`), resolved server side so one table words it. */
    label: z.string(),
    customisable: z.boolean(),
    /** The platform default for this role. */
    basePermissions: z.array(Permission),
    /** What the role actually holds here: the default, plus grants, minus withdrawals. */
    permissions: z.array(Permission),
    /** Permissions this business may not move in either direction. */
    lockedPermissions: z.array(Permission),
    /** Active memberships holding this role. */
    memberCount: z.number().int().nonnegative(),
});
export type OperatorRolePermissions = z.infer<typeof OperatorRolePermissions>;
/**
 * One area of the permission matrix as a screen draws it: the area's words and
 * each permission's words, from `PERMISSION_AREA_LABEL` and `PERMISSION_LABEL`.
 * Served with the roles so a client never keeps its own copy of the
 * vocabulary, which is how a matrix comes to list a permission that does not
 * exist. It grants nothing.
 */
export const OperatorPermissionArea = z.object({
    area: PERMISSION_AREA,
    label: z.string(),
    permissions: z.array(z.object({ permission: Permission, label: z.string() })),
});
export type OperatorPermissionArea = z.infer<typeof OperatorPermissionArea>;
export const OperatorRoleList = z.object({
    roles: z.array(OperatorRolePermissions),
    /** Every area and permission, in the platform's order. */
    areas: z.array(OperatorPermissionArea),
});
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
export const SetRolePermissionsRequest = z.object({
    permissions: z.array(Permission).max(64),
});
export type SetRolePermissionsRequest = z.infer<typeof SetRolePermissionsRequest>;
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
/** Whether a member covers every branch of their business or only some (ADR-054). */
export const BranchCoverage = z.enum(["all", "limited"]);
export type BranchCoverage = z.infer<typeof BranchCoverage>;
/** One branch a member covers, as the grant carries it (ADR-054 AC-S3). */
export const WorkspaceBranch = z.object({
    id: Uuid,
    name: z.string(),
    districtName: z.string().nullable(),
    isHeadOffice: z.boolean(),
});
export type WorkspaceBranch = z.infer<typeof WorkspaceBranch>;
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
     * The head office's name when this member covers it, else the first covered
     * branch by name (ADR-054 AC-S3). Made ONCE, here, rather than differently
     * in each screen that needs it.
     *
     * Null for `broker` and `personal`, which have no property, and for a
     * business that has not created one yet.
     */
    propertyName: z.string().nullable(),
    /**
     * The active branches this member covers, head office first then by name
     * (ADR-054 AC-S3). Every branch when `branchCoverage` is `all`. Empty for
     * `broker` and `personal`, and for a business with no property yet.
     *
     * Seeing a branch is COVERAGE, not a permission: the switcher reads this,
     * and the API narrows rows by the same list.
     */
    branches: z.array(WorkspaceBranch),
    /** `limited` when the member is limited to some branches. Null outside `business`. */
    branchCoverage: BranchCoverage.nullable(),
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
    psfMembership: z.object({ canManage: z.boolean() }).nullable().default(null),
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
 *
 * `roleOverrides` is what THIS business decided its roles mean. It is optional
 * and defaults to none, so every existing caller keeps the platform defaults and
 * a business that has never opened the Roles screen is unaffected. It is applied
 * INSIDE the registration gate rather than beside it: an org that is not
 * `active` holds nothing, and a business cannot grant its way past its own
 * approval.
 */
export function permissionsForWorkspace(input: {
    kind: WorkspaceKind;
    orgRole: OrgRole | null;
    registrationStatus: OrgRegistrationStatus | null;
    roleOverrides?: readonly RolePermissionOverride[];
}): Permission[] {
    if (input.kind !== "business" || input.orgRole === null)
        return [];
    if (!isOperational(input.registrationStatus))
        return [];
    return effectivePermissionsForRole(input.orgRole, input.roleOverrides ?? []);
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
    console: z.enum(["verification", "approval", "tax", "membership"]),
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
export function oversightConsoleFor(role: OversightRole): "verification" | "approval" | "tax" | "membership" {
    switch (role) {
        case "business_field_verifier":
            return "verification";
        case "business_approver":
            return "approval";
        case "tax_compliance_officer":
            return "tax";
        case "psf_membership_officer":
            return "membership";
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
        // Membership is not a registration gate either (ADR-056), so a PSF
        // field verifier may also hold it: they decide different things.
        case "psf_membership_officer":
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
export const ELEVATION_REFUSED_MESSAGE = "This needs a verified identity. Validate your National ID or scan your passport on the About you step, then try again.";