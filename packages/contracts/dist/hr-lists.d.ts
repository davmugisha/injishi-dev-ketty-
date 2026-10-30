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
        readonly key: "employeeType";
        readonly label: "Employee type";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "tag";
        readonly label: "Tag";
        readonly type: "ref";
        readonly filterable: true;
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
        hasAccount: z.ZodBoolean;
        orgRole: z.ZodNullable<z.ZodEnum<["owner", "manager", "receptionist", "finance", "hr", "housekeeper", "cashier", "waiter", "bartender", "kitchen", "stock_controller"]>>;
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
        } & {
            view: z.ZodLiteral<"basic">;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        id: string;
        email: string | null;
        legalName: string;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        phone: string | null;
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
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            view: "basic";
        } | null;
    }, {
        status: "active" | "offboarded";
        id: string;
        email: string | null;
        legalName: string;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        phone: string | null;
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
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
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
        hasAccount: z.ZodBoolean;
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
        offboardReason: z.ZodNullable<z.ZodString>;
        serviceFrom: z.ZodString;
        previousEmployeeId: z.ZodNullable<z.ZodString>;
        currentContract: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            employeeId: z.ZodString;
            contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
            startsOn: z.ZodString;
            endsOn: z.ZodNullable<z.ZodString>;
            wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
            status: z.ZodEnum<["scheduled", "active", "ended"]>;
        } & {
            view: z.ZodLiteral<"full">;
            wageRwf: z.ZodNumber;
            endReason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
            wageBasis: "monthly" | "daily" | "hourly";
            view: "full";
            wageRwf: number;
            endReason: string | null;
        }, {
            status: "active" | "scheduled" | "ended";
            id: string;
            startsOn: string;
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
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
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        phone: string | null;
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
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
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
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        phone: string | null;
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
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
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
    }>]>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        email: string | null;
        legalName: string;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        phone: string | null;
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
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
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
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        phone: string | null;
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
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
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
    })[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        email: string | null;
        legalName: string;
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        phone: string | null;
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
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
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
        orgRole: "owner" | "manager" | "receptionist" | "finance" | "hr" | "housekeeper" | "cashier" | "waiter" | "bartender" | "kitchen" | "stock_controller" | null;
        phone: string | null;
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
            employeeId: string;
            contractType: "permanent" | "fixed_term" | "casual";
            endsOn: string | null;
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
    })[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        publishedAt: z.ZodNullable<z.ZodString>;
        generated: z.ZodBoolean;
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
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        readonly enumValues: readonly ["supervisor", "self", "phone", "kiosk"];
        readonly enumLabels: {
            readonly supervisor: "Supervisor";
            readonly self: "Themselves";
            readonly phone: "Their phone";
            readonly kiosk: "Kiosk";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "validated";
        readonly label: "Validated";
        readonly type: "bool";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "autoClosed";
        readonly label: "Closed by the sweep";
        readonly type: "bool";
        readonly filterable: true;
    }, {
        readonly key: "lateMinutes";
        readonly label: "Late minutes";
        readonly type: "number";
        readonly filterable: true;
        readonly figure: true;
    }, {
        readonly key: "earlyMinutes";
        readonly label: "Early minutes";
        readonly type: "number";
        readonly filterable: true;
        readonly figure: true;
    }, {
        readonly key: "overtimeMinutes";
        readonly label: "Overtime minutes";
        readonly type: "number";
        readonly filterable: true;
        readonly figure: true;
    }, {
        readonly key: "overtimePending";
        readonly label: "Overtime to decide";
        readonly type: "bool";
        readonly filterable: true;
        readonly figure: true;
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
        source: z.ZodEnum<["supervisor", "self", "phone", "kiosk"]>;
        validated: z.ZodBoolean;
        status: z.ZodEnum<["open", "closed", "superseded"]>;
        supersedesId: z.ZodNullable<z.ZodString>;
        note: z.ZodNullable<z.ZodString>;
        autoClosed: z.ZodBoolean;
        inPendingReason: z.ZodNullable<z.ZodEnum<["no_location", "no_branch_location", "poor_accuracy", "outside_fence", "late_sync"]>>;
        outPendingReason: z.ZodNullable<z.ZodEnum<["no_location", "no_branch_location", "poor_accuracy", "outside_fence", "late_sync"]>>;
        figures: z.ZodNullable<z.ZodObject<{
            lateMinutes: z.ZodNullable<z.ZodNumber>;
            earlyMinutes: z.ZodNullable<z.ZodNumber>;
            workedMinutes: z.ZodNumber;
            overtimeMinutes: z.ZodNullable<z.ZodNumber>;
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
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
/** `GET /ops/shift-requests` (058-time AC-TM5): what is routed to the caller first. */
export declare const SHIFT_REQUEST_LIST: {
    readonly key: "staff.shift-requests";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "routedToMe";
        readonly dir: "desc";
    }, {
        readonly field: "fromDate";
        readonly dir: "asc";
    }];
    readonly fields: readonly [{
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "fromDate";
        readonly label: "From";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "toDate";
        readonly label: "To";
        readonly type: "date";
        readonly filterable: true;
    }, {
        readonly key: "kind";
        readonly label: "Kind";
        readonly type: "enum";
        readonly enumValues: readonly ["change", "swap"];
        readonly enumLabels: {
            readonly change: "Different shift";
            readonly swap: "Swap";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["requested", "awaiting_colleague", "approved", "rejected", "cancelled"];
        readonly enumLabels: {
            readonly requested: "Waiting";
            readonly awaiting_colleague: "Waiting for the colleague";
            readonly approved: "Approved";
            readonly rejected: "Refused";
            readonly cancelled: "Cancelled";
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
        readonly key: "routedToMe";
        readonly label: "Routed to me";
        readonly type: "bool";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "createdAt";
        readonly label: "Asked";
        readonly type: "datetime";
        readonly sortable: true;
    }];
};
export declare const ShiftRequestPage: z.ZodObject<{
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
        kind: z.ZodEnum<["change", "swap"]>;
        shiftTemplate: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
        }, {
            name: string;
            id: string;
        }>>;
        swapWith: z.ZodNullable<z.ZodObject<{
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
        }>>;
        fromDate: z.ZodString;
        toDate: z.ZodString;
        reason: z.ZodString;
        status: z.ZodEnum<["requested", "awaiting_colleague", "approved", "rejected", "cancelled"]>;
        colleagueAcceptedAt: z.ZodNullable<z.ZodString>;
        routedTo: z.ZodNullable<z.ZodObject<{
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
        }>>;
        routedToMe: z.ZodBoolean;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        id: string;
        kind: "change" | "swap";
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        routedToMe: boolean;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        fromDate: string;
        toDate: string;
        shiftTemplate: {
            name: string;
            id: string;
        } | null;
        swapWith: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        colleagueAcceptedAt: string | null;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        id: string;
        kind: "change" | "swap";
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        routedToMe: boolean;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        fromDate: string;
        toDate: string;
        shiftTemplate: {
            name: string;
            id: string;
        } | null;
        swapWith: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        colleagueAcceptedAt: string | null;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        id: string;
        kind: "change" | "swap";
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        routedToMe: boolean;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        fromDate: string;
        toDate: string;
        shiftTemplate: {
            name: string;
            id: string;
        } | null;
        swapWith: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        colleagueAcceptedAt: string | null;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        id: string;
        kind: "change" | "swap";
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        routedToMe: boolean;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        fromDate: string;
        toDate: string;
        shiftTemplate: {
            name: string;
            id: string;
        } | null;
        swapWith: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        colleagueAcceptedAt: string | null;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type ShiftRequestPage = z.infer<typeof ShiftRequestPage>;
/** `GET /ops/attendance-requests` (058-time AC-TM6). */
export declare const ATTENDANCE_REQUEST_LIST: {
    readonly key: "staff.attendance-requests";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "routedToMe";
        readonly dir: "desc";
    }, {
        readonly field: "workDate";
        readonly dir: "desc";
    }];
    readonly fields: readonly [{
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "workDate";
        readonly label: "Day";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
        readonly groupable: true;
    }, {
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
        readonly key: "branch";
        readonly label: "Branch";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "routedToMe";
        readonly label: "Routed to me";
        readonly type: "bool";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "createdAt";
        readonly label: "Asked";
        readonly type: "datetime";
        readonly sortable: true;
    }];
};
export declare const AttendanceRequestPage: z.ZodObject<{
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
        workDate: z.ZodString;
        clockInAt: z.ZodString;
        clockOutAt: z.ZodString;
        recordId: z.ZodNullable<z.ZodString>;
        reason: z.ZodString;
        status: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
        routedTo: z.ZodNullable<z.ZodObject<{
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
        }>>;
        routedToMe: z.ZodBoolean;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        resultRecordId: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        evidence: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        managerConfirmedByName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        managerConfirmedAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        recordClockInAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        recordClockOutAt: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        id: string;
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        workDate: string;
        branchId: string | null;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
        evidence?: string | null | undefined;
        managerConfirmedByName?: string | null | undefined;
        managerConfirmedAt?: string | null | undefined;
        recordClockInAt?: string | null | undefined;
        recordClockOutAt?: string | null | undefined;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        id: string;
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        workDate: string;
        branchId: string | null;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
        evidence?: string | null | undefined;
        managerConfirmedByName?: string | null | undefined;
        managerConfirmedAt?: string | null | undefined;
        recordClockInAt?: string | null | undefined;
        recordClockOutAt?: string | null | undefined;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        workDate: string;
        branchId: string | null;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
        evidence?: string | null | undefined;
        managerConfirmedByName?: string | null | undefined;
        managerConfirmedAt?: string | null | undefined;
        recordClockInAt?: string | null | undefined;
        recordClockOutAt?: string | null | undefined;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        workDate: string;
        branchId: string | null;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
        evidence?: string | null | undefined;
        managerConfirmedByName?: string | null | undefined;
        managerConfirmedAt?: string | null | undefined;
        recordClockInAt?: string | null | undefined;
        recordClockOutAt?: string | null | undefined;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type AttendanceRequestPage = z.infer<typeof AttendanceRequestPage>;
/** `POST /ops/shift-requests/bulk` and `/ops/attendance-requests/bulk`: approve or refuse many, one command each. */
export declare const TimeRequestBulkRequest: z.ZodObject<{
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
export type TimeRequestBulkRequest = z.infer<typeof TimeRequestBulkRequest>;
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
        days: z.ZodNumber;
        reason: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
        routedToEmployeeId: z.ZodNullable<z.ZodString>;
        routedToName: z.ZodNullable<z.ZodString>;
        routedToMe: z.ZodBoolean;
        decidedAt: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
        paymentPercent: z.ZodNullable<z.ZodNumber>;
        approvalSteps: z.ZodNumber;
        currentStep: z.ZodNumber;
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
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
/** `GET /ops/leave/allocation-requests` (058-leave AC-LV8): extra and compensatory days, routed to the caller first. */
export declare const LEAVE_ALLOCATION_LIST: {
    readonly key: "staff.leave-allocations";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "routedToMe";
        readonly dir: "desc";
    }, {
        readonly field: "createdAt";
        readonly dir: "desc";
    }];
    readonly fields: readonly [{
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "leaveType";
        readonly label: "Type";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "kind";
        readonly label: "Kind";
        readonly type: "enum";
        readonly enumValues: readonly ["extra", "compensatory"];
        readonly enumLabels: {
            readonly extra: "Extra days";
            readonly compensatory: "Compensatory";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["requested", "approved", "rejected", "cancelled"];
        readonly enumLabels: {
            readonly requested: "Waiting";
            readonly approved: "Approved";
            readonly rejected: "Refused";
            readonly cancelled: "Withdrawn";
        };
        readonly filterable: true;
        readonly groupable: true;
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
        readonly label: "Routed to me";
        readonly type: "bool";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "createdAt";
        readonly label: "Asked";
        readonly type: "datetime";
        readonly sortable: true;
    }];
};
export declare const LeaveAllocationPage: z.ZodObject<{
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
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
        }, {
            name: string;
            id: string;
        }>;
        kind: z.ZodEnum<["extra", "compensatory"]>;
        days: z.ZodNumber;
        attendanceRecordId: z.ZodNullable<z.ZodString>;
        workDate: z.ZodNullable<z.ZodString>;
        reason: z.ZodString;
        status: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
        routedTo: z.ZodNullable<z.ZodObject<{
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
        }>>;
        routedToMe: z.ZodBoolean;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        id: string;
        kind: "compensatory" | "extra";
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        workDate: string | null;
        branchId: string | null;
        days: number;
        leaveType: {
            name: string;
            id: string;
        };
        routedToMe: boolean;
        attendanceRecordId: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        id: string;
        kind: "compensatory" | "extra";
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        workDate: string | null;
        branchId: string | null;
        days: number;
        leaveType: {
            name: string;
            id: string;
        };
        routedToMe: boolean;
        attendanceRecordId: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        kind: "compensatory" | "extra";
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        workDate: string | null;
        branchId: string | null;
        days: number;
        leaveType: {
            name: string;
            id: string;
        };
        routedToMe: boolean;
        attendanceRecordId: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        kind: "compensatory" | "extra";
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        workDate: string | null;
        branchId: string | null;
        days: number;
        leaveType: {
            name: string;
            id: string;
        };
        routedToMe: boolean;
        attendanceRecordId: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type LeaveAllocationPage = z.infer<typeof LeaveAllocationPage>;
/** `POST /ops/leave/allocation-requests/bulk`. */
export declare const LeaveAllocationBulkRequest: z.ZodObject<{
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
export type LeaveAllocationBulkRequest = z.infer<typeof LeaveAllocationBulkRequest>;
/** `GET /ops/leave/balances` (058-leave AC-LV13): a row per person, a balance per type. */
export declare const LEAVE_BALANCE_LIST: {
    readonly key: "staff.leave-balances";
    readonly searchFields: readonly ["employee"];
    readonly defaultSort: readonly [{
        readonly field: "employee";
        readonly dir: "asc";
    }];
    readonly fields: readonly [{
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
        readonly key: "jobPosition";
        readonly label: "Position";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }];
};
export declare const LeaveBalancePage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
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
        jobPositionId: z.ZodNullable<z.ZodString>;
        balances: z.ZodArray<z.ZodObject<{
            leaveTypeId: z.ZodString;
            days: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            days: number | null;
            leaveTypeId: string;
        }, {
            days: number | null;
            leaveTypeId: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        jobPositionId: string | null;
        branchId: string | null;
        balances: {
            days: number | null;
            leaveTypeId: string;
        }[];
    }, {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        jobPositionId: string | null;
        branchId: string | null;
        balances: {
            days: number | null;
            leaveTypeId: string;
        }[];
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        jobPositionId: string | null;
        branchId: string | null;
        balances: {
            days: number | null;
            leaveTypeId: string;
        }[];
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        jobPositionId: string | null;
        branchId: string | null;
        balances: {
            days: number | null;
            leaveTypeId: string;
        }[];
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type LeaveBalancePage = z.infer<typeof LeaveBalancePage>;
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
        status: "confirmed" | "draft";
        id: string;
        grossRwf: number;
        confirmedAt: string | null;
        periodStart: string;
        period: string;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
        computedAt: string;
        ruleVersions: {
            configType: string;
            version: number;
            configEntryId: string;
        }[];
        confirmedByUserId: string | null;
        headcount: number;
    }, {
        status: "confirmed" | "draft";
        id: string;
        grossRwf: number;
        confirmedAt: string | null;
        periodStart: string;
        period: string;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
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
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        status: "confirmed" | "draft";
        id: string;
        grossRwf: number;
        confirmedAt: string | null;
        periodStart: string;
        period: string;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
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
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        status: "confirmed" | "draft";
        id: string;
        grossRwf: number;
        confirmedAt: string | null;
        periodStart: string;
        period: string;
        payeRwf: number;
        employeeContributionsRwf: number;
        employerContributionsRwf: number;
        netRwf: number;
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
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
/** `GET /ops/payslips` (058-payroll AC-PY15): every payslip across runs, with paid status. */
export declare const PAYSLIP_LIST: {
    readonly key: "staff.payslips";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "period";
        readonly dir: "desc";
    }, {
        readonly field: "employee";
        readonly dir: "asc";
    }];
    readonly fields: readonly [{
        readonly key: "period";
        readonly label: "Month";
        readonly type: "text";
        readonly filterable: true;
        readonly sortable: true;
        readonly groupable: true;
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
        readonly label: "Run";
        readonly type: "enum";
        readonly enumValues: readonly ["draft", "confirmed"];
        readonly enumLabels: {
            readonly draft: "Draft";
            readonly confirmed: "Confirmed";
        };
        readonly filterable: true;
    }, {
        readonly key: "paid";
        readonly label: "Paid";
        readonly type: "bool";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "paidMethod";
        readonly label: "Paid by";
        readonly type: "enum";
        readonly enumValues: readonly ["bank", "momo", "cash"];
        readonly enumLabels: {
            bank: string;
            momo: string;
            cash: string;
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "netRwf";
        readonly label: "Net";
        readonly type: "money";
        readonly sortable: true;
    }];
};
export declare const PayslipPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        payRunId: z.ZodString;
        period: z.ZodString;
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
        employeeNumber: z.ZodString;
        branchId: z.ZodNullable<z.ZodString>;
        grossRwf: z.ZodNumber;
        netRwf: z.ZodNumber;
        status: z.ZodEnum<["draft", "confirmed"]>;
        paidAt: z.ZodNullable<z.ZodString>;
        paidMethod: z.ZodNullable<z.ZodEnum<["bank", "momo", "cash"]>>;
        paidReference: z.ZodNullable<z.ZodString>;
        sentAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "confirmed" | "draft";
        id: string;
        grossRwf: number;
        paidAt: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        employeeNumber: string;
        branchId: string | null;
        period: string;
        netRwf: number;
        paidMethod: "cash" | "momo" | "bank" | null;
        paidReference: string | null;
        sentAt: string | null;
        payRunId: string;
    }, {
        status: "confirmed" | "draft";
        id: string;
        grossRwf: number;
        paidAt: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        employeeNumber: string;
        branchId: string | null;
        period: string;
        netRwf: number;
        paidMethod: "cash" | "momo" | "bank" | null;
        paidReference: string | null;
        sentAt: string | null;
        payRunId: string;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        status: "confirmed" | "draft";
        id: string;
        grossRwf: number;
        paidAt: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        employeeNumber: string;
        branchId: string | null;
        period: string;
        netRwf: number;
        paidMethod: "cash" | "momo" | "bank" | null;
        paidReference: string | null;
        sentAt: string | null;
        payRunId: string;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        status: "confirmed" | "draft";
        id: string;
        grossRwf: number;
        paidAt: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        employeeNumber: string;
        branchId: string | null;
        period: string;
        netRwf: number;
        paidMethod: "cash" | "momo" | "bank" | null;
        paidReference: string | null;
        sentAt: string | null;
        payRunId: string;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type PayslipPage = z.infer<typeof PayslipPage>;
/** `POST /ops/payslips/bulk`: mark several confirmed payslips paid, one way, one reference. */
export declare const PayslipBulkRequest: z.ZodObject<{
    ids: z.ZodArray<z.ZodString, "many">;
} & {
    action: z.ZodLiteral<"mark_paid">;
    params: z.ZodObject<{
        paidOn: z.ZodString;
        method: z.ZodEnum<["bank", "momo", "cash"]>;
        reference: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reference: string;
        method: "cash" | "momo" | "bank";
        paidOn: string;
    }, {
        reference: string;
        method: "cash" | "momo" | "bank";
        paidOn: string;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        reference: string;
        method: "cash" | "momo" | "bank";
        paidOn: string;
    };
    action: "mark_paid";
    ids: string[];
}, {
    params: {
        reference: string;
        method: "cash" | "momo" | "bank";
        paidOn: string;
    };
    action: "mark_paid";
    ids: string[];
}>;
export type PayslipBulkRequest = z.infer<typeof PayslipBulkRequest>;
/** `GET /ops/loans`. */
export declare const LOAN_LIST: {
    readonly key: "staff.loans";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "givenOn";
        readonly dir: "desc";
    }];
    readonly fields: readonly [{
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "kind";
        readonly label: "Kind";
        readonly type: "enum";
        readonly enumValues: readonly ["loan", "advance"];
        readonly enumLabels: {
            readonly loan: "Loan";
            readonly advance: "Advance";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["open", "settled"];
        readonly enumLabels: {
            readonly open: "Being repaid";
            readonly settled: "Settled";
        };
        readonly filterable: true;
    }, {
        readonly key: "branch";
        readonly label: "Branch";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "givenOn";
        readonly label: "Given";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "amountRwf";
        readonly label: "Amount";
        readonly type: "money";
        readonly sortable: true;
    }];
};
export declare const LoanPage: z.ZodObject<{
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
        kind: z.ZodEnum<["loan", "advance"]>;
        amountRwf: z.ZodNumber;
        givenOn: z.ZodString;
        installments: z.ZodNumber;
        firstPeriod: z.ZodString;
        paidOut: z.ZodEnum<["payslip", "outside"]>;
        reason: z.ZodNullable<z.ZodString>;
        paidRwf: z.ZodNumber;
        remainingRwf: z.ZodNumber;
        settledAt: z.ZodNullable<z.ZodString>;
        schedule: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            period: z.ZodString;
            amountRwf: z.ZodNumber;
            deferredFrom: z.ZodNullable<z.ZodString>;
            paid: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }, {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }>, "many">;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: "loan" | "advance";
        amountRwf: number;
        reason: string | null;
        paidRwf: number;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        settledAt: string | null;
        branchId: string | null;
        givenOn: string;
        installments: number;
        firstPeriod: string;
        paidOut: "payslip" | "outside";
        remainingRwf: number;
        schedule: {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }[];
    }, {
        id: string;
        kind: "loan" | "advance";
        amountRwf: number;
        reason: string | null;
        paidRwf: number;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        settledAt: string | null;
        branchId: string | null;
        givenOn: string;
        installments: number;
        firstPeriod: string;
        paidOut: "payslip" | "outside";
        remainingRwf: number;
        schedule: {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }[];
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        kind: "loan" | "advance";
        amountRwf: number;
        reason: string | null;
        paidRwf: number;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        settledAt: string | null;
        branchId: string | null;
        givenOn: string;
        installments: number;
        firstPeriod: string;
        paidOut: "payslip" | "outside";
        remainingRwf: number;
        schedule: {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }[];
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        kind: "loan" | "advance";
        amountRwf: number;
        reason: string | null;
        paidRwf: number;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        settledAt: string | null;
        branchId: string | null;
        givenOn: string;
        installments: number;
        firstPeriod: string;
        paidOut: "payslip" | "outside";
        remainingRwf: number;
        schedule: {
            id: string;
            amountRwf: number;
            paid: boolean;
            period: string;
            deferredFrom: string | null;
        }[];
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type LoanPage = z.infer<typeof LoanPage>;
/** `GET /ops/pay-claims`. */
export declare const PAY_CLAIM_LIST: {
    readonly key: "staff.pay-claims";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "createdAt";
        readonly dir: "desc";
    }];
    readonly fields: readonly [{
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "kind";
        readonly label: "Kind";
        readonly type: "enum";
        readonly enumValues: readonly ["reimbursement", "leave_encashment"];
        readonly enumLabels: {
            readonly reimbursement: "Reimbursement";
            readonly leave_encashment: "Leave paid out";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["requested", "approved", "rejected", "cancelled"];
        readonly enumLabels: {
            readonly requested: "Waiting";
            readonly approved: "Approved";
            readonly rejected: "Refused";
            readonly cancelled: "Withdrawn";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "period";
        readonly label: "Paid in";
        readonly type: "text";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "branch";
        readonly label: "Branch";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "createdAt";
        readonly label: "Asked";
        readonly type: "datetime";
        readonly sortable: true;
    }];
};
export declare const PayClaimPage: z.ZodObject<{
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
        kind: z.ZodEnum<["reimbursement", "leave_encashment"]>;
        amountRwf: z.ZodNullable<z.ZodNumber>;
        leaveType: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
        }, {
            name: string;
            id: string;
        }>>;
        days: z.ZodNullable<z.ZodNumber>;
        period: z.ZodString;
        hasReceipt: z.ZodBoolean;
        reason: z.ZodString;
        status: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        paid: z.ZodBoolean;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        id: string;
        kind: "reimbursement" | "leave_encashment";
        amountRwf: number | null;
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        paid: boolean;
        createdAt: string;
        branchId: string | null;
        days: number | null;
        leaveType: {
            name: string;
            id: string;
        } | null;
        period: string;
        hasReceipt: boolean;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        id: string;
        kind: "reimbursement" | "leave_encashment";
        amountRwf: number | null;
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        paid: boolean;
        createdAt: string;
        branchId: string | null;
        days: number | null;
        leaveType: {
            name: string;
            id: string;
        } | null;
        period: string;
        hasReceipt: boolean;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        kind: "reimbursement" | "leave_encashment";
        amountRwf: number | null;
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        paid: boolean;
        createdAt: string;
        branchId: string | null;
        days: number | null;
        leaveType: {
            name: string;
            id: string;
        } | null;
        period: string;
        hasReceipt: boolean;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        id: string;
        kind: "reimbursement" | "leave_encashment";
        amountRwf: number | null;
        decidedAt: string | null;
        reason: string;
        decisionNote: string | null;
        decidedByName: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        paid: boolean;
        createdAt: string;
        branchId: string | null;
        days: number | null;
        leaveType: {
            name: string;
            id: string;
        } | null;
        period: string;
        hasReceipt: boolean;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type PayClaimPage = z.infer<typeof PayClaimPage>;
export declare const PayClaimBulkRequest: z.ZodObject<{
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
export type PayClaimBulkRequest = z.infer<typeof PayClaimBulkRequest>;
/** `GET /ops/pay-adjustments`. */
export declare const PAY_ADJUSTMENT_LIST: {
    readonly key: "staff.pay-adjustments";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "createdAt";
        readonly dir: "desc";
    }];
    readonly fields: readonly [{
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "side";
        readonly label: "Side";
        readonly type: "enum";
        readonly enumValues: readonly ["earning", "deduction"];
        readonly enumLabels: {
            readonly earning: "Pays";
            readonly deduction: "Takes back";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "source";
        readonly label: "From";
        readonly type: "enum";
        readonly enumValues: readonly ["manual", "leave", "asset_fine", "held_payslip", "late_claim"];
        readonly enumLabels: {
            readonly manual: "By hand";
            readonly leave: "Leave";
            readonly asset_fine: "Asset fine";
            readonly held_payslip: "Held payslip";
            readonly late_claim: "Late claim";
        };
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["open", "waived", "paid"];
        readonly enumLabels: {
            readonly open: "To pay";
            readonly waived: "Waived";
            readonly paid: "Paid";
        };
        readonly filterable: true;
    }, {
        readonly key: "correctsPeriod";
        readonly label: "Corrects";
        readonly type: "text";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "branch";
        readonly label: "Branch";
        readonly type: "ref";
        readonly filterable: true;
        readonly groupable: true;
    }, {
        readonly key: "createdAt";
        readonly label: "Recorded";
        readonly type: "datetime";
        readonly sortable: true;
    }];
};
export declare const PayAdjustmentPage: z.ZodObject<{
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
        side: z.ZodEnum<["earning", "deduction"]>;
        amountRwf: z.ZodNumber;
        taxable: z.ZodBoolean;
        contributable: z.ZodBoolean;
        correctsPeriod: z.ZodString;
        reason: z.ZodString;
        source: z.ZodEnum<["manual", "leave", "asset_fine", "held_payslip", "late_claim"]>;
        status: z.ZodEnum<["open", "waived", "paid"]>;
        paidInPeriod: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "paid" | "waived";
        id: string;
        amountRwf: number;
        reason: string;
        source: "manual" | "leave" | "asset_fine" | "held_payslip" | "late_claim";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        side: "earning" | "deduction";
        taxable: boolean;
        contributable: boolean;
        correctsPeriod: string;
        paidInPeriod: string | null;
    }, {
        status: "open" | "paid" | "waived";
        id: string;
        amountRwf: number;
        reason: string;
        source: "manual" | "leave" | "asset_fine" | "held_payslip" | "late_claim";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        side: "earning" | "deduction";
        taxable: boolean;
        contributable: boolean;
        correctsPeriod: string;
        paidInPeriod: string | null;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        status: "open" | "paid" | "waived";
        id: string;
        amountRwf: number;
        reason: string;
        source: "manual" | "leave" | "asset_fine" | "held_payslip" | "late_claim";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        side: "earning" | "deduction";
        taxable: boolean;
        contributable: boolean;
        correctsPeriod: string;
        paidInPeriod: string | null;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        status: "open" | "paid" | "waived";
        id: string;
        amountRwf: number;
        reason: string;
        source: "manual" | "leave" | "asset_fine" | "held_payslip" | "late_claim";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        side: "earning" | "deduction";
        taxable: boolean;
        contributable: boolean;
        correctsPeriod: string;
        paidInPeriod: string | null;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type PayAdjustmentPage = z.infer<typeof PayAdjustmentPage>;
/** `GET /ops/contracts`: every contract of the business. */
export declare const CONTRACT_LIST: {
    readonly key: "staff.contracts";
    readonly searchFields: readonly ["employee"];
    readonly statusField: "status";
    readonly defaultSort: readonly [{
        readonly field: "startsOn";
        readonly dir: "desc";
    }];
    readonly fields: readonly [{
        readonly key: "employee";
        readonly label: "Person";
        readonly type: "text";
        readonly sortable: true;
    }, {
        readonly key: "status";
        readonly label: "Status";
        readonly type: "enum";
        readonly enumValues: readonly ["draft", "active", "ended"];
        readonly enumLabels: {
            readonly draft: "Starting";
            readonly active: "Running";
            readonly ended: "Ended";
        };
        readonly filterable: true;
    }, {
        readonly key: "wageBasis";
        readonly label: "Paid by";
        readonly type: "enum";
        readonly enumValues: readonly ["monthly", "daily", "hourly"];
        readonly enumLabels: {
            readonly monthly: "Month";
            readonly daily: "Day";
            readonly hourly: "Hour";
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
        readonly key: "startsOn";
        readonly label: "Starts";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
    }, {
        readonly key: "endsOn";
        readonly label: "Ends";
        readonly type: "date";
        readonly filterable: true;
        readonly sortable: true;
    }];
};
export declare const ContractPage: z.ZodObject<{
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
        employeeNumber: z.ZodString;
        branchId: z.ZodNullable<z.ZodString>;
        contractType: z.ZodString;
        startsOn: z.ZodString;
        endsOn: z.ZodNullable<z.ZodString>;
        wageBasis: z.ZodEnum<["monthly", "daily", "hourly"]>;
        wageRwf: z.ZodNumber;
        status: z.ZodString;
        payStructureId: z.ZodNullable<z.ZodString>;
        noticeDays: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        noticeDays: number | null;
        contractType: string;
        endsOn: string | null;
        wageBasis: "monthly" | "daily" | "hourly";
        wageRwf: number;
        employeeNumber: string;
        payStructureId: string | null;
        branchId: string | null;
    }, {
        status: string;
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        noticeDays: number | null;
        contractType: string;
        endsOn: string | null;
        wageBasis: "monthly" | "daily" | "hourly";
        wageRwf: number;
        employeeNumber: string;
        payStructureId: string | null;
        branchId: string | null;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodUnion<[z.ZodLiteral<10>, z.ZodLiteral<25>, z.ZodLiteral<50>, z.ZodLiteral<100>]>;
    groups: z.ZodOptional<z.ZodArray<z.ZodObject<{
        key: z.ZodNullable<z.ZodString>;
        label: z.ZodString;
        count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        count: number;
        key: string | null;
        label: string;
    }, {
        count: number;
        key: string | null;
        label: string;
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
        status: string;
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        noticeDays: number | null;
        contractType: string;
        endsOn: string | null;
        wageBasis: "monthly" | "daily" | "hourly";
        wageRwf: number;
        employeeNumber: string;
        payStructureId: string | null;
        branchId: string | null;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
        status: string;
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        noticeDays: number | null;
        contractType: string;
        endsOn: string | null;
        wageBasis: "monthly" | "daily" | "hourly";
        wageRwf: number;
        employeeNumber: string;
        payStructureId: string | null;
        branchId: string | null;
    }[];
    total: number;
    page: number;
    pageSize: 10 | 100 | 50 | 25;
    groups?: {
        count: number;
        key: string | null;
        label: string;
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
export type ContractPage = z.infer<typeof ContractPage>;
//# sourceMappingURL=hr-lists.d.ts.map