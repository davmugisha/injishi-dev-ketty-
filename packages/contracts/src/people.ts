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
/** 058-people-file AC-PF1. */
export const MaritalStatus = z.enum(["single", "married", "divorced", "widowed"]);
export type MaritalStatus = z.infer<typeof MaritalStatus>;
/** A tag's colour, named by the status vocabulary the screens draw, never a hex. */
export const TagTone = z.enum(["neutral", "info", "ok", "warn", "bad"]);
export type TagTone = z.infer<typeof TagTone>;
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
/** `phone` and `kiosk` arrive with 058-time (AC-TM9, AC-TM10). */
export const AttendanceSource = z.enum(["supervisor", "self", "phone", "kiosk"]);
export type AttendanceSource = z.infer<typeof AttendanceSource>;
/** `closed` becomes `superseded` only when a correction replaces it. */
export const AttendanceStatus = z.enum(["open", "closed", "superseded"]);
export type AttendanceStatus = z.infer<typeof AttendanceStatus>;
/**
 * Why a phone punch waits for a person to validate it (mobile spec 0003, D-ao),
 * in this order: the location reasons first, then `late_sync`, a punch that
 * reached the server more than 30 minutes after its tap.
 */
export const AttendancePendingReason = z.enum([
    "no_location",
    "no_branch_location",
    "poor_accuracy",
    "outside_fence",
    "late_sync",
]);
export type AttendancePendingReason = z.infer<typeof AttendancePendingReason>;
/** What kind of day a record's work date was, for pricing overtime (058-time AC-TM7). */
export const DayKind = z.enum(["weekday", "weekly_off", "public_holiday"]);
export type DayKind = z.infer<typeof DayKind>;
export const LeaveAccrual = z.enum(["yearly_upfront", "monthly", "none"]);
export type LeaveAccrual = z.infer<typeof LeaveAccrual>;
/**
 * What a ledger row records (058-leave AC-LV2). Credits are lots (`accrual`,
 * `carry_forward`, `adjustment`); debits name the lot they draw (`taken`,
 * `encashed`, `expiry`); a `reversal` undoes one `taken` row.
 */
