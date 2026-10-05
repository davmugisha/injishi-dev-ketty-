"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRecord = exports.AttendanceLocation = exports.AttendanceFigures = exports.CancelRosterEntryRequest = exports.CreateRosterEntryRequest = exports.RosterEntry = exports.CreateShiftTemplateRequest = exports.ShiftTemplateQuery = exports.ShiftTemplateList = exports.ShiftTemplate = exports.ShiftTemplateStatus = exports.OffboardEmployeeRequest = exports.CreateContractResponse = exports.CreateContractRequest = exports.UpdateEmployeeRequest = exports.CreateEmployeeRequest = exports.EmployeeFile = exports.EmployeeDepartment = exports.Employee = exports.EmployeeFull = exports.EmergencyContact = exports.EmployeeAddress = exports.EmployeeBasic = exports.EmploymentContract = exports.EmploymentContractFull = exports.EmploymentContractBasic = exports.RosterCard = exports.EMPLOYEE_MISSING_DETAIL_LABEL = exports.EmployeeMissingDetail = exports.TimeOfDay = exports.LeaveEndHalf = exports.LeaveStartHalf = exports.LeaveRequestStatus = exports.LeaveCarry = exports.LeaveReset = exports.LeavePayment = exports.LeaveEntryKind = exports.LeaveAccrual = exports.DayKind = exports.AttendanceStatus = exports.AttendanceSource = exports.RosterStatus = exports.ContractStatus = exports.WageBasis = exports.ContractType = exports.EmployeeStatus = exports.HrIdDocumentType = exports.TagTone = exports.MaritalStatus = exports.HrSex = void 0;
exports.LeaveDecisionRequest = exports.CreateMyLeaveRequestRequest = exports.CreateLeaveRequestRequest = exports.LeaveAsk = exports.LeaveRequest = exports.LeaveBalances = exports.LeaveBalance = exports.LeaveLot = exports.LeaveLedgerEntry = exports.UpdateLeaveTypeRequest = exports.CreateLeaveTypeRequest = exports.LeaveTypeList = exports.LeaveType = exports.LeaveTypeStatus = exports.CorrectAttendanceRequest = exports.ClockOutRequest = exports.ClockInRequest = void 0;
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
/** 058-people-file AC-PF1. */
exports.MaritalStatus = zod_1.z.enum(["single", "married", "divorced", "widowed"]);
/** A tag's colour, named by the status vocabulary the screens draw, never a hex. */
exports.TagTone = zod_1.z.enum(["neutral", "info", "ok", "warn", "bad"]);
exports.HrIdDocumentType = zod_1.z.enum(["national_id", "passport"]);
/** `active` then `offboarded`, with no way back (rehiring is a later decision). */
exports.EmployeeStatus = zod_1.z.enum(["active", "offboarded"]);
exports.ContractType = zod_1.z.enum(["permanent", "fixed_term", "casual"]);
exports.WageBasis = zod_1.z.enum(["monthly", "daily", "hourly"]);
/** For display and the one active contract index. Pay reads the dates. */
exports.ContractStatus = zod_1.z.enum(["scheduled", "active", "ended"]);
exports.RosterStatus = zod_1.z.enum(["scheduled", "cancelled"]);
/** Who wrote the record. A `self` record waits for validation. */
/** `phone` and `kiosk` arrive with 058-time (AC-TM9, AC-TM10). */
exports.AttendanceSource = zod_1.z.enum(["supervisor", "self", "phone", "kiosk"]);
/** `closed` becomes `superseded` only when a correction replaces it. */
exports.AttendanceStatus = zod_1.z.enum(["open", "closed", "superseded"]);
/** What kind of day a record's work date was, for pricing overtime (058-time AC-TM7). */
exports.DayKind = zod_1.z.enum(["weekday", "weekly_off", "public_holiday"]);
exports.LeaveAccrual = zod_1.z.enum(["yearly_upfront", "monthly", "none"]);
/**
 * What a ledger row records (058-leave AC-LV2). Credits are lots (`accrual`,
 * `carry_forward`, `adjustment`); debits name the lot they draw (`taken`,
 * `encashed`, `expiry`); a `reversal` undoes one `taken` row.
 */
