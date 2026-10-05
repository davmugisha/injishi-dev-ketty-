import { z } from "zod";
import { IsoDate } from "./booking";
import { RwPhoneNumber } from "./phone";
import { OrgRole, RwfAmount, Uuid } from "./primitives";
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
export const HrSex = z.enum(["female", "male"]);
export type HrSex = z.infer<typeof HrSex>;
export const HrIdDocumentType = z.enum(["national_id", "passport"]);
export type HrIdDocumentType = z.infer<typeof HrIdDocumentType>;
/** `active` then `offboarded`, with no way back (rehiring is a later decision). */
export const EmployeeStatus = z.enum(["active", "offboarded"]);
export type EmployeeStatus = z.infer<typeof EmployeeStatus>;
export const ContractType = z.enum(["permanent", "fixed_term", "casual"]);
export type ContractType = z.infer<typeof ContractType>;
export const WageBasis = z.enum(["monthly", "daily", "hourly"]);
export type WageBasis = z.infer<typeof WageBasis>;
/** For display and the one active contract index. Pay reads the dates. */
export const ContractStatus = z.enum(["scheduled", "active", "ended"]);
export type ContractStatus = z.infer<typeof ContractStatus>;
export const RosterStatus = z.enum(["scheduled", "cancelled"]);
export type RosterStatus = z.infer<typeof RosterStatus>;
/** Who wrote the record. A `self` record waits for validation. */
export const AttendanceSource = z.enum(["supervisor", "self"]);
export type AttendanceSource = z.infer<typeof AttendanceSource>;
/** `closed` becomes `superseded` only when a correction replaces it. */
export const AttendanceStatus = z.enum(["open", "closed", "superseded"]);
export type AttendanceStatus = z.infer<typeof AttendanceStatus>;
export const LeaveAccrual = z.enum(["yearly_upfront", "monthly", "none"]);
export type LeaveAccrual = z.infer<typeof LeaveAccrual>;
export const LeaveEntryKind = z.enum([
    "accrual",
    "taken",
    "reversal",
    "carry_forward",
    "expiry",
    "adjustment",
]);
export type LeaveEntryKind = z.infer<typeof LeaveEntryKind>;
export const LeaveRequestStatus = z.enum(["requested", "approved", "rejected", "cancelled"]);
export type LeaveRequestStatus = z.infer<typeof LeaveRequestStatus>;
/** A leave may start in the afternoon of its first day... */
export const LeaveStartHalf = z.enum(["full", "second_half"]);
export type LeaveStartHalf = z.infer<typeof LeaveStartHalf>;
/** ...and end at lunch on its last. */
export const LeaveEndHalf = z.enum(["full", "first_half"]);
export type LeaveEndHalf = z.infer<typeof LeaveEndHalf>;
/** `HH:MM`, 24 hour, the wall clock at the branch. */
export const TimeOfDay = z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "A time is HH:MM, like 07:00 or 22:30.");
export type TimeOfDay = z.infer<typeof TimeOfDay>;
/**
 * Which fields a file still lacks before it can carry a contract.
 *
 * A file backfilled from a membership (AC-P5) starts with all of them empty; a
 * file created through the API cannot, because the create route requires them.
 */
