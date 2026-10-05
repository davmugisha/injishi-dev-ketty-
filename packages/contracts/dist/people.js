"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveBalance = exports.LeaveLedgerEntry = exports.LeaveType = exports.CorrectAttendanceRequest = exports.ClockOutRequest = exports.ClockInRequest = exports.AttendanceQuery = exports.AttendanceList = exports.AttendanceRecord = exports.CancelRosterEntryRequest = exports.CreateRosterEntryRequest = exports.RosterQuery = exports.RosterList = exports.RosterEntry = exports.CreateShiftTemplateRequest = exports.ShiftTemplateQuery = exports.ShiftTemplateList = exports.ShiftTemplate = exports.ShiftTemplateStatus = exports.OffboardEmployeeRequest = exports.CreateContractResponse = exports.CreateContractRequest = exports.UpdateEmployeeRequest = exports.CreateEmployeeRequest = exports.EmployeeFile = exports.EmployeeDepartment = exports.Employee = exports.EmployeeFull = exports.EmployeeBasic = exports.EmploymentContract = exports.EmploymentContractFull = exports.EmploymentContractBasic = exports.RosterCard = exports.EMPLOYEE_MISSING_DETAIL_LABEL = exports.EmployeeMissingDetail = exports.TimeOfDay = exports.LeaveEndHalf = exports.LeaveStartHalf = exports.LeaveRequestStatus = exports.LeaveEntryKind = exports.LeaveAccrual = exports.AttendanceStatus = exports.AttendanceSource = exports.RosterStatus = exports.ContractStatus = exports.WageBasis = exports.ContractType = exports.EmployeeStatus = exports.HrIdDocumentType = exports.HrSex = void 0;
exports.LeaveDecisionRequest = exports.CreateLeaveRequestRequest = exports.LeaveRequestQuery = exports.LeaveRequestList = exports.LeaveRequest = exports.LeaveBalances = void 0;
const zod_1 = require("zod");
const booking_1 = require("./booking");
const phone_1 = require("./phone");
const primitives_1 = require("./primitives");
/**
 * The HR module's people side (ADR-058, first thread): the HR file, contracts,
 * shift templates, the roster, attendance and leave.
 *
 * Pay lives in `payroll.ts`. Both are the ONE definition of every HR request and
 * response; the API validates with these schemas and the apps render from the
 * types inferred from them.
 *
 * **Two shapes for a file, on purpose.** A caller holding `people.view` alone
 * gets `EmployeeBasic`, which has no field for a date of birth, an ID, an RSSB
 * number or a wage. A caller holding `people.manage` or `payroll.run` gets
 * `EmployeeFull`. The API picks the schema from the caller's grant, so a missed
 * check produces a response that fails to parse rather than one that leaks.
 */
// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
exports.HrSex = zod_1.z.enum(["female", "male"]);
exports.HrIdDocumentType = zod_1.z.enum(["national_id", "passport"]);
/** `active` then `offboarded`, with no way back (rehiring is a later decision). */
exports.EmployeeStatus = zod_1.z.enum(["active", "offboarded"]);
exports.ContractType = zod_1.z.enum(["permanent", "fixed_term", "casual"]);
exports.WageBasis = zod_1.z.enum(["monthly", "daily", "hourly"]);
/** For display and the one active contract index. Pay reads the dates. */
exports.ContractStatus = zod_1.z.enum(["scheduled", "active", "ended"]);
exports.RosterStatus = zod_1.z.enum(["scheduled", "cancelled"]);
/** Who wrote the record. A `self` record waits for validation. */
exports.AttendanceSource = zod_1.z.enum(["supervisor", "self"]);
/** `closed` becomes `superseded` only when a correction replaces it. */
exports.AttendanceStatus = zod_1.z.enum(["open", "closed", "superseded"]);
exports.LeaveAccrual = zod_1.z.enum(["yearly_upfront", "monthly", "none"]);
exports.LeaveEntryKind = zod_1.z.enum([
    "accrual",
    "taken",
    "reversal",
    "carry_forward",
    "expiry",
    "adjustment",
]);
exports.LeaveRequestStatus = zod_1.z.enum(["requested", "approved", "rejected", "cancelled"]);
/** A leave may start in the afternoon of its first day... */
exports.LeaveStartHalf = zod_1.z.enum(["full", "second_half"]);
/** ...and end at lunch on its last. */
exports.LeaveEndHalf = zod_1.z.enum(["full", "first_half"]);
/** `HH:MM`, 24 hour, the wall clock at the branch. */
exports.TimeOfDay = zod_1.z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "A time is HH:MM, like 07:00 or 22:30.");
/**
 * Which fields a file still lacks before it can carry a contract.
 *
 * A file backfilled from a membership (AC-P5) starts with all of them empty; a
 * file created through the API cannot, because the create route requires them.
 */
