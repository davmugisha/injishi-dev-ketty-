import { z } from "zod";
export declare const LeaveAllocationKind: z.ZodEnum<["extra", "compensatory"]>;
export type LeaveAllocationKind = z.infer<typeof LeaveAllocationKind>;
export declare const LeaveAllocationStatus: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
export type LeaveAllocationStatus = z.infer<typeof LeaveAllocationStatus>;
export declare const LeaveAllocationRequest: z.ZodObject<{
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
    /** The worked holiday or day off a compensatory request is for. */
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
    kind: "compensatory" | "extra";
    decidedAt: string | null;
    reason: string;
    id: string;
    decisionNote: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    branchId: string | null;
    workDate: string | null;
    days: number;
    leaveType: {
        name: string;
        id: string;
    };
    routedToMe: boolean;
    decidedByName: string | null;
    attendanceRecordId: string | null;
    routedTo: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    } | null;
}, {
    status: "approved" | "rejected" | "cancelled" | "requested";
    kind: "compensatory" | "extra";
    decidedAt: string | null;
    reason: string;
    id: string;
    decisionNote: string | null;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    createdAt: string;
    branchId: string | null;
    workDate: string | null;
    days: number;
    leaveType: {
        name: string;
        id: string;
    };
    routedToMe: boolean;
    decidedByName: string | null;
    attendanceRecordId: string | null;
    routedTo: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    } | null;
}>;
export type LeaveAllocationRequest = z.infer<typeof LeaveAllocationRequest>;
/** Extra days on a type, or the days a worked holiday or day off earns (counted by the server). */
export declare const AllocationAsk: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"extra">;
    leaveTypeId: z.ZodString;
    days: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "extra";
    reason: string;
    days: number;
    leaveTypeId: string;
}, {
    kind: "extra";
    reason: string;
    days: number;
    leaveTypeId: string;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"compensatory">;
    attendanceRecordId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "compensatory";
    reason: string;
    attendanceRecordId: string;
}, {
    kind: "compensatory";
    reason: string;
    attendanceRecordId: string;
}>]>;
export type AllocationAsk = z.infer<typeof AllocationAsk>;
/** `POST /ops/leave/allocation-requests`: on someone's behalf. */
export declare const CreateLeaveAllocationRequest: z.ZodIntersection<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"extra">;
    leaveTypeId: z.ZodString;
    days: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "extra";
    reason: string;
    days: number;
    leaveTypeId: string;
}, {
    kind: "extra";
    reason: string;
    days: number;
    leaveTypeId: string;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"compensatory">;
    attendanceRecordId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "compensatory";
    reason: string;
    attendanceRecordId: string;
}, {
    kind: "compensatory";
    reason: string;
    attendanceRecordId: string;
}>]>, z.ZodObject<{
    employeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
}, {
    employeeId: string;
}>>;
export type CreateLeaveAllocationRequest = z.infer<typeof CreateLeaveAllocationRequest>;
/** The same through self service. */
export declare const CreateMyLeaveAllocationRequest: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"extra">;
    leaveTypeId: z.ZodString;
    days: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "extra";
    reason: string;
    days: number;
    leaveTypeId: string;
}, {
    kind: "extra";
    reason: string;
    days: number;
    leaveTypeId: string;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"compensatory">;
    attendanceRecordId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "compensatory";
    reason: string;
    attendanceRecordId: string;
}, {
    kind: "compensatory";
    reason: string;
    attendanceRecordId: string;
}>]>;
export type CreateMyLeaveAllocationRequest = z.infer<typeof CreateMyLeaveAllocationRequest>;
export declare const RestrictedTypeMode: z.ZodEnum<["all", "only", "except"]>;
export type RestrictedTypeMode = z.infer<typeof RestrictedTypeMode>;
export declare const RestrictedLeavePeriod: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    fromDate: z.ZodString;
    toDate: z.ZodString;
    /** Null: every department. */
    departmentId: z.ZodNullable<z.ZodString>;
    departmentName: z.ZodNullable<z.ZodString>;
    /** Empty: every position. */
    jobPositionIds: z.ZodArray<z.ZodString, "many">;
    typeMode: z.ZodEnum<["all", "only", "except"]>;
    /** The types `only` covers or `except` leaves out. */
    leaveTypeIds: z.ZodArray<z.ZodString, "many">;
    description: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    departmentName: string | null;
    description: string | null;
    departmentId: string | null;
    fromDate: string;
    toDate: string;
    jobPositionIds: string[];
    typeMode: "all" | "only" | "except";
    leaveTypeIds: string[];
}, {
    id: string;
    title: string;
    departmentName: string | null;
    description: string | null;
    departmentId: string | null;
    fromDate: string;
    toDate: string;
    jobPositionIds: string[];
    typeMode: "all" | "only" | "except";
    leaveTypeIds: string[];
}>;
export type RestrictedLeavePeriod = z.infer<typeof RestrictedLeavePeriod>;
export declare const RestrictedLeavePeriodList: z.ZodObject<{
    periods: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        fromDate: z.ZodString;
        toDate: z.ZodString;
        /** Null: every department. */
        departmentId: z.ZodNullable<z.ZodString>;
        departmentName: z.ZodNullable<z.ZodString>;
        /** Empty: every position. */
        jobPositionIds: z.ZodArray<z.ZodString, "many">;
        typeMode: z.ZodEnum<["all", "only", "except"]>;
        /** The types `only` covers or `except` leaves out. */
        leaveTypeIds: z.ZodArray<z.ZodString, "many">;
        description: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        departmentName: string | null;
        description: string | null;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        jobPositionIds: string[];
        typeMode: "all" | "only" | "except";
        leaveTypeIds: string[];
    }, {
        id: string;
        title: string;
        departmentName: string | null;
        description: string | null;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        jobPositionIds: string[];
        typeMode: "all" | "only" | "except";
        leaveTypeIds: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    periods: {
        id: string;
        title: string;
        departmentName: string | null;
        description: string | null;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        jobPositionIds: string[];
        typeMode: "all" | "only" | "except";
        leaveTypeIds: string[];
    }[];
}, {
    periods: {
        id: string;
        title: string;
        departmentName: string | null;
        description: string | null;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        jobPositionIds: string[];
        typeMode: "all" | "only" | "except";
        leaveTypeIds: string[];
    }[];
}>;
export type RestrictedLeavePeriodList = z.infer<typeof RestrictedLeavePeriodList>;
export declare const CreateRestrictedLeavePeriodRequest: z.ZodEffects<z.ZodObject<{
    title: z.ZodString;
    fromDate: z.ZodString;
    toDate: z.ZodString;
    departmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jobPositionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    typeMode: z.ZodOptional<z.ZodEnum<["all", "only", "except"]>>;
    leaveTypeIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    fromDate: string;
    toDate: string;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}, {
    title: string;
    fromDate: string;
    toDate: string;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}>, {
    title: string;
    fromDate: string;
    toDate: string;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}, {
    title: string;
    fromDate: string;
    toDate: string;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}>;
