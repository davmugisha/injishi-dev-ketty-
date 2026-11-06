import { z } from "zod";
import { StaffRole } from "./primitives";
/**
 * The admin staff authorization model (ADR-012, D-e).
 *
 * The org side already has one of these in `authz.ts`: 21 permissions resolved
 * from four org roles. Admin had nothing — `roleCanSee` filtered a sidebar and
 * that was the whole of it, so a section a lens could not see still rendered
 * when its URL was typed.
 *
 * This is the missing half. It lives here, beside the org model, for the same
 * reason that one does: the API and every client must resolve the SAME answer
 * from the SAME table. The server is the enforcement point; a client copy is an
 * affordance.
 *
 * A permission (a named power like `admin.fee.edit`) is not a role. A role is a
 * bundle of permissions, and a staff member may hold several roles at once —
 * `admin_users.staff_roles` is an array column. `staffPermissionsForRoles`
 * unions them, which is why it takes a list rather than one value.
 *
 * There is no staff permission table in the database. Permissions are code,
 * resolved from roles, exactly as the org side resolves its 21.
 */
// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------
/** What an admin action needs. A permission absent from the union is denied. */
export const StaffPermission = z.enum([
    // Observe — reading the platform without acting on it.
    "admin.overview.view",
    "admin.analytics.view",
    "admin.system.view",
    // Businesses — the registration pipeline and what happens to a business after.
    "admin.business.view",
    "admin.business.review",
    "admin.business.suspend",
    "admin.business.reinstate",
    // Switch a product on or off for a business or chosen branches, with a
    // reason (ADR-076 G6). `super_admin` and `ops`: it narrows or widens what a
    // business runs, which is running the platform, never money.
    "admin.business.entitlement.edit",
    // Users — identity, and the two powers that can hand out authority.
    "admin.user.view",
    "admin.user.role.grant",
    "admin.user.session.revoke",
    "admin.user.impersonate",
    /** Suspend an account so it cannot sign in, and lift the suspension (2026-11-02). */
    "admin.user.suspend",
    /** See the staff roles, who holds each, and the permissions matrix (2026-11-02). Read only. */
    "admin.role.view",
    /** Add a person to a business, change their role there, or remove them. */
    "admin.business.member.manage",
    // Brokers.
    "admin.broker.view",
    "admin.broker.approve",
    // Money.
    "admin.finance.view",
    "admin.fee.edit",
    "admin.payout.release",
    "admin.money.override",
    // Compliance and the audit trail.
    "admin.compliance.view",
    "admin.dsr.action",
    "admin.audit.read",
    // Platform — configuration, environments, and what reaches users. Each area
    // has a read of its own (ADR-053): five sections used to gate their READ on
    // the write, so only `super_admin` could look at them at all.
    "admin.config.view",
    "admin.config.edit",
    "admin.environment.view",
    "admin.environment.manage",
    "admin.announcement.view",
    "admin.announcement.publish",
    "admin.moderation.view",
    "admin.moderation.act",
    "admin.localization.view",
    "admin.localization.edit",
    // Training (ADR-049). The only permissions in this union that a role
    // outside the four platform roles holds, which is why they carry their own
    // prefix: `admin.*` is "a power over the platform", `training.*` is "a
    // power over a course, a session, a roster or a certificate".
    //
    // Split three ways on purpose. Reading and running a session belongs to
    // whoever teaches it; deciding that a course exists, that a venue is a
    // place training may happen, and that a session is open for registration
    // belongs to the company. A trainer who could publish their own session
    // could put the credential anywhere at any price.
    "training.view",
    "training.session.manage",
    "training.attendance.mark",
    "training.certificate.revoke",
    "training.course.manage",
    "training.venue.manage",
    "training.session.publish",
]);
export type StaffPermission = z.infer<typeof StaffPermission>;
const ALL_STAFF = StaffPermission.options;
const OBSERVE = [
    "admin.overview.view",
    "admin.analytics.view",
    "admin.system.view",
];
/**
 * Role to permissions, for a staff account.
 *
 * `super_admin` holds everything, and is the ONLY role that may act as the
 * second signer on a two person action (ADR-012, D-h).
 *
 * `ops` runs the registration pipeline and the day to day platform: businesses,
 * brokers, moderation, localization, and enough of users to end a session.
 * Never money, never configuration, never impersonation.
 *
 * `compliance` reads. It sees the platform, sees a business, and acts only
 * inside compliance itself (data subject requests, the audit log).
 *
 * `finance` sees money and edits the fee catalog and payouts. It does NOT hold
 * `admin.money.override`, which needs a second signer regardless of who holds
 * it, so handing it out by role would only make the refusal later and stranger.
 *
 * THE FIVE READS (ADR-053). Every role reads configuration, because it is the
 * one area all four need context from and the fee amounts live there. `ops`
 * reads all five areas it already acts in or runs beside; `compliance` reads
 * configuration, moderation and localization; `finance` reads configuration.
 * Nobody gained a write they did not hold. 25 permissions became 30: `ops` 13 to
 * 18, `compliance` 7 to 10, `finance` 6 to 7.
 */
