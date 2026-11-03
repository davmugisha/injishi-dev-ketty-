import { z } from "zod";
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
export declare const HrSex: z.ZodEnum<["female", "male"]>;
/** 058-people-file AC-PF1. */
export declare const MaritalStatus: z.ZodEnum<["single", "married", "divorced", "widowed"]>;
export type MaritalStatus = z.infer<typeof MaritalStatus>;
/** A tag's colour, named by the status vocabulary the screens draw, never a hex. */
export declare const TagTone: z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>;
export type TagTone = z.infer<typeof TagTone>;
export type HrSex = z.infer<typeof HrSex>;
export declare const HrIdDocumentType: z.ZodEnum<["national_id", "passport"]>;
export type HrIdDocumentType = z.infer<typeof HrIdDocumentType>;
/** `active` then `offboarded`, with no way back (rehiring is a later decision). */
export declare const EmployeeStatus: z.ZodEnum<["active", "offboarded"]>;
export type EmployeeStatus = z.infer<typeof EmployeeStatus>;
export declare const ContractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
export type ContractType = z.infer<typeof ContractType>;
export declare const WageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
export type WageBasis = z.infer<typeof WageBasis>;
/** For display and the one active contract index. Pay reads the dates. */
export declare const ContractStatus: z.ZodEnum<["scheduled", "active", "ended"]>;
export type ContractStatus = z.infer<typeof ContractStatus>;
export declare const RosterStatus: z.ZodEnum<["scheduled", "cancelled"]>;
export type RosterStatus = z.infer<typeof RosterStatus>;
/** Who wrote the record. A `self` record waits for validation. */
/** `phone` and `kiosk` arrive with 058-time (AC-TM9, AC-TM10). */
export declare const AttendanceSource: z.ZodEnum<["supervisor", "self", "phone", "kiosk"]>;
export type AttendanceSource = z.infer<typeof AttendanceSource>;
/** `closed` becomes `superseded` only when a correction replaces it. */
export declare const AttendanceStatus: z.ZodEnum<["open", "closed", "superseded"]>;
export type AttendanceStatus = z.infer<typeof AttendanceStatus>;
/**
 * Why a phone punch waits for a person to validate it (mobile spec 0003, D-ao),
 * in this order: the location reasons first, then `late_sync`, a punch that
 * reached the server more than 30 minutes after its tap.
 */
export declare const AttendancePendingReason: z.ZodEnum<["no_location", "no_branch_location", "poor_accuracy", "outside_fence", "late_sync"]>;
export type AttendancePendingReason = z.infer<typeof AttendancePendingReason>;
/** What kind of day a record's work date was, for pricing overtime (058-time AC-TM7). */
export declare const DayKind: z.ZodEnum<["weekday", "weekly_off", "public_holiday"]>;
export type DayKind = z.infer<typeof DayKind>;
export declare const LeaveAccrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
export type LeaveAccrual = z.infer<typeof LeaveAccrual>;
/**
 * What a ledger row records (058-leave AC-LV2). Credits are lots (`accrual`,
 * `carry_forward`, `adjustment`); debits name the lot they draw (`taken`,
 * `encashed`, `expiry`); a `reversal` undoes one `taken` row.
 */
export declare const LeaveEntryKind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment", "encashed"]>;
export type LeaveEntryKind = z.infer<typeof LeaveEntryKind>;
/** How a type is paid: `partial` pays `paymentPercent` of the day (AC-LV1). */
export declare const LeavePayment: z.ZodEnum<["paid", "unpaid", "partial"]>;
export type LeavePayment = z.infer<typeof LeavePayment>;
/** When unused days stop: each year end, each month end, or never. */
export declare const LeaveReset: z.ZodEnum<["yearly", "monthly", "never"]>;
export type LeaveReset = z.infer<typeof LeaveReset>;
/** What a yearly reset carries into the new year. */
export declare const LeaveCarry: z.ZodEnum<["none", "carry", "carry_with_expiry"]>;
export type LeaveCarry = z.infer<typeof LeaveCarry>;
export declare const LeaveRequestStatus: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
export type LeaveRequestStatus = z.infer<typeof LeaveRequestStatus>;
/** A leave may start in the afternoon of its first day... */
export declare const LeaveStartHalf: z.ZodEnum<["full", "second_half"]>;
export type LeaveStartHalf = z.infer<typeof LeaveStartHalf>;
/** ...and end at lunch on its last. */
export declare const LeaveEndHalf: z.ZodEnum<["full", "first_half"]>;
export type LeaveEndHalf = z.infer<typeof LeaveEndHalf>;
/** `HH:MM`, 24 hour, the wall clock at the branch. */
export declare const TimeOfDay: z.ZodString;
export type TimeOfDay = z.infer<typeof TimeOfDay>;
/**
 * Which fields a file still lacks before it can carry a contract.
 *
 * A file backfilled from a membership (AC-P5) starts with all of them empty; a
 * file created through the API cannot, because the create route requires them.
 */
export declare const EmployeeMissingDetail: z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>;
export type EmployeeMissingDetail = z.infer<typeof EmployeeMissingDetail>;
export declare const EMPLOYEE_MISSING_DETAIL_LABEL: Readonly<Record<EmployeeMissingDetail, string>>;
/**
 * The only part of a file a roster or an attendance sheet ever carries.
 *
 * `attendance.record` is held by the front desk, so what the desk sees of a
 * colleague is a name and a job title and nothing else from the file.
 */