export const LeaveEntryKind = z.enum([
    "accrual",
    "taken",
    "reversal",
    "carry_forward",
    "expiry",
    "adjustment",
    "encashed",
]);
export type LeaveEntryKind = z.infer<typeof LeaveEntryKind>;
/** How a type is paid: `partial` pays `paymentPercent` of the day (AC-LV1). */
export const LeavePayment = z.enum(["paid", "unpaid", "partial"]);
export type LeavePayment = z.infer<typeof LeavePayment>;
/** When unused days stop: each year end, each month end, or never. */
export const LeaveReset = z.enum(["yearly", "monthly", "never"]);
export type LeaveReset = z.infer<typeof LeaveReset>;
/** What a yearly reset carries into the new year. */
export const LeaveCarry = z.enum(["none", "carry", "carry_with_expiry"]);
export type LeaveCarry = z.infer<typeof LeaveCarry>;
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
});
/** A contract as `people.view` reads it: no wage, and no end reason. */
export const EmploymentContractBasic = ContractBase.extend({ view: z.literal("basic") });
export type EmploymentContractBasic = z.infer<typeof EmploymentContractBasic>;
/** A contract as `people.manage` or `payroll.run` reads it. */
export const EmploymentContractFull = ContractBase.extend({
    view: z.literal("full"),
    wageRwf: RwfAmount,
    /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
    endReason: z.string().nullable(),
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
    /** Read through `GET /ops/employees/:id/photo`, a short signed link; a work field. */
    hasPhoto: z.boolean(),
    workPropertyId: Uuid.nullable(),
    workPropertyName: z.string().nullable(),
    jobPositionId: Uuid.nullable(),
    jobPositionTitle: z.string().nullable(),
    reportingManagerId: Uuid.nullable(),
    reportingManagerName: z.string().nullable(),
    hiredOn: IsoDate,
    status: EmployeeStatus,
    offboardedOn: IsoDate.nullable(),
    employeeType: z.object({ id: Uuid, title: z.string() }).nullable(),
    tags: z.array(z.object({ id: Uuid, title: z.string(), tone: TagTone })),
    qualification: z.string().nullable(),
    priorExperienceYears: z.number().int().nullable(),
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
/** A home address: a village of the geography tables, and a street line. */
export const EmployeeAddress = z.object({
    villageId: z.number().int(),
    villageName: z.string(),
    cellName: z.string(),
    sectorName: z.string(),
    districtName: z.string(),
    street: z.string().nullable(),
});
export type EmployeeAddress = z.infer<typeof EmployeeAddress>;
export const EmergencyContact = z.object({
    name: z.string(),
    phone: z.string().nullable(),
    relation: z.string().nullable(),
});
export type EmergencyContact = z.infer<typeof EmergencyContact>;
export const EmployeeFull = EmployeeBase.extend({
    view: z.literal("full"),
    sex: HrSex.nullable(),
    dateOfBirth: IsoDate.nullable(),
    idDocumentType: HrIdDocumentType.nullable(),
    idDocumentNumber: z.string().nullable(),
    rssbNumber: z.string().nullable(),
    maritalStatus: MaritalStatus.nullable(),
    childrenCount: z.number().int().nullable(),
    address: EmployeeAddress.nullable(),
    emergencyContact: EmergencyContact.nullable(),
    /** Why they left, when they have. */
    offboardReason: z.string().nullable(),
    /** Where service based rules count from; the hire date unless a rehire was credited (AC-PF14). */
    serviceFrom: IsoDate,
    /** The file this one rehired. */
    previousEmployeeId: Uuid.nullable(),
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
    /** An active job position of the business (058-people-file AC-PF11). */
    jobPositionId: Uuid.nullable().optional(),
    /**
     * Rehire a leaver as a new file (058-people-file AC-PF14). Sent after a create
     * answered 409 `rehire_available` naming the offboarded file with this ID.
     */
    rehireOf: Uuid.optional(),
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
    /** An active job position; an archived one stays on files that carry it (AC-PF11). */
    jobPositionId: Uuid.nullable(),
    // 058-people-file AC-PF1. Each optional and nullable; a personal value is
    // audited as "changed", never as itself.
    maritalStatus: MaritalStatus.nullable(),
    childrenCount: z.number().int().min(0).max(30).nullable(),
    villageId: z.number().int().positive().nullable(),
    street: z.string().trim().min(1).max(200).nullable(),
    emergencyName: z.string().trim().min(2).max(120).nullable(),
    emergencyPhone: RwPhoneNumber.nullable(),
    emergencyRelation: z.string().trim().min(2).max(60).nullable(),
    qualification: z.string().trim().min(2).max(120).nullable(),
    priorExperienceYears: z.number().int().min(0).max(60).nullable(),
    employeeTypeId: Uuid.nullable(),
    /** The whole set of tags; it replaces the file's tags. */
    tagIds: z.array(Uuid).max(20),
    /** Credit an earlier employment: no later than the hire date (AC-PF14). */
    serviceFrom: IsoDate,
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
    /** 058-payroll: the components the contract carries, and its notice in days. */
    payStructureId: Uuid.nullable().optional(),
    noticeDays: z.number().int().min(0).max(365).nullable().optional(),
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
    /** Overtime counts past this much work; null: the shift's length less its break (058-time AC-TM7). */
    minWorkMinutes: z.number().int().nullable(),
    /** Minutes after the end the sweep closes a record still open (AC-TM4); null: never. */
    autoClockOutMinutes: z.number().int().nullable(),
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
    minWorkMinutes: z.number().int().min(0).max(1440).nullable().optional(),
    autoClockOutMinutes: z.number().int().min(0).max(720).nullable().optional(),
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
    /** Null: a draft, seen only by those who manage the roster (058-time AC-TM1). */
    publishedAt: z.string().nullable(),
    /** Written by a rotation (AC-TM3). */
    generated: z.boolean(),
    /** Written by an approved shift or swap request (AC-TM5). */
    fromRequest: z.boolean(),
});
export type RosterEntry = z.infer<typeof RosterEntry>;
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
/** Whole minutes, floored (058-time AC-TM7). A record with no roster entry has worked minutes and a day kind only. */
export const AttendanceFigures = z.object({
    lateMinutes: z.number().int().nullable(),
    earlyMinutes: z.number().int().nullable(),
    workedMinutes: z.number().int(),
    overtimeMinutes: z.number().int().nullable(),
    /** Null until the policy or a person decides it (AC-TM8). */
    approvedOvertimeMinutes: z.number().int().nullable(),
    dayKind: DayKind.nullable(),
});
export type AttendanceFigures = z.infer<typeof AttendanceFigures>;
export const AttendanceLocation = z.object({
    inDistanceM: z.number().int().nullable(),
    inAccuracyM: z.number().int().nullable(),
    outDistanceM: z.number().int().nullable(),
    outAccuracyM: z.number().int().nullable(),
});
export type AttendanceLocation = z.infer<typeof AttendanceLocation>;
export const AttendanceRecord = z.object({
    id: Uuid,
    employee: RosterCard,
    /** The branch the person works at: what branch limits read and a page groups by. */
    branchId: Uuid.nullable(),
    rosterEntryId: Uuid.nullable(),
    workDate: IsoDate,
    clockInAt: z.string(),
    clockOutAt: z.string().nullable(),
    source: AttendanceSource,
    validated: z.boolean(),
    status: AttendanceStatus,
    supersedesId: Uuid.nullable(),
    note: z.string().nullable(),
    /** Closed by the sweep, not by a person: unvalidated until someone puts the times right (AC-TM4). */
    autoClosed: z.boolean(),
    /** Why the phone clock in waits for validation (mobile spec 0003, D-ao); null for any other punch. */
    inPendingReason: AttendancePendingReason.nullable(),
    /** Why the phone clock out waits for validation; null for any other punch. */
    outPendingReason: AttendancePendingReason.nullable(),
    /**
     * A closed record's work figures (AC-TM7). Null while open, and for a reader
     * outside the figure audience (`attendance.approve` and `people.manage`,
     * AC-TM13): the desk's sheet carries none.
     */
    figures: AttendanceFigures.nullable(),
    /** How far from the branch a phone punch was, for whoever validates it (AC-TM9); never the coordinates. */
    location: AttendanceLocation.nullable(),
});
export type AttendanceRecord = z.infer<typeof AttendanceRecord>;
const Instant = z.string().datetime({ offset: true, message: "A time is an ISO instant." });
export const ClockInRequest = z.object({
    employeeId: Uuid,
    /** At most 5 minutes ahead and 7 days behind the server clock. */
    at: Instant.optional(),
    rosterEntryId: Uuid.optional(),
    /** Why the desk wrote it and who confirmed the time: kept on the record. */
    note: z.string().trim().min(3, "Say who confirmed the time.").max(300).optional(),
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
/** Every rule a leave type carries (058-leave AC-LV1), the fields a type's form edits. */
const LeaveTypeRules = z.object({
    name: z.string().trim().min(1).max(80),
    payment: LeavePayment,
    /** The share of a day's wage a `partial` type pays, 0 to 100. */
    paymentPercent: z.number().int().min(0).max(100).nullable(),
    /** Null: no balance is kept, as for unpaid leave. */
    yearlyEntitlementDays: z.number().min(0).max(366).nullable(),
    accrual: LeaveAccrual,
    reset: LeaveReset,
    carry: LeaveCarry,
    carryMaxDays: z.number().min(0).max(366),
    /** How long a carried lot lives; a compensatory type's days live as long. */
    carryExpiresMonths: z.number().int().min(1).max(12).nullable(),
    /** 0: approved at request; 1 or 2 steps (AC-LV7). */
    approvalSteps: z.number().int().min(0).max(2),
    needsAttachment: z.boolean(),
    /** Inside a range a weekly day off counts as a day of leave, as for maternity leave. */
    countsWeeklyOffs: z.boolean(),
    countsHolidays: z.boolean(),
    eligibleSex: HrSex.nullable(),
    minServiceMonths: z.number().int().min(0).max(600),
    oncePerEmployment: z.boolean(),
    /** Never restricted by a restricted period (AC-LV9). */
    statutory: z.boolean(),
    /** Self service may start it up to 30 days back, as for sick leave. */
    allowsPastRequests: z.boolean(),
    encashable: z.boolean(),
    /** Where compensatory days land (AC-LV8). */
    compensatory: z.boolean(),
    seniorityEveryYears: z.number().int().min(1).max(50).nullable(),
    seniorityExtraDays: z.number().min(0).max(366).nullable(),
    seniorityCapDays: z.number().min(0).max(366).nullable(),
});
/** A type is archived, never deleted: requests and the ledger name it. */
export const LeaveTypeStatus = z.enum(["active", "archived"]);
export type LeaveTypeStatus = z.infer<typeof LeaveTypeStatus>;
export const LeaveType = LeaveTypeRules.extend({
    id: Uuid,
    code: z.string(),
    status: LeaveTypeStatus,
    /** When the owner signed the type off as the business's policy; null while it is the configured value nobody verified. */
    verifiedAt: z.string().nullable().optional(),
    verifiedByName: z.string().nullable().optional(),
});
export type LeaveType = z.infer<typeof LeaveType>;
export const LeaveTypeList = z.object({ types: z.array(LeaveType) });
export type LeaveTypeList = z.infer<typeof LeaveTypeList>;
function leaveTypeRefine(b: Partial<z.infer<typeof LeaveTypeRules>>, ctx: z.RefinementCtx): void {
    if (b.payment !== undefined && (b.payment === "partial") !== (b.paymentPercent !== null && b.paymentPercent !== undefined)) {
        ctx.addIssue({ code: "custom", path: ["paymentPercent"], message: "A partly paid type says what share it pays, and only it does." });
    }
    if (b.carry === "carry_with_expiry" && (b.carryExpiresMonths === null || b.carryExpiresMonths === undefined)) {
        ctx.addIssue({ code: "custom", path: ["carryExpiresMonths"], message: "Say after how many months carried days expire." });
    }
    if (b.reset !== undefined && b.reset !== "yearly" && b.carry !== undefined && b.carry !== "none") {
        ctx.addIssue({ code: "custom", path: ["carry"], message: "Only a type that resets each year carries days over." });
    }
    if (b.seniorityEveryYears !== undefined && (b.seniorityEveryYears === null) !== (b.seniorityExtraDays === null || b.seniorityExtraDays === undefined)) {
        ctx.addIssue({ code: "custom", path: ["seniorityExtraDays"], message: "A seniority rule names both its years and its extra days." });
    }
}
/** `POST /ops/leave/types`: a business's own type. */
export const CreateLeaveTypeRequest = LeaveTypeRules.extend({
    code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,30}$/, "A code is lower case letters, digits and underscores."),
}).superRefine(leaveTypeRefine);
export type CreateLeaveTypeRequest = z.infer<typeof CreateLeaveTypeRequest>;
/**
 * `PATCH /ops/leave/types/:id`: whole rule groups at once, so a check across
 * fields always sees both. An edit applies to requests made after it.
 */
export const UpdateLeaveTypeRequest = LeaveTypeRules.extend({ status: LeaveTypeStatus })
    .partial()
    .superRefine(leaveTypeRefine)
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateLeaveTypeRequest = z.infer<typeof UpdateLeaveTypeRequest>;
export const LeaveLedgerEntry = z.object({
    id: Uuid,
    kind: LeaveEntryKind,
    /** Signed: credits add, debits subtract, a reversal undoes. */
    days: z.number(),
    effectiveOn: IsoDate,
    periodKey: z.string().nullable(),
    leaveRequestId: Uuid.nullable(),
    reason: z.string().nullable(),
    /** A credit's last day plus one (AC-LV2). */
    expiresOn: IsoDate.nullable(),
    /** The credit a debit draws from. */
    lotId: Uuid.nullable(),
});
export type LeaveLedgerEntry = z.infer<typeof LeaveLedgerEntry>;
/** One credit and what is left of it (AC-LV2): why a person has 4 days, not 6. */
export const LeaveLot = z.object({
    id: Uuid,
    kind: z.enum(["accrual", "carry_forward", "adjustment"]),
    effectiveOn: IsoDate,
    /** The last day it can be spent: its own expiry or its year's (or month's) end. */
    usableUntil: IsoDate.nullable(),
    creditDays: z.number(),
    remainingDays: z.number(),
});
export type LeaveLot = z.infer<typeof LeaveLot>;
/** A balance is only ever the sum of the ledger (AC-L4). */
export const LeaveBalance = z.object({
    leaveType: LeaveType,
    /** Null for a type that keeps no balance. */
    balanceDays: z.number().nullable(),
    /** The lots with days left, soonest to expire first. */
    lots: z.array(LeaveLot),
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
    /** The branch the person works at: what branch limits read and a page groups by. */
    branchId: Uuid.nullable(),
    leaveType: z.object({ id: Uuid, code: z.string(), name: z.string() }),
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
    // --- 058-leave: the terms it was made under, its steps and its note ---
    payment: LeavePayment,
    paymentPercent: z.number().nullable(),
    /** 0, 1 or 2, copied from the type at request (AC-LV7). */
    approvalSteps: z.number().int(),
    /** The step a waiting request is at. */
    currentStep: z.number().int(),
    /** Each step decided so far, in order. */
    approvals: z.array(z.object({
        step: z.number().int(),
        decision: z.enum(["approved", "rejected", "skipped"]),
        decidedByName: z.string().nullable(),
        note: z.string().nullable(),
        decidedAt: z.string(),
    })),
    /** A sick note or the like is attached; read it through its own route. */
    hasAttachment: z.boolean(),
});
export type LeaveRequest = z.infer<typeof LeaveRequest>;
/** The fields a person and the office both ask with (058-leave AC-LV6). */
export const LeaveAsk = z.object({
    leaveTypeId: Uuid,
    startsOn: IsoDate,
    endsOn: IsoDate,
    startHalf: LeaveStartHalf.optional(),
    endHalf: LeaveEndHalf.optional(),
    reason: z.string().trim().max(300).nullable().optional(),
    /** An uploaded attachment's key (`POST /ops/hr/files` or `/me/work/:id/files`, purpose `attachment`). */
    attachmentKey: z.string().trim().min(1).max(300).nullable().optional(),
});
export const CreateLeaveRequestRequest = LeaveAsk.extend({ employeeId: Uuid });
export type CreateLeaveRequestRequest = z.infer<typeof CreateLeaveRequestRequest>;
/** The same through self service: the person's own file is the path. */
export const CreateMyLeaveRequestRequest = LeaveAsk;
export type CreateMyLeaveRequestRequest = z.infer<typeof CreateMyLeaveRequestRequest>;
export const LeaveDecisionRequest = z.object({
    note: z.string().trim().max(300).nullable().optional(),
});
export type LeaveDecisionRequest = z.infer<typeof LeaveDecisionRequest>;