const STAFF_ROLE_PERMISSIONS = {
    super_admin: new Set(ALL_STAFF),
    ops: new Set([
        ...OBSERVE,
        "admin.business.view",
        "admin.business.review",
        "admin.business.suspend",
        "admin.business.reinstate",
        "admin.business.entitlement.edit",
        "admin.user.view",
        "admin.user.session.revoke",
        // Ops can stop a compromised or abusive account from signing in; a
        // staff account is suspended only by a super admin (the API's rule).
        "admin.user.suspend",
        "admin.role.view",
        // Ops fixes who works where; ownership changes still need a written reason.
        "admin.business.member.manage",
        "admin.broker.view",
        "admin.broker.approve",
        "admin.config.view",
        "admin.environment.view",
        "admin.announcement.view",
        "admin.moderation.view",
        "admin.moderation.act",
        "admin.localization.view",
        "admin.localization.edit",
    ]),
    compliance: new Set([
        ...OBSERVE,
        "admin.business.view",
        "admin.role.view",
        "admin.compliance.view",
        "admin.dsr.action",
        "admin.audit.read",
        "admin.config.view",
        "admin.moderation.view",
        "admin.localization.view",
    ]),
    finance: new Set([
        ...OBSERVE,
        "admin.finance.view",
        "admin.fee.edit",
        "admin.payout.release",
        "admin.config.view",
    ]),
    /**
     * `trainer` (ADR-049) teaches, and that is the whole of it.
     *
     * It holds NO `admin.*` permission, not even the OBSERVE three every other
     * staff role carries. A trainer is a contractor who runs a room for a day,
     * not a member of platform operations, and the console reads every business
     * and every payout — so "staff" in their case means "may reach the Training
     * section", never "may reach the console".
     *
     * The four it holds are the four verbs a session actually needs: see it,
     * draft and edit it, tick the roster, and withdraw a certificate they
     * issued in error. Publishing a session, creating a course and setting a
     * venue are deliberately absent (ADR-049 AC-24): the company decides where
     * training happens and what it is worth, the trainer decides when.
     *
     * NOTE on ADR-049 AC-24, which says "the five training permissions a
     * trainer needs". It is four. The ADR's own security model enumerates these
     * four by name and then names the other three as platform-admin-only, and
     * four plus three is the seven it also states. Two independent enumerations
     * agree and only the count disagrees, so the count is the typo.
     */
    trainer: new Set([
        "training.view",
        "training.session.manage",
        "training.attendance.mark",
        "training.certificate.revoke",
    ]),
};
/**
 * Every permission a set of staff roles holds, as a stable sorted list.
 *
 * The union, not the intersection: holding `ops` and `finance` means holding
 * both sets. An empty list in means an empty list out, which is what a signed
 * in account with no `admin_users` row resolves to.
 */