export declare const RosterCard: z.ZodObject<{
    employeeId: z.ZodString;
    /** The preferred name, else the legal name. */
    displayName: z.ZodString;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    displayName: string;
    jobPositionTitle: string | null;
}, {
    employeeId: string;
    displayName: string;
    jobPositionTitle: string | null;
}>;
export type RosterCard = z.infer<typeof RosterCard>;
/** A contract as `people.view` reads it: no wage, and no end reason. */
export declare const EmploymentContractBasic: z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
    startsOn: z.ZodString;
    /** Null: open ended. */
    endsOn: z.ZodNullable<z.ZodString>;
    wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
    status: z.ZodEnum<["scheduled", "active", "ended"]>;
} & {
    view: z.ZodLiteral<"basic">;
}, "strip", z.ZodTypeAny, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    view: "basic";
}, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    view: "basic";
}>;
export type EmploymentContractBasic = z.infer<typeof EmploymentContractBasic>;
/** A contract as `people.manage` or `payroll.run` reads it. */
export declare const EmploymentContractFull: z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
    startsOn: z.ZodString;
    /** Null: open ended. */
    endsOn: z.ZodNullable<z.ZodString>;
    wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
    status: z.ZodEnum<["scheduled", "active", "ended"]>;
} & {
    view: z.ZodLiteral<"full">;
    wageRwf: z.ZodNumber;
    /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
    endReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    view: "full";
    wageRwf: number;
    endReason: string | null;
}, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    view: "full";
    wageRwf: number;
    endReason: string | null;
}>;
export type EmploymentContractFull = z.infer<typeof EmploymentContractFull>;
export declare const EmploymentContract: z.ZodDiscriminatedUnion<"view", [z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
    startsOn: z.ZodString;
    /** Null: open ended. */
    endsOn: z.ZodNullable<z.ZodString>;
    wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
    status: z.ZodEnum<["scheduled", "active", "ended"]>;
} & {
    view: z.ZodLiteral<"basic">;
}, "strip", z.ZodTypeAny, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    view: "basic";
}, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    view: "basic";
}>, z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
    startsOn: z.ZodString;
    /** Null: open ended. */
    endsOn: z.ZodNullable<z.ZodString>;
    wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
    status: z.ZodEnum<["scheduled", "active", "ended"]>;
} & {
    view: z.ZodLiteral<"full">;
    wageRwf: z.ZodNumber;
    /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
    endReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    view: "full";
    wageRwf: number;
    endReason: string | null;
}, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    view: "full";
    wageRwf: number;
    endReason: string | null;
}>]>;
export type EmploymentContract = z.infer<typeof EmploymentContract>;
/** A file as `people.view` reads it (AC-P2). */
export declare const EmployeeBasic: z.ZodObject<{
    id: z.ZodString;
    employeeNumber: z.ZodString;
    legalName: z.ZodString;
    preferredName: z.ZodNullable<z.ZodString>;
    displayName: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    /** Read through `GET /ops/employees/:id/photo`, a short signed link; a work field. */
    hasPhoto: z.ZodBoolean;
    workPropertyId: z.ZodNullable<z.ZodString>;
    workPropertyName: z.ZodNullable<z.ZodString>;
    jobPositionId: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    reportingManagerId: z.ZodNullable<z.ZodString>;
    reportingManagerName: z.ZodNullable<z.ZodString>;
    hiredOn: z.ZodString;
    status: z.ZodEnum<["active", "offboarded"]>;
    offboardedOn: z.ZodNullable<z.ZodString>;
    employeeType: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
    }, {
        id: string;
        title: string;
    }>>;
    tags: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        tone: z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }, {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }>, "many">;
    qualification: z.ZodNullable<z.ZodString>;
    priorExperienceYears: z.ZodNullable<z.ZodNumber>;
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.ZodBoolean;
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
    detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
} & {
    view: z.ZodLiteral<"basic">;
    currentContract: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
    } & {
        view: z.ZodLiteral<"basic">;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    id: string;
    email: string | null;
    legalName: string;
    phone: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "basic";
    employeeNumber: string;
    preferredName: string | null;
    hasPhoto: boolean;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    employeeType: {
        id: string;
        title: string;
    } | null;
    tags: {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }[];
    qualification: string | null;
    priorExperienceYears: number | null;
    hasAccount: boolean;
    detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
    currentContract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    } | null;
}, {
    status: "active" | "offboarded";
    id: string;
    email: string | null;
    legalName: string;
    phone: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "basic";
    employeeNumber: string;
    preferredName: string | null;
    hasPhoto: boolean;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    employeeType: {
        id: string;
        title: string;
    } | null;
    tags: {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }[];
    qualification: string | null;
    priorExperienceYears: number | null;
    hasAccount: boolean;
    detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
    currentContract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    } | null;
}>;
export type EmployeeBasic = z.infer<typeof EmployeeBasic>;
/** A file with the sensitive fields, for `people.manage` or `payroll.run`. */
/** A home address: a village of the geography tables, and a street line. */
export declare const EmployeeAddress: z.ZodObject<{
    villageId: z.ZodNumber;
    villageName: z.ZodString;
    cellName: z.ZodString;
    sectorName: z.ZodString;
    districtName: z.ZodString;
    street: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    districtName: string;
    villageId: number;
    street: string | null;
    sectorName: string;
    villageName: string;
    cellName: string;
}, {
    districtName: string;
    villageId: number;
    street: string | null;
    sectorName: string;
    villageName: string;
    cellName: string;
}>;
export type EmployeeAddress = z.infer<typeof EmployeeAddress>;
export declare const EmergencyContact: z.ZodObject<{
    name: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    relation: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    phone: string | null;
    relation: string | null;
}, {
    name: string;
    phone: string | null;
    relation: string | null;
}>;
export type EmergencyContact = z.infer<typeof EmergencyContact>;
export declare const EmployeeFull: z.ZodObject<{
    id: z.ZodString;
    employeeNumber: z.ZodString;
    legalName: z.ZodString;
    preferredName: z.ZodNullable<z.ZodString>;
    displayName: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    /** Read through `GET /ops/employees/:id/photo`, a short signed link; a work field. */
    hasPhoto: z.ZodBoolean;
    workPropertyId: z.ZodNullable<z.ZodString>;
    workPropertyName: z.ZodNullable<z.ZodString>;
    jobPositionId: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    reportingManagerId: z.ZodNullable<z.ZodString>;
    reportingManagerName: z.ZodNullable<z.ZodString>;
    hiredOn: z.ZodString;
    status: z.ZodEnum<["active", "offboarded"]>;
    offboardedOn: z.ZodNullable<z.ZodString>;
    employeeType: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
    }, {
        id: string;
        title: string;
    }>>;
    tags: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        tone: z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }, {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }>, "many">;
    qualification: z.ZodNullable<z.ZodString>;
    priorExperienceYears: z.ZodNullable<z.ZodNumber>;
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.ZodBoolean;
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
    detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
} & {
    view: z.ZodLiteral<"full">;
    sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    dateOfBirth: z.ZodNullable<z.ZodString>;
    idDocumentType: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
    idDocumentNumber: z.ZodNullable<z.ZodString>;
    rssbNumber: z.ZodNullable<z.ZodString>;
    maritalStatus: z.ZodNullable<z.ZodEnum<["single", "married", "divorced", "widowed"]>>;
    childrenCount: z.ZodNullable<z.ZodNumber>;
    address: z.ZodNullable<z.ZodObject<{
        villageId: z.ZodNumber;
        villageName: z.ZodString;
        cellName: z.ZodString;
        sectorName: z.ZodString;
        districtName: z.ZodString;
        street: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        districtName: string;
        villageId: number;
        street: string | null;
        sectorName: string;
        villageName: string;
        cellName: string;
    }, {
        districtName: string;
        villageId: number;
        street: string | null;
        sectorName: string;
        villageName: string;
        cellName: string;
    }>>;
    emergencyContact: z.ZodNullable<z.ZodObject<{
        name: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
        relation: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        phone: string | null;
        relation: string | null;
    }, {
        name: string;
        phone: string | null;
        relation: string | null;
    }>>;
    /** Why they left, when they have. */
    offboardReason: z.ZodNullable<z.ZodString>;
    /** Where service based rules count from; the hire date unless a rehire was credited (AC-PF14). */
    serviceFrom: z.ZodString;
    /** The file this one rehired. */
    previousEmployeeId: z.ZodNullable<z.ZodString>;
    currentContract: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
        /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
        endReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    id: string;
    dateOfBirth: string | null;
    address: {
        districtName: string;
        villageId: number;
        street: string | null;
        sectorName: string;
        villageName: string;
        cellName: string;
    } | null;
    email: string | null;
    legalName: string;
    idDocumentType: "national_id" | "passport" | null;
    idDocumentNumber: string | null;
    phone: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "full";
    employeeNumber: string;
    preferredName: string | null;
    hasPhoto: boolean;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    employeeType: {
        id: string;
        title: string;
    } | null;
    tags: {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }[];
    qualification: string | null;
    priorExperienceYears: number | null;
    hasAccount: boolean;
    detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
    currentContract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    } | null;
    rssbNumber: string | null;
    maritalStatus: "single" | "married" | "divorced" | "widowed" | null;
    childrenCount: number | null;
    emergencyContact: {
        name: string;
        phone: string | null;
        relation: string | null;
    } | null;
    offboardReason: string | null;
    serviceFrom: string;
    previousEmployeeId: string | null;
}, {
    status: "active" | "offboarded";
    id: string;
    dateOfBirth: string | null;
    address: {
        districtName: string;
        villageId: number;
        street: string | null;
        sectorName: string;
        villageName: string;
        cellName: string;
    } | null;
    email: string | null;
    legalName: string;
    idDocumentType: "national_id" | "passport" | null;
    idDocumentNumber: string | null;
    phone: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "full";
    employeeNumber: string;
    preferredName: string | null;
    hasPhoto: boolean;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    employeeType: {
        id: string;
        title: string;
    } | null;
    tags: {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }[];
    qualification: string | null;
    priorExperienceYears: number | null;
    hasAccount: boolean;
    detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
    currentContract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    } | null;
    rssbNumber: string | null;
    maritalStatus: "single" | "married" | "divorced" | "widowed" | null;
    childrenCount: number | null;
    emergencyContact: {
        name: string;
        phone: string | null;
        relation: string | null;
    } | null;
    offboardReason: string | null;
    serviceFrom: string;
    previousEmployeeId: string | null;
}>;
export type EmployeeFull = z.infer<typeof EmployeeFull>;
export declare const Employee: z.ZodDiscriminatedUnion<"view", [z.ZodObject<{
    id: z.ZodString;
    employeeNumber: z.ZodString;
    legalName: z.ZodString;
    preferredName: z.ZodNullable<z.ZodString>;
    displayName: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    /** Read through `GET /ops/employees/:id/photo`, a short signed link; a work field. */
    hasPhoto: z.ZodBoolean;
    workPropertyId: z.ZodNullable<z.ZodString>;
    workPropertyName: z.ZodNullable<z.ZodString>;
    jobPositionId: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    reportingManagerId: z.ZodNullable<z.ZodString>;
    reportingManagerName: z.ZodNullable<z.ZodString>;
    hiredOn: z.ZodString;
    status: z.ZodEnum<["active", "offboarded"]>;
    offboardedOn: z.ZodNullable<z.ZodString>;
    employeeType: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
    }, {
        id: string;
        title: string;
    }>>;
    tags: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        tone: z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }, {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }>, "many">;
    qualification: z.ZodNullable<z.ZodString>;
    priorExperienceYears: z.ZodNullable<z.ZodNumber>;
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.ZodBoolean;
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
    detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
} & {
    view: z.ZodLiteral<"basic">;
    currentContract: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
    } & {
        view: z.ZodLiteral<"basic">;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    id: string;
    email: string | null;
    legalName: string;
    phone: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "basic";
    employeeNumber: string;
    preferredName: string | null;
    hasPhoto: boolean;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    employeeType: {
        id: string;
        title: string;
    } | null;
    tags: {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }[];
    qualification: string | null;
    priorExperienceYears: number | null;
    hasAccount: boolean;
    detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
    currentContract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    } | null;
}, {
    status: "active" | "offboarded";
    id: string;
    email: string | null;
    legalName: string;
    phone: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "basic";
    employeeNumber: string;
    preferredName: string | null;
    hasPhoto: boolean;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    employeeType: {
        id: string;
        title: string;
    } | null;
    tags: {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }[];
    qualification: string | null;
    priorExperienceYears: number | null;
    hasAccount: boolean;
    detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
    currentContract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    } | null;
}>, z.ZodObject<{
    id: z.ZodString;
    employeeNumber: z.ZodString;
    legalName: z.ZodString;
    preferredName: z.ZodNullable<z.ZodString>;
    displayName: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    /** Read through `GET /ops/employees/:id/photo`, a short signed link; a work field. */
    hasPhoto: z.ZodBoolean;
    workPropertyId: z.ZodNullable<z.ZodString>;
    workPropertyName: z.ZodNullable<z.ZodString>;
    jobPositionId: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    reportingManagerId: z.ZodNullable<z.ZodString>;
    reportingManagerName: z.ZodNullable<z.ZodString>;
    hiredOn: z.ZodString;
    status: z.ZodEnum<["active", "offboarded"]>;
    offboardedOn: z.ZodNullable<z.ZodString>;
    employeeType: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
    }, {
        id: string;
        title: string;
    }>>;
    tags: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        tone: z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }, {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }>, "many">;
    qualification: z.ZodNullable<z.ZodString>;
    priorExperienceYears: z.ZodNullable<z.ZodNumber>;
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.ZodBoolean;
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
    detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
} & {
    view: z.ZodLiteral<"full">;
    sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    dateOfBirth: z.ZodNullable<z.ZodString>;
    idDocumentType: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
    idDocumentNumber: z.ZodNullable<z.ZodString>;
    rssbNumber: z.ZodNullable<z.ZodString>;
    maritalStatus: z.ZodNullable<z.ZodEnum<["single", "married", "divorced", "widowed"]>>;
    childrenCount: z.ZodNullable<z.ZodNumber>;
    address: z.ZodNullable<z.ZodObject<{
        villageId: z.ZodNumber;
        villageName: z.ZodString;
        cellName: z.ZodString;
        sectorName: z.ZodString;
        districtName: z.ZodString;
        street: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        districtName: string;
        villageId: number;
        street: string | null;
        sectorName: string;
        villageName: string;
        cellName: string;
    }, {
        districtName: string;
        villageId: number;
        street: string | null;
        sectorName: string;
        villageName: string;
        cellName: string;
    }>>;
    emergencyContact: z.ZodNullable<z.ZodObject<{
        name: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
        relation: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        phone: string | null;
        relation: string | null;
    }, {
        name: string;
        phone: string | null;
        relation: string | null;
    }>>;
    /** Why they left, when they have. */
    offboardReason: z.ZodNullable<z.ZodString>;
    /** Where service based rules count from; the hire date unless a rehire was credited (AC-PF14). */
    serviceFrom: z.ZodString;
    /** The file this one rehired. */
    previousEmployeeId: z.ZodNullable<z.ZodString>;
    currentContract: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
        /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
        endReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    id: string;
    dateOfBirth: string | null;
    address: {
        districtName: string;
        villageId: number;
        street: string | null;
        sectorName: string;
        villageName: string;
        cellName: string;
    } | null;
    email: string | null;
    legalName: string;
    idDocumentType: "national_id" | "passport" | null;
    idDocumentNumber: string | null;
    phone: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "full";
    employeeNumber: string;
    preferredName: string | null;
    hasPhoto: boolean;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    employeeType: {
        id: string;
        title: string;
    } | null;
    tags: {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }[];
    qualification: string | null;
    priorExperienceYears: number | null;
    hasAccount: boolean;
    detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
    currentContract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    } | null;
    rssbNumber: string | null;
    maritalStatus: "single" | "married" | "divorced" | "widowed" | null;
    childrenCount: number | null;
    emergencyContact: {
        name: string;
        phone: string | null;
        relation: string | null;
    } | null;
    offboardReason: string | null;
    serviceFrom: string;
    previousEmployeeId: string | null;
}, {
    status: "active" | "offboarded";
    id: string;
    dateOfBirth: string | null;
    address: {
        districtName: string;
        villageId: number;
        street: string | null;
        sectorName: string;
        villageName: string;
        cellName: string;
    } | null;
    email: string | null;
    legalName: string;
    idDocumentType: "national_id" | "passport" | null;
    idDocumentNumber: string | null;
    phone: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "full";
    employeeNumber: string;
    preferredName: string | null;
    hasPhoto: boolean;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    employeeType: {
        id: string;
        title: string;
    } | null;
    tags: {
        id: string;
        title: string;
        tone: "neutral" | "info" | "ok" | "warn" | "bad";
    }[];
    qualification: string | null;
    priorExperienceYears: number | null;
    hasAccount: boolean;
    detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
    currentContract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    } | null;
    rssbNumber: string | null;
    maritalStatus: "single" | "married" | "divorced" | "widowed" | null;
    childrenCount: number | null;
    emergencyContact: {
        name: string;
        phone: string | null;
        relation: string | null;
    } | null;
    offboardReason: string | null;
    serviceFrom: string;
    previousEmployeeId: string | null;
}>]>;
export type Employee = z.infer<typeof Employee>;
/** A department the person is on, through `department_members`. */
export declare const EmployeeDepartment: z.ZodObject<{
    departmentId: z.ZodString;
    name: z.ZodString;
    departmentPosition: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    departmentId: string;
    departmentPosition: string;
}, {
    name: string;
    departmentId: string;
    departmentPosition: string;
}>;
export type EmployeeDepartment = z.infer<typeof EmployeeDepartment>;
/** `GET /ops/employees/:id`: the file, its contracts newest first, its departments. */
export declare const EmployeeFile: z.ZodObject<{
    employee: z.ZodDiscriminatedUnion<"view", [z.ZodObject<{
        id: z.ZodString;
        employeeNumber: z.ZodString;
        legalName: z.ZodString;
        preferredName: z.ZodNullable<z.ZodString>;
        displayName: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        /** Read through `GET /ops/employees/:id/photo`, a short signed link; a work field. */
        hasPhoto: z.ZodBoolean;
        workPropertyId: z.ZodNullable<z.ZodString>;
        workPropertyName: z.ZodNullable<z.ZodString>;
        jobPositionId: z.ZodNullable<z.ZodString>;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
        reportingManagerId: z.ZodNullable<z.ZodString>;
        reportingManagerName: z.ZodNullable<z.ZodString>;
        hiredOn: z.ZodString;
        status: z.ZodEnum<["active", "offboarded"]>;
        offboardedOn: z.ZodNullable<z.ZodString>;
        employeeType: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
        }, {
            id: string;
            title: string;
        }>>;
        tags: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            tone: z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }, {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }>, "many">;
        qualification: z.ZodNullable<z.ZodString>;
        priorExperienceYears: z.ZodNullable<z.ZodNumber>;
        /** Whether the file is linked to an account (an `org_memberships` row). */
        hasAccount: z.ZodBoolean;
        /** The role that account holds here, when it does. Never held by the file. */
        orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
        detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
    } & {
        view: z.ZodLiteral<"basic">;
        currentContract: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            employeeId: z.ZodString;
            contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
            startsOn: z.ZodString;
            /** Null: open ended. */
            endsOn: z.ZodNullable<z.ZodString>;
            wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
            status: z.ZodEnum<["scheduled", "active", "ended"]>;
        } & {
            view: z.ZodLiteral<"basic">;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        id: string;
        email: string | null;
        legalName: string;
        phone: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        hasPhoto: boolean;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        employeeType: {
            id: string;
            title: string;
        } | null;
        tags: {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }[];
        qualification: string | null;
        priorExperienceYears: number | null;
        hasAccount: boolean;
        detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
        currentContract: {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        } | null;
    }, {
        status: "active" | "offboarded";
        id: string;
        email: string | null;
        legalName: string;
        phone: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        hasPhoto: boolean;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        employeeType: {
            id: string;
            title: string;
        } | null;
        tags: {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }[];
        qualification: string | null;
        priorExperienceYears: number | null;
        hasAccount: boolean;
        detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
        currentContract: {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        } | null;
    }>, z.ZodObject<{
        id: z.ZodString;
        employeeNumber: z.ZodString;
        legalName: z.ZodString;
        preferredName: z.ZodNullable<z.ZodString>;
        displayName: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        /** Read through `GET /ops/employees/:id/photo`, a short signed link; a work field. */
        hasPhoto: z.ZodBoolean;
        workPropertyId: z.ZodNullable<z.ZodString>;
        workPropertyName: z.ZodNullable<z.ZodString>;
        jobPositionId: z.ZodNullable<z.ZodString>;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
        reportingManagerId: z.ZodNullable<z.ZodString>;
        reportingManagerName: z.ZodNullable<z.ZodString>;
        hiredOn: z.ZodString;
        status: z.ZodEnum<["active", "offboarded"]>;
        offboardedOn: z.ZodNullable<z.ZodString>;
        employeeType: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
        }, {
            id: string;
            title: string;
        }>>;
        tags: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            tone: z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }, {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }>, "many">;
        qualification: z.ZodNullable<z.ZodString>;
        priorExperienceYears: z.ZodNullable<z.ZodNumber>;
        /** Whether the file is linked to an account (an `org_memberships` row). */
        hasAccount: z.ZodBoolean;
        /** The role that account holds here, when it does. Never held by the file. */
        orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
        detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
    } & {
        view: z.ZodLiteral<"full">;
        sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        dateOfBirth: z.ZodNullable<z.ZodString>;
        idDocumentType: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idDocumentNumber: z.ZodNullable<z.ZodString>;
        rssbNumber: z.ZodNullable<z.ZodString>;
        maritalStatus: z.ZodNullable<z.ZodEnum<["single", "married", "divorced", "widowed"]>>;
        childrenCount: z.ZodNullable<z.ZodNumber>;
        address: z.ZodNullable<z.ZodObject<{
            villageId: z.ZodNumber;
            villageName: z.ZodString;
            cellName: z.ZodString;
            sectorName: z.ZodString;
            districtName: z.ZodString;
            street: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            districtName: string;
            villageId: number;
            street: string | null;
            sectorName: string;
            villageName: string;
            cellName: string;
        }, {
            districtName: string;
            villageId: number;
            street: string | null;
            sectorName: string;
            villageName: string;
            cellName: string;
        }>>;
        emergencyContact: z.ZodNullable<z.ZodObject<{
            name: z.ZodString;
            phone: z.ZodNullable<z.ZodString>;
            relation: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            phone: string | null;
            relation: string | null;
        }, {
            name: string;
            phone: string | null;
            relation: string | null;
        }>>;
        /** Why they left, when they have. */
        offboardReason: z.ZodNullable<z.ZodString>;
        /** Where service based rules count from; the hire date unless a rehire was credited (AC-PF14). */
        serviceFrom: z.ZodString;
        /** The file this one rehired. */
        previousEmployeeId: z.ZodNullable<z.ZodString>;
        currentContract: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            employeeId: z.ZodString;
            contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
            startsOn: z.ZodString;
            /** Null: open ended. */
            endsOn: z.ZodNullable<z.ZodString>;
            wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
            status: z.ZodEnum<["scheduled", "active", "ended"]>;
        } & {
            view: z.ZodLiteral<"full">;
            wageRwf: z.ZodNumber;
            /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
            endReason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "full";
            wageRwf: number;
            endReason: string | null;
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "full";
            wageRwf: number;
            endReason: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        id: string;
        dateOfBirth: string | null;
        address: {
            districtName: string;
            villageId: number;
            street: string | null;
            sectorName: string;
            villageName: string;
            cellName: string;
        } | null;
        email: string | null;
        legalName: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        phone: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        hasPhoto: boolean;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        employeeType: {
            id: string;
            title: string;
        } | null;
        tags: {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }[];
        qualification: string | null;
        priorExperienceYears: number | null;
        hasAccount: boolean;
        detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
        currentContract: {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "full";
            wageRwf: number;
            endReason: string | null;
        } | null;
        rssbNumber: string | null;
        maritalStatus: "single" | "married" | "divorced" | "widowed" | null;
        childrenCount: number | null;
        emergencyContact: {
            name: string;
            phone: string | null;
            relation: string | null;
        } | null;
        offboardReason: string | null;
        serviceFrom: string;
        previousEmployeeId: string | null;
    }, {
        status: "active" | "offboarded";
        id: string;
        dateOfBirth: string | null;
        address: {
            districtName: string;
            villageId: number;
            street: string | null;
            sectorName: string;
            villageName: string;
            cellName: string;
        } | null;
        email: string | null;
        legalName: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        phone: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        hasPhoto: boolean;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        employeeType: {
            id: string;
            title: string;
        } | null;
        tags: {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }[];
        qualification: string | null;
        priorExperienceYears: number | null;
        hasAccount: boolean;
        detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
        currentContract: {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "full";
            wageRwf: number;
            endReason: string | null;
        } | null;
        rssbNumber: string | null;
        maritalStatus: "single" | "married" | "divorced" | "widowed" | null;
        childrenCount: number | null;
        emergencyContact: {
            name: string;
            phone: string | null;
            relation: string | null;
        } | null;
        offboardReason: string | null;
        serviceFrom: string;
        previousEmployeeId: string | null;
    }>]>;
    contracts: z.ZodArray<z.ZodDiscriminatedUnion<"view", [z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
    } & {
        view: z.ZodLiteral<"basic">;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    }>, z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
        /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
        endReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }>]>, "many">;
    departments: z.ZodArray<z.ZodObject<{
        departmentId: z.ZodString;
        name: z.ZodString;
        departmentPosition: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        departmentId: string;
        departmentPosition: string;
    }, {
        name: string;
        departmentId: string;
        departmentPosition: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    employee: {
        status: "active" | "offboarded";
        id: string;
        email: string | null;
        legalName: string;
        phone: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        hasPhoto: boolean;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        employeeType: {
            id: string;
            title: string;
        } | null;
        tags: {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }[];
        qualification: string | null;
        priorExperienceYears: number | null;
        hasAccount: boolean;
        detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
        currentContract: {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        } | null;
    } | {
        status: "active" | "offboarded";
        id: string;
        dateOfBirth: string | null;
        address: {
            districtName: string;
            villageId: number;
            street: string | null;
            sectorName: string;
            villageName: string;
            cellName: string;
        } | null;
        email: string | null;
        legalName: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        phone: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        hasPhoto: boolean;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        employeeType: {
            id: string;
            title: string;
        } | null;
        tags: {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }[];
        qualification: string | null;
        priorExperienceYears: number | null;
        hasAccount: boolean;
        detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
        currentContract: {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "full";
            wageRwf: number;
            endReason: string | null;
        } | null;
        rssbNumber: string | null;
        maritalStatus: "single" | "married" | "divorced" | "widowed" | null;
        childrenCount: number | null;
        emergencyContact: {
            name: string;
            phone: string | null;
            relation: string | null;
        } | null;
        offboardReason: string | null;
        serviceFrom: string;
        previousEmployeeId: string | null;
    };
    departments: {
        name: string;
        departmentId: string;
        departmentPosition: string;
    }[];
    contracts: ({
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    } | {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    })[];
}, {
    employee: {
        status: "active" | "offboarded";
        id: string;
        email: string | null;
        legalName: string;
        phone: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        hasPhoto: boolean;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        employeeType: {
            id: string;
            title: string;
        } | null;
        tags: {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }[];
        qualification: string | null;
        priorExperienceYears: number | null;
        hasAccount: boolean;
        detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
        currentContract: {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        } | null;
    } | {
        status: "active" | "offboarded";
        id: string;
        dateOfBirth: string | null;
        address: {
            districtName: string;
            villageId: number;
            street: string | null;
            sectorName: string;
            villageName: string;
            cellName: string;
        } | null;
        email: string | null;
        legalName: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        phone: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        hasPhoto: boolean;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        employeeType: {
            id: string;
            title: string;
        } | null;
        tags: {
            id: string;
            title: string;
            tone: "neutral" | "info" | "ok" | "warn" | "bad";
        }[];
        qualification: string | null;
        priorExperienceYears: number | null;
        hasAccount: boolean;
        detailsMissing: ("dateOfBirth" | "idDocument" | "phone" | "sex")[];
        currentContract: {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            view: "full";
            wageRwf: number;
            endReason: string | null;
        } | null;
        rssbNumber: string | null;
        maritalStatus: "single" | "married" | "divorced" | "widowed" | null;
        childrenCount: number | null;
        emergencyContact: {
            name: string;
            phone: string | null;
            relation: string | null;
        } | null;
        offboardReason: string | null;
        serviceFrom: string;
        previousEmployeeId: string | null;
    };
    departments: {
        name: string;
        departmentId: string;
        departmentPosition: string;
    }[];
    contracts: ({
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "basic";
    } | {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    })[];
}>;
export type EmployeeFile = z.infer<typeof EmployeeFile>;
/** `POST /ops/employees`. The business is the workspace, never the body (AC-U4). */
export declare const CreateEmployeeRequest: z.ZodObject<{
    legalName: z.ZodString;
    preferredName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>;
    dateOfBirth: z.ZodString;
    sex: z.ZodEnum<["female", "male"]>;
    idDocumentType: z.ZodEnum<["national_id", "passport"]>;
    idDocumentNumber: z.ZodString;
    hiredOn: z.ZodString;
    workPropertyId: z.ZodString;
    /** Minted per business (`0001`, `0002`, …) when absent. */
    employeeNumber: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rssbNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reportingManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** An active job position of the business (058-people-file AC-PF11). */
    jobPositionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /**
     * Rehire a leaver as a new file (058-people-file AC-PF14). Sent after a create
     * answered 409 `rehire_available` naming the offboarded file with this ID.
     */
    rehireOf: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    dateOfBirth: string;
    legalName: string;
    idDocumentType: "national_id" | "passport";
    idDocumentNumber: string;
    phone: string;
    sex: "female" | "male";
    workPropertyId: string;
    hiredOn: string;
    email?: string | null | undefined;
    employeeNumber?: string | undefined;
    preferredName?: string | null | undefined;
    jobPositionId?: string | null | undefined;
    reportingManagerId?: string | null | undefined;
    rssbNumber?: string | null | undefined;
    rehireOf?: string | undefined;
}, {
    dateOfBirth: string;
    legalName: string;
    idDocumentType: "national_id" | "passport";
    idDocumentNumber: string;
    phone: string;
    sex: "female" | "male";
    workPropertyId: string;
    hiredOn: string;
    email?: string | null | undefined;
    employeeNumber?: string | undefined;
    preferredName?: string | null | undefined;
    jobPositionId?: string | null | undefined;
    reportingManagerId?: string | null | undefined;
    rssbNumber?: string | null | undefined;
    rehireOf?: string | undefined;
}>;
export type CreateEmployeeRequest = z.infer<typeof CreateEmployeeRequest>;
/**
 * `PATCH /ops/employees/:id`. Any file field; null clears a nullable one.
 *
 * The ID travels as a pair: a type with no number, or a number with no type,
 * says nothing a payroll declaration can use.
 */
