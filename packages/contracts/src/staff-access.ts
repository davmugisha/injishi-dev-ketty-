import { z } from "zod";
import { PERMISSION_AREA, Permission } from "./authz";
import { InvitableOrgRole, MemberBranchIds } from "./ops";
import { OrgRole, Uuid } from "./primitives";
/**
 * Giving a staff file its Injishi login while putting the person on file (HR onboarding).
 *
 * The file and the login stay two things: a file is HR's record of somebody employed, a login is
 * an account that may act in the business. HR, holding `team.invite`, names the address, the role
 * and the branches. A front-line role's invitation goes out at once; a role that reaches money,
 * staff files, payroll or prices (`accessNeedsOwner`) is a request the owner approves on Team and
 * roles, and only then is the invitation sent. The owner, holding `team.manage`, gives any role
 * at once.
 */
// ---------------------------------------------------------------------------
// HR's side: one file's login
// ---------------------------------------------------------------------------
/** `POST /api/v1/ops/employees/:id/access`. */
export const GrantEmployeeAccessRequest = z.object({
    email: z
        .string()
        .trim()
        .toLowerCase()
        .email("Use an email address like name@example.com.")
        .max(200),
    orgRole: InvitableOrgRole,
    /** The branches the person will cover; null is every branch (ADR-054). */
    branchIds: MemberBranchIds.default(null),
    /** For a request the owner decides: shown to them beside it. */
    note: z.string().trim().max(300).nullable().optional(),
});
export type GrantEmployeeAccessRequest = z.infer<typeof GrantEmployeeAccessRequest>;
export const StaffAccessRequestStatus = z.enum(["pending", "approved", "declined", "cancelled"]);
export type StaffAccessRequestStatus = z.infer<typeof StaffAccessRequestStatus>;
/** A login asked for one file, as HR and the owner read it. */
export const StaffAccessRequest = z.object({
    id: Uuid,
    employeeId: Uuid,
    employeeName: z.string(),
    employeeNumber: z.string(),
    jobTitle: z.string().nullable(),
    email: z.string(),
    orgRole: OrgRole,
    /** Null is every branch. */
    branchIds: z.array(Uuid).nullable(),
    status: StaffAccessRequestStatus,
    /** What HR wrote for the owner. */
    note: z.string().nullable(),
    requestedAt: z.string(),
    requestedByName: z.string().nullable(),
    decidedAt: z.string().nullable(),
    decidedByName: z.string().nullable(),
    /** Why the owner declined. */
    decisionNote: z.string().nullable(),
});
export type StaffAccessRequest = z.infer<typeof StaffAccessRequest>;
/** One role as the access form offers it: its permissions HERE, and whether the owner approves it. */
export const AccessRoleOption = z.object({
    orgRole: InvitableOrgRole,
    label: z.string(),
    /** What the role is for, in one line. */
    summary: z.string(),
    /** The role's permissions at this business, by area, in the screen's words. */
    areas: z.array(z.object({
        area: PERMISSION_AREA,
        label: z.string(),
        permissions: z.array(z.object({ permission: Permission, label: z.string() })),
    })),
    /** A login into this role waits for the owner when the caller does not manage the team. */
    needsOwner: z.boolean(),
});
export type AccessRoleOption = z.infer<typeof AccessRoleOption>;
/**
 * `GET /api/v1/ops/employees/access-options`: what a login may be, before there is a file to give
 * it to (the new employee form). The same roles, branches and rights the file's read carries.
 */
export const EmployeeAccessOptions = z.object({
    roles: z.array(AccessRoleOption),
    /** The branches the caller covers, which are the ones a login they give may name. */
    branches: z.array(z.object({ id: Uuid, name: z.string() })),
    /** The caller may give logins (`team.invite` or `team.manage`); without it the state reads only. */
    canGrant: z.boolean(),
    /** The caller manages the team: every role goes out at once, none is requested. */
    grantsEveryRole: z.boolean(),
});
export type EmployeeAccessOptions = z.infer<typeof EmployeeAccessOptions>;
/**
 * `GET /api/v1/ops/employees/:id/access`: where the file's login stands, and what may be given.
 *
 * `state` reads in that order: an account on the file is `active`; else a live invitation sent
 * for it is `invited`; else a request waiting for the owner is `awaiting_owner`; else `none`.
 */
export const EmployeeAccess = EmployeeAccessOptions.extend({
    employeeId: Uuid,
    state: z.enum(["active", "invited", "awaiting_owner", "none"]),
    member: z
        .object({
        email: z.string().nullable(),
        orgRole: OrgRole,
        branchIds: z.array(Uuid).nullable(),
        lastActiveAt: z.string().nullable(),
    })
        .nullable(),
    invitation: z
        .object({
        id: Uuid,
        email: z.string(),
        orgRole: OrgRole,
        branchIds: z.array(Uuid).nullable(),
        sentAt: z.string(),
        expiresAt: z.string(),
    })
        .nullable(),
    /** The file's latest request, whatever became of it. */
    request: StaffAccessRequest.nullable(),
});
export type EmployeeAccess = z.infer<typeof EmployeeAccess>;
/** What giving a login did: sent the invitation, or asked the owner. */
export const GrantEmployeeAccessResponse = z.object({
    outcome: z.enum(["invited", "requested"]),
    access: EmployeeAccess,
});
export type GrantEmployeeAccessResponse = z.infer<typeof GrantEmployeeAccessResponse>;
// ---------------------------------------------------------------------------
// The owner's side: the requests
// ---------------------------------------------------------------------------
/** `GET /api/v1/ops/team/access-requests`: waiting ones first, then the last month's decisions. */
export const StaffAccessRequestList = z.object({
    requests: z.array(StaffAccessRequest),
});
export type StaffAccessRequestList = z.infer<typeof StaffAccessRequestList>;
/** `POST /api/v1/ops/team/access-requests/:id/decline`. */
export const DeclineStaffAccessRequest = z.object({
    note: z.string().trim().min(3, "Say why, so HR can tell the person.").max(300),
});
export type DeclineStaffAccessRequest = z.infer<typeof DeclineStaffAccessRequest>;
/** What each staff role is for, in one line a person choosing a login reads. */
export const ORG_ROLE_SUMMARY: Readonly<Record<InvitableOrgRole, string>> = {
    manager: "Runs the property. No team changes.",
    receptionist: "Bookings, check-in, desk payments.",
    finance: "Money, payments, EBM and refunds.",
    hr: "Staff files, roster, leave, pay drafts.",
    housekeeper: "Room status and maintenance.",
    cashier: "Orders, payment and the cash drawer.",
    waiter: "Takes orders and runs tables.",
    bartender: "Orders, tables and bar tickets.",
    kitchen: "Kitchen and bar tickets.",
    stock_controller: "Signs in; stock comes later.",
};
/** The words a refused login carries, one per rule. */
export const STAFF_ACCESS_REFUSAL = {
    offboarded: "This person has left. A login can only be given to someone on file.",
    hasLogin: "This person already has a login here. The owner changes their role on Team and roles.",
    pending: "A login for this person is already waiting for the owner. Cancel it first to ask again.",
    branches: "You can only give a login for the branches you cover.",
    notPending: "This request has been decided already.",
} as const;