export function staffPermissionsForRoles(roles: readonly StaffRole[]): StaffPermission[] {
    const held = new Set();
    for (const role of roles) {
        for (const p of STAFF_ROLE_PERMISSIONS[role] ?? [])
            held.add(p);
    }
    // Filtered off the canonical order so the list is stable whatever order the
    // roles arrived in. Two accounts with the same powers compare equal.
    return ALL_STAFF.filter((p) => held.has(p));
}
/** Does this resolved set hold this permission? The one predicate both sides call. */
export function staffAllows(permissions: readonly StaffPermission[], permission: StaffPermission): boolean {
    return permissions.includes(permission);
}
/** Plain wording for the denial message. Names the missing capability. */
export const STAFF_PERMISSION_LABEL: Readonly<Record<StaffPermission, string>> = {
    "admin.overview.view": "view the platform overview",
    "admin.analytics.view": "view analytics",
    "admin.system.view": "view system health",
    "admin.business.view": "view businesses",
    "admin.business.review": "review a business registration",
    "admin.business.suspend": "suspend a business",
    "admin.business.reinstate": "reinstate a business",
    "admin.business.entitlement.edit": "switch a business's products on or off",
    "admin.user.view": "view users",
    "admin.user.role.grant": "change what a user may do",
    "admin.user.session.revoke": "end a user's sessions",
    "admin.business.member.manage": "add, change or remove a person in a business",
    "admin.user.impersonate": "act on behalf of a user",
    "admin.user.suspend": "suspend or reactivate an account",
    "admin.role.view": "view staff roles and permissions",
    "admin.broker.view": "view brokers",
    "admin.broker.approve": "approve a broker",
    "admin.finance.view": "view money",
    "admin.fee.edit": "edit the fee catalog",
    "admin.payout.release": "release a payout",
    "admin.money.override": "override a money movement",
    "admin.compliance.view": "view compliance",
    "admin.dsr.action": "action a data subject request",
    "admin.audit.read": "read the audit log",
    "admin.config.view": "view configuration",
    "admin.config.edit": "change configuration",
    "admin.environment.view": "view environments and adapters",
    "admin.environment.manage": "manage environments and adapters",
    "admin.announcement.view": "view announcements",
    "admin.announcement.publish": "publish an announcement",
    "admin.moderation.view": "view moderation and support",
    "admin.moderation.act": "moderate content",
    "admin.localization.view": "view translations",
    "admin.localization.edit": "edit translations",
    "training.view": "view training",
    "training.session.manage": "draft and edit a training session",
    "training.attendance.mark": "mark who attended a training session",
    "training.certificate.revoke": "withdraw a training certificate",
    "training.course.manage": "create and publish a training course",
    "training.venue.manage": "set where training may happen",
    "training.session.publish": "publish a training session",
};
/**
 * The two powers that cannot be completed by one person (ADR-012, D-h).
 *
 * Each writes a request row and waits for a different `super_admin`. The
 * database `CHECK` on the request table is the control; this list is what lets
 * a route and a screen know the wait is coming before they start.
 *
 * Only `admin.money.override` has that request table. `admin.user.role.grant`
 * is single signer by owner decision (ADR-053, confirmed 2026-11-02): its
 * routes demand a step-up under ten minutes old instead
 * (`STAFF_GRANT_STEP_UP_SECONDS`), and no custom role can carry it.
 */
export const TWO_PERSON_STAFF_PERMISSIONS: readonly StaffPermission[] = [
    "admin.money.override",
    "admin.user.role.grant",
];
/** Does completing this power need a second `super_admin` to approve it? */
export function needsSecondSigner(permission: StaffPermission): boolean {
    return TWO_PERSON_STAFF_PERMISSIONS.includes(permission);
}
// ---------------------------------------------------------------------------
// Custom staff roles (2026-11-02)
// ---------------------------------------------------------------------------
/**
 * A custom role is a NAMED BUNDLE OF THE PERMISSIONS ABOVE, made by a super
 * admin from the console. It never adds a power: the list it chooses from is
 * `StaffPermission.options`, which is code, and every route still asks for one
 * of those by name through `@RequireStaffPermission`. A permission stored on a
 * custom role that the code no longer defines is dropped when access is
 * resolved (`staffPermissionsForGrants`), so a stale row can never be a power.
 *
 * The five built-in roles stay in code (`STAFF_ROLE_PERMISSIONS`) and are shown
 * read only: they cannot be edited, archived or deleted.
 */
/**
 * Permissions that may never be put in a custom role (owner decision,
 * 2026-11-02). They hand out authority, act as somebody else, move money
 * without the usual checks, or change how the whole platform runs, so they stay
 * with `super_admin` alone. The database refuses them too
 * (`staff_custom_role_permissions_not_reserved`).
 */