export declare const UpdateEmployeeRequest: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    legalName: z.ZodOptional<z.ZodString>;
    preferredName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    phone: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>>;
    email: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    dateOfBirth: z.ZodOptional<z.ZodString>;
    sex: z.ZodOptional<z.ZodEnum<["female", "male"]>>;
    idDocumentType: z.ZodOptional<z.ZodEnum<["national_id", "passport"]>>;
    idDocumentNumber: z.ZodOptional<z.ZodString>;
    rssbNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    hiredOn: z.ZodOptional<z.ZodString>;
    workPropertyId: z.ZodOptional<z.ZodString>;
    employeeNumber: z.ZodOptional<z.ZodString>;
    reportingManagerId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jobPositionId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    maritalStatus: z.ZodOptional<z.ZodNullable<z.ZodEnum<["single", "married", "divorced", "widowed"]>>>;
    childrenCount: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    villageId: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    street: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    emergencyName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    emergencyPhone: z.ZodOptional<z.ZodNullable<z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>>>;
    emergencyRelation: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    qualification: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    priorExperienceYears: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    employeeTypeId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tagIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    serviceFrom: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    villageId?: number | null | undefined;
    street?: string | null | undefined;
    dateOfBirth?: string | undefined;
    email?: string | null | undefined;
    legalName?: string | undefined;
    idDocumentType?: "national_id" | "passport" | undefined;
    idDocumentNumber?: string | undefined;
    phone?: string | undefined;
    sex?: "female" | "male" | undefined;
    employeeNumber?: string | undefined;
    preferredName?: string | null | undefined;
    workPropertyId?: string | undefined;
    jobPositionId?: string | null | undefined;
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    qualification?: string | null | undefined;
    priorExperienceYears?: number | null | undefined;
    rssbNumber?: string | null | undefined;
    maritalStatus?: "single" | "married" | "divorced" | "widowed" | null | undefined;
    childrenCount?: number | null | undefined;
    serviceFrom?: string | undefined;
    emergencyName?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
    emergencyRelation?: string | null | undefined;
    employeeTypeId?: string | null | undefined;
    tagIds?: string[] | undefined;
}, {
    villageId?: number | null | undefined;
    street?: string | null | undefined;
    dateOfBirth?: string | undefined;
    email?: string | null | undefined;
    legalName?: string | undefined;
    idDocumentType?: "national_id" | "passport" | undefined;
    idDocumentNumber?: string | undefined;
    phone?: string | undefined;
    sex?: "female" | "male" | undefined;
    employeeNumber?: string | undefined;
    preferredName?: string | null | undefined;
    workPropertyId?: string | undefined;
    jobPositionId?: string | null | undefined;
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    qualification?: string | null | undefined;
    priorExperienceYears?: number | null | undefined;
    rssbNumber?: string | null | undefined;
    maritalStatus?: "single" | "married" | "divorced" | "widowed" | null | undefined;
    childrenCount?: number | null | undefined;
    serviceFrom?: string | undefined;
    emergencyName?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
    emergencyRelation?: string | null | undefined;
    employeeTypeId?: string | null | undefined;
    tagIds?: string[] | undefined;
}>, {
    villageId?: number | null | undefined;
    street?: string | null | undefined;
    dateOfBirth?: string | undefined;
    email?: string | null | undefined;
    legalName?: string | undefined;
    idDocumentType?: "national_id" | "passport" | undefined;
    idDocumentNumber?: string | undefined;
    phone?: string | undefined;
    sex?: "female" | "male" | undefined;
    employeeNumber?: string | undefined;
    preferredName?: string | null | undefined;
    workPropertyId?: string | undefined;
    jobPositionId?: string | null | undefined;
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    qualification?: string | null | undefined;
    priorExperienceYears?: number | null | undefined;
    rssbNumber?: string | null | undefined;
    maritalStatus?: "single" | "married" | "divorced" | "widowed" | null | undefined;
    childrenCount?: number | null | undefined;
    serviceFrom?: string | undefined;
    emergencyName?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
    emergencyRelation?: string | null | undefined;
    employeeTypeId?: string | null | undefined;
    tagIds?: string[] | undefined;
}, {
    villageId?: number | null | undefined;
    street?: string | null | undefined;
    dateOfBirth?: string | undefined;
    email?: string | null | undefined;
    legalName?: string | undefined;
    idDocumentType?: "national_id" | "passport" | undefined;
    idDocumentNumber?: string | undefined;
    phone?: string | undefined;
    sex?: "female" | "male" | undefined;
    employeeNumber?: string | undefined;
    preferredName?: string | null | undefined;
    workPropertyId?: string | undefined;
    jobPositionId?: string | null | undefined;
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    qualification?: string | null | undefined;
    priorExperienceYears?: number | null | undefined;
    rssbNumber?: string | null | undefined;
    maritalStatus?: "single" | "married" | "divorced" | "widowed" | null | undefined;
    childrenCount?: number | null | undefined;
    serviceFrom?: string | undefined;
    emergencyName?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
    emergencyRelation?: string | null | undefined;
    employeeTypeId?: string | null | undefined;
    tagIds?: string[] | undefined;
}>, {
    villageId?: number | null | undefined;
    street?: string | null | undefined;
    dateOfBirth?: string | undefined;
    email?: string | null | undefined;
    legalName?: string | undefined;
    idDocumentType?: "national_id" | "passport" | undefined;
    idDocumentNumber?: string | undefined;
    phone?: string | undefined;
    sex?: "female" | "male" | undefined;
    employeeNumber?: string | undefined;
    preferredName?: string | null | undefined;
    workPropertyId?: string | undefined;
    jobPositionId?: string | null | undefined;
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    qualification?: string | null | undefined;
    priorExperienceYears?: number | null | undefined;
    rssbNumber?: string | null | undefined;
    maritalStatus?: "single" | "married" | "divorced" | "widowed" | null | undefined;
    childrenCount?: number | null | undefined;
    serviceFrom?: string | undefined;
    emergencyName?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
    emergencyRelation?: string | null | undefined;
    employeeTypeId?: string | null | undefined;
    tagIds?: string[] | undefined;
}, {
    villageId?: number | null | undefined;
    street?: string | null | undefined;
    dateOfBirth?: string | undefined;
    email?: string | null | undefined;
    legalName?: string | undefined;
    idDocumentType?: "national_id" | "passport" | undefined;
    idDocumentNumber?: string | undefined;
    phone?: string | undefined;
    sex?: "female" | "male" | undefined;
    employeeNumber?: string | undefined;
    preferredName?: string | null | undefined;
    workPropertyId?: string | undefined;
    jobPositionId?: string | null | undefined;
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    qualification?: string | null | undefined;
    priorExperienceYears?: number | null | undefined;
    rssbNumber?: string | null | undefined;
    maritalStatus?: "single" | "married" | "divorced" | "widowed" | null | undefined;
    childrenCount?: number | null | undefined;
    serviceFrom?: string | undefined;
    emergencyName?: string | null | undefined;
    emergencyPhone?: string | null | undefined;
    emergencyRelation?: string | null | undefined;
    employeeTypeId?: string | null | undefined;
    tagIds?: string[] | undefined;
}>;
export type UpdateEmployeeRequest = z.infer<typeof UpdateEmployeeRequest>;
/**
 * `POST /ops/employees/:id/contracts`. A wage change is a new contract.
 *
 * Only a monthly wage is accepted in the first thread. Daily and hourly pay are
 * computed from attendance, which arrives with ADR-058 slice 5; refusing the
 * contract now is what stops a pay run from silently leaving someone out.
 */