export type CreateRestrictedLeavePeriodRequest = z.infer<typeof CreateRestrictedLeavePeriodRequest>;
export declare const UpdateRestrictedLeavePeriodRequest: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    fromDate: z.ZodOptional<z.ZodString>;
    toDate: z.ZodOptional<z.ZodString>;
    departmentId: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    jobPositionIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    typeMode: z.ZodOptional<z.ZodOptional<z.ZodEnum<["all", "only", "except"]>>>;
    leaveTypeIds: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    description: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}, {
    title?: string | undefined;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}>, {
    title?: string | undefined;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}, {
    title?: string | undefined;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}>, {
    title?: string | undefined;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}, {
    title?: string | undefined;
    description?: string | null | undefined;
    departmentId?: string | null | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    jobPositionIds?: string[] | undefined;
    typeMode?: "all" | "only" | "except" | undefined;
    leaveTypeIds?: string[] | undefined;
}>;
export type UpdateRestrictedLeavePeriodRequest = z.infer<typeof UpdateRestrictedLeavePeriodRequest>;
/** One person's balance per type: the sum of the ledger. Open the person for the lots and rows. */
export declare const LeaveBalanceRow: z.ZodObject<{
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
    balances: z.ZodArray<z.ZodObject<{
        leaveTypeId: z.ZodString;
        /** Null for a type that keeps no balance. */
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
    branchId: string | null;
    balances: {
        days: number | null;
        leaveTypeId: string;
    }[];
}>;
export type LeaveBalanceRow = z.infer<typeof LeaveBalanceRow>;
export declare const LeaveDashboard: z.ZodObject<{
    today: z.ZodString;
    onLeaveToday: z.ZodArray<z.ZodObject<{
        requestId: z.ZodString;
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
        leaveTypeName: z.ZodString;
        startsOn: z.ZodString;
        endsOn: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        endsOn: string;
        requestId: string;
        leaveTypeName: string;
    }, {
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        endsOn: string;
        requestId: string;
        leaveTypeName: string;
    }>, "many">;
    startingThisWeek: z.ZodArray<z.ZodObject<{
        requestId: z.ZodString;
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
        leaveTypeName: z.ZodString;
        startsOn: z.ZodString;
        endsOn: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        endsOn: string;
        requestId: string;
        leaveTypeName: string;
    }, {
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        endsOn: string;
        requestId: string;
        leaveTypeName: string;
    }>, "many">;
    waiting: z.ZodObject<{
        requests: z.ZodNumber;
        routedToMe: z.ZodNumber;
        atStepTwo: z.ZodNumber;
        allocations: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        requests: number;
        routedToMe: number;
        atStepTwo: number;
        allocations: number;
    }, {
        requests: number;
        routedToMe: number;
        atStepTwo: number;
        allocations: number;
    }>;
}, "strip", z.ZodTypeAny, {
    today: string;
    onLeaveToday: {
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        endsOn: string;
        requestId: string;
        leaveTypeName: string;
    }[];
    startingThisWeek: {
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        endsOn: string;
        requestId: string;
        leaveTypeName: string;
    }[];
    waiting: {
        requests: number;
        routedToMe: number;
        atStepTwo: number;
        allocations: number;
    };
}, {
    today: string;
    onLeaveToday: {
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        endsOn: string;
        requestId: string;
        leaveTypeName: string;
    }[];
    startingThisWeek: {
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        endsOn: string;
        requestId: string;
        leaveTypeName: string;
    }[];
    waiting: {
        requests: number;
        routedToMe: number;
        atStepTwo: number;
        allocations: number;
    };
}>;
export type LeaveDashboard = z.infer<typeof LeaveDashboard>;
export declare const LeaveDefaultsDiff: z.ZodObject<{
    /** The defaults row in force. */
    configEntryId: z.ZodString;
    version: z.ZodNumber;
    /** Types in the defaults the business does not have. */
    missing: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
    }, {
        code: string;
        name: string;
    }>, "many">;
    /** Rules that differ, by type: what the business has and what the defaults say. */
    changed: z.ZodArray<z.ZodObject<{
        code: z.ZodString;
        name: z.ZodString;
        field: z.ZodString;
        current: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
        defaults: z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        current: string | number | boolean | null;
        field: string;
        defaults: string | number | boolean | null;
    }, {
        code: string;
        name: string;
        current: string | number | boolean | null;
        field: string;
        defaults: string | number | boolean | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    missing: {
        code: string;
        name: string;
    }[];
    version: number;
    configEntryId: string;
    changed: {
        code: string;
        name: string;
        current: string | number | boolean | null;
        field: string;
        defaults: string | number | boolean | null;
    }[];
}, {
    missing: {
        code: string;
        name: string;
    }[];
    version: number;
    configEntryId: string;
    changed: {
        code: string;
        name: string;
        current: string | number | boolean | null;
        field: string;
        defaults: string | number | boolean | null;
    }[];
}>;
export type LeaveDefaultsDiff = z.infer<typeof LeaveDefaultsDiff>;
/**
 * `POST /ops/leave/types/defaults/apply`: the codes to take from the defaults.
 * A missing type is added; a present one takes the defaults' rules from now on.
 */
export declare const ApplyLeaveDefaultsRequest: z.ZodObject<{
    codes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    codes: string[];
}, {
    codes: string[];
}>;
export type ApplyLeaveDefaultsRequest = z.infer<typeof ApplyLeaveDefaultsRequest>;
export declare const MyLeaveBalances: z.ZodObject<{
    employeeId: z.ZodString;
    balances: z.ZodArray<z.ZodObject<{
        leaveType: z.ZodObject<{
            name: z.ZodString;
            payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
            paymentPercent: z.ZodNullable<z.ZodNumber>;
            yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
            accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
            reset: z.ZodEnum<["yearly", "monthly", "never"]>;
            carry: z.ZodEnum<["none", "carry", "carry_with_expiry"]>;
            carryMaxDays: z.ZodNumber;
            carryExpiresMonths: z.ZodNullable<z.ZodNumber>;
            approvalSteps: z.ZodNumber;
            needsAttachment: z.ZodBoolean;
            countsWeeklyOffs: z.ZodBoolean;
            countsHolidays: z.ZodBoolean;
            eligibleSex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
            minServiceMonths: z.ZodNumber;
            oncePerEmployment: z.ZodBoolean;
            statutory: z.ZodBoolean;
            allowsPastRequests: z.ZodBoolean;
            encashable: z.ZodBoolean;
            compensatory: z.ZodBoolean;
            seniorityEveryYears: z.ZodNullable<z.ZodNumber>;
            seniorityExtraDays: z.ZodNullable<z.ZodNumber>;
            seniorityCapDays: z.ZodNullable<z.ZodNumber>;
        } & {
            id: z.ZodString;
            code: z.ZodString;
            status: z.ZodEnum<["active", "archived"]>;
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
        }>;
        balanceDays: z.ZodNullable<z.ZodNumber>;
        lots: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["accrual", "carry_forward", "adjustment"]>;
            effectiveOn: z.ZodString;
            usableUntil: z.ZodNullable<z.ZodString>;
            creditDays: z.ZodNumber;
            remainingDays: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            kind: "adjustment" | "accrual" | "carry_forward";
            id: string;
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }, {
            kind: "adjustment" | "accrual" | "carry_forward";
            id: string;
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }>, "many">;
        entries: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["accrual", "taken", "reversal", "carry_forward", "expiry", "adjustment", "encashed"]>;
            days: z.ZodNumber;
            effectiveOn: z.ZodString;
            periodKey: z.ZodNullable<z.ZodString>;
            leaveRequestId: z.ZodNullable<z.ZodString>;
            reason: z.ZodNullable<z.ZodString>;
            expiresOn: z.ZodNullable<z.ZodString>;
            lotId: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            id: string;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
            lotId: string | null;
        }, {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            id: string;
            days: number;
            effectiveOn: string;
            periodKey: string | null;
            leaveRequestId: string | null;
            lotId: string | null;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entries: {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            id: string;
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
        };
        balanceDays: number | null;
        lots: {
            kind: "adjustment" | "accrual" | "carry_forward";
            id: string;
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }[];
    }, {
        entries: {
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            id: string;
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
        };
        balanceDays: number | null;
        lots: {
            kind: "adjustment" | "accrual" | "carry_forward";
            id: string;
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
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            id: string;
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
        };
        balanceDays: number | null;
        lots: {
            kind: "adjustment" | "accrual" | "carry_forward";
            id: string;
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
            kind: "taken" | "adjustment" | "accrual" | "reversal" | "carry_forward" | "expiry" | "encashed";
            expiresOn: string | null;
            reason: string | null;
            id: string;
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
        };
        balanceDays: number | null;
        lots: {
            kind: "adjustment" | "accrual" | "carry_forward";
            id: string;
            effectiveOn: string;
            usableUntil: string | null;
            creditDays: number;
            remainingDays: number;
        }[];
    }[];
}>;
export type MyLeaveBalances = z.infer<typeof MyLeaveBalances>;
export declare const MyLeaveRequestList: z.ZodObject<{
    requests: z.ZodArray<z.ZodObject<{
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
            step: number;
            decidedByName: string | null;
        }, {
            decision: "approved" | "rejected" | "skipped";
            decidedAt: string;
            note: string | null;
            step: number;
            decidedByName: string | null;
        }>, "many">;
        hasAttachment: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        decidedAt: string | null;
        reason: string | null;
        id: string;
        startsOn: string;
        decisionNote: string | null;
        payment: "paid" | "unpaid" | "partial";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        endsOn: string;
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
            step: number;
            decidedByName: string | null;
        }[];
        hasAttachment: boolean;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        decidedAt: string | null;
        reason: string | null;
        id: string;
        startsOn: string;
        decisionNote: string | null;
        payment: "paid" | "unpaid" | "partial";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        endsOn: string;
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
            step: number;
            decidedByName: string | null;
        }[];
        hasAttachment: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
        decidedAt: string | null;
        reason: string | null;
        id: string;
        startsOn: string;
        decisionNote: string | null;
        payment: "paid" | "unpaid" | "partial";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        endsOn: string;
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
            step: number;
            decidedByName: string | null;
        }[];
        hasAttachment: boolean;
    }[];
}, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
        decidedAt: string | null;
        reason: string | null;
        id: string;
        startsOn: string;
        decisionNote: string | null;
        payment: "paid" | "unpaid" | "partial";
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        endsOn: string;
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
            step: number;
            decidedByName: string | null;
        }[];
        hasAttachment: boolean;
    }[];
}>;
export type MyLeaveRequestList = z.infer<typeof MyLeaveRequestList>;
export declare const MyLeaveAllocationList: z.ZodObject<{
    requests: z.ZodArray<z.ZodObject<{
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
        /** The worked holiday or day off a compensatory request is for. */
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
        kind: "compensatory" | "extra";
        decidedAt: string | null;
        reason: string;
        id: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        workDate: string | null;
        days: number;
        leaveType: {
            name: string;
            id: string;
        };
        routedToMe: boolean;
        decidedByName: string | null;
        attendanceRecordId: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
        kind: "compensatory" | "extra";
        decidedAt: string | null;
        reason: string;
        id: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        workDate: string | null;
        days: number;
        leaveType: {
            name: string;
            id: string;
        };
        routedToMe: boolean;
        decidedByName: string | null;
        attendanceRecordId: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
        kind: "compensatory" | "extra";
        decidedAt: string | null;
        reason: string;
        id: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        workDate: string | null;
        days: number;
        leaveType: {
            name: string;
            id: string;
        };
        routedToMe: boolean;
        decidedByName: string | null;
        attendanceRecordId: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
    }[];
}, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
        kind: "compensatory" | "extra";
        decidedAt: string | null;
        reason: string;
        id: string;
        decisionNote: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        createdAt: string;
        branchId: string | null;
        workDate: string | null;
        days: number;
        leaveType: {
            name: string;
            id: string;
        };
        routedToMe: boolean;
        decidedByName: string | null;
        attendanceRecordId: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
    }[];
}>;
export type MyLeaveAllocationList = z.infer<typeof MyLeaveAllocationList>;
/** The types a person may ask for: their own eligibility already applied. */
export declare const MyLeaveTypeList: z.ZodObject<{
    types: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        payment: z.ZodEnum<["paid", "unpaid", "partial"]>;
        paymentPercent: z.ZodNullable<z.ZodNumber>;
        yearlyEntitlementDays: z.ZodNullable<z.ZodNumber>;
        accrual: z.ZodEnum<["yearly_upfront", "monthly", "none"]>;
        reset: z.ZodEnum<["yearly", "monthly", "never"]>;
        carry: z.ZodEnum<["none", "carry", "carry_with_expiry"]>;
        carryMaxDays: z.ZodNumber;
        carryExpiresMonths: z.ZodNullable<z.ZodNumber>;
        approvalSteps: z.ZodNumber;
        needsAttachment: z.ZodBoolean;
        countsWeeklyOffs: z.ZodBoolean;
        countsHolidays: z.ZodBoolean;
        eligibleSex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        minServiceMonths: z.ZodNumber;
        oncePerEmployment: z.ZodBoolean;
        statutory: z.ZodBoolean;
        allowsPastRequests: z.ZodBoolean;
        encashable: z.ZodBoolean;
        compensatory: z.ZodBoolean;
        seniorityEveryYears: z.ZodNullable<z.ZodNumber>;
        seniorityExtraDays: z.ZodNullable<z.ZodNumber>;
        seniorityCapDays: z.ZodNullable<z.ZodNumber>;
    } & {
        id: z.ZodString;
        code: z.ZodString;
        status: z.ZodEnum<["active", "archived"]>;
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
    }[];
}>;
export type MyLeaveTypeList = z.infer<typeof MyLeaveTypeList>;
/** `POST /me/work/:employeeId/files`: an attachment uploaded by the person, answered with its key. */
export declare const MyUpload: z.ZodObject<{
    key: z.ZodString;
    contentType: z.ZodString;
    sizeBytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sizeBytes: number;
    key: string;
    contentType: string;
}, {
    sizeBytes: number;
    key: string;
    contentType: string;
}>;
export type MyUpload = z.infer<typeof MyUpload>;
//# sourceMappingURL=leave.d.ts.map