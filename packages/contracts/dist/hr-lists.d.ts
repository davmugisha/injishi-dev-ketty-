import { z } from "zod";
/** `GET /ops/employees`. Date of birth is sensitive: a `basic` caller cannot see or use it (AC-LF4). */
export declare const EMPLOYEE_LIST: {
    readonly key: "staff.employees";
    readonly searchFields: readonly ["name", "legalName", "employeeNumber", "phone"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "employeeNumber";
        readonly dir: "asc";
    }];
    readonly fields: readonly [{
        readonly key: "employeeNumber";
        readonly label: "Number";
        readonly type: "text";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "name";
        readonly label: "Name";
        readonly type: "text";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "legalName";
        readonly label: "Legal name";
        readonly type: "text";
    }, {
        readonly key: "phone";
        readonly label: "Phone";
        readonly type: "text";
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["active", "offboarded"];
        readonly enumLabels: {
            active: string;
            offboarded: string;
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "branch";
        readonly label: "Branch";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "department";
        readonly label: "Department";
        readonly type: "ref";
        readonly filterable: true;
    }, {
        readonly key: "jobPosition";
        readonly label: "Job position";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "hiredOn";
        readonly label: "Hired on";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "hasAccount";
        readonly label: "Has an account";
        readonly type: "bool";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "detailsMissing";
        readonly label: "Details missing";
        readonly type: "bool";
        readonly filterable: true;
    }, {
        readonly key: "dateOfBirth";
        readonly label: "Date of birth";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
        readonly sensitive: true;
    }];
};
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
        hasAccount: z.ZodBoolean;
        orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "housekeeper"]>>;
        detailsMissing: z.ZodArray<z.ZodEnum<["phone", "dateOfBirth", "sex", "idDocument"]>, "many">;
    } & {
        view: z.ZodLiteral<"basic">;
        currentContract: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            employeeId: z.ZodString;
            contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
            startsOn: z.ZodString;
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
            view: "basic";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            view: "basic";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        view: "basic";
        employeeNumber: string;
        displayName: string;
        sex: "female" | "male" | null;
        jobPositionTitle: string | null;
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
            view: "basic";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
        } | null;
    }, {
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        view: "basic";
        employeeNumber: string;
        displayName: string;
        sex: "female" | "male" | null;
        jobPositionTitle: string | null;
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
            view: "basic";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
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
        hasAccount: z.ZodBoolean;
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
            view: "full";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            wageRwf: number;
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            view: "full";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
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
        view: "full";
        employeeNumber: string;
        displayName: string;
        sex: "female" | "male" | null;
        jobPositionTitle: string | null;
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
            view: "full";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
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
        view: "full";
        employeeNumber: string;
        displayName: string;
        sex: "female" | "male" | null;
        jobPositionTitle: string | null;
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
            view: "full";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
    }>]>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        key: string | null;
        label: string;
        count: number;
    }, {
        key: string | null;
        label: string;
        count: number;
    }>, "many">>;
    statusCounts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
    }, {
        value: string;
        count: number;
    }>, "many">>;
    stages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    items: ({
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        view: "basic";
        employeeNumber: string;
        displayName: string;
        sex: "female" | "male" | null;
        jobPositionTitle: string | null;
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
            view: "basic";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
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
        view: "full";
        employeeNumber: string;
        displayName: string;
        sex: "female" | "male" | null;
        jobPositionTitle: string | null;
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
            view: "full";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
    })[];
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}, {
    items: ({
        status: "active" | "offboarded";
        email: string | null;
        legalName: string;
        id: string;
        orgRole: "owner" | "manager" | "receptionist" | "housekeeper" | null;
        phone: string | null;
        view: "basic";
        employeeNumber: string;
        displayName: string;
        sex: "female" | "male" | null;
        jobPositionTitle: string | null;
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
            view: "basic";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
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
        view: "full";
        employeeNumber: string;
        displayName: string;
        sex: "female" | "male" | null;
        jobPositionTitle: string | null;
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
            view: "full";
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            endReason: string | null;
            wageRwf: number;
        } | null;
        rssbNumber: string | null;
    })[];
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}>;
export type EmployeePage = z.infer<typeof EmployeePage>;
/**
 * `GET /ops/roster`. With no day filter it reads this week, Monday to Sunday in
 * Kigali; pages bound anything wider, which retired the first thread's 31 day
 * cap on a roster read.
 */