export const RESERVED_STAFF_PERMISSIONS: readonly StaffPermission[] = [
    "admin.user.role.grant",
    "admin.user.impersonate",
    "admin.money.override",
    "admin.config.edit",
    "admin.environment.manage",
];
/** May this permission go into a custom role? */
export function isReservedStaffPermission(permission: StaffPermission): boolean {
    return RESERVED_STAFF_PERMISSIONS.includes(permission);
}
/** The areas a role editor and the matrix group permissions under, in display order. */
export const StaffPermissionArea = z.enum([
    "observe",
    "businesses",
    "people",
    "brokers",
    "money",
    "compliance",
    "platform",
    "training",
]);
export type StaffPermissionArea = z.infer<typeof StaffPermissionArea>;
export const STAFF_PERMISSION_AREA_LABEL: Readonly<Record<StaffPermissionArea, string>> = {
    observe: "Overview",
    businesses: "Businesses",
    people: "People and roles",
    brokers: "Brokers",
    money: "Money",
    compliance: "Compliance and audit",
    platform: "Platform",
    training: "Training",
};
/** Which area each permission sits in. Typed by `StaffPermission`, so a new one must be placed. */
export const STAFF_PERMISSION_AREA: Readonly<Record<StaffPermission, StaffPermissionArea>> = {
    "admin.overview.view": "observe",
    "admin.analytics.view": "observe",
    "admin.system.view": "observe",
    "admin.business.view": "businesses",
    "admin.business.review": "businesses",
    "admin.business.suspend": "businesses",
    "admin.business.reinstate": "businesses",
    "admin.business.entitlement.edit": "businesses",
    "admin.business.member.manage": "businesses",
    "admin.user.view": "people",
    "admin.user.role.grant": "people",
    "admin.user.session.revoke": "people",
    "admin.user.impersonate": "people",
    "admin.user.suspend": "people",
    "admin.role.view": "people",
    "admin.broker.view": "brokers",
    "admin.broker.approve": "brokers",
    "admin.finance.view": "money",
    "admin.fee.edit": "money",
    "admin.payout.release": "money",
    "admin.money.override": "money",
    "admin.compliance.view": "compliance",
    "admin.dsr.action": "compliance",
    "admin.audit.read": "compliance",
    "admin.config.view": "platform",
    "admin.config.edit": "platform",
    "admin.environment.view": "platform",
    "admin.environment.manage": "platform",
    "admin.announcement.view": "platform",
    "admin.announcement.publish": "platform",
    "admin.moderation.view": "platform",
    "admin.moderation.act": "platform",
    "admin.localization.view": "platform",
    "admin.localization.edit": "platform",
    "training.view": "training",
    "training.session.manage": "training",
    "training.attendance.mark": "training",
    "training.certificate.revoke": "training",
    "training.course.manage": "training",
    "training.venue.manage": "training",
    "training.session.publish": "training",
};
/** One plain sentence per permission, for the role editor and the matrix. */
export const STAFF_PERMISSION_DESCRIPTION: Readonly<Record<StaffPermission, string>> = {
    "admin.overview.view": "Open the admin home with today's numbers.",
    "admin.analytics.view": "See bookings, revenue and growth charts.",
    "admin.system.view": "See whether the platform's services are healthy.",
    "admin.business.view": "Open any business and its registration.",
    "admin.business.review": "Check a registration and send it on or back.",
    "admin.business.suspend": "Stop a business from trading on Injishi.",
    "admin.business.reinstate": "Let a suspended business trade again.",
    "admin.business.entitlement.edit": "Switch a product on or off for a business, for all of it or some branches.",
    "admin.business.member.manage": "Add a person to a business, change their role there, or take them out.",
    "admin.user.view": "Search every account and open a person.",
    "admin.user.role.grant": "Create accounts, give staff roles and appoint officers.",
    "admin.user.session.revoke": "Sign a person out everywhere.",
    "admin.user.impersonate": "See Injishi as a particular person sees it.",
    "admin.user.suspend": "Stop an account from signing in, and let it back in.",
    "admin.role.view": "See the staff roles, who holds each one, and what each allows.",
    "admin.broker.view": "See brokers and their applications.",
    "admin.broker.approve": "Approve or turn down a broker.",
    "admin.finance.view": "See payments, payouts and the ledger.",
    "admin.fee.edit": "Change the fees Injishi charges.",
    "admin.payout.release": "Release money that is owed to a business.",
    "admin.money.override": "Correct a money movement by hand.",
    "admin.compliance.view": "See data requests and compliance records.",
    "admin.dsr.action": "Act on a person's request to see or delete their data.",
    "admin.audit.read": "Read who did what, and why.",
    "admin.config.view": "See platform settings and rules.",
    "admin.config.edit": "Change platform settings and rules.",
    "admin.environment.view": "See environments and connected services.",
    "admin.environment.manage": "Switch environments and connected services.",
    "admin.announcement.view": "See announcements to users.",
    "admin.announcement.publish": "Publish an announcement to users.",
    "admin.moderation.view": "See reported content and support cases.",
    "admin.moderation.act": "Hide content and close support cases.",
    "admin.localization.view": "See translations.",
    "admin.localization.edit": "Edit translations.",
    "training.view": "See training courses, sessions and rosters.",
    "training.session.manage": "Draft and edit a training session.",
    "training.attendance.mark": "Mark who attended a session.",
    "training.certificate.revoke": "Withdraw a certificate issued in error.",
    "training.course.manage": "Create and publish a course.",
    "training.venue.manage": "Set where training may happen.",
    "training.session.publish": "Open a session for registration.",
};
/** The permissions in an area, in canonical order. */
export function staffPermissionsInArea(area: StaffPermissionArea): StaffPermission[] {
    return ALL_STAFF.filter((p) => STAFF_PERMISSION_AREA[p] === area);
}
/** The permissions a built-in role holds, in canonical order. For the matrix. */
export function builtInRolePermissions(role: StaffRole): StaffPermission[] {
    return staffPermissionsForRoles([role]);
}
/**
 * Every permission a staffer holds from their built-in roles AND their custom
 * roles, as a stable sorted list.
 *
 * Custom role permissions arrive as stored strings. Anything the code does not
 * define, and anything reserved, is dropped here rather than trusted: the
 * database is a record of what was chosen, the code is what a power IS.
 */