exports.EmployeeMissingDetail = zod_1.z.enum(["phone", "dateOfBirth", "sex", "idDocument"]);
exports.EMPLOYEE_MISSING_DETAIL_LABEL = {
    phone: "phone number",
    dateOfBirth: "date of birth",
    sex: "sex",
    idDocument: "ID document",
};
// ---------------------------------------------------------------------------
// The HR file
// ---------------------------------------------------------------------------
/**
 * The only part of a file a roster or an attendance sheet ever carries.
 *
 * `attendance.record` is held by the front desk, so what the desk sees of a
 * colleague is a name and a job title and nothing else from the file.
 */
exports.RosterCard = zod_1.z.object({
    employeeId: primitives_1.Uuid,
    /** The preferred name, else the legal name. */
    displayName: zod_1.z.string(),
    jobPositionTitle: zod_1.z.string().nullable(),
});
const ContractBase = zod_1.z.object({
    id: primitives_1.Uuid,
    employeeId: primitives_1.Uuid,
    contractType: exports.ContractType,
    startsOn: booking_1.IsoDate,
    /** Null: open ended. */
    endsOn: booking_1.IsoDate.nullable(),
    wageBasis: exports.WageBasis,
    status: exports.ContractStatus,
    endReason: zod_1.z.string().nullable(),
});
/** A contract as `people.view` reads it: no wage. */
exports.EmploymentContractBasic = ContractBase.extend({ view: zod_1.z.literal("basic") });
/** A contract as `people.manage` or `payroll.run` reads it. */
exports.EmploymentContractFull = ContractBase.extend({
    view: zod_1.z.literal("full"),
    wageRwf: primitives_1.RwfAmount,
});
exports.EmploymentContract = zod_1.z.discriminatedUnion("view", [
    exports.EmploymentContractBasic,
    exports.EmploymentContractFull,
]);
const EmployeeBase = zod_1.z.object({
    id: primitives_1.Uuid,
    employeeNumber: zod_1.z.string(),
    legalName: zod_1.z.string(),
    preferredName: zod_1.z.string().nullable(),
    displayName: zod_1.z.string(),
    phone: zod_1.z.string().nullable(),
    email: zod_1.z.string().nullable(),
    sex: exports.HrSex.nullable(),
    workPropertyId: primitives_1.Uuid.nullable(),
    workPropertyName: zod_1.z.string().nullable(),
    jobPositionId: primitives_1.Uuid.nullable(),
    jobPositionTitle: zod_1.z.string().nullable(),
    reportingManagerId: primitives_1.Uuid.nullable(),
    reportingManagerName: zod_1.z.string().nullable(),
    hiredOn: booking_1.IsoDate,
    status: exports.EmployeeStatus,
    offboardedOn: booking_1.IsoDate.nullable(),
    offboardReason: zod_1.z.string().nullable(),
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: zod_1.z.boolean(),
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: primitives_1.OrgRole.nullable(),
    detailsMissing: zod_1.z.array(exports.EmployeeMissingDetail),
});
/** A file as `people.view` reads it (AC-P2). */
exports.EmployeeBasic = EmployeeBase.extend({
    view: zod_1.z.literal("basic"),
    currentContract: exports.EmploymentContractBasic.nullable(),
});
/** A file with the sensitive fields, for `people.manage` or `payroll.run`. */
exports.EmployeeFull = EmployeeBase.extend({
    view: zod_1.z.literal("full"),
    dateOfBirth: booking_1.IsoDate.nullable(),
    idDocumentType: exports.HrIdDocumentType.nullable(),
    idDocumentNumber: zod_1.z.string().nullable(),
    rssbNumber: zod_1.z.string().nullable(),
    currentContract: exports.EmploymentContractFull.nullable(),
});
exports.Employee = zod_1.z.discriminatedUnion("view", [exports.EmployeeBasic, exports.EmployeeFull]);
/** A department the person is on, through `department_members`. */
exports.EmployeeDepartment = zod_1.z.object({
    departmentId: primitives_1.Uuid,
    name: zod_1.z.string(),
    departmentPosition: zod_1.z.string(),
});
/** `GET /ops/employees/:id`: the file, its contracts newest first, its departments. */
exports.EmployeeFile = zod_1.z.object({
    employee: exports.Employee,
    contracts: zod_1.z.array(exports.EmploymentContract),
    departments: zod_1.z.array(exports.EmployeeDepartment),
});
// The employee list's page and query are `EMPLOYEE_LIST` and `EmployeePage` in
// `hr-lists.ts` (058-list-framework), which replaced the first thread's cursor.
const LegalName = zod_1.z.string().trim().min(2, "Enter the name as it is on the ID.").max(200);
const IdDocumentNumber = zod_1.z.string().trim().min(3, "Enter the ID number.").max(40);
const RssbNumber = zod_1.z.string().trim().min(3, "Enter the RSSB number.").max(40);
const EmployeeNumber = zod_1.z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,20}$/, "An employee number is letters, digits and dashes.");
const OptionalEmail = zod_1.z.string().trim().toLowerCase().email("Enter a valid email address.");
/** `POST /ops/employees`. The business is the workspace, never the body (AC-U4). */
exports.CreateEmployeeRequest = zod_1.z.object({
    legalName: LegalName,
    preferredName: zod_1.z.string().trim().min(1).max(100).nullable().optional(),
    phone: phone_1.RwPhoneNumber,
    dateOfBirth: booking_1.IsoDate,
    sex: exports.HrSex,
    idDocumentType: exports.HrIdDocumentType,
    idDocumentNumber: IdDocumentNumber,
    hiredOn: booking_1.IsoDate,
    workPropertyId: primitives_1.Uuid,
    /** Minted per business (`0001`, `0002`, …) when absent. */
    employeeNumber: EmployeeNumber.optional(),
    email: OptionalEmail.nullable().optional(),
    rssbNumber: RssbNumber.nullable().optional(),
    reportingManagerId: primitives_1.Uuid.nullable().optional(),
});
/**
 * `PATCH /ops/employees/:id`. Any file field; null clears a nullable one.
 *
 * The ID travels as a pair: a type with no number, or a number with no type,
 * says nothing a payroll declaration can use.
 */
