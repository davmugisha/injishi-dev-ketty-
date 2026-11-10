"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAFF_ACCESS_REFUSAL = exports.ORG_ROLE_SUMMARY = exports.DeclineStaffAccessRequest = exports.StaffAccessRequestList = exports.GrantEmployeeAccessResponse = exports.EmployeeAccess = exports.EmployeeAccessOptions = exports.AccessRoleOption = exports.StaffAccessRequest = exports.StaffAccessRequestStatus = exports.GrantEmployeeAccessRequest = void 0;
const zod_1 = require("zod");
const authz_1 = require("./authz");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
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
exports.GrantEmployeeAccessRequest = zod_1.z.object({
    email: zod_1.z
        .string()
        .trim()
        .toLowerCase()
        .email("Use an email address like name@example.com.")
        .max(200),
    orgRole: ops_1.InvitableOrgRole,
    /** The branches the person will cover; null is every branch (ADR-054). */
    branchIds: ops_1.MemberBranchIds.default(null),
    /** For a request the owner decides: shown to them beside it. */
    note: zod_1.z.string().trim().max(300).nullable().optional(),
});
exports.StaffAccessRequestStatus = zod_1.z.enum(["pending", "approved", "declined", "cancelled"]);
/** A login asked for one file, as HR and the owner read it. */
exports.StaffAccessRequest = zod_1.z.object({
    id: primitives_1.Uuid,
    employeeId: primitives_1.Uuid,
    employeeName: zod_1.z.string(),
    employeeNumber: zod_1.z.string(),
    jobTitle: zod_1.z.string().nullable(),
    email: zod_1.z.string(),
    orgRole: primitives_1.OrgRole,
    /** Null is every branch. */
    branchIds: zod_1.z.array(primitives_1.Uuid).nullable(),
    status: exports.StaffAccessRequestStatus,
    /** What HR wrote for the owner. */
    note: zod_1.z.string().nullable(),
    requestedAt: zod_1.z.string(),
    requestedByName: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string().nullable(),
    decidedByName: zod_1.z.string().nullable(),
    /** Why the owner declined. */
    decisionNote: zod_1.z.string().nullable(),
});
/** One role as the access form offers it: its permissions HERE, and whether the owner approves it. */
exports.AccessRoleOption = zod_1.z.object({
    orgRole: ops_1.InvitableOrgRole,
    label: zod_1.z.string(),
    /** What the role is for, in one line. */
    summary: zod_1.z.string(),
    /** The role's permissions at this business, by area, in the screen's words. */
    areas: zod_1.z.array(zod_1.z.object({
        area: authz_1.PERMISSION_AREA,
        label: zod_1.z.string(),
        permissions: zod_1.z.array(zod_1.z.object({ permission: authz_1.Permission, label: zod_1.z.string() })),
    })),
    /** A login into this role waits for the owner when the caller does not manage the team. */
    needsOwner: zod_1.z.boolean(),
});
/**
 * `GET /api/v1/ops/employees/access-options`: what a login may be, before there is a file to give
 * it to (the new employee form). The same roles, branches and rights the file's read carries.
 */
exports.EmployeeAccessOptions = zod_1.z.object({
    roles: zod_1.z.array(exports.AccessRoleOption),
    /** The branches the caller covers, which are the ones a login they give may name. */
    branches: zod_1.z.array(zod_1.z.object({ id: primitives_1.Uuid, name: zod_1.z.string() })),
    /** The caller may give logins (`team.invite` or `team.manage`); without it the state reads only. */
    canGrant: zod_1.z.boolean(),
    /** The caller manages the team: every role goes out at once, none is requested. */
    grantsEveryRole: zod_1.z.boolean(),
});
/**
 * `GET /api/v1/ops/employees/:id/access`: where the file's login stands, and what may be given.
 *
 * `state` reads in that order: an account on the file is `active`; else a live invitation sent
 * for it is `invited`; else a request waiting for the owner is `awaiting_owner`; else `none`.
 */
exports.EmployeeAccess = exports.EmployeeAccessOptions.extend({
    employeeId: primitives_1.Uuid,
    state: zod_1.z.enum(["active", "invited", "awaiting_owner", "none"]),
    member: zod_1.z
        .object({
        email: zod_1.z.string().nullable(),
        orgRole: primitives_1.OrgRole,
        branchIds: zod_1.z.array(primitives_1.Uuid).nullable(),
        lastActiveAt: zod_1.z.string().nullable(),
    })
        .nullable(),
    invitation: zod_1.z
        .object({
        id: primitives_1.Uuid,
        email: zod_1.z.string(),
        orgRole: primitives_1.OrgRole,
        branchIds: zod_1.z.array(primitives_1.Uuid).nullable(),
        sentAt: zod_1.z.string(),
        expiresAt: zod_1.z.string(),
    })
        .nullable(),
    /** The file's latest request, whatever became of it. */
    request: exports.StaffAccessRequest.nullable(),
});
/** What giving a login did: sent the invitation, or asked the owner. */
exports.GrantEmployeeAccessResponse = zod_1.z.object({
    outcome: zod_1.z.enum(["invited", "requested"]),
    access: exports.EmployeeAccess,
});
// ---------------------------------------------------------------------------
// The owner's side: the requests
// ---------------------------------------------------------------------------
/** `GET /api/v1/ops/team/access-requests`: waiting ones first, then the last month's decisions. */
exports.StaffAccessRequestList = zod_1.z.object({
    requests: zod_1.z.array(exports.StaffAccessRequest),
});
/** `POST /api/v1/ops/team/access-requests/:id/decline`. */
exports.DeclineStaffAccessRequest = zod_1.z.object({
    note: zod_1.z.string().trim().min(3, "Say why, so HR can tell the person.").max(300),
});
/** What each staff role is for, in one line a person choosing a login reads. */
exports.ORG_ROLE_SUMMARY = {
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
exports.STAFF_ACCESS_REFUSAL = {
    offboarded: "This person has left. A login can only be given to someone on file.",
    hasLogin: "This person already has a login here. The owner changes their role on Team and roles.",
    pending: "A login for this person is already waiting for the owner. Cancel it first to ask again.",
    branches: "You can only give a login for the branches you cover.",
    notPending: "This request has been decided already.",
};
//# sourceMappingURL=staff-access.js.map