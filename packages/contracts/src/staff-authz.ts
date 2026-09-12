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
    // Users — identity, and the two powers that can hand out authority.
    "admin.user.view",
    "admin.user.role.grant",
    "admin.user.session.revoke",
    "admin.user.impersonate",
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
    // Platform — configuration, environments, and what reaches users.
    "admin.config.edit",
    "admin.environment.manage",
    "admin.announcement.publish",
    "admin.moderation.act",
    "admin.localization.edit",
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
 */
const STAFF_ROLE_PERMISSIONS = {
    super_admin: new Set(ALL_STAFF),
    ops: new Set([
        ...OBSERVE,
        "admin.business.view",
        "admin.business.review",
        "admin.business.suspend",
        "admin.business.reinstate",
        "admin.user.view",
        "admin.user.session.revoke",
        "admin.broker.view",
        "admin.broker.approve",
        "admin.moderation.act",
        "admin.localization.edit",
    ]),
    compliance: new Set([
        ...OBSERVE,
        "admin.business.view",
        "admin.compliance.view",
        "admin.dsr.action",
        "admin.audit.read",
    ]),
    finance: new Set([
        ...OBSERVE,
        "admin.finance.view",
        "admin.fee.edit",
        "admin.payout.release",
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
    "admin.user.view": "view users",
    "admin.user.role.grant": "change what a user may do",
    "admin.user.session.revoke": "end a user's sessions",
    "admin.user.impersonate": "act on behalf of a user",
    "admin.broker.view": "view brokers",
    "admin.broker.approve": "approve a broker",
    "admin.finance.view": "view money",
    "admin.fee.edit": "edit the fee catalog",
    "admin.payout.release": "release a payout",
    "admin.money.override": "override a money movement",
    "admin.compliance.view": "view compliance",
    "admin.dsr.action": "action a data subject request",
    "admin.audit.read": "read the audit log",
    "admin.config.edit": "change configuration",
    "admin.environment.manage": "manage environments and adapters",
    "admin.announcement.publish": "publish an announcement",
    "admin.moderation.act": "moderate content",
    "admin.localization.edit": "edit translations",
};
/**
 * The two powers that cannot be completed by one person (ADR-012, D-h).
 *
 * Each writes a request row and waits for a different `super_admin`. The
 * database `CHECK` on the request table is the control; this list is what lets
 * a route and a screen know the wait is coming before they start.
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