export const EmployeeMissingDetail = z.enum(["phone", "dateOfBirth", "sex", "idDocument"]);
export type EmployeeMissingDetail = z.infer<typeof EmployeeMissingDetail>;
export const EMPLOYEE_MISSING_DETAIL_LABEL: Readonly<Record<EmployeeMissingDetail, string>> = {
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
export const RosterCard = z.object({
    employeeId: Uuid,
    /** The preferred name, else the legal name. */
    displayName: z.string(),
    jobPositionTitle: z.string().nullable(),
});
export type RosterCard = z.infer<typeof RosterCard>;
const ContractBase = z.object({
    id: Uuid,
    employeeId: Uuid,
    contractType: ContractType,
    startsOn: IsoDate,
    /** Null: open ended. */
    endsOn: IsoDate.nullable(),
    wageBasis: WageBasis,
    status: ContractStatus,
    endReason: z.string().nullable(),
});
/** A contract as `people.view` reads it: no wage. */
export const EmploymentContractBasic = ContractBase.extend({ view: z.literal("basic") });
export type EmploymentContractBasic = z.infer<typeof EmploymentContractBasic>;
/** A contract as `people.manage` or `payroll.run` reads it. */
export const EmploymentContractFull = ContractBase.extend({
    view: z.literal("full"),
    wageRwf: RwfAmount,
});
export type EmploymentContractFull = z.infer<typeof EmploymentContractFull>;
export const EmploymentContract = z.discriminatedUnion("view", [
    EmploymentContractBasic,
    EmploymentContractFull,
]);
export type EmploymentContract = z.infer<typeof EmploymentContract>;
const EmployeeBase = z.object({
    id: Uuid,
    employeeNumber: z.string(),
    legalName: z.string(),
    preferredName: z.string().nullable(),
    displayName: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    sex: HrSex.nullable(),
    workPropertyId: Uuid.nullable(),
    workPropertyName: z.string().nullable(),
    jobPositionId: Uuid.nullable(),
    jobPositionTitle: z.string().nullable(),
    reportingManagerId: Uuid.nullable(),
    reportingManagerName: z.string().nullable(),
    hiredOn: IsoDate,
    status: EmployeeStatus,
    offboardedOn: IsoDate.nullable(),
    offboardReason: z.string().nullable(),
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.boolean(),
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: OrgRole.nullable(),
    detailsMissing: z.array(EmployeeMissingDetail),
});
/** A file as `people.view` reads it (AC-P2). */
export const EmployeeBasic = EmployeeBase.extend({
    view: z.literal("basic"),
    currentContract: EmploymentContractBasic.nullable(),
});
export type EmployeeBasic = z.infer<typeof EmployeeBasic>;
/** A file with the sensitive fields, for `people.manage` or `payroll.run`. */
export const EmployeeFull = EmployeeBase.extend({
    view: z.literal("full"),
    dateOfBirth: IsoDate.nullable(),
    idDocumentType: HrIdDocumentType.nullable(),
    idDocumentNumber: z.string().nullable(),
    rssbNumber: z.string().nullable(),
    currentContract: EmploymentContractFull.nullable(),
});
export type EmployeeFull = z.infer<typeof EmployeeFull>;
export const Employee = z.discriminatedUnion("view", [EmployeeBasic, EmployeeFull]);
export type Employee = z.infer<typeof Employee>;
/** A department the person is on, through `department_members`. */
export const EmployeeDepartment = z.object({
    departmentId: Uuid,
    name: z.string(),
    departmentPosition: z.string(),
});
export type EmployeeDepartment = z.infer<typeof EmployeeDepartment>;
/** `GET /ops/employees/:id`: the file, its contracts newest first, its departments. */
export const EmployeeFile = z.object({
    employee: Employee,
    contracts: z.array(EmploymentContract),
    departments: z.array(EmployeeDepartment),
});
export type EmployeeFile = z.infer<typeof EmployeeFile>;
// The employee list's page and query are `EMPLOYEE_LIST` and `EmployeePage` in
// `hr-lists.ts` (058-list-framework), which replaced the first thread's cursor.
const LegalName = z.string().trim().min(2, "Enter the name as it is on the ID.").max(200);
const IdDocumentNumber = z.string().trim().min(3, "Enter the ID number.").max(40);
const RssbNumber = z.string().trim().min(3, "Enter the RSSB number.").max(40);
const EmployeeNumber = z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,20}$/, "An employee number is letters, digits and dashes.");
const OptionalEmail = z.string().trim().toLowerCase().email("Enter a valid email address.");
/** `POST /ops/employees`. The business is the workspace, never the body (AC-U4). */
export const CreateEmployeeRequest = z.object({
    legalName: LegalName,
    preferredName: z.string().trim().min(1).max(100).nullable().optional(),
    phone: RwPhoneNumber,
    dateOfBirth: IsoDate,
    sex: HrSex,
    idDocumentType: HrIdDocumentType,
    idDocumentNumber: IdDocumentNumber,
    hiredOn: IsoDate,
    workPropertyId: Uuid,
    /** Minted per business (`0001`, `0002`, …) when absent. */
    employeeNumber: EmployeeNumber.optional(),
    email: OptionalEmail.nullable().optional(),
    rssbNumber: RssbNumber.nullable().optional(),
    reportingManagerId: Uuid.nullable().optional(),
});
export type CreateEmployeeRequest = z.infer<typeof CreateEmployeeRequest>;
/**
 * `PATCH /ops/employees/:id`. Any file field; null clears a nullable one.
 *
 * The ID travels as a pair: a type with no number, or a number with no type,
 * says nothing a payroll declaration can use.
 */
export const UpdateEmployeeRequest = z
    .object({
    legalName: LegalName,
    preferredName: z.string().trim().min(1).max(100).nullable(),
    phone: RwPhoneNumber,
    email: OptionalEmail.nullable(),
    dateOfBirth: IsoDate,
    sex: HrSex,
    idDocumentType: HrIdDocumentType,
    idDocumentNumber: IdDocumentNumber,
    rssbNumber: RssbNumber.nullable(),
    hiredOn: IsoDate,
    workPropertyId: Uuid,
    employeeNumber: EmployeeNumber,
    reportingManagerId: Uuid.nullable(),
})
    .partial()
    .refine((b) => (b.idDocumentType === undefined) === (b.idDocumentNumber === undefined), {
    message: "Send the ID type and the ID number together.",
    path: ["idDocumentNumber"],
})
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateEmployeeRequest = z.infer<typeof UpdateEmployeeRequest>;
/**
 * `POST /ops/employees/:id/contracts`. A wage change is a new contract.
 *
 * Only a monthly wage is accepted in the first thread. Daily and hourly pay are
 * computed from attendance, which arrives with ADR-058 slice 5; refusing the
 * contract now is what stops a pay run from silently leaving someone out.
 */