export function staffPermissionsForGrants(roles: readonly StaffRole[], customPermissions: readonly string[]): StaffPermission[] {
    const held = new Set<StaffPermission>(staffPermissionsForRoles(roles));
    for (const raw of customPermissions) {
        const parsed = StaffPermission.safeParse(raw);
        if (parsed.success && !isReservedStaffPermission(parsed.data))
            held.add(parsed.data);
    }
    return ALL_STAFF.filter((p) => held.has(p));
}
/**
 * The permissions in `wanted` that `held` does not cover. Empty means the
 * actor may hand all of them out: nobody grants a power they do not hold.
 */
export function permissionsBeyond(held: readonly StaffPermission[], wanted: readonly StaffPermission[]): StaffPermission[] {
    return wanted.filter((p) => !held.includes(p));
}
/**
 * How recent the emailed step-up must be for a grant (owner decision,
 * 2026-11-02): ten minutes. The console already demands the code once per
 * session; a grant asks again when the last code is older than this, so the
 * person granting is shown to hold the mailbox at the moment of granting.
 * Role grants stay single signer (ADR-053); this is the control in its place.
 */
export const STAFF_GRANT_STEP_UP_SECONDS = 600;
/** The refusal code a grant route answers when the step-up is too old. */
export const STAFF_STEP_UP_STALE = "step_up_stale";
// ---------------------------------------------------------------------------
// The wire shape
// ---------------------------------------------------------------------------
/**
 * What `GET /api/v1/me/staff` answers: whether the caller is platform staff,
 * and what that gets them.
 *
 * The admin console had no way to ask this at all. It read `roleLens` — a
 * Zustand value defaulting to `super_admin` — which is a preview control, not
 * an identity, and it filtered a sidebar rather than guarding a route. So the
 * console opened for anybody who reached its origin, wearing the highest role
 * in the system.
 *
 * `isStaff` is carried explicitly rather than inferred from `roles.length`, for
 * the same reason `MeState` splits `resolved` from `anonymous`: a caller must
 * be able to tell "asked, and you are not staff" from "asked, and you hold no
 * role yet", without counting rows to guess which.
 *
 * `permissions` is resolved server side by `staffPermissionsForRoles` and sent,
 * rather than resolved in the browser from `roles`. A client that turns a role
 * into powers holds its own copy of the table and drifts from the server's —
 * the exact bug ADR-012 removed on the org side.
 */