export declare const CreateContractRequest: z.ZodObject<{
    contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
    startsOn: z.ZodString;
    endsOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
    wageRwf: z.ZodNumber;
    /** 058-payroll: the components the contract carries, and its notice in days. */
    payStructureId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    noticeDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    startsOn: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    wageRwf: number;
    noticeDays?: number | null | undefined;
    endsOn?: string | null | undefined;
    payStructureId?: string | null | undefined;
}, {
    startsOn: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    wageRwf: number;
    noticeDays?: number | null | undefined;
    endsOn?: string | null | undefined;
    payStructureId?: string | null | undefined;
}>;
export type CreateContractRequest = z.infer<typeof CreateContractRequest>;
/** The new contract, and the one it shortened, if any. */
export declare const CreateContractResponse: z.ZodObject<{
    contract: z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
        /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
        endReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }>;
    shortened: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
        /** Why it ended, which can say why the person left (058-people-file AC-PF2). */
        endReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    contract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    };
    shortened: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    } | null;
}, {
    contract: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    };
    shortened: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        view: "full";
        wageRwf: number;
        endReason: string | null;
    } | null;
}>;
export type CreateContractResponse = z.infer<typeof CreateContractResponse>;
/** `POST /ops/employees/:id/offboard`. */
export declare const OffboardEmployeeRequest: z.ZodObject<{
    lastDay: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    lastDay: string;
}, {
    reason: string;
    lastDay: string;
}>;
export type OffboardEmployeeRequest = z.infer<typeof OffboardEmployeeRequest>;
export declare const ShiftTemplateStatus: z.ZodEnum<["active", "archived"]>;
export type ShiftTemplateStatus = z.infer<typeof ShiftTemplateStatus>;
export declare const ShiftTemplate: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodString;
    departmentId: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    startsAt: z.ZodString;
    endsAt: z.ZodString;
    breakMinutes: z.ZodNumber;
    /** An end at or before the start runs past midnight. */
    crossesMidnight: z.ZodBoolean;
    /** Overtime counts past this much work; null: the shift's length less its break (058-time AC-TM7). */
    minWorkMinutes: z.ZodNullable<z.ZodNumber>;
    /** Minutes after the end the sweep closes a record still open (AC-TM4); null: never. */
    autoClockOutMinutes: z.ZodNullable<z.ZodNumber>;
    status: z.ZodEnum<["active", "archived"]>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    name: string;
    id: string;
    propertyId: string;
    departmentId: string | null;
    startsAt: string;
    endsAt: string;
    breakMinutes: number;
    crossesMidnight: boolean;
    minWorkMinutes: number | null;
    autoClockOutMinutes: number | null;
}, {
    status: "active" | "archived";
    name: string;
    id: string;
    propertyId: string;
    departmentId: string | null;
    startsAt: string;
    endsAt: string;
    breakMinutes: number;
    crossesMidnight: boolean;
    minWorkMinutes: number | null;
    autoClockOutMinutes: number | null;
}>;
export type ShiftTemplate = z.infer<typeof ShiftTemplate>;
export declare const ShiftTemplateList: z.ZodObject<{
    templates: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        departmentId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        startsAt: z.ZodString;
        endsAt: z.ZodString;
        breakMinutes: z.ZodNumber;
        /** An end at or before the start runs past midnight. */
        crossesMidnight: z.ZodBoolean;
        /** Overtime counts past this much work; null: the shift's length less its break (058-time AC-TM7). */
        minWorkMinutes: z.ZodNullable<z.ZodNumber>;
        /** Minutes after the end the sweep closes a record still open (AC-TM4); null: never. */
        autoClockOutMinutes: z.ZodNullable<z.ZodNumber>;
        status: z.ZodEnum<["active", "archived"]>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        name: string;
        id: string;
        propertyId: string;
        departmentId: string | null;
        startsAt: string;
        endsAt: string;
        breakMinutes: number;
        crossesMidnight: boolean;
        minWorkMinutes: number | null;
        autoClockOutMinutes: number | null;
    }, {
        status: "active" | "archived";
        name: string;
        id: string;
        propertyId: string;
        departmentId: string | null;
        startsAt: string;
        endsAt: string;
        breakMinutes: number;
        crossesMidnight: boolean;
        minWorkMinutes: number | null;
        autoClockOutMinutes: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    templates: {
        status: "active" | "archived";
        name: string;
        id: string;
        propertyId: string;
        departmentId: string | null;
        startsAt: string;
        endsAt: string;
        breakMinutes: number;
        crossesMidnight: boolean;
        minWorkMinutes: number | null;
        autoClockOutMinutes: number | null;
    }[];
}, {
    templates: {
        status: "active" | "archived";
        name: string;
        id: string;
        propertyId: string;
        departmentId: string | null;
        startsAt: string;
        endsAt: string;
        breakMinutes: number;
        crossesMidnight: boolean;
        minWorkMinutes: number | null;
        autoClockOutMinutes: number | null;
    }[];
}>;
export type ShiftTemplateList = z.infer<typeof ShiftTemplateList>;
export declare const ShiftTemplateQuery: z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    propertyId?: string | undefined;
}, {
    propertyId?: string | undefined;
}>;
export type ShiftTemplateQuery = z.infer<typeof ShiftTemplateQuery>;
export declare const CreateShiftTemplateRequest: z.ZodObject<{
    propertyId: z.ZodString;
    departmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    startsAt: z.ZodString;
    endsAt: z.ZodString;
    breakMinutes: z.ZodOptional<z.ZodNumber>;
    minWorkMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    autoClockOutMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    propertyId: string;
    startsAt: string;
    endsAt: string;
    departmentId?: string | null | undefined;
    breakMinutes?: number | undefined;
    minWorkMinutes?: number | null | undefined;
    autoClockOutMinutes?: number | null | undefined;
}, {
    name: string;
    propertyId: string;
    startsAt: string;
    endsAt: string;
    departmentId?: string | null | undefined;
    breakMinutes?: number | undefined;
    minWorkMinutes?: number | null | undefined;
    autoClockOutMinutes?: number | null | undefined;
}>;
export type CreateShiftTemplateRequest = z.infer<typeof CreateShiftTemplateRequest>;
export declare const RosterEntry: z.ZodObject<{
    id: z.ZodString;
    employee: z.ZodObject<{
        employeeId: z.ZodString;
        /** The preferred name, else the legal name. */
        displayName: z.ZodString;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }>;
    shiftTemplateId: z.ZodString;
    shiftName: z.ZodString;
    propertyId: z.ZodString;
    departmentId: z.ZodNullable<z.ZodString>;
    workDate: z.ZodString;
    /** Instants, computed from the template's times on `workDate` in Kigali. */
    startsAt: z.ZodString;
    endsAt: z.ZodString;
    status: z.ZodEnum<["scheduled", "cancelled"]>;
    cancelReason: z.ZodNullable<z.ZodString>;
    /** Null: a draft, seen only by those who manage the roster (058-time AC-TM1). */
    publishedAt: z.ZodNullable<z.ZodString>;
    /** Written by a rotation (AC-TM3). */
    generated: z.ZodBoolean;
    /** Written by an approved shift or swap request (AC-TM5). */
    fromRequest: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "scheduled";
    id: string;
    publishedAt: string | null;
    generated: boolean;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    propertyId: string;
    departmentId: string | null;
    startsAt: string;
    endsAt: string;
    shiftTemplateId: string;
    shiftName: string;
    workDate: string;
    cancelReason: string | null;
    fromRequest: boolean;
}, {
    status: "cancelled" | "scheduled";
    id: string;
    publishedAt: string | null;
    generated: boolean;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    propertyId: string;
    departmentId: string | null;
    startsAt: string;
    endsAt: string;
    shiftTemplateId: string;
    shiftName: string;
    workDate: string;
    cancelReason: string | null;
    fromRequest: boolean;
}>;
export type RosterEntry = z.infer<typeof RosterEntry>;
export declare const CreateRosterEntryRequest: z.ZodObject<{
    employeeId: z.ZodString;
    shiftTemplateId: z.ZodString;
    workDate: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    shiftTemplateId: string;
    workDate: string;
}, {
    employeeId: string;
    shiftTemplateId: string;
    workDate: string;
}>;
export type CreateRosterEntryRequest = z.infer<typeof CreateRosterEntryRequest>;
export declare const CancelRosterEntryRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type CancelRosterEntryRequest = z.infer<typeof CancelRosterEntryRequest>;
/** Whole minutes, floored (058-time AC-TM7). A record with no roster entry has worked minutes and a day kind only. */
export declare const AttendanceFigures: z.ZodObject<{
    lateMinutes: z.ZodNullable<z.ZodNumber>;
    earlyMinutes: z.ZodNullable<z.ZodNumber>;
    workedMinutes: z.ZodNumber;
    overtimeMinutes: z.ZodNullable<z.ZodNumber>;
    /** Null until the policy or a person decides it (AC-TM8). */
    approvedOvertimeMinutes: z.ZodNullable<z.ZodNumber>;
    dayKind: z.ZodNullable<z.ZodEnum<["weekday", "weekly_off", "public_holiday"]>>;
}, "strip", z.ZodTypeAny, {
    lateMinutes: number | null;
    earlyMinutes: number | null;
    workedMinutes: number;
    overtimeMinutes: number | null;
    approvedOvertimeMinutes: number | null;
    dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
}, {
    lateMinutes: number | null;
    earlyMinutes: number | null;
    workedMinutes: number;
    overtimeMinutes: number | null;
    approvedOvertimeMinutes: number | null;
    dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
}>;
export type AttendanceFigures = z.infer<typeof AttendanceFigures>;
export declare const AttendanceLocation: z.ZodObject<{
    inDistanceM: z.ZodNullable<z.ZodNumber>;
    inAccuracyM: z.ZodNullable<z.ZodNumber>;
    outDistanceM: z.ZodNullable<z.ZodNumber>;
    outAccuracyM: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    inDistanceM: number | null;
    inAccuracyM: number | null;
    outDistanceM: number | null;
    outAccuracyM: number | null;
}, {
    inDistanceM: number | null;
    inAccuracyM: number | null;
    outDistanceM: number | null;
    outAccuracyM: number | null;
}>;
export type AttendanceLocation = z.infer<typeof AttendanceLocation>;
export declare const AttendanceRecord: z.ZodObject<{
    id: z.ZodString;
    employee: z.ZodObject<{
        employeeId: z.ZodString;
        /** The preferred name, else the legal name. */
        displayName: z.ZodString;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }>;
    /** The branch the person works at: what branch limits read and a page groups by. */
    branchId: z.ZodNullable<z.ZodString>;
    rosterEntryId: z.ZodNullable<z.ZodString>;
    workDate: z.ZodString;
    clockInAt: z.ZodString;
    clockOutAt: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<["supervisor", "self", "phone", "kiosk"]>;
    validated: z.ZodBoolean;
    status: z.ZodEnum<["open", "closed", "superseded"]>;
    supersedesId: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
    /** Closed by the sweep, not by a person: unvalidated until someone puts the times right (AC-TM4). */
    autoClosed: z.ZodBoolean;
    /** Why the phone clock in waits for validation (mobile spec 0003, D-ao); null for any other punch. */
    inPendingReason: z.ZodNullable<z.ZodEnum<["no_location", "no_branch_location", "poor_accuracy", "outside_fence", "late_sync"]>>;
    /** Why the phone clock out waits for validation; null for any other punch. */
    outPendingReason: z.ZodNullable<z.ZodEnum<["no_location", "no_branch_location", "poor_accuracy", "outside_fence", "late_sync"]>>;
    /**
     * A closed record's work figures (AC-TM7). Null while open, and for a reader
     * outside the figure audience (`attendance.approve` and `people.manage`,
     * AC-TM13): the desk's sheet carries none.
     */
    figures: z.ZodNullable<z.ZodObject<{
        lateMinutes: z.ZodNullable<z.ZodNumber>;
        earlyMinutes: z.ZodNullable<z.ZodNumber>;
        workedMinutes: z.ZodNumber;
        overtimeMinutes: z.ZodNullable<z.ZodNumber>;
        /** Null until the policy or a person decides it (AC-TM8). */
        approvedOvertimeMinutes: z.ZodNullable<z.ZodNumber>;
        dayKind: z.ZodNullable<z.ZodEnum<["weekday", "weekly_off", "public_holiday"]>>;
    }, "strip", z.ZodTypeAny, {
        lateMinutes: number | null;
        earlyMinutes: number | null;
        workedMinutes: number;
        overtimeMinutes: number | null;
        approvedOvertimeMinutes: number | null;
        dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
    }, {
        lateMinutes: number | null;
        earlyMinutes: number | null;
        workedMinutes: number;
        overtimeMinutes: number | null;
        approvedOvertimeMinutes: number | null;
        dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
    }>>;
    /** How far from the branch a phone punch was, for whoever validates it (AC-TM9); never the coordinates. */
    location: z.ZodNullable<z.ZodObject<{
        inDistanceM: z.ZodNullable<z.ZodNumber>;
        inAccuracyM: z.ZodNullable<z.ZodNumber>;
        outDistanceM: z.ZodNullable<z.ZodNumber>;
        outAccuracyM: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        inDistanceM: number | null;
        inAccuracyM: number | null;
        outDistanceM: number | null;
        outAccuracyM: number | null;
    }, {
        inDistanceM: number | null;
        inAccuracyM: number | null;
        outDistanceM: number | null;
        outAccuracyM: number | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "superseded" | "open" | "closed";
    id: string;
    source: "phone" | "supervisor" | "self" | "kiosk";
    note: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    workDate: string;
    branchId: string | null;
    rosterEntryId: string | null;
    clockInAt: string;
    clockOutAt: string | null;
    validated: boolean;
    supersedesId: string | null;
    autoClosed: boolean;
    inPendingReason: "no_location" | "no_branch_location" | "poor_accuracy" | "outside_fence" | "late_sync" | null;
    outPendingReason: "no_location" | "no_branch_location" | "poor_accuracy" | "outside_fence" | "late_sync" | null;
    figures: {
        lateMinutes: number | null;
        earlyMinutes: number | null;
        workedMinutes: number;
        overtimeMinutes: number | null;
        approvedOvertimeMinutes: number | null;
        dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
    } | null;
    location: {
        inDistanceM: number | null;
        inAccuracyM: number | null;
        outDistanceM: number | null;
        outAccuracyM: number | null;
    } | null;
}, {
    status: "superseded" | "open" | "closed";
    id: string;
    source: "phone" | "supervisor" | "self" | "kiosk";
    note: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    workDate: string;
    branchId: string | null;
    rosterEntryId: string | null;
    clockInAt: string;
    clockOutAt: string | null;
    validated: boolean;
    supersedesId: string | null;
    autoClosed: boolean;
    inPendingReason: "no_location" | "no_branch_location" | "poor_accuracy" | "outside_fence" | "late_sync" | null;
    outPendingReason: "no_location" | "no_branch_location" | "poor_accuracy" | "outside_fence" | "late_sync" | null;
    figures: {
        lateMinutes: number | null;
        earlyMinutes: number | null;
        workedMinutes: number;
        overtimeMinutes: number | null;
        approvedOvertimeMinutes: number | null;
        dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
    } | null;
    location: {
        inDistanceM: number | null;
        inAccuracyM: number | null;
        outDistanceM: number | null;
        outAccuracyM: number | null;
    } | null;
}>;
export type AttendanceRecord = z.infer<typeof AttendanceRecord>;
export declare const ClockInRequest: z.ZodObject<{
    employeeId: z.ZodString;
    /** At most 5 minutes ahead and 7 days behind the server clock. */
    at: z.ZodOptional<z.ZodString>;
    rosterEntryId: z.ZodOptional<z.ZodString>;
    /** Why the desk wrote it and who confirmed the time: kept on the record. */
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    note?: string | undefined;
    at?: string | undefined;
    rosterEntryId?: string | undefined;
}, {
    employeeId: string;
    note?: string | undefined;
    at?: string | undefined;
    rosterEntryId?: string | undefined;
}>;
export type ClockInRequest = z.infer<typeof ClockInRequest>;
export declare const ClockOutRequest: z.ZodObject<{
    at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    at?: string | undefined;
}, {
    at?: string | undefined;
}>;
export type ClockOutRequest = z.infer<typeof ClockOutRequest>;
export declare const CorrectAttendanceRequest: z.ZodObject<{
    clockInAt: z.ZodString;
    clockOutAt: z.ZodString;
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
    clockInAt: string;
    clockOutAt: string;
}, {
    note: string;
    clockInAt: string;
    clockOutAt: string;
}>;
export type CorrectAttendanceRequest = z.infer<typeof CorrectAttendanceRequest>;
/** A type is archived, never deleted: requests and the ledger name it. */
export declare const LeaveTypeStatus: z.ZodEnum<["active", "archived"]>;
export type LeaveTypeStatus = z.infer<typeof LeaveTypeStatus>;
export declare const LeaveType: z.ZodObject<{
    name: z.ZodString;
    payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
    /** The share of a day's wage a `partial` type pays, 0 to 100. */
    paymentPercent: z.ZodNullable<z.ZodNumber>;
    /** Null: no balance is kept, as for unpaid leave. */
    yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
    accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
    reset: z.ZodEnum<["yearly", "monthly", "never"]>;
    carry: z.ZodEnum<["none", "carry", "carry_with_expiry"]>;
    carryMaxDays: z.ZodNumber;
    /** How long a carried lot lives; a compensatory type's days live as long. */
    carryExpiresMonths: z.ZodNullable<z.ZodNumber>;
    /** 0: approved at request; 1 or 2 steps (AC-LV7). */
    approvalSteps: z.ZodNumber;
    needsAttachment: z.ZodBoolean;
    /** Inside a range a weekly day off counts as a day of leave, as for maternity leave. */
    countsWeeklyOffs: z.ZodBoolean;
    countsHolidays: z.ZodBoolean;
    eligibleSex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    minServiceMonths: z.ZodNumber;
    oncePerEmployment: z.ZodBoolean;
    /** Never restricted by a restricted period (AC-LV9). */
    statutory: z.ZodBoolean;
    /** Self service may start it up to 30 days back, as for sick leave. */
    allowsPastRequests: z.ZodBoolean;
    encashable: z.ZodBoolean;
    /** Where compensatory days land (AC-LV8). */
    compensatory: z.ZodBoolean;
    seniorityEveryYears: z.ZodNullable<z.ZodNumber>;
    seniorityExtraDays: z.ZodNullable<z.ZodNumber>;
    seniorityCapDays: z.ZodNullable<z.ZodNumber>;
} & {
    id: z.ZodString;
    code: z.ZodString;
    status: z.ZodEnum<["active", "archived"]>;
    /** When the owner signed the type off as the business's policy; null while it is the configured value nobody verified. */
    verifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    verifiedByName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    status: "active" | "archived";
    name: string;
    id: string;
    payment: "paid" | "unpaid" | "partial";
    accrual: "none" | "monthly" | "yearly_upfront";
    carry: "none" | "carry" | "carry_with_expiry";
    paymentPercent: number | null;
    yearlyEntitlementDays: number | null;
    reset: "never" | "monthly" | "yearly";
    carryMaxDays: number;
    carryExpiresMonths: number | null;
    approvalSteps: number;
    needsAttachment: boolean;
    countsWeeklyOffs: boolean;
    countsHolidays: boolean;
    eligibleSex: "female" | "male" | null;
    minServiceMonths: number;
    oncePerEmployment: boolean;
    statutory: boolean;
    allowsPastRequests: boolean;
    encashable: boolean;
    compensatory: boolean;
    seniorityEveryYears: number | null;
    seniorityExtraDays: number | null;
    seniorityCapDays: number | null;
    verifiedAt?: string | null | undefined;
    verifiedByName?: string | null | undefined;
}, {
    code: string;
    status: "active" | "archived";
    name: string;
    id: string;
    payment: "paid" | "unpaid" | "partial";
    accrual: "none" | "monthly" | "yearly_upfront";
    carry: "none" | "carry" | "carry_with_expiry";
    paymentPercent: number | null;
    yearlyEntitlementDays: number | null;
    reset: "never" | "monthly" | "yearly";
    carryMaxDays: number;
    carryExpiresMonths: number | null;
    approvalSteps: number;
    needsAttachment: boolean;
    countsWeeklyOffs: boolean;
    countsHolidays: boolean;
    eligibleSex: "female" | "male" | null;
    minServiceMonths: number;
    oncePerEmployment: boolean;
    statutory: boolean;
    allowsPastRequests: boolean;
    encashable: boolean;
    compensatory: boolean;
    seniorityEveryYears: number | null;
    seniorityExtraDays: number | null;
    seniorityCapDays: number | null;
    verifiedAt?: string | null | undefined;
    verifiedByName?: string | null | undefined;
}>;
export type LeaveType = z.infer<typeof LeaveType>;
export declare const LeaveTypeList: z.ZodObject<{
    types: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
        /** The share of a day's wage a `partial` type pays, 0 to 100. */
        paymentPercent: z.ZodNullable<z.ZodNumber>;
        /** Null: no balance is kept, as for unpaid leave. */
        yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
        accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
        reset: z.ZodEnum<["yearly", "monthly", "never"]>;
        carry: z.ZodEnum<["none", "carry", "carry_with_expiry"]>;
        carryMaxDays: z.ZodNumber;
        /** How long a carried lot lives; a compensatory type's days live as long. */
        carryExpiresMonths: z.ZodNullable<z.ZodNumber>;
        /** 0: approved at request; 1 or 2 steps (AC-LV7). */
        approvalSteps: z.ZodNumber;
        needsAttachment: z.ZodBoolean;
        /** Inside a range a weekly day off counts as a day of leave, as for maternity leave. */
        countsWeeklyOffs: z.ZodBoolean;
        countsHolidays: z.ZodBoolean;
        eligibleSex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        minServiceMonths: z.ZodNumber;
        oncePerEmployment: z.ZodBoolean;
        /** Never restricted by a restricted period (AC-LV9). */
        statutory: z.ZodBoolean;
        /** Self service may start it up to 30 days back, as for sick leave. */
        allowsPastRequests: z.ZodBoolean;
        encashable: z.ZodBoolean;
        /** Where compensatory days land (AC-LV8). */
        compensatory: z.ZodBoolean;
        seniorityEveryYears: z.ZodNullable<z.ZodNumber>;
        seniorityExtraDays: z.ZodNullable<z.ZodNumber>;
        seniorityCapDays: z.ZodNullable<z.ZodNumber>;
    } & {
        id: z.ZodString;
        code: z.ZodString;
        status: z.ZodEnum<["active", "archived"]>;
        /** When the owner signed the type off as the business's policy; null while it is the configured value nobody verified. */
        verifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        verifiedByName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        status: "active" | "archived";
        name: string;
        id: string;
        payment: "paid" | "unpaid" | "partial";
        accrual: "none" | "monthly" | "yearly_upfront";
        carry: "none" | "carry" | "carry_with_expiry";
        paymentPercent: number | null;
        yearlyEntitlementDays: number | null;
        reset: "never" | "monthly" | "yearly";
        carryMaxDays: number;
        carryExpiresMonths: number | null;
        approvalSteps: number;
        needsAttachment: boolean;
        countsWeeklyOffs: boolean;
        countsHolidays: boolean;
        eligibleSex: "female" | "male" | null;
        minServiceMonths: number;
        oncePerEmployment: boolean;
        statutory: boolean;
        allowsPastRequests: boolean;
        encashable: boolean;
        compensatory: boolean;
        seniorityEveryYears: number | null;
        seniorityExtraDays: number | null;
        seniorityCapDays: number | null;
        verifiedAt?: string | null | undefined;
        verifiedByName?: string | null | undefined;
    }, {
        code: string;
        status: "active" | "archived";
        name: string;
        id: string;
        payment: "paid" | "unpaid" | "partial";
        accrual: "none" | "monthly" | "yearly_upfront";
        carry: "none" | "carry" | "carry_with_expiry";
        paymentPercent: number | null;
        yearlyEntitlementDays: number | null;
        reset: "never" | "monthly" | "yearly";
        carryMaxDays: number;
        carryExpiresMonths: number | null;
        approvalSteps: number;
        needsAttachment: boolean;
        countsWeeklyOffs: boolean;
        countsHolidays: boolean;
        eligibleSex: "female" | "male" | null;
        minServiceMonths: number;
        oncePerEmployment: boolean;
        statutory: boolean;
        allowsPastRequests: boolean;
        encashable: boolean;
        compensatory: boolean;
        seniorityEveryYears: number | null;
        seniorityExtraDays: number | null;
        seniorityCapDays: number | null;
        verifiedAt?: string | null | undefined;
        verifiedByName?: string | null | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    types: {
        code: string;
        status: "active" | "archived";
        name: string;
        id: string;
        payment: "paid" | "unpaid" | "partial";
        accrual: "none" | "monthly" | "yearly_upfront";
        carry: "none" | "carry" | "carry_with_expiry";
        paymentPercent: number | null;
        yearlyEntitlementDays: number | null;
        reset: "never" | "monthly" | "yearly";
        carryMaxDays: number;
        carryExpiresMonths: number | null;
        approvalSteps: number;
        needsAttachment: boolean;
        countsWeeklyOffs: boolean;
        countsHolidays: boolean;
        eligibleSex: "female" | "male" | null;
        minServiceMonths: number;
        oncePerEmployment: boolean;
        statutory: boolean;
        allowsPastRequests: boolean;
        encashable: boolean;
        compensatory: boolean;
        seniorityEveryYears: number | null;
        seniorityExtraDays: number | null;
        seniorityCapDays: number | null;
        verifiedAt?: string | null | undefined;
        verifiedByName?: string | null | undefined;
    }[];
}, {
    types: {
        code: string;
        status: "active" | "archived";
        name: string;
        id: string;
        payment: "paid" | "unpaid" | "partial";
        accrual: "none" | "monthly" | "yearly_upfront";
        carry: "none" | "carry" | "carry_with_expiry";
        paymentPercent: number | null;
        yearlyEntitlementDays: number | null;
        reset: "never" | "monthly" | "yearly";
        carryMaxDays: number;
        carryExpiresMonths: number | null;
        approvalSteps: number;
        needsAttachment: boolean;
        countsWeeklyOffs: boolean;
        countsHolidays: boolean;
        eligibleSex: "female" | "male" | null;
        minServiceMonths: number;
        oncePerEmployment: boolean;
        statutory: boolean;
        allowsPastRequests: boolean;
        encashable: boolean;
        compensatory: boolean;
        seniorityEveryYears: number | null;
        seniorityExtraDays: number | null;
        seniorityCapDays: number | null;
        verifiedAt?: string | null | undefined;
        verifiedByName?: string | null | undefined;
    }[];
}>;
export type LeaveTypeList = z.infer<typeof LeaveTypeList>;
/** `POST /ops/leave/types`: a business's own type. */
export declare const CreateLeaveTypeRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodString;
    payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
    /** The share of a day's wage a `partial` type pays, 0 to 100. */
    paymentPercent: z.ZodNullable<z.ZodNumber>;
    /** Null: no balance is kept, as for unpaid leave. */
    yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
    accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
    reset: z.ZodEnum<["yearly", "monthly", "never"]>;
    carry: z.ZodEnum<["none", "carry", "carry_with_expiry"]>;
    carryMaxDays: z.ZodNumber;
    /** How long a carried lot lives; a compensatory type's days live as long. */
    carryExpiresMonths: z.ZodNullable<z.ZodNumber>;
    /** 0: approved at request; 1 or 2 steps (AC-LV7). */
    approvalSteps: z.ZodNumber;
    needsAttachment: z.ZodBoolean;
    /** Inside a range a weekly day off counts as a day of leave, as for maternity leave. */
    countsWeeklyOffs: z.ZodBoolean;
    countsHolidays: z.ZodBoolean;
    eligibleSex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    minServiceMonths: z.ZodNumber;
    oncePerEmployment: z.ZodBoolean;
    /** Never restricted by a restricted period (AC-LV9). */
    statutory: z.ZodBoolean;
    /** Self service may start it up to 30 days back, as for sick leave. */
    allowsPastRequests: z.ZodBoolean;
    encashable: z.ZodBoolean;
    /** Where compensatory days land (AC-LV8). */
    compensatory: z.ZodBoolean;
    seniorityEveryYears: z.ZodNullable<z.ZodNumber>;
    seniorityExtraDays: z.ZodNullable<z.ZodNumber>;
    seniorityCapDays: z.ZodNullable<z.ZodNumber>;
} & {
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    payment: "paid" | "unpaid" | "partial";
    accrual: "none" | "monthly" | "yearly_upfront";
    carry: "none" | "carry" | "carry_with_expiry";
    paymentPercent: number | null;
    yearlyEntitlementDays: number | null;
    reset: "never" | "monthly" | "yearly";
    carryMaxDays: number;
    carryExpiresMonths: number | null;
    approvalSteps: number;
    needsAttachment: boolean;
    countsWeeklyOffs: boolean;
    countsHolidays: boolean;
    eligibleSex: "female" | "male" | null;
    minServiceMonths: number;
    oncePerEmployment: boolean;
    statutory: boolean;
    allowsPastRequests: boolean;
    encashable: boolean;
    compensatory: boolean;
    seniorityEveryYears: number | null;
    seniorityExtraDays: number | null;
    seniorityCapDays: number | null;
}, {
    code: string;
    name: string;
    payment: "paid" | "unpaid" | "partial";
    accrual: "none" | "monthly" | "yearly_upfront";
    carry: "none" | "carry" | "carry_with_expiry";
    paymentPercent: number | null;
    yearlyEntitlementDays: number | null;
    reset: "never" | "monthly" | "yearly";
    carryMaxDays: number;
    carryExpiresMonths: number | null;
    approvalSteps: number;
    needsAttachment: boolean;
    countsWeeklyOffs: boolean;
    countsHolidays: boolean;
    eligibleSex: "female" | "male" | null;
    minServiceMonths: number;
    oncePerEmployment: boolean;
    statutory: boolean;
    allowsPastRequests: boolean;
    encashable: boolean;
    compensatory: boolean;
    seniorityEveryYears: number | null;
    seniorityExtraDays: number | null;
    seniorityCapDays: number | null;
}>, {
    code: string;
    name: string;
    payment: "paid" | "unpaid" | "partial";
    accrual: "none" | "monthly" | "yearly_upfront";
    carry: "none" | "carry" | "carry_with_expiry";
    paymentPercent: number | null;
    yearlyEntitlementDays: number | null;
    reset: "never" | "monthly" | "yearly";
    carryMaxDays: number;
    carryExpiresMonths: number | null;
    approvalSteps: number;
    needsAttachment: boolean;
    countsWeeklyOffs: boolean;
    countsHolidays: boolean;
    eligibleSex: "female" | "male" | null;
    minServiceMonths: number;
    oncePerEmployment: boolean;
    statutory: boolean;
    allowsPastRequests: boolean;
    encashable: boolean;
    compensatory: boolean;
    seniorityEveryYears: number | null;
    seniorityExtraDays: number | null;
    seniorityCapDays: number | null;
}, {
    code: string;
    name: string;
    payment: "paid" | "unpaid" | "partial";
    accrual: "none" | "monthly" | "yearly_upfront";
    carry: "none" | "carry" | "carry_with_expiry";
    paymentPercent: number | null;
    yearlyEntitlementDays: number | null;
    reset: "never" | "monthly" | "yearly";
    carryMaxDays: number;
    carryExpiresMonths: number | null;
    approvalSteps: number;
    needsAttachment: boolean;
    countsWeeklyOffs: boolean;
    countsHolidays: boolean;
    eligibleSex: "female" | "male" | null;
    minServiceMonths: number;
    oncePerEmployment: boolean;
    statutory: boolean;
    allowsPastRequests: boolean;
    encashable: boolean;
    compensatory: boolean;
    seniorityEveryYears: number | null;
    seniorityExtraDays: number | null;
    seniorityCapDays: number | null;
}>;
export type CreateLeaveTypeRequest = z.infer<typeof CreateLeaveTypeRequest>;
/**
 * `PATCH /ops/leave/types/:id`: whole rule groups at once, so a check across
 * fields always sees both. An edit applies to requests made after it.
 */