exports.LeaveEntryKind = zod_1.z.enum([
    "accrual",
    "taken",
    "reversal",
    "carry_forward",
    "expiry",
    "adjustment",
    "encashed",
]);
/** How a type is paid: `partial` pays `paymentPercent` of the day (AC-LV1). */
exports.LeavePayment = zod_1.z.enum(["paid", "unpaid", "partial"]);
/** When unused days stop: each year end, each month end, or never. */
exports.LeaveReset = zod_1.z.enum(["yearly", "monthly", "never"]);
/** What a yearly reset carries into the new year. */
exports.LeaveCarry = zod_1.z.enum(["none", "carry", "carry_with_expiry"]);
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
});
/** A contract as `people.view` reads it: no wage, and no end reason. */
exports.EmploymentContractBasic = ContractBase.extend({ view: zod_1.z.literal("basic") });
/** A contract as `people.manage` or `payroll.run` reads it. */
exports.EmploymentContractFull = ContractBase.extend({
    view: zod_1.z.literal("full"),
    wageRwf: primitives_1.RwfAmount,
    /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
    endReason: zod_1.z.string().nullable(),
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
    /** Read through `GET /ops/employees/:id/photo`, a short signed link; a work field. */
    hasPhoto: zod_1.z.boolean(),
    workPropertyId: primitives_1.Uuid.nullable(),
    workPropertyName: zod_1.z.string().nullable(),
    jobPositionId: primitives_1.Uuid.nullable(),
    jobPositionTitle: zod_1.z.string().nullable(),
    reportingManagerId: primitives_1.Uuid.nullable(),
    reportingManagerName: zod_1.z.string().nullable(),
    hiredOn: booking_1.IsoDate,
    status: exports.EmployeeStatus,
    offboardedOn: booking_1.IsoDate.nullable(),
    employeeType: zod_1.z.object({ id: primitives_1.Uuid, title: zod_1.z.string() }).nullable(),
    tags: zod_1.z.array(zod_1.z.object({ id: primitives_1.Uuid, title: zod_1.z.string(), tone: exports.TagTone })),
    qualification: zod_1.z.string().nullable(),
    priorExperienceYears: zod_1.z.number().int().nullable(),
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
/** A home address: a village of the geography tables, and a street line. */
exports.EmployeeAddress = zod_1.z.object({
    villageId: zod_1.z.number().int(),
    villageName: zod_1.z.string(),
    cellName: zod_1.z.string(),
    sectorName: zod_1.z.string(),
    districtName: zod_1.z.string(),
    street: zod_1.z.string().nullable(),
});
exports.EmergencyContact = zod_1.z.object({
    name: zod_1.z.string(),
    phone: zod_1.z.string().nullable(),
    relation: zod_1.z.string().nullable(),
});
exports.EmployeeFull = EmployeeBase.extend({
    view: zod_1.z.literal("full"),
    sex: exports.HrSex.nullable(),
    dateOfBirth: booking_1.IsoDate.nullable(),
    idDocumentType: exports.HrIdDocumentType.nullable(),
    idDocumentNumber: zod_1.z.string().nullable(),
    rssbNumber: zod_1.z.string().nullable(),
    maritalStatus: exports.MaritalStatus.nullable(),
    childrenCount: zod_1.z.number().int().nullable(),
    address: exports.EmployeeAddress.nullable(),
    emergencyContact: exports.EmergencyContact.nullable(),
    /** Why they left, when they have. */
    offboardReason: zod_1.z.string().nullable(),
    /** Where service based rules count from; the hire date unless a rehire was credited (AC-PF14). */
    serviceFrom: booking_1.IsoDate,
    /** The file this one rehired. */
    previousEmployeeId: primitives_1.Uuid.nullable(),
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
    /** An active job position of the business (058-people-file AC-PF11). */
    jobPositionId: primitives_1.Uuid.nullable().optional(),
    /**
     * Rehire a leaver as a new file (058-people-file AC-PF14). Sent after a create
     * answered 409 `rehire_available` naming the offboarded file with this ID.
     */
    rehireOf: primitives_1.Uuid.optional(),
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
    /** An active job position; an archived one stays on files that carry it (AC-PF11). */
    jobPositionId: primitives_1.Uuid.nullable(),
    // 058-people-file AC-PF1. Each optional and nullable; a personal value is
    // audited as "changed", never as itself.
    maritalStatus: exports.MaritalStatus.nullable(),
    childrenCount: zod_1.z.number().int().min(0).max(30).nullable(),
    villageId: zod_1.z.number().int().positive().nullable(),
    street: zod_1.z.string().trim().min(1).max(200).nullable(),
    emergencyName: zod_1.z.string().trim().min(2).max(120).nullable(),
    emergencyPhone: phone_1.RwPhoneNumber.nullable(),
    emergencyRelation: zod_1.z.string().trim().min(2).max(60).nullable(),
    qualification: zod_1.z.string().trim().min(2).max(120).nullable(),
    priorExperienceYears: zod_1.z.number().int().min(0).max(60).nullable(),
    employeeTypeId: primitives_1.Uuid.nullable(),
    /** The whole set of tags; it replaces the file's tags. */
    tagIds: zod_1.z.array(primitives_1.Uuid).max(20),
    /** Credit an earlier employment: no later than the hire date (AC-PF14). */
    serviceFrom: booking_1.IsoDate,
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
    /** 058-payroll: the components the contract carries, and its notice in days. */
    payStructureId: primitives_1.Uuid.nullable().optional(),
    noticeDays: zod_1.z.number().int().min(0).max(365).nullable().optional(),
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
    /** Overtime counts past this much work; null: the shift's length less its break (058-time AC-TM7). */
    minWorkMinutes: zod_1.z.number().int().nullable(),
    /** Minutes after the end the sweep closes a record still open (AC-TM4); null: never. */
    autoClockOutMinutes: zod_1.z.number().int().nullable(),
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
    minWorkMinutes: zod_1.z.number().int().min(0).max(1440).nullable().optional(),
    autoClockOutMinutes: zod_1.z.number().int().min(0).max(720).nullable().optional(),
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
    /** Null: a draft, seen only by those who manage the roster (058-time AC-TM1). */
    publishedAt: zod_1.z.string().nullable(),
    /** Written by a rotation (AC-TM3). */
    generated: zod_1.z.boolean(),
    /** Written by an approved shift or swap request (AC-TM5). */
    fromRequest: zod_1.z.boolean(),
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
/** Whole minutes, floored (058-time AC-TM7). A record with no roster entry has worked minutes and a day kind only. */
exports.AttendanceFigures = zod_1.z.object({
    lateMinutes: zod_1.z.number().int().nullable(),
    earlyMinutes: zod_1.z.number().int().nullable(),
    workedMinutes: zod_1.z.number().int(),
    overtimeMinutes: zod_1.z.number().int().nullable(),
    /** Null until the policy or a person decides it (AC-TM8). */
    approvedOvertimeMinutes: zod_1.z.number().int().nullable(),
    dayKind: exports.DayKind.nullable(),
});
exports.AttendanceLocation = zod_1.z.object({
    inDistanceM: zod_1.z.number().int().nullable(),
    inAccuracyM: zod_1.z.number().int().nullable(),
    outDistanceM: zod_1.z.number().int().nullable(),
    outAccuracyM: zod_1.z.number().int().nullable(),
});
exports.AttendanceRecord = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: exports.RosterCard,
    /** The branch the person works at: what branch limits read and a page groups by. */
    branchId: primitives_1.Uuid.nullable(),
    rosterEntryId: primitives_1.Uuid.nullable(),
    workDate: booking_1.IsoDate,
    clockInAt: zod_1.z.string(),
    clockOutAt: zod_1.z.string().nullable(),
    source: exports.AttendanceSource,
    validated: zod_1.z.boolean(),
    status: exports.AttendanceStatus,
    supersedesId: primitives_1.Uuid.nullable(),
    note: zod_1.z.string().nullable(),
    /** Closed by the sweep, not by a person: unvalidated until someone puts the times right (AC-TM4). */
    autoClosed: zod_1.z.boolean(),
    /**
     * A closed record's work figures (AC-TM7). Null while open, and for a reader
     * outside the figure audience (`attendance.approve` and `people.manage`,
     * AC-TM13): the desk's sheet carries none.
     */
    figures: exports.AttendanceFigures.nullable(),
    /** How far from the branch a phone punch was, for whoever validates it (AC-TM9); never the coordinates. */
    location: exports.AttendanceLocation.nullable(),
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
/** Every rule a leave type carries (058-leave AC-LV1), the fields a type's form edits. */
const LeaveTypeRules = zod_1.z.object({
    name: zod_1.z.string().trim().min(1).max(80),
    payment: exports.LeavePayment,
    /** The share of a day's wage a `partial` type pays, 0 to 100. */
    paymentPercent: zod_1.z.number().int().min(0).max(100).nullable(),
    /** Null: no balance is kept, as for unpaid leave. */
    yearlyEntitlementDays: zod_1.z.number().min(0).max(366).nullable(),
    accrual: exports.LeaveAccrual,
    reset: exports.LeaveReset,
    carry: exports.LeaveCarry,
    carryMaxDays: zod_1.z.number().min(0).max(366),
    /** How long a carried lot lives; a compensatory type's days live as long. */
    carryExpiresMonths: zod_1.z.number().int().min(1).max(12).nullable(),
    /** 0: approved at request; 1 or 2 steps (AC-LV7). */
    approvalSteps: zod_1.z.number().int().min(0).max(2),
    needsAttachment: zod_1.z.boolean(),
    /** Inside a range a weekly day off counts as a day of leave, as for maternity leave. */
    countsWeeklyOffs: zod_1.z.boolean(),
    countsHolidays: zod_1.z.boolean(),
    eligibleSex: exports.HrSex.nullable(),
    minServiceMonths: zod_1.z.number().int().min(0).max(600),
    oncePerEmployment: zod_1.z.boolean(),
    /** Never restricted by a restricted period (AC-LV9). */
    statutory: zod_1.z.boolean(),
    /** Self service may start it up to 30 days back, as for sick leave. */
    allowsPastRequests: zod_1.z.boolean(),
    encashable: zod_1.z.boolean(),
    /** Where compensatory days land (AC-LV8). */
    compensatory: zod_1.z.boolean(),
    seniorityEveryYears: zod_1.z.number().int().min(1).max(50).nullable(),
    seniorityExtraDays: zod_1.z.number().min(0).max(366).nullable(),
    seniorityCapDays: zod_1.z.number().min(0).max(366).nullable(),
});
/** A type is archived, never deleted: requests and the ledger name it. */
exports.LeaveTypeStatus = zod_1.z.enum(["active", "archived"]);
exports.LeaveType = LeaveTypeRules.extend({
    id: primitives_1.Uuid,
    code: zod_1.z.string(),
    status: exports.LeaveTypeStatus,
});
exports.LeaveTypeList = zod_1.z.object({ types: zod_1.z.array(exports.LeaveType) });
function leaveTypeRefine(b, ctx) {
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
exports.CreateLeaveTypeRequest = LeaveTypeRules.extend({
    code: zod_1.z.string().trim().regex(/^[a-z][a-z0-9_]{1,30}$/, "A code is lower case letters, digits and underscores."),
}).superRefine(leaveTypeRefine);
/**
 * `PATCH /ops/leave/types/:id`: whole rule groups at once, so a check across
 * fields always sees both. An edit applies to requests made after it.
 */
exports.UpdateLeaveTypeRequest = LeaveTypeRules.extend({ status: exports.LeaveTypeStatus })
    .partial()
    .superRefine(leaveTypeRefine)
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
exports.LeaveLedgerEntry = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: exports.LeaveEntryKind,
    /** Signed: credits add, debits subtract, a reversal undoes. */
    days: zod_1.z.number(),
    effectiveOn: booking_1.IsoDate,
    periodKey: zod_1.z.string().nullable(),
    leaveRequestId: primitives_1.Uuid.nullable(),
    reason: zod_1.z.string().nullable(),
    /** A credit's last day plus one (AC-LV2). */
    expiresOn: booking_1.IsoDate.nullable(),
    /** The credit a debit draws from. */
    lotId: primitives_1.Uuid.nullable(),
});
/** One credit and what is left of it (AC-LV2): why a person has 4 days, not 6. */
exports.LeaveLot = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: zod_1.z.enum(["accrual", "carry_forward", "adjustment"]),
    effectiveOn: booking_1.IsoDate,
    /** The last day it can be spent: its own expiry or its year's (or month's) end. */
    usableUntil: booking_1.IsoDate.nullable(),
    creditDays: zod_1.z.number(),
    remainingDays: zod_1.z.number(),
});
/** A balance is only ever the sum of the ledger (AC-L4). */
exports.LeaveBalance = zod_1.z.object({
    leaveType: exports.LeaveType,
    /** Null for a type that keeps no balance. */
    balanceDays: zod_1.z.number().nullable(),
    /** The lots with days left, soonest to expire first. */
    lots: zod_1.z.array(exports.LeaveLot),
    entries: zod_1.z.array(exports.LeaveLedgerEntry),
});
exports.LeaveBalances = zod_1.z.object({
    employeeId: primitives_1.Uuid,
    balances: zod_1.z.array(exports.LeaveBalance),
});
exports.LeaveRequest = zod_1.z.object({
    id: primitives_1.Uuid,
    employee: exports.RosterCard,
    /** The branch the person works at: what branch limits read and a page groups by. */
    branchId: primitives_1.Uuid.nullable(),
    leaveType: zod_1.z.object({ id: primitives_1.Uuid, code: zod_1.z.string(), name: zod_1.z.string() }),
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
    // --- 058-leave: the terms it was made under, its steps and its note ---
    payment: exports.LeavePayment,
    paymentPercent: zod_1.z.number().nullable(),
    /** 0, 1 or 2, copied from the type at request (AC-LV7). */
    approvalSteps: zod_1.z.number().int(),
    /** The step a waiting request is at. */
    currentStep: zod_1.z.number().int(),
    /** Each step decided so far, in order. */
    approvals: zod_1.z.array(zod_1.z.object({
        step: zod_1.z.number().int(),
        decision: zod_1.z.enum(["approved", "rejected", "skipped"]),
        decidedByName: zod_1.z.string().nullable(),
        note: zod_1.z.string().nullable(),
        decidedAt: zod_1.z.string(),
    })),
    /** A sick note or the like is attached; read it through its own route. */
    hasAttachment: zod_1.z.boolean(),
});
/** The fields a person and the office both ask with (058-leave AC-LV6). */
exports.LeaveAsk = zod_1.z.object({
    leaveTypeId: primitives_1.Uuid,
    startsOn: booking_1.IsoDate,
    endsOn: booking_1.IsoDate,
    startHalf: exports.LeaveStartHalf.optional(),
    endHalf: exports.LeaveEndHalf.optional(),
    reason: zod_1.z.string().trim().max(300).nullable().optional(),
    /** An uploaded attachment's key (`POST /ops/hr/files` or `/me/work/:id/files`, purpose `attachment`). */
    attachmentKey: zod_1.z.string().trim().min(1).max(300).nullable().optional(),
});
exports.CreateLeaveRequestRequest = exports.LeaveAsk.extend({ employeeId: primitives_1.Uuid });
/** The same through self service: the person's own file is the path. */
exports.CreateMyLeaveRequestRequest = exports.LeaveAsk;
exports.LeaveDecisionRequest = zod_1.z.object({
    note: zod_1.z.string().trim().max(300).nullable().optional(),
});
//# sourceMappingURL=people.js.map