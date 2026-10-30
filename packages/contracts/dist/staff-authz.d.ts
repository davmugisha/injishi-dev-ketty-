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
/** What an admin action needs. A permission absent from the union is denied. */
export declare const StaffPermission: z.ZodEnum<["admin.overview.view", "admin.analytics.view", "admin.system.view", "admin.business.view", "admin.business.review", "admin.business.suspend", "admin.business.reinstate", "admin.user.view", "admin.user.role.grant", "admin.user.session.revoke", "admin.user.impersonate", "admin.business.member.manage", "admin.broker.view", "admin.broker.approve", "admin.finance.view", "admin.fee.edit", "admin.payout.release", "admin.money.override", "admin.compliance.view", "admin.dsr.action", "admin.audit.read", "admin.config.view", "admin.config.edit", "admin.environment.view", "admin.environment.manage", "admin.announcement.view", "admin.announcement.publish", "admin.moderation.view", "admin.moderation.act", "admin.localization.view", "admin.localization.edit", "training.view", "training.session.manage", "training.attendance.mark", "training.certificate.revoke", "training.course.manage", "training.venue.manage", "training.session.publish"]>;
export type StaffPermission = z.infer<typeof StaffPermission>;
/**
 * Every permission a set of staff roles holds, as a stable sorted list.
 *
 * The union, not the intersection: holding `ops` and `finance` means holding
 * both sets. An empty list in means an empty list out, which is what a signed
 * in account with no `admin_users` row resolves to.
 */
export declare function staffPermissionsForRoles(roles: readonly StaffRole[]): StaffPermission[];
/** Does this resolved set hold this permission? The one predicate both sides call. */
export declare function staffAllows(permissions: readonly StaffPermission[], permission: StaffPermission): boolean;
/** Plain wording for the denial message. Names the missing capability. */
export declare const STAFF_PERMISSION_LABEL: Readonly<Record<StaffPermission, string>>;
/**
 * The two powers that cannot be completed by one person (ADR-012, D-h).
 *
 * Each writes a request row and waits for a different `super_admin`. The
 * database `CHECK` on the request table is the control; this list is what lets
 * a route and a screen know the wait is coming before they start.
 */