export declare const ROSTER_LIST: {
    readonly key: "staff.roster";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "workDate";
        readonly dir: "asc";
    }, {
        readonly field: "startsAt";
        readonly dir: "asc";
    }];
    readonly fields: readonly [{
        readonly key: "workDate";
        readonly label: "Day";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
        readonly groupable: true;
    }, {
        readonly key: "startsAt";
        readonly label: "Starts";
        readonly type: "datetime";
        readonly sortable: true;
    }, {
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "shift";
        readonly label: "Shift";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "branch";
        readonly label: "Branch";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "department";
        readonly label: "Department";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["scheduled", "cancelled"];
        readonly enumLabels: {
            readonly scheduled: "Scheduled";
            readonly cancelled: "Cancelled";
        };
        readonly filterable: true;
    }];
};
export declare const RosterPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employee: z.ZodObject<{
            employeeId: z.ZodString;
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
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        key: string | null;
        label: string;
        count: number;
    }, {
        key: string | null;
        label: string;
        count: number;
    }>, "many">>;
    statusCounts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
    }, {
        value: string;
        count: number;
    }>, "many">>;
    stages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    items: {
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
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}, {
    items: {
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
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}>;
export type RosterPage = z.infer<typeof RosterPage>;
/** `GET /ops/attendance`. With no day filter it reads today and anything still open. */
export declare const ATTENDANCE_LIST: {
    readonly key: "staff.attendance";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "clockInAt";
        readonly dir: "desc";
    }];
    readonly fields: readonly [{
        readonly key: "workDate";
        readonly label: "Day";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
        readonly groupable: true;
    }, {
        readonly key: "clockInAt";
        readonly label: "Clocked in";
        readonly type: "datetime";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "branch";
        readonly label: "Branch";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["open", "closed", "superseded"];
        readonly enumLabels: {
            readonly open: "Clocked in";
            readonly closed: "Closed";
            readonly superseded: "Corrected";
        };
        readonly filterable: true;
    }, {
        readonly key: "source";
        readonly label: "Recorded by";
        readonly type: "enum";
        readonly enumValues: readonly ["supervisor", "self"];
        readonly enumLabels: {
            readonly supervisor: "Supervisor";
            readonly self: "Themselves";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "validated";
        readonly label: "Validated";
        readonly type: "bool";
        readonly filterable: true;
        readonly groupable: true;
    }];
};
export declare const AttendancePage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employee: z.ZodObject<{
            employeeId: z.ZodString;
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
        branchId: z.ZodNullable<z.ZodString>;
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
        branchId: string | null;
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
        branchId: string | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        key: string | null;
        label: string;
        count: number;
    }, {
        key: string | null;
        label: string;
        count: number;
    }>, "many">>;
    statusCounts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
    }, {
        value: string;
        count: number;
    }>, "many">>;
    stages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "supervisor" | "self";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        branchId: string | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
    }[];
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}, {
    items: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "supervisor" | "self";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        branchId: string | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
    }[];
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}>;
export type AttendancePage = z.infer<typeof AttendancePage>;
/** `GET /ops/leave/requests`. */
export declare const LEAVE_REQUEST_LIST: {
    readonly key: "staff.leave-requests";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "routedToMe";
        readonly dir: "desc";
    }, {
        readonly field: "startsOn";
        readonly dir: "asc";
    }];
    readonly fields: readonly [{
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["requested", "approved", "rejected", "cancelled"];
        readonly enumLabels: {
            readonly requested: "Waiting";
            readonly approved: "Approved";
            readonly rejected: "Refused";
            readonly cancelled: "Cancelled";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "leaveType";
        readonly label: "Type";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "startsOn";
        readonly label: "From";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "endsOn";
        readonly label: "To";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "days";
        readonly label: "Days";
        readonly type: "number";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "branch";
        readonly label: "Branch";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "routedToMe";
        readonly label: "Waiting on me";
        readonly type: "bool";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "createdAt";
        readonly label: "Requested";
        readonly type: "datetime";
        readonly filterable: true;
        readonly sortable: true;
    }];
};
export declare const LeaveRequestPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employee: z.ZodObject<{
            employeeId: z.ZodString;
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
        branchId: z.ZodNullable<z.ZodString>;
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
        days: z.ZodNumber;
        reason: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
        routedToEmployeeId: z.ZodNullable<z.ZodString>;
        routedToName: z.ZodNullable<z.ZodString>;
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
        branchId: string | null;
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
        branchId: string | null;
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
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        key: string | null;
        label: string;
        count: number;
    }, {
        key: string | null;
        label: string;
        count: number;
    }>, "many">>;
    statusCounts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
    }, {
        value: string;
        count: number;
    }>, "many">>;
    stages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    items: {
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
        branchId: string | null;
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
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}, {
    items: {
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
        branchId: string | null;
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
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}>;
export type LeaveRequestPage = z.infer<typeof LeaveRequestPage>;
/**
 * `POST /ops/leave/requests/bulk`: approve or refuse several requests, each as
 * the single command with its own checks, lock and audit row (AC-LF6).
 */
export declare const LeaveBulkRequest: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
} & {
    action: z.ZodEnum<["approve", "reject"]>;
    params: z.ZodOptional<z.ZodObject<{
        note: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        note?: string | undefined;
    }, {
        note?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    action: "approve" | "reject";
    ids: string[];
    params?: {
        note?: string | undefined;
    } | undefined;
}, {
    action: "approve" | "reject";
    ids: string[];
    params?: {
        note?: string | undefined;
    } | undefined;
}>;
export type LeaveBulkRequest = z.infer<typeof LeaveBulkRequest>;
/** `GET /ops/pay-runs`. */
export declare const PAY_RUN_LIST: {
    readonly key: "staff.pay-runs";
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "periodStart";
        readonly dir: "desc";
    }];
    readonly fields: readonly [{
        readonly key: "periodStart";
        readonly label: "Month";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["draft", "confirmed"];
        readonly enumLabels: {
            readonly draft: "Draft";
            readonly confirmed: "Confirmed";
        };
        readonly filterable: true;
    }, {
        readonly key: "headcount";
        readonly label: "People";
        readonly type: "number";
        readonly sortable: true;
    }, {
        readonly key: "grossRwf";
        readonly label: "Gross";
        readonly type: "money";
        readonly sortable: true;
    }, {
        readonly key: "netRwf";
        readonly label: "Net";
        readonly type: "money";
        readonly sortable: true;
    }];
};
export declare const PayRunPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        period: z.ZodString;
        periodStart: z.ZodString;
        status: z.ZodEnum<["draft", "confirmed"]>;
        computedAt: z.ZodString;
        ruleVersions: z.ZodArray<z.ZodObject<{
            configType: z.ZodString;
            configEntryId: z.ZodString;
            version: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            configType: string;
            version: number;
            configEntryId: string;
        }, {
            configType: string;
            version: number;
            configEntryId: string;
        }>, "many">;
        confirmedAt: z.ZodNullable<z.ZodString>;
        confirmedByUserId: z.ZodNullable<z.ZodString>;
        headcount: z.ZodNumber;
        grossRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        payeRwf: z.ZodNumber;
        employeeContributionsRwf: z.ZodNumber;
        employerContributionsRwf: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }, {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        key: string | null;
        label: string;
        count: number;
    }, {
        key: string | null;
        label: string;
        count: number;
    }>, "many">>;
    statusCounts: z.ZodOptional<z.ZodArray<z.ZodObject<{
        value: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: string;
        count: number;
    }, {
        value: string;
        count: number;
    }>, "many">>;
    stages: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        label: string;
    }, {
        key: string;
        label: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }[];
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}, {
    items: {
        status: "draft" | "confirmed";
        id: string;
        periodStart: string;
        grossRwf: number;
        confirmedAt: string | null;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        period: string;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }[];
    total: number;
    page: number;
    pageSize: 50 | 10 | 100 | 25;
    groups?: {
        key: string | null;
        label: string;
        count: number;
    }[] | undefined;
    statusCounts?: {
        value: string;
        count: number;
    }[] | undefined;
    stages?: {
        key: string;
        label: string;
    }[] | undefined;
}>;
export type PayRunPage = z.infer<typeof PayRunPage>;
//# sourceMappingURL=hr-lists.d.ts.map