export declare const UpdateLeaveTypeRequest: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    payment: z.ZodOptional<z.ZodEnum<["paid", "unpaid", "partial"]>>;
    paymentPercent: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    yearlyEntitlementDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    accrual: z.ZodOptional<z.ZodEnum<["yearly_upfront", "monthly", "none"]>>;
    reset: z.ZodOptional<z.ZodEnum<["yearly", "monthly", "never"]>>;
    carry: z.ZodOptional<z.ZodEnum<["none", "carry", "carry_with_expiry"]>>;
    carryMaxDays: z.ZodOptional<z.ZodNumber>;
    carryExpiresMonths: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    approvalSteps: z.ZodOptional<z.ZodNumber>;
    needsAttachment: z.ZodOptional<z.ZodBoolean>;
    countsWeeklyOffs: z.ZodOptional<z.ZodBoolean>;
    countsHolidays: z.ZodOptional<z.ZodBoolean>;
    eligibleSex: z.ZodOptional<z.ZodNullable<z.ZodEnum<["female", "male"]>>>;
    minServiceMonths: z.ZodOptional<z.ZodNumber>;
    oncePerEmployment: z.ZodOptional<z.ZodBoolean>;
    statutory: z.ZodOptional<z.ZodBoolean>;
    allowsPastRequests: z.ZodOptional<z.ZodBoolean>;
    encashable: z.ZodOptional<z.ZodBoolean>;
    compensatory: z.ZodOptional<z.ZodBoolean>;
    seniorityEveryYears: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    seniorityExtraDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    seniorityCapDays: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    status: z.ZodOptional<z.ZodEnum<["active", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    payment?: "paid" | "unpaid" | "partial" | undefined;
    accrual?: "none" | "monthly" | "yearly_upfront" | undefined;
    carry?: "none" | "carry" | "carry_with_expiry" | undefined;
    paymentPercent?: number | null | undefined;
    yearlyEntitlementDays?: number | null | undefined;
    reset?: "never" | "monthly" | "yearly" | undefined;
    carryMaxDays?: number | undefined;
    carryExpiresMonths?: number | null | undefined;
    approvalSteps?: number | undefined;
    needsAttachment?: boolean | undefined;
    countsWeeklyOffs?: boolean | undefined;
    countsHolidays?: boolean | undefined;
    eligibleSex?: "female" | "male" | null | undefined;
    minServiceMonths?: number | undefined;
    oncePerEmployment?: boolean | undefined;
    statutory?: boolean | undefined;
    allowsPastRequests?: boolean | undefined;
    encashable?: boolean | undefined;
    compensatory?: boolean | undefined;
    seniorityEveryYears?: number | null | undefined;
    seniorityExtraDays?: number | null | undefined;
    seniorityCapDays?: number | null | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    payment?: "paid" | "unpaid" | "partial" | undefined;
    accrual?: "none" | "monthly" | "yearly_upfront" | undefined;
    carry?: "none" | "carry" | "carry_with_expiry" | undefined;
    paymentPercent?: number | null | undefined;
    yearlyEntitlementDays?: number | null | undefined;
    reset?: "never" | "monthly" | "yearly" | undefined;
    carryMaxDays?: number | undefined;
    carryExpiresMonths?: number | null | undefined;
    approvalSteps?: number | undefined;
    needsAttachment?: boolean | undefined;
    countsWeeklyOffs?: boolean | undefined;
    countsHolidays?: boolean | undefined;
    eligibleSex?: "female" | "male" | null | undefined;
    minServiceMonths?: number | undefined;
    oncePerEmployment?: boolean | undefined;
    statutory?: boolean | undefined;
    allowsPastRequests?: boolean | undefined;
    encashable?: boolean | undefined;
    compensatory?: boolean | undefined;
    seniorityEveryYears?: number | null | undefined;
    seniorityExtraDays?: number | null | undefined;
    seniorityCapDays?: number | null | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    payment?: "paid" | "unpaid" | "partial" | undefined;
    accrual?: "none" | "monthly" | "yearly_upfront" | undefined;
    carry?: "none" | "carry" | "carry_with_expiry" | undefined;
    paymentPercent?: number | null | undefined;
    yearlyEntitlementDays?: number | null | undefined;
    reset?: "never" | "monthly" | "yearly" | undefined;
    carryMaxDays?: number | undefined;
    carryExpiresMonths?: number | null | undefined;
    approvalSteps?: number | undefined;
    needsAttachment?: boolean | undefined;
    countsWeeklyOffs?: boolean | undefined;
    countsHolidays?: boolean | undefined;
    eligibleSex?: "female" | "male" | null | undefined;
    minServiceMonths?: number | undefined;
    oncePerEmployment?: boolean | undefined;
    statutory?: boolean | undefined;
    allowsPastRequests?: boolean | undefined;
    encashable?: boolean | undefined;
    compensatory?: boolean | undefined;
    seniorityEveryYears?: number | null | undefined;
    seniorityExtraDays?: number | null | undefined;
    seniorityCapDays?: number | null | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    payment?: "paid" | "unpaid" | "partial" | undefined;
    accrual?: "none" | "monthly" | "yearly_upfront" | undefined;
    carry?: "none" | "carry" | "carry_with_expiry" | undefined;
    paymentPercent?: number | null | undefined;
    yearlyEntitlementDays?: number | null | undefined;
    reset?: "never" | "monthly" | "yearly" | undefined;
    carryMaxDays?: number | undefined;
    carryExpiresMonths?: number | null | undefined;
    approvalSteps?: number | undefined;
    needsAttachment?: boolean | undefined;
    countsWeeklyOffs?: boolean | undefined;
    countsHolidays?: boolean | undefined;
    eligibleSex?: "female" | "male" | null | undefined;
    minServiceMonths?: number | undefined;
    oncePerEmployment?: boolean | undefined;
    statutory?: boolean | undefined;
    allowsPastRequests?: boolean | undefined;
    encashable?: boolean | undefined;
    compensatory?: boolean | undefined;
    seniorityEveryYears?: number | null | undefined;
    seniorityExtraDays?: number | null | undefined;
    seniorityCapDays?: number | null | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    payment?: "paid" | "unpaid" | "partial" | undefined;
    accrual?: "none" | "monthly" | "yearly_upfront" | undefined;
    carry?: "none" | "carry" | "carry_with_expiry" | undefined;
    paymentPercent?: number | null | undefined;
    yearlyEntitlementDays?: number | null | undefined;
    reset?: "never" | "monthly" | "yearly" | undefined;
    carryMaxDays?: number | undefined;
    carryExpiresMonths?: number | null | undefined;
    approvalSteps?: number | undefined;
    needsAttachment?: boolean | undefined;
    countsWeeklyOffs?: boolean | undefined;
    countsHolidays?: boolean | undefined;
    eligibleSex?: "female" | "male" | null | undefined;
    minServiceMonths?: number | undefined;
    oncePerEmployment?: boolean | undefined;
    statutory?: boolean | undefined;
    allowsPastRequests?: boolean | undefined;
    encashable?: boolean | undefined;
    compensatory?: boolean | undefined;
    seniorityEveryYears?: number | null | undefined;
    seniorityExtraDays?: number | null | undefined;
    seniorityCapDays?: number | null | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
    payment?: "paid" | "unpaid" | "partial" | undefined;
    accrual?: "none" | "monthly" | "yearly_upfront" | undefined;
    carry?: "none" | "carry" | "carry_with_expiry" | undefined;
    paymentPercent?: number | null | undefined;
    yearlyEntitlementDays?: number | null | undefined;
    reset?: "never" | "monthly" | "yearly" | undefined;
    carryMaxDays?: number | undefined;
    carryExpiresMonths?: number | null | undefined;
    approvalSteps?: number | undefined;
    needsAttachment?: boolean | undefined;
    countsWeeklyOffs?: boolean | undefined;
    countsHolidays?: boolean | undefined;
    eligibleSex?: "female" | "male" | null | undefined;
    minServiceMonths?: number | undefined;
    oncePerEmployment?: boolean | undefined;
    statutory?: boolean | undefined;
    allowsPastRequests?: boolean | undefined;
    encashable?: boolean | undefined;
    compensatory?: boolean | undefined;
    seniorityEveryYears?: number | null | undefined;
    seniorityExtraDays?: number | null | undefined;
    seniorityCapDays?: number | null | undefined;
}>;
export type UpdateLeaveTypeRequest = z.infer<typeof UpdateLeaveTypeRequest>;
export declare const LeaveLedgerEntry: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment", "encashed"]>;
    /** Signed: credits add, debits subtract, a reversal undoes. */
    days: z.ZodNumber;
    effectiveOn: z.ZodString;
    periodKey: z.ZodNullable<z.ZodString>;
    leaveRequestId: z.ZodNullable<z.ZodString>;
    reason: z.ZodNullable<z.ZodString>;
    /** A credit's last day plus one (AC-LV2). */
    expiresOn: z.ZodNullable<z.ZodString>;
    /** The credit a debit draws from. */
    lotId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
    expiresOn: string | null;
    reason: string | null;
    days: number;
    effectiveOn: string;
    periodKey: string | null;
    leaveRequestId: string | null;
    lotId: string | null;
}, {
    id: string;
    kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
    expiresOn: string | null;
    reason: string | null;
    days: number;
    effectiveOn: string;
    periodKey: string | null;
    leaveRequestId: string | null;
    lotId: string | null;
}>;
export type LeaveLedgerEntry = z.infer<typeof LeaveLedgerEntry>;
/** One credit and what is left of it (AC-LV2): why a person has 4 days, not 6. */
export declare const LeaveLot: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["accrual", "carry_forward", "adjustment"]>;
    effectiveOn: z.ZodString;
    /** The last day it can be spent: its own expiry or its year's (or month's) end. */
    usableUntil: z.ZodNullable<z.ZodString>;
    creditDays: z.ZodNumber;
    remainingDays: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: "adjustment" | "accrual" | "carry_forward";
    effectiveOn: string;
    usableUntil: string | null;
    creditDays: number;
    remainingDays: number;
}, {
    id: string;
    kind: "adjustment" | "accrual" | "carry_forward";
    effectiveOn: string;
    usableUntil: string | null;
    creditDays: number;
    remainingDays: number;
}>;
export type LeaveLot = z.infer<typeof LeaveLot>;
/** A balance is only ever the sum of the ledger (AC-L4). */
export declare const LeaveBalance: z.ZodObject<{
    leaveType: z.ZodObject<{
        name: z.ZodString;
        payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
        /** The share of a day's wage a `partial` type pays, 0 to 100. */
        paymentPercent: z.ZodNullable<z.ZodNumber>;
        /** Null: no balance is kept, as for unpaid leave. */
        yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
        accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
        reset: z.ZodEnum<["yearly", "monthly", "never"]>;
        carry: z.ZodEnum<["none", "carry", "carry_with_expiry"]>;
        carryMaxDays: z.ZodNumber;
        /** How long a carried lot lives; a compensatory type's days live as long. */
        carryExpiresMonths: z.ZodNullable<z.ZodNumber>;
        /** 0: approved at request; 1 or 2 steps (AC-LV7). */
        approvalSteps: z.ZodNumber;
        needsAttachment: z.ZodBoolean;
        /** Inside a range a weekly day off counts as a day of leave, as for maternity leave. */
        countsWeeklyOffs: z.ZodBoolean;
        countsHolidays: z.ZodBoolean;
        eligibleSex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        minServiceMonths: z.ZodNumber;
        oncePerEmployment: z.ZodBoolean;
        /** Never restricted by a restricted period (AC-LV9). */
        statutory: z.ZodBoolean;
        /** Self service may start it up to 30 days back, as for sick leave. */
        allowsPastRequests: z.ZodBoolean;
        encashable: z.ZodBoolean;
        /** Where compensatory days land (AC-LV8). */
        compensatory: z.ZodBoolean;
        seniorityEveryYears: z.ZodNullable<z.ZodNumber>;
        seniorityExtraDays: z.ZodNullable<z.ZodNumber>;
        seniorityCapDays: z.ZodNullable<z.ZodNumber>;
    } & {
        id: z.ZodString;
        code: z.ZodString;
        status: z.ZodEnum<["active", "archived"]>;
        /** When the owner signed the type off as the business's policy; null while it is the configured value nobody verified. */
        verifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        verifiedByName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        status: "active" | "archived";
        name: string;
        id: string;
        payment: "paid" | "unpaid" | "partial";
        accrual: "none" | "monthly" | "yearly_upfront";
        carry: "none" | "carry" | "carry_with_expiry";
        paymentPercent: number | null;
        yearlyEntitlementDays: number | null;
        reset: "never" | "monthly" | "yearly";
        carryMaxDays: number;
        carryExpiresMonths: number | null;
        approvalSteps: number;
        needsAttachment: boolean;
        countsWeeklyOffs: boolean;
        countsHolidays: boolean;
        eligibleSex: "female" | "male" | null;
        minServiceMonths: number;
        oncePerEmployment: boolean;
        statutory: boolean;
        allowsPastRequests: boolean;
        encashable: boolean;
        compensatory: boolean;
        seniorityEveryYears: number | null;
        seniorityExtraDays: number | null;
        seniorityCapDays: number | null;
        verifiedAt?: string | null | undefined;
        verifiedByName?: string | null | undefined;
    }, {
        code: string;
        status: "active" | "archived";
        name: string;
        id: string;
        payment: "paid" | "unpaid" | "partial";
        accrual: "none" | "monthly" | "yearly_upfront";
        carry: "none" | "carry" | "carry_with_expiry";
        paymentPercent: number | null;
        yearlyEntitlementDays: number | null;
        reset: "never" | "monthly" | "yearly";
        carryMaxDays: number;
        carryExpiresMonths: number | null;
        approvalSteps: number;
        needsAttachment: boolean;
        countsWeeklyOffs: boolean;
        countsHolidays: boolean;
        eligibleSex: "female" | "male" | null;
        minServiceMonths: number;
        oncePerEmployment: boolean;
        statutory: boolean;
        allowsPastRequests: boolean;
        encashable: boolean;
        compensatory: boolean;
        seniorityEveryYears: number | null;
        seniorityExtraDays: number | null;
        seniorityCapDays: number | null;
        verifiedAt?: string | null | undefined;
        verifiedByName?: string | null | undefined;
    }>;
    /** Null for a type that keeps no balance. */
    balanceDays: z.ZodNullable<z.ZodNumber>;
    /** The lots with days left, soonest to expire first. */
    lots: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["accrual", "carry_forward", "adjustment"]>;
        effectiveOn: z.ZodString;
        /** The last day it can be spent: its own expiry or its year's (or month's) end. */
        usableUntil: z.ZodNullable<z.ZodString>;
        creditDays: z.ZodNumber;
        remainingDays: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "adjustment" | "accrual" | "carry_forward";
        effectiveOn: string;
        usableUntil: string | null;
        creditDays: number;
        remainingDays: number;
    }, {
        id: string;
        kind: "adjustment" | "accrual" | "carry_forward";
        effectiveOn: string;
        usableUntil: string | null;
        creditDays: number;
        remainingDays: number;
    }>, "many">;
    entries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment", "encashed"]>;
        /** Signed: credits add, debits subtract, a reversal undoes. */
        days: z.ZodNumber;
        effectiveOn: z.ZodString;
        periodKey: z.ZodNullable<z.ZodString>;
        leaveRequestId: z.ZodNullable<z.ZodString>;
        reason: z.ZodNullable<z.ZodString>;
        /** A credit's last day plus one (AC-LV2). */
        expiresOn: z.ZodNullable<z.ZodString>;
        /** The credit a debit draws from. */
        lotId: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
        expiresOn: string | null;
        reason: string | null;
        days: number;
        effectiveOn: string;
        periodKey: string | null;
        leaveRequestId: string | null;
        lotId: string | null;
    }, {
        id: string;
        kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
        expiresOn: string | null;
        reason: string | null;
        days: number;
        effectiveOn: string;
        periodKey: string | null;
        leaveRequestId: string | null;
        lotId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        id: string;
        kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
        expiresOn: string | null;
        reason: string | null;
        days: number;
        effectiveOn: string;
        periodKey: string | null;
        leaveRequestId: string | null;
        lotId: string | null;
    }[];
    leaveType: {
        code: string;
        status: "active" | "archived";
        name: string;
        id: string;
        payment: "paid" | "unpaid" | "partial";
        accrual: "none" | "monthly" | "yearly_upfront";
        carry: "none" | "carry" | "carry_with_expiry";
        paymentPercent: number | null;
        yearlyEntitlementDays: number | null;
        reset: "never" | "monthly" | "yearly";
        carryMaxDays: number;
        carryExpiresMonths: number | null;
        approvalSteps: number;
        needsAttachment: boolean;
        countsWeeklyOffs: boolean;
        countsHolidays: boolean;
        eligibleSex: "female" | "male" | null;
        minServiceMonths: number;
        oncePerEmployment: boolean;
        statutory: boolean;
        allowsPastRequests: boolean;
        encashable: boolean;
        compensatory: boolean;
        seniorityEveryYears: number | null;
        seniorityExtraDays: number | null;
        seniorityCapDays: number | null;
        verifiedAt?: string | null | undefined;
        verifiedByName?: string | null | undefined;
    };
    balanceDays: number | null;
    lots: {
        id: string;
        kind: "adjustment" | "accrual" | "carry_forward";
        effectiveOn: string;
        usableUntil: string | null;
        creditDays: number;
        remainingDays: number;
    }[];
}, {
    entries: {
        id: string;
        kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
        expiresOn: string | null;
        reason: string | null;
        days: number;
        effectiveOn: string;
        periodKey: string | null;
        leaveRequestId: string | null;
        lotId: string | null;
    }[];
    leaveType: {
        code: string;
        status: "active" | "archived";
        name: string;
        id: string;
        payment: "paid" | "unpaid" | "partial";
        accrual: "none" | "monthly" | "yearly_upfront";
        carry: "none" | "carry" | "carry_with_expiry";
        paymentPercent: number | null;
        yearlyEntitlementDays: number | null;
        reset: "never" | "monthly" | "yearly";
        carryMaxDays: number;
        carryExpiresMonths: number | null;
        approvalSteps: number;
        needsAttachment: boolean;
        countsWeeklyOffs: boolean;
        countsHolidays: boolean;
        eligibleSex: "female" | "male" | null;
        minServiceMonths: number;
        oncePerEmployment: boolean;
        statutory: boolean;
        allowsPastRequests: boolean;
        encashable: boolean;
        compensatory: boolean;
        seniorityEveryYears: number | null;
        seniorityExtraDays: number | null;
        seniorityCapDays: number | null;
        verifiedAt?: string | null | undefined;
        verifiedByName?: string | null | undefined;
    };
    balanceDays: number | null;
    lots: {
        id: string;
        kind: "adjustment" | "accrual" | "carry_forward";
        effectiveOn: string;
        usableUntil: string | null;
        creditDays: number;
        remainingDays: number;
    }[];
}>;
export type LeaveBalance = z.infer<typeof LeaveBalance>;
export declare const LeaveBalances: z.ZodObject<{
    employeeId: z.ZodString;
    balances: z.ZodArray<z.ZodObject<{
        leaveType: z.ZodObject<{
            name: z.ZodString;
            payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
            /** The share of a day's wage a `partial` type pays, 0 to 100. */
            paymentPercent: z.ZodNullable<z.ZodNumber>;
            /** Null: no balance is kept, as for unpaid leave. */
            yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
            accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
            reset: z.ZodEnum<["yearly", "monthly", "never"]>;
            carry: z.ZodEnum<["none", "carry", "carry_with_expiry"]>;
            carryMaxDays: z.ZodNumber;
            /** How long a carried lot lives; a compensatory type's days live as long. */
            carryExpiresMonths: z.ZodNullable<z.ZodNumber>;
            /** 0: approved at request; 1 or 2 steps (AC-LV7). */
            approvalSteps: z.ZodNumber;
            needsAttachment: z.ZodBoolean;
            /** Inside a range a weekly day off counts as a day of leave, as for maternity leave. */
            countsWeeklyOffs: z.ZodBoolean;
            countsHolidays: z.ZodBoolean;
            eligibleSex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
            minServiceMonths: z.ZodNumber;
            oncePerEmployment: z.ZodBoolean;
            /** Never restricted by a restricted period (AC-LV9). */
            statutory: z.ZodBoolean;
            /** Self service may start it up to 30 days back, as for sick leave. */
            allowsPastRequests: z.ZodBoolean;
            encashable: z.ZodBoolean;
            /** Where compensatory days land (AC-LV8). */
            compensatory: z.ZodBoolean;
            seniorityEveryYears: z.ZodNullable<z.ZodNumber>;
            seniorityExtraDays: z.ZodNullable<z.ZodNumber>;
            seniorityCapDays: z.ZodNullable<z.ZodNumber>;
        } & {
            id: z.ZodString;
            code: z.ZodString;
            status: z.ZodEnum<["active", "archived"]>;
            /** When the owner signed the type off as the business's policy; null while it is the configured value nobody verified. */
            verifiedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
            verifiedByName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            status: "active" | "archived";
            name: string;
            id: string;
            payment: "paid" | "unpaid" | "partial";
            accrual: "none" | "monthly" | "yearly_upfront";
            carry: "none" | "carry" | "carry_with_expiry";
            paymentPercent: number | null;
            yearlyEntitlementDays: number | null;
            reset: "never" | "monthly" | "yearly";
            carryMaxDays: number;
            carryExpiresMonths: number | null;
            approvalSteps: number;
            needsAttachment: boolean;
            countsWeeklyOffs: boolean;
            countsHolidays: boolean;
            eligibleSex: "female" | "male" | null;
            minServiceMonths: number;
            oncePerEmployment: boolean;
            statutory: boolean;
            allowsPastRequests: boolean;
            encashable: boolean;
            compensatory: boolean;
            seniorityEveryYears: number | null;
            seniorityExtraDays: number | null;
            seniorityCapDays: number | null;
            verifiedAt?: string | null | undefined;
            verifiedByName?: string | null | undefined;
        }, {
            code: string;
            status: "active" | "archived";
            name: string;
            id: string;
            payment: "paid" | "unpaid" | "partial";
            accrual: "none" | "monthly" | "yearly_upfront";
            carry: "none" | "carry" | "carry_with_expiry";
            paymentPercent: number | null;
            yearlyEntitlementDays: number | null;
            reset: "never" | "monthly" | "yearly";
            carryMaxDays: number;
            carryExpiresMonths: number | null;
            approvalSteps: number;
            needsAttachment: boolean;
            countsWeeklyOffs: boolean;
            countsHolidays: boolean;
            eligibleSex: "female" | "male" | null;
            minServiceMonths: number;
            oncePerEmployment: boolean;
            statutory: boolean;
            allowsPastRequests: boolean;
            encashable: boolean;
            compensatory: boolean;
            seniorityEveryYears: number | null;
            seniorityExtraDays: number | null;
            seniorityCapDays: number | null;
            verifiedAt?: string | null | undefined;
            verifiedByName?: string | null | undefined;
        }>;
        /** Null for a type that keeps no balance. */
        balanceDays: z.ZodNullable<z.ZodNumber>;
        /** The lots with days left, soonest to expire first. */
        lots: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["accrual", "carry_forward", "adjustment"]>;
            effectiveOn: z.ZodString;
            /** The last day it can be spent: its own expiry or its year's (or month's) end. */
            usableUntil: z.ZodNullable<z.ZodString>;
            creditDays: z.ZodNumber;
            remainingDays: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "adjustment" | "accrual" | "carry_forward";
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }, {
            id: string;
            kind: "adjustment" | "accrual" | "carry_forward";
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }>, "many">;
        entries: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment", "encashed"]>;
            /** Signed: credits add, debits subtract, a reversal undoes. */
            days: z.ZodNumber;
            effectiveOn: z.ZodString;
            periodKey: z.ZodNullable<z.ZodString>;
            leaveRequestId: z.ZodNullable<z.ZodString>;
            reason: z.ZodNullable<z.ZodString>;
            /** A credit's last day plus one (AC-LV2). */
            expiresOn: z.ZodNullable<z.ZodString>;
            /** The credit a debit draws from. */
            lotId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            id: string;
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
            lotId: string | null;
        }, {
            id: string;
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
            lotId: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            id: string;
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
            lotId: string | null;
        }[];
        leaveType: {
            code: string;
            status: "active" | "archived";
            name: string;
            id: string;
            payment: "paid" | "unpaid" | "partial";
            accrual: "none" | "monthly" | "yearly_upfront";
            carry: "none" | "carry" | "carry_with_expiry";
            paymentPercent: number | null;
            yearlyEntitlementDays: number | null;
            reset: "never" | "monthly" | "yearly";
            carryMaxDays: number;
            carryExpiresMonths: number | null;
            approvalSteps: number;
            needsAttachment: boolean;
            countsWeeklyOffs: boolean;
            countsHolidays: boolean;
            eligibleSex: "female" | "male" | null;
            minServiceMonths: number;
            oncePerEmployment: boolean;
            statutory: boolean;
            allowsPastRequests: boolean;
            encashable: boolean;
            compensatory: boolean;
            seniorityEveryYears: number | null;
            seniorityExtraDays: number | null;
            seniorityCapDays: number | null;
            verifiedAt?: string | null | undefined;
            verifiedByName?: string | null | undefined;
        };
        balanceDays: number | null;
        lots: {
            id: string;
            kind: "adjustment" | "accrual" | "carry_forward";
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }[];
    }, {
        entries: {
            id: string;
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
            lotId: string | null;
        }[];
        leaveType: {
            code: string;
            status: "active" | "archived";
            name: string;
            id: string;
            payment: "paid" | "unpaid" | "partial";
            accrual: "none" | "monthly" | "yearly_upfront";
            carry: "none" | "carry" | "carry_with_expiry";
            paymentPercent: number | null;
            yearlyEntitlementDays: number | null;
            reset: "never" | "monthly" | "yearly";
            carryMaxDays: number;
            carryExpiresMonths: number | null;
            approvalSteps: number;
            needsAttachment: boolean;
            countsWeeklyOffs: boolean;
            countsHolidays: boolean;
            eligibleSex: "female" | "male" | null;
            minServiceMonths: number;
            oncePerEmployment: boolean;
            statutory: boolean;
            allowsPastRequests: boolean;
            encashable: boolean;
            compensatory: boolean;
            seniorityEveryYears: number | null;
            seniorityExtraDays: number | null;
            seniorityCapDays: number | null;
            verifiedAt?: string | null | undefined;
            verifiedByName?: string | null | undefined;
        };
        balanceDays: number | null;
        lots: {
            id: string;
            kind: "adjustment" | "accrual" | "carry_forward";
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    balances: {
        entries: {
            id: string;
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
            lotId: string | null;
        }[];
        leaveType: {
            code: string;
            status: "active" | "archived";
            name: string;
            id: string;
            payment: "paid" | "unpaid" | "partial";
            accrual: "none" | "monthly" | "yearly_upfront";
            carry: "none" | "carry" | "carry_with_expiry";
            paymentPercent: number | null;
            yearlyEntitlementDays: number | null;
            reset: "never" | "monthly" | "yearly";
            carryMaxDays: number;
            carryExpiresMonths: number | null;
            approvalSteps: number;
            needsAttachment: boolean;
            countsWeeklyOffs: boolean;
            countsHolidays: boolean;
            eligibleSex: "female" | "male" | null;
            minServiceMonths: number;
            oncePerEmployment: boolean;
            statutory: boolean;
            allowsPastRequests: boolean;
            encashable: boolean;
            compensatory: boolean;
            seniorityEveryYears: number | null;
            seniorityExtraDays: number | null;
            seniorityCapDays: number | null;
            verifiedAt?: string | null | undefined;
            verifiedByName?: string | null | undefined;
        };
        balanceDays: number | null;
        lots: {
            id: string;
            kind: "adjustment" | "accrual" | "carry_forward";
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }[];
    }[];
}, {
    employeeId: string;
    balances: {
        entries: {
            id: string;
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
            lotId: string | null;
        }[];
        leaveType: {
            code: string;
            status: "active" | "archived";
            name: string;
            id: string;
            payment: "paid" | "unpaid" | "partial";
            accrual: "none" | "monthly" | "yearly_upfront";
            carry: "none" | "carry" | "carry_with_expiry";
            paymentPercent: number | null;
            yearlyEntitlementDays: number | null;
            reset: "never" | "monthly" | "yearly";
            carryMaxDays: number;
            carryExpiresMonths: number | null;
            approvalSteps: number;
            needsAttachment: boolean;
            countsWeeklyOffs: boolean;
            countsHolidays: boolean;
            eligibleSex: "female" | "male" | null;
            minServiceMonths: number;
            oncePerEmployment: boolean;
            statutory: boolean;
            allowsPastRequests: boolean;
            encashable: boolean;
            compensatory: boolean;
            seniorityEveryYears: number | null;
            seniorityExtraDays: number | null;
            seniorityCapDays: number | null;
            verifiedAt?: string | null | undefined;
            verifiedByName?: string | null | undefined;
        };
        balanceDays: number | null;
        lots: {
            id: string;
            kind: "adjustment" | "accrual" | "carry_forward";
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }[];
    }[];
}>;
export type LeaveBalances = z.infer<typeof LeaveBalances>;
export declare const LeaveRequest: z.ZodObject<{
    id: z.ZodString;
    employee: z.ZodObject<{
        employeeId: z.ZodString;
        /** The preferred name, else the legal name. */
        displayName: z.ZodString;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }>;
    /** The branch the person works at: what branch limits read and a page groups by. */
    branchId: z.ZodNullable<z.ZodString>;
    leaveType: z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        id: string;
    }, {
        code: string;
        name: string;
        id: string;
    }>;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    startHalf: z.ZodEnum<["full", "second_half"]>;
    endHalf: z.ZodEnum<["full", "first_half"]>;
    /** Estimated at request; the approved figure once approved. */
    days: z.ZodNumber;
    reason: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
    /** The reporting manager at request time. Orders the queue; grants nothing. */
    routedToEmployeeId: z.ZodNullable<z.ZodString>;
    routedToName: z.ZodNullable<z.ZodString>;
    /** Whether the caller is the manager this request was routed to. */
    routedToMe: z.ZodBoolean;
    decidedAt: z.ZodNullable<z.ZodString>;
    decisionNote: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
    paymentPercent: z.ZodNullable<z.ZodNumber>;
    /** 0, 1 or 2, copied from the type at request (AC-LV7). */
    approvalSteps: z.ZodNumber;
    /** The step a waiting request is at. */
    currentStep: z.ZodNumber;
    /** Each step decided so far, in order. */
    approvals: z.ZodArray<z.ZodObject<{
        step: z.ZodNumber;
        decision: z.ZodEnum<["approved", "rejected", "skipped"]>;
        decidedByName: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        decision: "approved" | "rejected" | "skipped";
        decidedAt: string;
        note: string | null;
        decidedByName: string | null;
        step: number;
    }, {
        decision: "approved" | "rejected" | "skipped";
        decidedAt: string;
        note: string | null;
        decidedByName: string | null;
        step: number;
    }>, "many">;
    /** A sick note or the like is attached; read it through its own route. */
    hasAttachment: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected" | "cancelled" | "requested";
    id: string;
    decidedAt: string | null;
    reason: string | null;
    startsOn: string;
    decisionNote: string | null;
    payment: "paid" | "unpaid" | "partial";
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    endsOn: string;
    branchId: string | null;
    paymentPercent: number | null;
    approvalSteps: number;
    days: number;
    leaveType: {
        code: string;
        name: string;
        id: string;
    };
    startHalf: "full" | "second_half";
    endHalf: "full" | "first_half";
    routedToEmployeeId: string | null;
    routedToName: string | null;
    routedToMe: boolean;
    currentStep: number;
    approvals: {
        decision: "approved" | "rejected" | "skipped";
        decidedAt: string;
        note: string | null;
        decidedByName: string | null;
        step: number;
    }[];
    hasAttachment: boolean;
}, {
    status: "approved" | "rejected" | "cancelled" | "requested";
    id: string;
    decidedAt: string | null;
    reason: string | null;
    startsOn: string;
    decisionNote: string | null;
    payment: "paid" | "unpaid" | "partial";
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    endsOn: string;
    branchId: string | null;
    paymentPercent: number | null;
    approvalSteps: number;
    days: number;
    leaveType: {
        code: string;
        name: string;
        id: string;
    };
    startHalf: "full" | "second_half";
    endHalf: "full" | "first_half";
    routedToEmployeeId: string | null;
    routedToName: string | null;
    routedToMe: boolean;
    currentStep: number;
    approvals: {
        decision: "approved" | "rejected" | "skipped";
        decidedAt: string;
        note: string | null;
        decidedByName: string | null;
        step: number;
    }[];
    hasAttachment: boolean;
}>;
export type LeaveRequest = z.infer<typeof LeaveRequest>;
/** The fields a person and the office both ask with (058-leave AC-LV6). */
export declare const LeaveAsk: z.ZodObject<{
    leaveTypeId: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    startHalf: z.ZodOptional<z.ZodEnum<["full", "second_half"]>>;
    endHalf: z.ZodOptional<z.ZodEnum<["full", "first_half"]>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** An uploaded attachment's key (`POST /ops/hr/files` or `/me/work/:id/files`, purpose `attachment`). */
    attachmentKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    startsOn: string;
    endsOn: string;
    leaveTypeId: string;
    reason?: string | null | undefined;
    startHalf?: "full" | "second_half" | undefined;
    endHalf?: "full" | "first_half" | undefined;
    attachmentKey?: string | null | undefined;
}, {
    startsOn: string;
    endsOn: string;
    leaveTypeId: string;
    reason?: string | null | undefined;
    startHalf?: "full" | "second_half" | undefined;
    endHalf?: "full" | "first_half" | undefined;
    attachmentKey?: string | null | undefined;
}>;
export declare const CreateLeaveRequestRequest: z.ZodObject<{
    leaveTypeId: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    startHalf: z.ZodOptional<z.ZodEnum<["full", "second_half"]>>;
    endHalf: z.ZodOptional<z.ZodEnum<["full", "first_half"]>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** An uploaded attachment's key (`POST /ops/hr/files` or `/me/work/:id/files`, purpose `attachment`). */
    attachmentKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
} & {
    employeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    startsOn: string;
    endsOn: string;
    employeeId: string;
    leaveTypeId: string;
    reason?: string | null | undefined;
    startHalf?: "full" | "second_half" | undefined;
    endHalf?: "full" | "first_half" | undefined;
    attachmentKey?: string | null | undefined;
}, {
    startsOn: string;
    endsOn: string;
    employeeId: string;
    leaveTypeId: string;
    reason?: string | null | undefined;
    startHalf?: "full" | "second_half" | undefined;
    endHalf?: "full" | "first_half" | undefined;
    attachmentKey?: string | null | undefined;
}>;
export type CreateLeaveRequestRequest = z.infer<typeof CreateLeaveRequestRequest>;
/** The same through self service: the person's own file is the path. */
export declare const CreateMyLeaveRequestRequest: z.ZodObject<{
    leaveTypeId: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    startHalf: z.ZodOptional<z.ZodEnum<["full", "second_half"]>>;
    endHalf: z.ZodOptional<z.ZodEnum<["full", "first_half"]>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** An uploaded attachment's key (`POST /ops/hr/files` or `/me/work/:id/files`, purpose `attachment`). */
    attachmentKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    startsOn: string;
    endsOn: string;
    leaveTypeId: string;
    reason?: string | null | undefined;
    startHalf?: "full" | "second_half" | undefined;
    endHalf?: "full" | "first_half" | undefined;
    attachmentKey?: string | null | undefined;
}, {
    startsOn: string;
    endsOn: string;
    leaveTypeId: string;
    reason?: string | null | undefined;
    startHalf?: "full" | "second_half" | undefined;
    endHalf?: "full" | "first_half" | undefined;
    attachmentKey?: string | null | undefined;
}>;
export type CreateMyLeaveRequestRequest = z.infer<typeof CreateMyLeaveRequestRequest>;
export declare const LeaveDecisionRequest: z.ZodObject<{
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
}, {
    note?: string | null | undefined;
}>;
export type LeaveDecisionRequest = z.infer<typeof LeaveDecisionRequest>;
//# sourceMappingURL=people.d.ts.map