exports.UpdateEmployeeRequest = zod_1.z
    .object({
    legalName: LegalName,
    preferredName: zod_1.z.string().trim().min(1).max(100).nullable(),
    phone: phone_1.RwPhoneNumber,
    email: OptionalEmail.nullable(),
    dateOfBirth: booking_1.IsoDate,
    sex: exports.HrSex,
    idDocumentType: exports.HrIdDocumentType,
    idDocumentNumber: IdDocumentNumber,
    rssbNumber: RssbNumber.nullable(),
    hiredOn: booking_1.IsoDate,
    workPropertyId: primitives_1.Uuid,
    employeeNumber: EmployeeNumber,
    reportingManagerId: primitives_1.Uuid.nullable(),
})
    .partial()
    .refine((b) => (b.idDocumentType === undefined) === (b.idDocumentNumber === undefined), {
    message: "Send the ID type and the ID number together.",
    path: ["idDocumentNumber"],
})
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
/**
 * `POST /ops/employees/:id/contracts`. A wage change is a new contract.
 *
 * Only a monthly wage is accepted in the first thread. Daily and hourly pay are
 * computed from attendance, which arrives with ADR-058 slice 5; refusing the
 * contract now is what stops a pay run from silently leaving someone out.
 */
exports.CreateContractRequest = zod_1.z.object({
    contractType: exports.ContractType,
    startsOn: booking_1.IsoDate,
    endsOn: booking_1.IsoDate.nullable().optional(),
    wageBasis: exports.WageBasis,
    wageRwf: zod_1.z.number().int().positive("A wage is more than zero."),
});
/** The new contract, and the one it shortened, if any. */
exports.CreateContractResponse = zod_1.z.object({
    contract: exports.EmploymentContractFull,
    shortened: exports.EmploymentContractFull.nullable(),
});
/** `POST /ops/employees/:id/offboard`. */
exports.OffboardEmployeeRequest = zod_1.z.object({
    lastDay: booking_1.IsoDate,
    reason: zod_1.z.string().trim().min(3, "Say why they are leaving.").max(500),
});
// ---------------------------------------------------------------------------
// Shift templates and the roster
// ---------------------------------------------------------------------------
exports.ShiftTemplateStatus = zod_1.z.enum(["active", "archived"]);
exports.ShiftTemplate = zod_1.z.object({
    id: primitives_1.Uuid,
    propertyId: primitives_1.Uuid,
    departmentId: primitives_1.Uuid.nullable(),
    name: zod_1.z.string(),
    startsAt: exports.TimeOfDay,
    endsAt: exports.TimeOfDay,
    breakMinutes: zod_1.z.number().int().nonnegative(),
    /** An end at or before the start runs past midnight. */
    crossesMidnight: zod_1.z.boolean(),
    status: exports.ShiftTemplateStatus,
});
exports.ShiftTemplateList = zod_1.z.object({ templates: zod_1.z.array(exports.ShiftTemplate) });
exports.ShiftTemplateQuery = zod_1.z.object({ propertyId: primitives_1.Uuid.optional() });
exports.CreateShiftTemplateRequest = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    departmentId: primitives_1.Uuid.nullable().optional(),
    name: zod_1.z.string().trim().min(1, "Name the shift.").max(60),
    startsAt: exports.TimeOfDay,
    endsAt: exports.TimeOfDay,
    breakMinutes: zod_1.z.number().int().min(0).max(720).optional(),
});
exports.RosterEntry = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: exports.RosterCard,
    shiftTemplateId: primitives_1.Uuid,
    shiftName: zod_1.z.string(),
    propertyId: primitives_1.Uuid,
    departmentId: primitives_1.Uuid.nullable(),
    workDate: booking_1.IsoDate,
    /** Instants, computed from the template's times on `workDate` in Kigali. */
    startsAt: zod_1.z.string(),
    endsAt: zod_1.z.string(),
    status: exports.RosterStatus,
    cancelReason: zod_1.z.string().nullable(),
});
exports.RosterList = zod_1.z.object({ entries: zod_1.z.array(exports.RosterEntry) });
/** At most 31 days, inclusive at both ends. */
exports.RosterQuery = zod_1.z.object({
    from: booking_1.IsoDate,
    to: booking_1.IsoDate,
    propertyId: primitives_1.Uuid.optional(),
});
exports.CreateRosterEntryRequest = zod_1.z.object({
    employeeId: primitives_1.Uuid,
    shiftTemplateId: primitives_1.Uuid,
    workDate: booking_1.IsoDate,
});
exports.CancelRosterEntryRequest = zod_1.z.object({
    reason: zod_1.z.string().trim().min(1, "Say why.").max(300),
});
// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
exports.AttendanceRecord = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: exports.RosterCard,
    rosterEntryId: primitives_1.Uuid.nullable(),
    workDate: booking_1.IsoDate,
    clockInAt: zod_1.z.string(),
    clockOutAt: zod_1.z.string().nullable(),
    source: exports.AttendanceSource,
    validated: zod_1.z.boolean(),
    status: exports.AttendanceStatus,
    supersedesId: primitives_1.Uuid.nullable(),
    note: zod_1.z.string().nullable(),
});
exports.AttendanceList = zod_1.z.object({ records: zod_1.z.array(exports.AttendanceRecord) });
exports.AttendanceQuery = zod_1.z.object({
    date: booking_1.IsoDate,
    propertyId: primitives_1.Uuid.optional(),
});
const Instant = zod_1.z.string().datetime({ offset: true, message: "A time is an ISO instant." });
exports.ClockInRequest = zod_1.z.object({
    employeeId: primitives_1.Uuid,
    /** At most 5 minutes ahead and 7 days behind the server clock. */
    at: Instant.optional(),
    rosterEntryId: primitives_1.Uuid.optional(),
});
exports.ClockOutRequest = zod_1.z.object({ at: Instant.optional() });
exports.CorrectAttendanceRequest = zod_1.z.object({
    clockInAt: Instant,
    clockOutAt: Instant,
    note: zod_1.z.string().trim().min(3, "Say what was wrong.").max(300),
});
// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------
exports.LeaveType = zod_1.z.object({
    id: primitives_1.Uuid,
    code: zod_1.z.string(),
    name: zod_1.z.string(),
    paid: zod_1.z.boolean(),
    /** Null: no balance is kept, as for unpaid leave. */
    yearlyEntitlementDays: zod_1.z.number().nullable(),
    accrual: exports.LeaveAccrual,
    needsApproval: zod_1.z.boolean(),
});
exports.LeaveLedgerEntry = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: exports.LeaveEntryKind,
    /** Signed: accruals add, leave taken subtracts, a reversal undoes. */
    days: zod_1.z.number(),
    effectiveOn: booking_1.IsoDate,
    periodKey: zod_1.z.string().nullable(),
    leaveRequestId: primitives_1.Uuid.nullable(),
    reason: zod_1.z.string().nullable(),
});
/** A balance is only ever the sum of the ledger (AC-L4). */
exports.LeaveBalance = zod_1.z.object({
    leaveType: exports.LeaveType,
    /** Null for a type that keeps no balance. */
    balanceDays: zod_1.z.number().nullable(),
    entries: zod_1.z.array(exports.LeaveLedgerEntry),
});
exports.LeaveBalances = zod_1.z.object({
    employeeId: primitives_1.Uuid,
    balances: zod_1.z.array(exports.LeaveBalance),
});
exports.LeaveRequest = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: exports.RosterCard,
    leaveType: zod_1.z.object({ id: primitives_1.Uuid, code: zod_1.z.string(), name: zod_1.z.string(), paid: zod_1.z.boolean() }),
    startsOn: booking_1.IsoDate,
    endsOn: booking_1.IsoDate,
    startHalf: exports.LeaveStartHalf,
    endHalf: exports.LeaveEndHalf,
    /** Estimated at request; the approved figure once approved. */
    days: zod_1.z.number(),
    reason: zod_1.z.string().nullable(),
    status: exports.LeaveRequestStatus,
    /** The reporting manager at request time. Orders the queue; grants nothing. */
    routedToEmployeeId: primitives_1.Uuid.nullable(),
    routedToName: zod_1.z.string().nullable(),
    /** Whether the caller is the manager this request was routed to. */
    routedToMe: zod_1.z.boolean(),
    decidedAt: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.LeaveRequestList = zod_1.z.object({ requests: zod_1.z.array(exports.LeaveRequest) });
exports.LeaveRequestQuery = zod_1.z.object({ status: exports.LeaveRequestStatus.optional() });
exports.CreateLeaveRequestRequest = zod_1.z.object({
    employeeId: primitives_1.Uuid,
    leaveTypeId: primitives_1.Uuid,
    startsOn: booking_1.IsoDate,
    endsOn: booking_1.IsoDate,
    startHalf: exports.LeaveStartHalf.optional(),
    endHalf: exports.LeaveEndHalf.optional(),
    reason: zod_1.z.string().trim().max(300).nullable().optional(),
});
exports.LeaveDecisionRequest = zod_1.z.object({
    note: zod_1.z.string().trim().max(300).nullable().optional(),
});
//# sourceMappingURL=people.js.map