export declare const TWO_PERSON_STAFF_PERMISSIONS: readonly StaffPermission[];
/** Does completing this power need a second `super_admin` to approve it? */
export declare function needsSecondSigner(permission: StaffPermission): boolean;
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
export declare const StaffTwoFactor: z.ZodObject<{
    /** Does `StaffGuard` demand the code of this caller at all? */
    required: z.ZodBoolean;
    /** Has THIS session presented a valid code? */
    verified: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    verified: boolean;
    required: boolean;
}, {
    verified: boolean;
    required: boolean;
}>;
export type StaffTwoFactor = z.infer<typeof StaffTwoFactor>;
export declare const StaffAccess: z.ZodObject<{
    /** True only for an account with a live, unrevoked `admin_users` row. */
    isStaff: z.ZodBoolean;
    /** The roles held. Empty for everyone who is not staff. */
    roles: z.ZodArray<z.ZodEnum<["super_admin", "ops", "compliance", "finance", "trainer"]>, "many">;
    /** The union of those roles' powers, already resolved. Empty for non-staff. */
    permissions: z.ZodArray<z.ZodEnum<["admin.overview.view", "admin.analytics.view", "admin.system.view", "admin.business.view", "admin.business.review", "admin.business.suspend", "admin.business.reinstate", "admin.user.view", "admin.user.role.grant", "admin.user.session.revoke", "admin.user.impersonate", "admin.business.member.manage", "admin.broker.view", "admin.broker.approve", "admin.finance.view", "admin.fee.edit", "admin.payout.release", "admin.money.override", "admin.compliance.view", "admin.dsr.action", "admin.audit.read", "admin.config.view", "admin.config.edit", "admin.environment.view", "admin.environment.manage", "admin.announcement.view", "admin.announcement.publish", "admin.moderation.view", "admin.moderation.act", "admin.localization.view", "admin.localization.edit", "training.view", "training.session.manage", "training.attendance.mark", "training.certificate.revoke", "training.course.manage", "training.venue.manage", "training.session.publish"]>, "many">;
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
    twoFactor: z.ZodOptional<z.ZodObject<{
        /** Does `StaffGuard` demand the code of this caller at all? */
        required: z.ZodBoolean;
        /** Has THIS session presented a valid code? */
        verified: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        verified: boolean;
        required: boolean;
    }, {
        verified: boolean;
        required: boolean;
    }>>;
}, "strip", z.ZodTypeAny, {
    roles: ("finance" | "super_admin" | "ops" | "compliance" | "trainer")[];
    permissions: ("admin.overview.view" | "admin.analytics.view" | "admin.system.view" | "admin.business.view" | "admin.business.review" | "admin.business.suspend" | "admin.business.reinstate" | "admin.user.view" | "admin.user.role.grant" | "admin.user.session.revoke" | "admin.user.impersonate" | "admin.business.member.manage" | "admin.broker.view" | "admin.broker.approve" | "admin.finance.view" | "admin.fee.edit" | "admin.payout.release" | "admin.money.override" | "admin.compliance.view" | "admin.dsr.action" | "admin.audit.read" | "admin.config.view" | "admin.config.edit" | "admin.environment.view" | "admin.environment.manage" | "admin.announcement.view" | "admin.announcement.publish" | "admin.moderation.view" | "admin.moderation.act" | "admin.localization.view" | "admin.localization.edit" | "training.view" | "training.session.manage" | "training.attendance.mark" | "training.certificate.revoke" | "training.course.manage" | "training.venue.manage" | "training.session.publish")[];
    isStaff: boolean;
    twoFactor?: {
        verified: boolean;
        required: boolean;
    } | undefined;
}, {
    roles: ("finance" | "super_admin" | "ops" | "compliance" | "trainer")[];
    permissions: ("admin.overview.view" | "admin.analytics.view" | "admin.system.view" | "admin.business.view" | "admin.business.review" | "admin.business.suspend" | "admin.business.reinstate" | "admin.user.view" | "admin.user.role.grant" | "admin.user.session.revoke" | "admin.user.impersonate" | "admin.business.member.manage" | "admin.broker.view" | "admin.broker.approve" | "admin.finance.view" | "admin.fee.edit" | "admin.payout.release" | "admin.money.override" | "admin.compliance.view" | "admin.dsr.action" | "admin.audit.read" | "admin.config.view" | "admin.config.edit" | "admin.environment.view" | "admin.environment.manage" | "admin.announcement.view" | "admin.announcement.publish" | "admin.moderation.view" | "admin.moderation.act" | "admin.localization.view" | "admin.localization.edit" | "training.view" | "training.session.manage" | "training.attendance.mark" | "training.certificate.revoke" | "training.course.manage" | "training.venue.manage" | "training.session.publish")[];
    isStaff: boolean;
    twoFactor?: {
        verified: boolean;
        required: boolean;
    } | undefined;
}>;
export type StaffAccess = z.infer<typeof StaffAccess>;
/**
 * The answer for an account that is not staff. One definition, so it cannot drift.
 *
 * It carries NO `twoFactor` block, deliberately. This constant is also what the
 * console holds when it could not ask at all, and any value for `verified` here
 * would be a claim about a session nobody looked at. Absent is the truthful
 * "not reported".
 */
export declare const NO_STAFF_ACCESS: StaffAccess;
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
export declare function staffRequiresStepUp(access: Pick<StaffAccess, "isStaff">): boolean;
/**
 * Does this answer mean "staff, but enter your code first"?
 *
 * The console's reading of `/me/staff`. Non-staff never owe it — a person who
 * is not staff is told the console is not theirs, not asked for a code that
 * would open nothing.
 */
export declare function staffStepUpOwed(access: StaffAccess): boolean;
//# sourceMappingURL=staff-authz.d.ts.map