/**
 * Whether the emailed step-up (F-S02) stands between THIS session and the admin
 * API.
 *
 * The same two fields as the `twoFactor` block `/me/workspaces` and
 * `/me/oversight` already carry, so every `/me/*` answer reads one structure.
 * The RULE behind `required` is this console's own, though, and it is
 * `staffRequiresStepUp` below — not the operator rule those two routes report.
 * A staffer who holds no workspace is not required by that rule and IS required
 * by this one, which is exactly why the console cannot borrow the other answer.
 *
 * `verified` is meaningful only when `required` is true. Nothing may route on
 * it otherwise.
 */
export const StaffTwoFactor = z.object({
    /** Does `StaffGuard` demand the code of this caller at all? */
    required: z.boolean(),
    /** Has THIS session presented a valid code? */
    verified: z.boolean(),
});
export type StaffTwoFactor = z.infer<typeof StaffTwoFactor>;
export const StaffAccess = z.object({
    /** True only for an account with a live, unrevoked `admin_users` row. */
    isStaff: z.boolean(),
    /** The roles held. Empty for everyone who is not staff. */
    roles: StaffRole.array(),
    /** The union of those roles' powers, already resolved. Empty for non-staff. */
    permissions: StaffPermission.array(),
    /**
     * The custom roles held (2026-11-02), by id and name. Optional so an older
     * API stays parseable; their powers are already in `permissions`.
     */
    customRoles: z.array(z.object({ id: z.string().uuid(), name: z.string() })).optional(),
    /**
     * The step-up, as `GET /api/v1/me/staff` reports it, so the console can send
     * a staffer to the code screen BEFORE it renders rather than after a page's
     * read is refused halfway through painting.
     *
     * OPTIONAL, and on purpose. The resolver of "who is staff"
     * (`WorkspaceService.staffAccessForUser`) builds this object from
     * `admin_users` alone and has no session to ask about; making the field
     * required would force the one reader of staff grants to become a reader of
     * sessions too. So `/me/staff` adds it and `StaffGuard` never needs it. It
     * also keeps an older API — one that neither reports nor enforces the
     * step-up — parseable. Absent means "not reported", and `staffStepUpOwed`
     * reads that as nothing owed: an API that does not report the rule is not
     * enforcing it, and if it were, the page read would still come back as
     * `step_up`, because the API stays the boundary.
     */
    twoFactor: StaffTwoFactor.optional(),
});
export type StaffAccess = z.infer<typeof StaffAccess>;
/**
 * The answer for an account that is not staff. One definition, so it cannot drift.
 *
 * It carries NO `twoFactor` block, deliberately. This constant is also what the
 * console holds when it could not ask at all, and any value for `verified` here
 * would be a claim about a session nobody looked at. Absent is the truthful
 * "not reported".
 */
export const NO_STAFF_ACCESS: StaffAccess = {
    isStaff: false,
    roles: [],
    permissions: [],
};
/**
 * `StaffGuard`'s step-up rule: being platform staff is itself the requirement.
 *
 * Operators and officers owe the code because of what they hold
 * (`TwoFactorService.requiredFor` counts workspaces and oversight assignments).
 * Staff owe it because of what they ARE — the console reads every business,
 * every user and every payout — and a staffer who holds nothing else is not
 * counted by that operator rule at all. Named here, once, because two places
 * must agree on it: the guard that refuses, and `/me/staff`, which predicts the
 * refusal for the console. Two copies are how the console gets told "come in"
 * by one and "enter your code" by the other.
 *
 * There is no enrolment to check first. The emailed code needs nothing set up,
 * so `admin_users.two_factor_enrolled` — a leftover of the TOTP scheme it
 * replaced — plays no part.
 */
export function staffRequiresStepUp(access: Pick<StaffAccess, "isStaff">): boolean {
    return access.isStaff;
}
/**
 * Does this answer mean "staff, but enter your code first"?
 *
 * The console's reading of `/me/staff`. Non-staff never owe it — a person who
 * is not staff is told the console is not theirs, not asked for a code that
 * would open nothing.
 */
export function staffStepUpOwed(access: StaffAccess): boolean {
    return (access.isStaff &&
        access.twoFactor?.required === true &&
        !access.twoFactor.verified);
}