export const CreateContractRequest = z.object({
    contractType: ContractType,
    startsOn: IsoDate,
    endsOn: IsoDate.nullable().optional(),
    wageBasis: WageBasis,
    wageRwf: z.number().int().positive("A wage is more than zero."),
});
export type CreateContractRequest = z.infer<typeof CreateContractRequest>;
/** The new contract, and the one it shortened, if any. */
export const CreateContractResponse = z.object({
    contract: EmploymentContractFull,
    shortened: EmploymentContractFull.nullable(),
});
export type CreateContractResponse = z.infer<typeof CreateContractResponse>;
/** `POST /ops/employees/:id/offboard`. */
export const OffboardEmployeeRequest = z.object({
    lastDay: IsoDate,
    reason: z.string().trim().min(3, "Say why they are leaving.").max(500),
});
export type OffboardEmployeeRequest = z.infer<typeof OffboardEmployeeRequest>;
// ---------------------------------------------------------------------------
// Shift templates and the roster
// ---------------------------------------------------------------------------
export const ShiftTemplateStatus = z.enum(["active", "archived"]);
export type ShiftTemplateStatus = z.infer<typeof ShiftTemplateStatus>;
export const ShiftTemplate = z.object({
    id: Uuid,
    propertyId: Uuid,
    departmentId: Uuid.nullable(),
    name: z.string(),
    startsAt: TimeOfDay,
    endsAt: TimeOfDay,
    breakMinutes: z.number().int().nonnegative(),
    /** An end at or before the start runs past midnight. */
    crossesMidnight: z.boolean(),
    status: ShiftTemplateStatus,
});
export type ShiftTemplate = z.infer<typeof ShiftTemplate>;
export const ShiftTemplateList = z.object({ templates: z.array(ShiftTemplate) });
export type ShiftTemplateList = z.infer<typeof ShiftTemplateList>;
export const ShiftTemplateQuery = z.object({ propertyId: Uuid.optional() });
export type ShiftTemplateQuery = z.infer<typeof ShiftTemplateQuery>;
export const CreateShiftTemplateRequest = z.object({
    propertyId: Uuid,
    departmentId: Uuid.nullable().optional(),
    name: z.string().trim().min(1, "Name the shift.").max(60),
    startsAt: TimeOfDay,
    endsAt: TimeOfDay,
    breakMinutes: z.number().int().min(0).max(720).optional(),
});
export type CreateShiftTemplateRequest = z.infer<typeof CreateShiftTemplateRequest>;
export const RosterEntry = z.object({
    id: Uuid,
    employee: RosterCard,
    shiftTemplateId: Uuid,
    shiftName: z.string(),
    propertyId: Uuid,
    departmentId: Uuid.nullable(),
    workDate: IsoDate,
    /** Instants, computed from the template's times on `workDate` in Kigali. */
    startsAt: z.string(),
    endsAt: z.string(),
    status: RosterStatus,
    cancelReason: z.string().nullable(),
});
export type RosterEntry = z.infer<typeof RosterEntry>;
export const RosterList = z.object({ entries: z.array(RosterEntry) });
export type RosterList = z.infer<typeof RosterList>;
/** At most 31 days, inclusive at both ends. */
export const RosterQuery = z.object({
    from: IsoDate,
    to: IsoDate,
    propertyId: Uuid.optional(),
});
export type RosterQuery = z.infer<typeof RosterQuery>;
export const CreateRosterEntryRequest = z.object({
    employeeId: Uuid,
    shiftTemplateId: Uuid,
    workDate: IsoDate,
});
export type CreateRosterEntryRequest = z.infer<typeof CreateRosterEntryRequest>;
export const CancelRosterEntryRequest = z.object({
    reason: z.string().trim().min(1, "Say why.").max(300),
});
export type CancelRosterEntryRequest = z.infer<typeof CancelRosterEntryRequest>;
// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
export const AttendanceRecord = z.object({
    id: Uuid,
    employee: RosterCard,
    rosterEntryId: Uuid.nullable(),
    workDate: IsoDate,
    clockInAt: z.string(),
    clockOutAt: z.string().nullable(),
    source: AttendanceSource,
    validated: z.boolean(),
    status: AttendanceStatus,
    supersedesId: Uuid.nullable(),
    note: z.string().nullable(),
});
export type AttendanceRecord = z.infer<typeof AttendanceRecord>;
export const AttendanceList = z.object({ records: z.array(AttendanceRecord) });
export type AttendanceList = z.infer<typeof AttendanceList>;
export const AttendanceQuery = z.object({
    date: IsoDate,
    propertyId: Uuid.optional(),
});
export type AttendanceQuery = z.infer<typeof AttendanceQuery>;
const Instant = z.string().datetime({ offset: true, message: "A time is an ISO instant." });
export const ClockInRequest = z.object({
    employeeId: Uuid,
    /** At most 5 minutes ahead and 7 days behind the server clock. */
    at: Instant.optional(),
    rosterEntryId: Uuid.optional(),
});
export type ClockInRequest = z.infer<typeof ClockInRequest>;
export const ClockOutRequest = z.object({ at: Instant.optional() });
export type ClockOutRequest = z.infer<typeof ClockOutRequest>;
export const CorrectAttendanceRequest = z.object({
    clockInAt: Instant,
    clockOutAt: Instant,
    note: z.string().trim().min(3, "Say what was wrong.").max(300),
});
export type CorrectAttendanceRequest = z.infer<typeof CorrectAttendanceRequest>;
// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------
export const LeaveType = z.object({
    id: Uuid,
    code: z.string(),
    name: z.string(),
    paid: z.boolean(),
    /** Null: no balance is kept, as for unpaid leave. */
    yearlyEntitlementDays: z.number().nullable(),
    accrual: LeaveAccrual,
    needsApproval: z.boolean(),
});
export type LeaveType = z.infer<typeof LeaveType>;
export const LeaveLedgerEntry = z.object({
    id: Uuid,
    kind: LeaveEntryKind,
    /** Signed: accruals add, leave taken subtracts, a reversal undoes. */
    days: z.number(),
    effectiveOn: IsoDate,
    periodKey: z.string().nullable(),
    leaveRequestId: Uuid.nullable(),
    reason: z.string().nullable(),
});
export type LeaveLedgerEntry = z.infer<typeof LeaveLedgerEntry>;
/** A balance is only ever the sum of the ledger (AC-L4). */
export const LeaveBalance = z.object({
    leaveType: LeaveType,
    /** Null for a type that keeps no balance. */
    balanceDays: z.number().nullable(),
    entries: z.array(LeaveLedgerEntry),
});
export type LeaveBalance = z.infer<typeof LeaveBalance>;
export const LeaveBalances = z.object({
    employeeId: Uuid,
    balances: z.array(LeaveBalance),
});
export type LeaveBalances = z.infer<typeof LeaveBalances>;
export const LeaveRequest = z.object({
    id: Uuid,
    employee: RosterCard,
    leaveType: z.object({ id: Uuid, code: z.string(), name: z.string(), paid: z.boolean() }),
    startsOn: IsoDate,
    endsOn: IsoDate,
    startHalf: LeaveStartHalf,
    endHalf: LeaveEndHalf,
    /** Estimated at request; the approved figure once approved. */
    days: z.number(),
    reason: z.string().nullable(),
    status: LeaveRequestStatus,
    /** The reporting manager at request time. Orders the queue; grants nothing. */
    routedToEmployeeId: Uuid.nullable(),
    routedToName: z.string().nullable(),
    /** Whether the caller is the manager this request was routed to. */
    routedToMe: z.boolean(),
    decidedAt: z.string().nullable(),
    decisionNote: z.string().nullable(),
    createdAt: z.string(),
});
export type LeaveRequest = z.infer<typeof LeaveRequest>;
export const LeaveRequestList = z.object({ requests: z.array(LeaveRequest) });
export type LeaveRequestList = z.infer<typeof LeaveRequestList>;
export const LeaveRequestQuery = z.object({ status: LeaveRequestStatus.optional() });
export type LeaveRequestQuery = z.infer<typeof LeaveRequestQuery>;
export const CreateLeaveRequestRequest = z.object({
    employeeId: Uuid,
    leaveTypeId: Uuid,
    startsOn: IsoDate,
    endsOn: IsoDate,
    startHalf: LeaveStartHalf.optional(),
    endHalf: LeaveEndHalf.optional(),
    reason: z.string().trim().max(300).nullable().optional(),
});
export type CreateLeaveRequestRequest = z.infer<typeof CreateLeaveRequestRequest>;
export const LeaveDecisionRequest = z.object({
    note: z.string().trim().max(300).nullable().optional(),
});
export type LeaveDecisionRequest = z.infer<typeof LeaveDecisionRequest>;
