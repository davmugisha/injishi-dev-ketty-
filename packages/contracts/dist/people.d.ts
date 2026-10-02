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
export declare const AttendanceSource: z.ZodEnum<["supervisor", "self"]>;
export type AttendanceSource = z.infer<typeof AttendanceSource>;
/** `closed` becomes `superseded` only when a correction replaces it. */
export declare const AttendanceStatus: z.ZodEnum<["open", "closed", "superseded"]>;
export type AttendanceStatus = z.infer<typeof AttendanceStatus>;
export declare const LeaveAccrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
export type LeaveAccrual = z.infer<typeof LeaveAccrual>;
export declare const LeaveEntryKind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment"]>;
export type LeaveEntryKind = z.infer<typeof LeaveEntryKind>;
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
/** A contract as `people.view` reads it: no wage. */
export declare const EmploymentContractBasic: z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
    startsOn: z.ZodString;
    /** Null: open ended. */
    endsOn: z.ZodNullable<z.ZodString>;
    wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
    status: z.ZodEnum<["scheduled", "active", "ended"]>;
    endReason: z.ZodNullable<z.ZodString>;
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
    endReason: string | null;
    view: "basic";
}, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    endReason: string | null;
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
    endReason: z.ZodNullable<z.ZodString>;
} & {
    view: z.ZodLiteral<"full">;
    wageRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    endReason: string | null;
    view: "full";
    wageRwf: number;
}, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    endReason: string | null;
    view: "full";
    wageRwf: number;
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
    endReason: z.ZodNullable<z.ZodString>;
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
    endReason: string | null;
    view: "basic";
}, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    endReason: string | null;
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
    endReason: z.ZodNullable<z.ZodString>;
} & {
    view: z.ZodLiteral<"full">;
    wageRwf: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    endReason: string | null;
    view: "full";
    wageRwf: number;
}, {
    status: "active" | "scheduled" | "ended";
    id: string;
    startsOn: string;
    endsOn: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    endReason: string | null;
    view: "full";
    wageRwf: number;
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
    sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    workPropertyId: z.ZodNullable<z.ZodString>;
    workPropertyName: z.ZodNullable<z.ZodString>;
    jobPositionId: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    reportingManagerId: z.ZodNullable<z.ZodString>;
    reportingManagerName: z.ZodNullable<z.ZodString>;
    hiredOn: z.ZodString;
    status: z.ZodEnum<["active", "offboarded"]>;
    offboardedOn: z.ZodNullable<z.ZodString>;
    offboardReason: z.ZodNullable<z.ZodString>;
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.ZodBoolean;
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
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
        endReason: z.ZodNullable<z.ZodString>;
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
        endReason: string | null;
        view: "basic";
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "basic";
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    email: string | null;
    legalName: string;
    id: string;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    phone: string | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "basic";
    employeeNumber: string;
    preferredName: string | null;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    offboardReason: string | null;
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
        endReason: string | null;
        view: "basic";
    } | null;
}, {
    status: "active" | "offboarded";
    email: string | null;
    legalName: string;
    id: string;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    phone: string | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "basic";
    employeeNumber: string;
    preferredName: string | null;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    offboardReason: string | null;
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
        endReason: string | null;
        view: "basic";
    } | null;
}>;
export type EmployeeBasic = z.infer<typeof EmployeeBasic>;
/** A file with the sensitive fields, for `people.manage` or `payroll.run`. */
export declare const EmployeeFull: z.ZodObject<{
    id: z.ZodString;
    employeeNumber: z.ZodString;
    legalName: z.ZodString;
    preferredName: z.ZodNullable<z.ZodString>;
    displayName: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
    email: z.ZodNullable<z.ZodString>;
    sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    workPropertyId: z.ZodNullable<z.ZodString>;
    workPropertyName: z.ZodNullable<z.ZodString>;
    jobPositionId: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    reportingManagerId: z.ZodNullable<z.ZodString>;
    reportingManagerName: z.ZodNullable<z.ZodString>;
    hiredOn: z.ZodString;
    status: z.ZodEnum<["active", "offboarded"]>;
    offboardedOn: z.ZodNullable<z.ZodString>;
    offboardReason: z.ZodNullable<z.ZodString>;
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.ZodBoolean;
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
    detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
} & {
    view: z.ZodLiteral<"full">;
    dateOfBirth: z.ZodNullable<z.ZodString>;
    idDocumentType: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
    idDocumentNumber: z.ZodNullable<z.ZodString>;
    rssbNumber: z.ZodNullable<z.ZodString>;
    currentContract: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
        endReason: z.ZodNullable<z.ZodString>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    dateOfBirth: string | null;
    email: string | null;
    legalName: string;
    id: string;
    idDocumentType: "national_id" | "passport" | null;
    idDocumentNumber: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    phone: string | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "full";
    employeeNumber: string;
    preferredName: string | null;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    offboardReason: string | null;
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
        endReason: string | null;
        view: "full";
        wageRwf: number;
    } | null;
    rssbNumber: string | null;
}, {
    status: "active" | "offboarded";
    dateOfBirth: string | null;
    email: string | null;
    legalName: string;
    id: string;
    idDocumentType: "national_id" | "passport" | null;
    idDocumentNumber: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    phone: string | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "full";
    employeeNumber: string;
    preferredName: string | null;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    offboardReason: string | null;
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
        endReason: string | null;
        view: "full";
        wageRwf: number;
    } | null;
    rssbNumber: string | null;
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
    sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    workPropertyId: z.ZodNullable<z.ZodString>;
    workPropertyName: z.ZodNullable<z.ZodString>;
    jobPositionId: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    reportingManagerId: z.ZodNullable<z.ZodString>;
    reportingManagerName: z.ZodNullable<z.ZodString>;
    hiredOn: z.ZodString;
    status: z.ZodEnum<["active", "offboarded"]>;
    offboardedOn: z.ZodNullable<z.ZodString>;
    offboardReason: z.ZodNullable<z.ZodString>;
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.ZodBoolean;
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
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
        endReason: z.ZodNullable<z.ZodString>;
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
        endReason: string | null;
        view: "basic";
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "basic";
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    email: string | null;
    legalName: string;
    id: string;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    phone: string | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "basic";
    employeeNumber: string;
    preferredName: string | null;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    offboardReason: string | null;
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
        endReason: string | null;
        view: "basic";
    } | null;
}, {
    status: "active" | "offboarded";
    email: string | null;
    legalName: string;
    id: string;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    phone: string | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "basic";
    employeeNumber: string;
    preferredName: string | null;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    offboardReason: string | null;
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
        endReason: string | null;
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
    sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    workPropertyId: z.ZodNullable<z.ZodString>;
    workPropertyName: z.ZodNullable<z.ZodString>;
    jobPositionId: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    reportingManagerId: z.ZodNullable<z.ZodString>;
    reportingManagerName: z.ZodNullable<z.ZodString>;
    hiredOn: z.ZodString;
    status: z.ZodEnum<["active", "offboarded"]>;
    offboardedOn: z.ZodNullable<z.ZodString>;
    offboardReason: z.ZodNullable<z.ZodString>;
    /** Whether the file is linked to an account (an `org_memberships` row). */
    hasAccount: z.ZodBoolean;
    /** The role that account holds here, when it does. Never held by the file. */
    orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
    detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
} & {
    view: z.ZodLiteral<"full">;
    dateOfBirth: z.ZodNullable<z.ZodString>;
    idDocumentType: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
    idDocumentNumber: z.ZodNullable<z.ZodString>;
    rssbNumber: z.ZodNullable<z.ZodString>;
    currentContract: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        /** Null: open ended. */
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
        endReason: z.ZodNullable<z.ZodString>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    dateOfBirth: string | null;
    email: string | null;
    legalName: string;
    id: string;
    idDocumentType: "national_id" | "passport" | null;
    idDocumentNumber: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    phone: string | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "full";
    employeeNumber: string;
    preferredName: string | null;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    offboardReason: string | null;
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
        endReason: string | null;
        view: "full";
        wageRwf: number;
    } | null;
    rssbNumber: string | null;
}, {
    status: "active" | "offboarded";
    dateOfBirth: string | null;
    email: string | null;
    legalName: string;
    id: string;
    idDocumentType: "national_id" | "passport" | null;
    idDocumentNumber: string | null;
    orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
    phone: string | null;
    sex: "female" | "male" | null;
    displayName: string;
    jobPositionTitle: string | null;
    view: "full";
    employeeNumber: string;
    preferredName: string | null;
    workPropertyId: string | null;
    workPropertyName: string | null;
    jobPositionId: string | null;
    reportingManagerId: string | null;
    reportingManagerName: string | null;
    hiredOn: string;
    offboardedOn: string | null;
    offboardReason: string | null;
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
        endReason: string | null;
        view: "full";
        wageRwf: number;
    } | null;
    rssbNumber: string | null;
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
        sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        workPropertyId: z.ZodNullable<z.ZodString>;
        workPropertyName: z.ZodNullable<z.ZodString>;
        jobPositionId: z.ZodNullable<z.ZodString>;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
        reportingManagerId: z.ZodNullable<z.ZodString>;
        reportingManagerName: z.ZodNullable<z.ZodString>;
        hiredOn: z.ZodString;
        status: z.ZodEnum<["active", "offboarded"]>;
        offboardedOn: z.ZodNullable<z.ZodString>;
        offboardReason: z.ZodNullable<z.ZodString>;
        /** Whether the file is linked to an account (an `org_memberships` row). */
        hasAccount: z.ZodBoolean;
        /** The role that account holds here, when it does. Never held by the file. */
        orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
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
            endReason: z.ZodNullable<z.ZodString>;
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
            endReason: string | null;
            view: "basic";
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            view: "basic";
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "basic";
        } | null;
    }, {
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
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
        sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        workPropertyId: z.ZodNullable<z.ZodString>;
        workPropertyName: z.ZodNullable<z.ZodString>;
        jobPositionId: z.ZodNullable<z.ZodString>;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
        reportingManagerId: z.ZodNullable<z.ZodString>;
        reportingManagerName: z.ZodNullable<z.ZodString>;
        hiredOn: z.ZodString;
        status: z.ZodEnum<["active", "offboarded"]>;
        offboardedOn: z.ZodNullable<z.ZodString>;
        offboardReason: z.ZodNullable<z.ZodString>;
        /** Whether the file is linked to an account (an `org_memberships` row). */
        hasAccount: z.ZodBoolean;
        /** The role that account holds here, when it does. Never held by the file. */
        orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
        detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
    } & {
        view: z.ZodLiteral<"full">;
        dateOfBirth: z.ZodNullable<z.ZodString>;
        idDocumentType: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idDocumentNumber: z.ZodNullable<z.ZodString>;
        rssbNumber: z.ZodNullable<z.ZodString>;
        currentContract: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            employeeId: z.ZodString;
            contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
            startsOn: z.ZodString;
            /** Null: open ended. */
            endsOn: z.ZodNullable<z.ZodString>;
            wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
            status: z.ZodEnum<["scheduled", "active", "ended"]>;
            endReason: z.ZodNullable<z.ZodString>;
        } & {
            view: z.ZodLiteral<"full">;
            wageRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            view: "full";
            wageRwf: number;
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            view: "full";
            wageRwf: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        dateOfBirth: string | null;
        email: string | null;
        legalName: string;
        id: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "full";
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
    }, {
        status: "active" | "offboarded";
        dateOfBirth: string | null;
        email: string | null;
        legalName: string;
        id: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "full";
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
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
        endReason: z.ZodNullable<z.ZodString>;
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
        endReason: string | null;
        view: "basic";
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
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
        endReason: z.ZodNullable<z.ZodString>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
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
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "basic";
        } | null;
    } | {
        status: "active" | "offboarded";
        dateOfBirth: string | null;
        email: string | null;
        legalName: string;
        id: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "full";
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
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
        endReason: string | null;
        view: "basic";
    } | {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    })[];
}, {
    employee: {
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "basic";
        } | null;
    } | {
        status: "active" | "offboarded";
        dateOfBirth: string | null;
        email: string | null;
        legalName: string;
        id: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "full";
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
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
        endReason: string | null;
        view: "basic";
    } | {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    })[];
}>;
export type EmployeeFile = z.infer<typeof EmployeeFile>;
export declare const EmployeePage: z.ZodObject<{
    items: z.ZodArray<z.ZodDiscriminatedUnion<"view", [z.ZodObject<{
        id: z.ZodString;
        employeeNumber: z.ZodString;
        legalName: z.ZodString;
        preferredName: z.ZodNullable<z.ZodString>;
        displayName: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
        email: z.ZodNullable<z.ZodString>;
        sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        workPropertyId: z.ZodNullable<z.ZodString>;
        workPropertyName: z.ZodNullable<z.ZodString>;
        jobPositionId: z.ZodNullable<z.ZodString>;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
        reportingManagerId: z.ZodNullable<z.ZodString>;
        reportingManagerName: z.ZodNullable<z.ZodString>;
        hiredOn: z.ZodString;
        status: z.ZodEnum<["active", "offboarded"]>;
        offboardedOn: z.ZodNullable<z.ZodString>;
        offboardReason: z.ZodNullable<z.ZodString>;
        /** Whether the file is linked to an account (an `org_memberships` row). */
        hasAccount: z.ZodBoolean;
        /** The role that account holds here, when it does. Never held by the file. */
        orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
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
            endReason: z.ZodNullable<z.ZodString>;
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
            endReason: string | null;
            view: "basic";
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            view: "basic";
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "basic";
        } | null;
    }, {
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
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
        sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        workPropertyId: z.ZodNullable<z.ZodString>;
        workPropertyName: z.ZodNullable<z.ZodString>;
        jobPositionId: z.ZodNullable<z.ZodString>;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
        reportingManagerId: z.ZodNullable<z.ZodString>;
        reportingManagerName: z.ZodNullable<z.ZodString>;
        hiredOn: z.ZodString;
        status: z.ZodEnum<["active", "offboarded"]>;
        offboardedOn: z.ZodNullable<z.ZodString>;
        offboardReason: z.ZodNullable<z.ZodString>;
        /** Whether the file is linked to an account (an `org_memberships` row). */
        hasAccount: z.ZodBoolean;
        /** The role that account holds here, when it does. Never held by the file. */
        orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
        detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
    } & {
        view: z.ZodLiteral<"full">;
        dateOfBirth: z.ZodNullable<z.ZodString>;
        idDocumentType: z.ZodNullable<z.ZodEnum<["national_id", "passport"]>>;
        idDocumentNumber: z.ZodNullable<z.ZodString>;
        rssbNumber: z.ZodNullable<z.ZodString>;
        currentContract: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            employeeId: z.ZodString;
            contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
            startsOn: z.ZodString;
            /** Null: open ended. */
            endsOn: z.ZodNullable<z.ZodString>;
            wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
            status: z.ZodEnum<["scheduled", "active", "ended"]>;
            endReason: z.ZodNullable<z.ZodString>;
        } & {
            view: z.ZodLiteral<"full">;
            wageRwf: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            view: "full";
            wageRwf: number;
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            endsOn: string | null;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            view: "full";
            wageRwf: number;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        dateOfBirth: string | null;
        email: string | null;
        legalName: string;
        id: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "full";
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
    }, {
        status: "active" | "offboarded";
        dateOfBirth: string | null;
        email: string | null;
        legalName: string;
        id: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "full";
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
    }>]>, "many">;
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    items: ({
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "basic";
        } | null;
    } | {
        status: "active" | "offboarded";
        dateOfBirth: string | null;
        email: string | null;
        legalName: string;
        id: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "full";
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
    })[];
    nextCursor: string | null;
}, {
    items: ({
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "basic";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "basic";
        } | null;
    } | {
        status: "active" | "offboarded";
        dateOfBirth: string | null;
        email: string | null;
        legalName: string;
        id: string;
        idDocumentType: "national_id" | "passport" | null;
        idDocumentNumber: string | null;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        sex: "female" | "male" | null;
        displayName: string;
        jobPositionTitle: string | null;
        view: "full";
        employeeNumber: string;
        preferredName: string | null;
        workPropertyId: string | null;
        workPropertyName: string | null;
        jobPositionId: string | null;
        reportingManagerId: string | null;
        reportingManagerName: string | null;
        hiredOn: string;
        offboardedOn: string | null;
        offboardReason: string | null;
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
            endReason: string | null;
            view: "full";
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
    })[];
    nextCursor: string | null;
}>;
export type EmployeePage = z.infer<typeof EmployeePage>;
export declare const EmployeeListQuery: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["active", "offboarded"]>>;
    propertyId: z.ZodOptional<z.ZodString>;
    departmentId: z.ZodOptional<z.ZodString>;
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "offboarded" | undefined;
    cursor?: string | undefined;
    propertyId?: string | undefined;
    departmentId?: string | undefined;
    limit?: number | undefined;
}, {
    status?: "active" | "offboarded" | undefined;
    cursor?: string | undefined;
    propertyId?: string | undefined;
    departmentId?: string | undefined;
    limit?: number | undefined;
}>;
export type EmployeeListQuery = z.infer<typeof EmployeeListQuery>;
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
    reportingManagerId?: string | null | undefined;
    rssbNumber?: string | null | undefined;
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
    reportingManagerId?: string | null | undefined;
    rssbNumber?: string | null | undefined;
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
}, "strip", z.ZodTypeAny, {
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
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    rssbNumber?: string | null | undefined;
}, {
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
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    rssbNumber?: string | null | undefined;
}>, {
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
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    rssbNumber?: string | null | undefined;
}, {
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
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    rssbNumber?: string | null | undefined;
}>, {
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
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    rssbNumber?: string | null | undefined;
}, {
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
    reportingManagerId?: string | null | undefined;
    hiredOn?: string | undefined;
    rssbNumber?: string | null | undefined;
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
}, "strip", z.ZodTypeAny, {
    startsOn: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    wageRwf: number;
    endsOn?: string | null | undefined;
}, {
    startsOn: string;
    contractType: "permanent" | "fixed_term" | "casual";
    wageBasis: "monthly" | "daily" | "hourly";
    wageRwf: number;
    endsOn?: string | null | undefined;
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
        endReason: z.ZodNullable<z.ZodString>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
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
        endReason: z.ZodNullable<z.ZodString>;
    } & {
        view: z.ZodLiteral<"full">;
        wageRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
    }, {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
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
        endReason: string | null;
        view: "full";
        wageRwf: number;
    };
    shortened: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
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
        endReason: string | null;
        view: "full";
        wageRwf: number;
    };
    shortened: {
        status: "active" | "scheduled" | "ended";
        id: string;
        startsOn: string;
        endsOn: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        wageBasis: "monthly" | "daily" | "hourly";
        endReason: string | null;
        view: "full";
        wageRwf: number;
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
}, "strip", z.ZodTypeAny, {
    name: string;
    propertyId: string;
    startsAt: string;
    endsAt: string;
    departmentId?: string | null | undefined;
    breakMinutes?: number | undefined;
}, {
    name: string;
    propertyId: string;
    startsAt: string;
    endsAt: string;
    departmentId?: string | null | undefined;
    breakMinutes?: number | undefined;
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
}, "strip", z.ZodTypeAny, {
    status: "scheduled" | "cancelled";
    id: string;
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
}, {
    status: "scheduled" | "cancelled";
    id: string;
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
}>;
export type RosterEntry = z.infer<typeof RosterEntry>;
export declare const RosterList: z.ZodObject<{
    entries: z.ZodArray<z.ZodObject<{
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
    }, "strip", z.ZodTypeAny, {
        status: "scheduled" | "cancelled";
        id: string;
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
    }, {
        status: "scheduled" | "cancelled";
        id: string;
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
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        status: "scheduled" | "cancelled";
        id: string;
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
    }[];
}, {
    entries: {
        status: "scheduled" | "cancelled";
        id: string;
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
    }[];
}>;
export type RosterList = z.infer<typeof RosterList>;
/** At most 31 days, inclusive at both ends. */
export declare const RosterQuery: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    propertyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    propertyId?: string | undefined;
}, {
    from: string;
    to: string;
    propertyId?: string | undefined;
}>;
export type RosterQuery = z.infer<typeof RosterQuery>;
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
    rosterEntryId: z.ZodNullable<z.ZodString>;
    workDate: z.ZodString;
    clockInAt: z.ZodString;
    clockOutAt: z.ZodNullable<z.ZodString>;
    source: z.ZodEnum<["supervisor", "self"]>;
    validated: z.ZodBoolean;
    status: z.ZodEnum<["open", "closed", "superseded"]>;
    supersedesId: z.ZodNullable<z.ZodString>;
    note: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "superseded" | "open" | "closed";
    id: string;
    source: "supervisor" | "self";
    note: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    workDate: string;
    rosterEntryId: string | null;
    clockInAt: string;
    clockOutAt: string | null;
    validated: boolean;
    supersedesId: string | null;
}, {
    status: "superseded" | "open" | "closed";
    id: string;
    source: "supervisor" | "self";
    note: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    workDate: string;
    rosterEntryId: string | null;
    clockInAt: string;
    clockOutAt: string | null;
    validated: boolean;
    supersedesId: string | null;
}>;
export type AttendanceRecord = z.infer<typeof AttendanceRecord>;
export declare const AttendanceList: z.ZodObject<{
    records: z.ZodArray<z.ZodObject<{
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
        rosterEntryId: z.ZodNullable<z.ZodString>;
        workDate: z.ZodString;
        clockInAt: z.ZodString;
        clockOutAt: z.ZodNullable<z.ZodString>;
        source: z.ZodEnum<["supervisor", "self"]>;
        validated: z.ZodBoolean;
        status: z.ZodEnum<["open", "closed", "superseded"]>;
        supersedesId: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "supervisor" | "self";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
    }, {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "supervisor" | "self";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    records: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "supervisor" | "self";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
    }[];
}, {
    records: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "supervisor" | "self";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
    }[];
}>;
export type AttendanceList = z.infer<typeof AttendanceList>;
export declare const AttendanceQuery: z.ZodObject<{
    date: z.ZodString;
    propertyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    date: string;
    propertyId?: string | undefined;
}, {
    date: string;
    propertyId?: string | undefined;
}>;
export type AttendanceQuery = z.infer<typeof AttendanceQuery>;
export declare const ClockInRequest: z.ZodObject<{
    employeeId: z.ZodString;
    /** At most 5 minutes ahead and 7 days behind the server clock. */
    at: z.ZodOptional<z.ZodString>;
    rosterEntryId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    at?: string | undefined;
    rosterEntryId?: string | undefined;
}, {
    employeeId: string;
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
export declare const LeaveType: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    paid: z.ZodBoolean;
    /** Null: no balance is kept, as for unpaid leave. */
    yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
    accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
    needsApproval: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    id: string;
    paid: boolean;
    accrual: "none" | "monthly" | "yearly_upfront";
    yearlyEntitlementDays: number | null;
    needsApproval: boolean;
}, {
    code: string;
    name: string;
    id: string;
    paid: boolean;
    accrual: "none" | "monthly" | "yearly_upfront";
    yearlyEntitlementDays: number | null;
    needsApproval: boolean;
}>;
export type LeaveType = z.infer<typeof LeaveType>;
export declare const LeaveLedgerEntry: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment"]>;
    /** Signed: accruals add, leave taken subtracts, a reversal undoes. */
    days: z.ZodNumber;
    effectiveOn: z.ZodString;
    periodKey: z.ZodNullable<z.ZodString>;
    leaveRequestId: z.ZodNullable<z.ZodString>;
    reason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
    reason: string | null;
    id: string;
    days: number;
    effectiveOn: string;
    periodKey: string | null;
    leaveRequestId: string | null;
}, {
    kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
    reason: string | null;
    id: string;
    days: number;
    effectiveOn: string;
    periodKey: string | null;
    leaveRequestId: string | null;
}>;
export type LeaveLedgerEntry = z.infer<typeof LeaveLedgerEntry>;
/** A balance is only ever the sum of the ledger (AC-L4). */
export declare const LeaveBalance: z.ZodObject<{
    leaveType: z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        paid: z.ZodBoolean;
        /** Null: no balance is kept, as for unpaid leave. */
        yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
        accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
        needsApproval: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        id: string;
        paid: boolean;
        accrual: "none" | "monthly" | "yearly_upfront";
        yearlyEntitlementDays: number | null;
        needsApproval: boolean;
    }, {
        code: string;
        name: string;
        id: string;
        paid: boolean;
        accrual: "none" | "monthly" | "yearly_upfront";
        yearlyEntitlementDays: number | null;
        needsApproval: boolean;
    }>;
    /** Null for a type that keeps no balance. */
    balanceDays: z.ZodNullable<z.ZodNumber>;
    entries: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment"]>;
        /** Signed: accruals add, leave taken subtracts, a reversal undoes. */
        days: z.ZodNumber;
        effectiveOn: z.ZodString;
        periodKey: z.ZodNullable<z.ZodString>;
        leaveRequestId: z.ZodNullable<z.ZodString>;
        reason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
        reason: string | null;
        id: string;
        days: number;
        effectiveOn: string;
        periodKey: string | null;
        leaveRequestId: string | null;
    }, {
        kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
        reason: string | null;
        id: string;
        days: number;
        effectiveOn: string;
        periodKey: string | null;
        leaveRequestId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
        reason: string | null;
        id: string;
        days: number;
        effectiveOn: string;
        periodKey: string | null;
        leaveRequestId: string | null;
    }[];
    leaveType: {
        code: string;
        name: string;
        id: string;
        paid: boolean;
        accrual: "none" | "monthly" | "yearly_upfront";
        yearlyEntitlementDays: number | null;
        needsApproval: boolean;
    };
    balanceDays: number | null;
}, {
    entries: {
        kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
        reason: string | null;
        id: string;
        days: number;
        effectiveOn: string;
        periodKey: string | null;
        leaveRequestId: string | null;
    }[];
    leaveType: {
        code: string;
        name: string;
        id: string;
        paid: boolean;
        accrual: "none" | "monthly" | "yearly_upfront";
        yearlyEntitlementDays: number | null;
        needsApproval: boolean;
    };
    balanceDays: number | null;
}>;
export type LeaveBalance = z.infer<typeof LeaveBalance>;
export declare const LeaveBalances: z.ZodObject<{
    employeeId: z.ZodString;
    balances: z.ZodArray<z.ZodObject<{
        leaveType: z.ZodObject<{
            id: z.ZodString;
            code: z.ZodString;
            name: z.ZodString;
            paid: z.ZodBoolean;
            /** Null: no balance is kept, as for unpaid leave. */
            yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
            accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
            needsApproval: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            code: string;
            name: string;
            id: string;
            paid: boolean;
            accrual: "none" | "monthly" | "yearly_upfront";
            yearlyEntitlementDays: number | null;
            needsApproval: boolean;
        }, {
            code: string;
            name: string;
            id: string;
            paid: boolean;
            accrual: "none" | "monthly" | "yearly_upfront";
            yearlyEntitlementDays: number | null;
            needsApproval: boolean;
        }>;
        /** Null for a type that keeps no balance. */
        balanceDays: z.ZodNullable<z.ZodNumber>;
        entries: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment"]>;
            /** Signed: accruals add, leave taken subtracts, a reversal undoes. */
            days: z.ZodNumber;
            effectiveOn: z.ZodString;
            periodKey: z.ZodNullable<z.ZodString>;
            leaveRequestId: z.ZodNullable<z.ZodString>;
            reason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
            reason: string | null;
            id: string;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
        }, {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
            reason: string | null;
            id: string;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
            reason: string | null;
            id: string;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
        }[];
        leaveType: {
            code: string;
            name: string;
            id: string;
            paid: boolean;
            accrual: "none" | "monthly" | "yearly_upfront";
            yearlyEntitlementDays: number | null;
            needsApproval: boolean;
        };
        balanceDays: number | null;
    }, {
        entries: {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
            reason: string | null;
            id: string;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
        }[];
        leaveType: {
            code: string;
            name: string;
            id: string;
            paid: boolean;
            accrual: "none" | "monthly" | "yearly_upfront";
            yearlyEntitlementDays: number | null;
            needsApproval: boolean;
        };
        balanceDays: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    balances: {
        entries: {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
            reason: string | null;
            id: string;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
        }[];
        leaveType: {
            code: string;
            name: string;
            id: string;
            paid: boolean;
            accrual: "none" | "monthly" | "yearly_upfront";
            yearlyEntitlementDays: number | null;
            needsApproval: boolean;
        };
        balanceDays: number | null;
    }[];
}, {
    employeeId: string;
    balances: {
        entries: {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry";
            reason: string | null;
            id: string;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
        }[];
        leaveType: {
            code: string;
            name: string;
            id: string;
            paid: boolean;
            accrual: "none" | "monthly" | "yearly_upfront";
            yearlyEntitlementDays: number | null;
            needsApproval: boolean;
        };
        balanceDays: number | null;
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
    leaveType: z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        paid: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        id: string;
        paid: boolean;
    }, {
        code: string;
        name: string;
        id: string;
        paid: boolean;
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
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected" | "cancelled" | "requested";
    decidedAt: string | null;
    reason: string | null;
    id: string;
    startsOn: string;
    decisionNote: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    endsOn: string;
    days: number;
    leaveType: {
        code: string;
        name: string;
        id: string;
        paid: boolean;
    };
    startHalf: "full" | "second_half";
    endHalf: "full" | "first_half";
    routedToEmployeeId: string | null;
    routedToName: string | null;
    routedToMe: boolean;
}, {
    status: "approved" | "rejected" | "cancelled" | "requested";
    decidedAt: string | null;
    reason: string | null;
    id: string;
    startsOn: string;
    decisionNote: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    endsOn: string;
    days: number;
    leaveType: {
        code: string;
        name: string;
        id: string;
        paid: boolean;
    };
    startHalf: "full" | "second_half";
    endHalf: "full" | "first_half";
    routedToEmployeeId: string | null;
    routedToName: string | null;
    routedToMe: boolean;
}>;
export type LeaveRequest = z.infer<typeof LeaveRequest>;
export declare const LeaveRequestList: z.ZodObject<{
    requests: z.ZodArray<z.ZodObject<{
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
        leaveType: z.ZodObject<{
            id: z.ZodString;
            code: z.ZodString;
            name: z.ZodString;
            paid: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            code: string;
            name: string;
            id: string;
            paid: boolean;
        }, {
            code: string;
            name: string;
            id: string;
            paid: boolean;
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
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        decidedAt: string | null;
        reason: string | null;
        id: string;
        startsOn: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        endsOn: string;
        days: number;
        leaveType: {
            code: string;
            name: string;
            id: string;
            paid: boolean;
        };
        startHalf: "full" | "second_half";
        endHalf: "full" | "first_half";
        routedToEmployeeId: string | null;
        routedToName: string | null;
        routedToMe: boolean;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        decidedAt: string | null;
        reason: string | null;
        id: string;
        startsOn: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        endsOn: string;
        days: number;
        leaveType: {
            code: string;
            name: string;
            id: string;
            paid: boolean;
        };
        startHalf: "full" | "second_half";
        endHalf: "full" | "first_half";
        routedToEmployeeId: string | null;
        routedToName: string | null;
        routedToMe: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
        decidedAt: string | null;
        reason: string | null;
        id: string;
        startsOn: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        endsOn: string;
        days: number;
        leaveType: {
            code: string;
            name: string;
            id: string;
            paid: boolean;
        };
        startHalf: "full" | "second_half";
        endHalf: "full" | "first_half";
        routedToEmployeeId: string | null;
        routedToName: string | null;
        routedToMe: boolean;
    }[];
}, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
        decidedAt: string | null;
        reason: string | null;
        id: string;
        startsOn: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        endsOn: string;
        days: number;
        leaveType: {
            code: string;
            name: string;
            id: string;
            paid: boolean;
        };
        startHalf: "full" | "second_half";
        endHalf: "full" | "first_half";
        routedToEmployeeId: string | null;
        routedToName: string | null;
        routedToMe: boolean;
    }[];
}>;
export type LeaveRequestList = z.infer<typeof LeaveRequestList>;
export declare const LeaveRequestQuery: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "approved" | "rejected" | "cancelled" | "requested" | undefined;
}, {
    status?: "approved" | "rejected" | "cancelled" | "requested" | undefined;
}>;
export type LeaveRequestQuery = z.infer<typeof LeaveRequestQuery>;
export declare const CreateLeaveRequestRequest: z.ZodObject<{
    employeeId: z.ZodString;
    leaveTypeId: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodString;
    startHalf: z.ZodOptional<z.ZodEnum<["full", "second_half"]>>;
    endHalf: z.ZodOptional<z.ZodEnum<["full", "first_half"]>>;
    reason: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    startsOn: string;
    endsOn: string;
    employeeId: string;
    leaveTypeId: string;
    reason?: string | null | undefined;
    startHalf?: "full" | "second_half" | undefined;
    endHalf?: "full" | "first_half" | undefined;
}, {
    startsOn: string;
    endsOn: string;
    employeeId: string;
    leaveTypeId: string;
    reason?: string | null | undefined;
    startHalf?: "full" | "second_half" | undefined;
    endHalf?: "full" | "first_half" | undefined;
}>;
export type CreateLeaveRequestRequest = z.infer<typeof CreateLeaveRequestRequest>;
export declare const LeaveDecisionRequest: z.ZodObject<{
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
}, {
    note?: string | null | undefined;
}>;
export type LeaveDecisionRequest = z.infer<typeof LeaveDecisionRequest>;
//# sourceMappingURL=people.d.ts.map