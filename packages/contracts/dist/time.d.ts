import { z } from "zod";
/** `POST /ops/roster/publish`: every draft of a branch (and a department) in the range. */
export declare const PublishRosterRequest: z.ZodEffects<z.ZodObject<{
    propertyId: z.ZodString;
    departmentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    propertyId: string;
    departmentId?: string | null | undefined;
}, {
    from: string;
    to: string;
    propertyId: string;
    departmentId?: string | null | undefined;
}>, {
    from: string;
    to: string;
    propertyId: string;
    departmentId?: string | null | undefined;
}, {
    from: string;
    to: string;
    propertyId: string;
    departmentId?: string | null | undefined;
}>;
export type PublishRosterRequest = z.infer<typeof PublishRosterRequest>;
export declare const RosterPublication: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodString;
    departmentId: z.ZodNullable<z.ZodString>;
    fromDate: z.ZodString;
    toDate: z.ZodString;
    entryCount: z.ZodNumber;
    publishedAt: z.ZodString;
    publishedByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    entryCount: number;
    publishedAt: string;
    propertyId: string;
    departmentId: string | null;
    fromDate: string;
    toDate: string;
    publishedByName: string | null;
}, {
    id: string;
    entryCount: number;
    publishedAt: string;
    propertyId: string;
    departmentId: string | null;
    fromDate: string;
    toDate: string;
    publishedByName: string | null;
}>;
export type RosterPublication = z.infer<typeof RosterPublication>;
export declare const RosterPublicationList: z.ZodObject<{
    publications: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        departmentId: z.ZodNullable<z.ZodString>;
        fromDate: z.ZodString;
        toDate: z.ZodString;
        entryCount: z.ZodNumber;
        publishedAt: z.ZodString;
        publishedByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        entryCount: number;
        publishedAt: string;
        propertyId: string;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        publishedByName: string | null;
    }, {
        id: string;
        entryCount: number;
        publishedAt: string;
        propertyId: string;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        publishedByName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    publications: {
        id: string;
        entryCount: number;
        publishedAt: string;
        propertyId: string;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        publishedByName: string | null;
    }[];
}, {
    publications: {
        id: string;
        entryCount: number;
        publishedAt: string;
        propertyId: string;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        publishedByName: string | null;
    }[];
}>;
export type RosterPublicationList = z.infer<typeof RosterPublicationList>;
/** `GET /ops/roster/week`: one branch's entries for seven days, drafts included, for the week grid. */
export declare const RosterWeek: z.ZodObject<{
    propertyId: z.ZodString;
    from: z.ZodString;
    to: z.ZodString;
    entries: z.ZodArray<z.ZodObject<{
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
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
    /** The publishes that touched the week, newest first. */
    publications: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        departmentId: z.ZodNullable<z.ZodString>;
        fromDate: z.ZodString;
        toDate: z.ZodString;
        entryCount: z.ZodNumber;
        publishedAt: z.ZodString;
        publishedByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        entryCount: number;
        publishedAt: string;
        propertyId: string;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        publishedByName: string | null;
    }, {
        id: string;
        entryCount: number;
        publishedAt: string;
        propertyId: string;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        publishedByName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
    from: string;
    to: string;
    propertyId: string;
    publications: {
        id: string;
        entryCount: number;
        publishedAt: string;
        propertyId: string;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        publishedByName: string | null;
    }[];
}, {
    entries: {
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
    from: string;
    to: string;
    propertyId: string;
    publications: {
        id: string;
        entryCount: number;
        publishedAt: string;
        propertyId: string;
        departmentId: string | null;
        fromDate: string;
        toDate: string;
        publishedByName: string | null;
    }[];
}>;
export type RosterWeek = z.infer<typeof RosterWeek>;
/** `GET /ops/roster/week`: any day of the week wanted; the week runs Monday to Sunday. */
export declare const RosterWeekQuery: z.ZodObject<{
    propertyId: z.ZodString;
    from: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    propertyId: string;
    from?: string | undefined;
}, {
    propertyId: string;
    from?: string | undefined;
}>;
export type RosterWeekQuery = z.infer<typeof RosterWeekQuery>;
export declare const RotationRule: z.ZodEnum<["every_n_days", "weekly", "monthly"]>;
export type RotationRule = z.infer<typeof RotationRule>;
/** A step is a shift template of the branch, or a day off. */
export declare const RotationStep: z.ZodUnion<[z.ZodString, z.ZodLiteral<"off">]>;
export type RotationStep = z.infer<typeof RotationStep>;
export declare const RotationPatternStatus: z.ZodEnum<["active", "archived"]>;
export type RotationPatternStatus = z.infer<typeof RotationPatternStatus>;
export declare const RotationPattern: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodString;
    name: z.ZodString;
    steps: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodLiteral<"off">]>, "many">;
    /** Each step's shift name, or "Off", in order. */
    stepNames: z.ZodArray<z.ZodString, "many">;
    rule: z.ZodEnum<["every_n_days", "weekly", "monthly"]>;
    ruleValue: z.ZodNumber;
    status: z.ZodEnum<["active", "archived"]>;
    /** People on it now. */
    openAssignments: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    name: string;
    id: string;
    rule: "monthly" | "every_n_days" | "weekly";
    propertyId: string;
    steps: string[];
    stepNames: string[];
    ruleValue: number;
    openAssignments: number;
}, {
    status: "active" | "archived";
    name: string;
    id: string;
    rule: "monthly" | "every_n_days" | "weekly";
    propertyId: string;
    steps: string[];
    stepNames: string[];
    ruleValue: number;
    openAssignments: number;
}>;
export type RotationPattern = z.infer<typeof RotationPattern>;
export declare const RotationPatternList: z.ZodObject<{
    patterns: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        name: z.ZodString;
        steps: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodLiteral<"off">]>, "many">;
        /** Each step's shift name, or "Off", in order. */
        stepNames: z.ZodArray<z.ZodString, "many">;
        rule: z.ZodEnum<["every_n_days", "weekly", "monthly"]>;
        ruleValue: z.ZodNumber;
        status: z.ZodEnum<["active", "archived"]>;
        /** People on it now. */
        openAssignments: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        name: string;
        id: string;
        rule: "monthly" | "every_n_days" | "weekly";
        propertyId: string;
        steps: string[];
        stepNames: string[];
        ruleValue: number;
        openAssignments: number;
    }, {
        status: "active" | "archived";
        name: string;
        id: string;
        rule: "monthly" | "every_n_days" | "weekly";
        propertyId: string;
        steps: string[];
        stepNames: string[];
        ruleValue: number;
        openAssignments: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    patterns: {
        status: "active" | "archived";
        name: string;
        id: string;
        rule: "monthly" | "every_n_days" | "weekly";
        propertyId: string;
        steps: string[];
        stepNames: string[];
        ruleValue: number;
        openAssignments: number;
    }[];
}, {
    patterns: {
        status: "active" | "archived";
        name: string;
        id: string;
        rule: "monthly" | "every_n_days" | "weekly";
        propertyId: string;
        steps: string[];
        stepNames: string[];
        ruleValue: number;
        openAssignments: number;
    }[];
}>;
export type RotationPatternList = z.infer<typeof RotationPatternList>;
export declare const RotationPatternQuery: z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    propertyId?: string | undefined;
}, {
    propertyId?: string | undefined;
}>;
export type RotationPatternQuery = z.infer<typeof RotationPatternQuery>;
export declare const CreateRotationPatternRequest: z.ZodEffects<z.ZodObject<{
    propertyId: z.ZodString;
    name: z.ZodString;
    steps: z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodLiteral<"off">]>, "many">;
    rule: z.ZodEnum<["every_n_days", "weekly", "monthly"]>;
    ruleValue: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    name: string;
    rule: "monthly" | "every_n_days" | "weekly";
    propertyId: string;
    steps: string[];
    ruleValue: number;
}, {
    name: string;
    rule: "monthly" | "every_n_days" | "weekly";
    propertyId: string;
    steps: string[];
    ruleValue: number;
}>, {
    name: string;
    rule: "monthly" | "every_n_days" | "weekly";
    propertyId: string;
    steps: string[];
    ruleValue: number;
}, {
    name: string;
    rule: "monthly" | "every_n_days" | "weekly";
    propertyId: string;
    steps: string[];
    ruleValue: number;
}>;
export type CreateRotationPatternRequest = z.infer<typeof CreateRotationPatternRequest>;
/**
 * `PATCH /ops/rotation-patterns/:id`. The steps and the rule of a pattern
 * someone is on never change: their generated drafts follow it, so a new
 * pattern is a new row (058-time, calls made while building).
 */
export declare const UpdateRotationPatternRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
}, {
    status?: "active" | "archived" | undefined;
    name?: string | undefined;
}>;
export type UpdateRotationPatternRequest = z.infer<typeof UpdateRotationPatternRequest>;
export declare const RotationAssignment: z.ZodObject<{
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
    patternId: z.ZodString;
    patternName: z.ZodString;
    propertyId: z.ZodString;
    startsOn: z.ZodString;
    endsOn: z.ZodNullable<z.ZodString>;
    startStep: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    startsOn: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    propertyId: string;
    endsOn: string | null;
    patternId: string;
    patternName: string;
    startStep: number;
}, {
    id: string;
    startsOn: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    propertyId: string;
    endsOn: string | null;
    patternId: string;
    patternName: string;
    startStep: number;
}>;
export type RotationAssignment = z.infer<typeof RotationAssignment>;
export declare const RotationAssignmentList: z.ZodObject<{
    assignments: z.ZodArray<z.ZodObject<{
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
        patternId: z.ZodString;
        patternName: z.ZodString;
        propertyId: z.ZodString;
        startsOn: z.ZodString;
        endsOn: z.ZodNullable<z.ZodString>;
        startStep: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        propertyId: string;
        endsOn: string | null;
        patternId: string;
        patternName: string;
        startStep: number;
    }, {
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        propertyId: string;
        endsOn: string | null;
        patternId: string;
        patternName: string;
        startStep: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    assignments: {
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        propertyId: string;
        endsOn: string | null;
        patternId: string;
        patternName: string;
        startStep: number;
    }[];
}, {
    assignments: {
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        propertyId: string;
        endsOn: string | null;
        patternId: string;
        patternName: string;
        startStep: number;
    }[];
}>;
export type RotationAssignmentList = z.infer<typeof RotationAssignmentList>;
/** Running assignments, unless ended ones are asked for too. */
export declare const RotationAssignmentQuery: z.ZodObject<{
    patternId: z.ZodOptional<z.ZodString>;
    includeEnded: z.ZodOptional<z.ZodEnum<["true", "false"]>>;
}, "strip", z.ZodTypeAny, {
    patternId?: string | undefined;
    includeEnded?: "true" | "false" | undefined;
}, {
    patternId?: string | undefined;
    includeEnded?: "true" | "false" | undefined;
}>;
export type RotationAssignmentQuery = z.infer<typeof RotationAssignmentQuery>;
export declare const CreateRotationAssignmentRequest: z.ZodObject<{
    employeeId: z.ZodString;
    patternId: z.ZodString;
    startsOn: z.ZodString;
    /** Which step the person is on on `startsOn`, from 0. */
    startStep: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    startsOn: string;
    employeeId: string;
    patternId: string;
    startStep?: number | undefined;
}, {
    startsOn: string;
    employeeId: string;
    patternId: string;
    startStep?: number | undefined;
}>;
export type CreateRotationAssignmentRequest = z.infer<typeof CreateRotationAssignmentRequest>;
/** Ending an assignment cancels the drafts it generated after its last day. */
export declare const EndRotationAssignmentRequest: z.ZodObject<{
    endsOn: z.ZodString;
}, "strip", z.ZodTypeAny, {
    endsOn: string;
}, {
    endsOn: string;
}>;
export type EndRotationAssignmentRequest = z.infer<typeof EndRotationAssignmentRequest>;
export declare const ShiftRequestKind: z.ZodEnum<["change", "swap"]>;
export type ShiftRequestKind = z.infer<typeof ShiftRequestKind>;
export declare const ShiftRequestStatus: z.ZodEnum<["requested", "awaiting_colleague", "approved", "rejected", "cancelled"]>;
export type ShiftRequestStatus = z.infer<typeof ShiftRequestStatus>;
export declare const ShiftRequest: z.ZodObject<{
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
    /** Routed to the caller's own file. */
    routedToMe: z.ZodBoolean;
    decidedAt: z.ZodNullable<z.ZodString>;
    decidedByName: z.ZodNullable<z.ZodString>;
    decisionNote: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
    kind: "change" | "swap";
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
    routedToMe: boolean;
    decidedByName: string | null;
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
    kind: "change" | "swap";
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
    routedToMe: boolean;
    decidedByName: string | null;
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
}>;
export type ShiftRequest = z.infer<typeof ShiftRequest>;
/** `POST /ops/shift-requests`: on someone's behalf. A swap names a colleague at the same branch. */
export declare const CreateShiftRequestRequest: z.ZodEffects<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    reason: z.ZodString;
} & {
    kind: z.ZodLiteral<"change">;
    employeeId: z.ZodString;
    shiftTemplateId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "change";
    reason: string;
    from: string;
    to: string;
    employeeId: string;
    shiftTemplateId: string;
}, {
    kind: "change";
    reason: string;
    from: string;
    to: string;
    employeeId: string;
    shiftTemplateId: string;
}>, z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    reason: z.ZodString;
} & {
    kind: z.ZodLiteral<"swap">;
    employeeId: z.ZodString;
    swapEmployeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "swap";
    reason: string;
    from: string;
    to: string;
    employeeId: string;
    swapEmployeeId: string;
}, {
    kind: "swap";
    reason: string;
    from: string;
    to: string;
    employeeId: string;
    swapEmployeeId: string;
}>]>, {
    kind: "change";
    reason: string;
    from: string;
    to: string;
    employeeId: string;
    shiftTemplateId: string;
} | {
    kind: "swap";
    reason: string;
    from: string;
    to: string;
    employeeId: string;
    swapEmployeeId: string;
}, {
    kind: "change";
    reason: string;
    from: string;
    to: string;
    employeeId: string;
    shiftTemplateId: string;
} | {
    kind: "swap";
    reason: string;
    from: string;
    to: string;
    employeeId: string;
    swapEmployeeId: string;
}>;
export type CreateShiftRequestRequest = z.infer<typeof CreateShiftRequestRequest>;
/** The same, raised by the person through self service: their own file is the path. */
export declare const CreateMyShiftRequestRequest: z.ZodEffects<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    reason: z.ZodString;
} & {
    kind: z.ZodLiteral<"change">;
    shiftTemplateId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "change";
    reason: string;
    from: string;
    to: string;
    shiftTemplateId: string;
}, {
    kind: "change";
    reason: string;
    from: string;
    to: string;
    shiftTemplateId: string;
}>, z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    reason: z.ZodString;
} & {
    kind: z.ZodLiteral<"swap">;
    swapEmployeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "swap";
    reason: string;
    from: string;
    to: string;
    swapEmployeeId: string;
}, {
    kind: "swap";
    reason: string;
    from: string;
    to: string;
    swapEmployeeId: string;
}>]>, {
    kind: "change";
    reason: string;
    from: string;
    to: string;
    shiftTemplateId: string;
} | {
    kind: "swap";
    reason: string;
    from: string;
    to: string;
    swapEmployeeId: string;
}, {
    kind: "change";
    reason: string;
    from: string;
    to: string;
    shiftTemplateId: string;
} | {
    kind: "swap";
    reason: string;
    from: string;
    to: string;
    swapEmployeeId: string;
}>;
export type CreateMyShiftRequestRequest = z.infer<typeof CreateMyShiftRequestRequest>;
export declare const DecideRequestBody: z.ZodObject<{
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    note?: string | null | undefined;
}, {
    note?: string | null | undefined;
}>;
export type DecideRequestBody = z.infer<typeof DecideRequestBody>;
export declare const AttendanceRequestStatus: z.ZodEnum<["requested", "approved", "rejected", "cancelled"]>;
export type AttendanceRequestStatus = z.infer<typeof AttendanceRequestStatus>;
export declare const AttendanceRequest: z.ZodObject<{
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
    /** The record it would put right; null asks for a missing one. */
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
}, "strip", z.ZodTypeAny, {
    status: "approved" | "rejected" | "cancelled" | "requested";
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
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    routedToMe: boolean;
    decidedByName: string | null;
    routedTo: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    } | null;
    recordId: string | null;
    resultRecordId: string | null;
}, {
    status: "approved" | "rejected" | "cancelled" | "requested";
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
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    routedToMe: boolean;
    decidedByName: string | null;
    routedTo: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    } | null;
    recordId: string | null;
    resultRecordId: string | null;
}>;
export type AttendanceRequest = z.infer<typeof AttendanceRequest>;
/** `POST /ops/attendance-requests`: on someone's behalf (`attendance.record`). */
export declare const CreateAttendanceRequestRequest: z.ZodIntersection<z.ZodEffects<z.ZodObject<{
    workDate: z.ZodString;
    clockInAt: z.ZodString;
    clockOutAt: z.ZodString;
    recordId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    recordId?: string | null | undefined;
}, {
    reason: string;
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    recordId?: string | null | undefined;
}>, {
    reason: string;
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    recordId?: string | null | undefined;
}, {
    reason: string;
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    recordId?: string | null | undefined;
}>, z.ZodObject<{
    employeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
}, {
    employeeId: string;
}>>;
export type CreateAttendanceRequestRequest = z.infer<typeof CreateAttendanceRequestRequest>;
/** The same through self service. */
export declare const CreateMyAttendanceRequestRequest: z.ZodEffects<z.ZodObject<{
    workDate: z.ZodString;
    clockInAt: z.ZodString;
    clockOutAt: z.ZodString;
    recordId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    recordId?: string | null | undefined;
}, {
    reason: string;
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    recordId?: string | null | undefined;
}>, {
    reason: string;
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    recordId?: string | null | undefined;
}, {
    reason: string;
    workDate: string;
    clockInAt: string;
    clockOutAt: string;
    recordId?: string | null | undefined;
}>;
export type CreateMyAttendanceRequestRequest = z.infer<typeof CreateMyAttendanceRequestRequest>;
/** `POST /ops/attendance/:id/overtime`: approve all of it, or less (AC-TM8). */
export declare const DecideOvertimeRequest: z.ZodObject<{
    approvedMinutes: z.ZodNumber;
    note: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    approvedMinutes: number;
    note?: string | null | undefined;
}, {
    approvedMinutes: number;
    note?: string | null | undefined;
}>;
export type DecideOvertimeRequest = z.infer<typeof DecideOvertimeRequest>;
export declare const AttendancePolicy: z.ZodObject<{
    graceInMinutes: z.ZodNumber;
    graceOutMinutes: z.ZodNumber;
    overtimeCutoffMinutes: z.ZodNullable<z.ZodNumber>;
    overtimeAutoApprove: z.ZodBoolean;
    overtimeMinMinutes: z.ZodNumber;
    linkWindowMinutes: z.ZodNumber;
    staleOpenHours: z.ZodNumber;
    defaultShiftMinutes: z.ZodNumber;
    /** 058-leave AC-LV8: minutes on a worked holiday or day off that earn a whole compensatory day; half of it earns half. */
    compensationThresholdMinutes: z.ZodNumber;
} & {
    /** Null: the business default every branch without its own row follows. */
    propertyId: z.ZodNullable<z.ZodString>;
    /** False when nothing is saved and these are the built in defaults. */
    saved: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    propertyId: string | null;
    graceInMinutes: number;
    graceOutMinutes: number;
    overtimeCutoffMinutes: number | null;
    overtimeAutoApprove: boolean;
    overtimeMinMinutes: number;
    linkWindowMinutes: number;
    staleOpenHours: number;
    defaultShiftMinutes: number;
    compensationThresholdMinutes: number;
    saved: boolean;
}, {
    propertyId: string | null;
    graceInMinutes: number;
    graceOutMinutes: number;
    overtimeCutoffMinutes: number | null;
    overtimeAutoApprove: boolean;
    overtimeMinMinutes: number;
    linkWindowMinutes: number;
    staleOpenHours: number;
    defaultShiftMinutes: number;
    compensationThresholdMinutes: number;
    saved: boolean;
}>;
export type AttendancePolicy = z.infer<typeof AttendancePolicy>;
export declare const BranchClockSettings: z.ZodObject<{
    propertyId: z.ZodString;
    branchName: z.ZodString;
    geofenceRadiusM: z.ZodNumber;
    /** The geofence's own centre, set here: where staff clock in, when that is not the map pin. */
    centre: z.ZodNullable<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
    }, {
        lat: number;
        lng: number;
    }>>;
    /** The property's own map pin is known, and is the centre when none is set here. */
    propertyHasCoordinates: z.ZodBoolean;
    /** Some centre is known. Without one, every phone punch waits for validation. */
    hasCoordinates: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    propertyId: string;
    branchName: string;
    geofenceRadiusM: number;
    centre: {
        lat: number;
        lng: number;
    } | null;
    propertyHasCoordinates: boolean;
    hasCoordinates: boolean;
}, {
    propertyId: string;
    branchName: string;
    geofenceRadiusM: number;
    centre: {
        lat: number;
        lng: number;
    } | null;
    propertyHasCoordinates: boolean;
    hasCoordinates: boolean;
}>;
export type BranchClockSettings = z.infer<typeof BranchClockSettings>;
/** `GET /ops/attendance/policies`: the business default, each branch's own, and each branch's geofence. */
export declare const AttendanceSettings: z.ZodObject<{
    policies: z.ZodArray<z.ZodObject<{
        graceInMinutes: z.ZodNumber;
        graceOutMinutes: z.ZodNumber;
        overtimeCutoffMinutes: z.ZodNullable<z.ZodNumber>;
        overtimeAutoApprove: z.ZodBoolean;
        overtimeMinMinutes: z.ZodNumber;
        linkWindowMinutes: z.ZodNumber;
        staleOpenHours: z.ZodNumber;
        defaultShiftMinutes: z.ZodNumber;
        /** 058-leave AC-LV8: minutes on a worked holiday or day off that earn a whole compensatory day; half of it earns half. */
        compensationThresholdMinutes: z.ZodNumber;
    } & {
        /** Null: the business default every branch without its own row follows. */
        propertyId: z.ZodNullable<z.ZodString>;
        /** False when nothing is saved and these are the built in defaults. */
        saved: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        propertyId: string | null;
        graceInMinutes: number;
        graceOutMinutes: number;
        overtimeCutoffMinutes: number | null;
        overtimeAutoApprove: boolean;
        overtimeMinMinutes: number;
        linkWindowMinutes: number;
        staleOpenHours: number;
        defaultShiftMinutes: number;
        compensationThresholdMinutes: number;
        saved: boolean;
    }, {
        propertyId: string | null;
        graceInMinutes: number;
        graceOutMinutes: number;
        overtimeCutoffMinutes: number | null;
        overtimeAutoApprove: boolean;
        overtimeMinMinutes: number;
        linkWindowMinutes: number;
        staleOpenHours: number;
        defaultShiftMinutes: number;
        compensationThresholdMinutes: number;
        saved: boolean;
    }>, "many">;
    clock: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        branchName: z.ZodString;
        geofenceRadiusM: z.ZodNumber;
        /** The geofence's own centre, set here: where staff clock in, when that is not the map pin. */
        centre: z.ZodNullable<z.ZodObject<{
            lat: z.ZodNumber;
            lng: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            lat: number;
            lng: number;
        }, {
            lat: number;
            lng: number;
        }>>;
        /** The property's own map pin is known, and is the centre when none is set here. */
        propertyHasCoordinates: z.ZodBoolean;
        /** Some centre is known. Without one, every phone punch waits for validation. */
        hasCoordinates: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        propertyId: string;
        branchName: string;
        geofenceRadiusM: number;
        centre: {
            lat: number;
            lng: number;
        } | null;
        propertyHasCoordinates: boolean;
        hasCoordinates: boolean;
    }, {
        propertyId: string;
        branchName: string;
        geofenceRadiusM: number;
        centre: {
            lat: number;
            lng: number;
        } | null;
        propertyHasCoordinates: boolean;
        hasCoordinates: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    policies: {
        propertyId: string | null;
        graceInMinutes: number;
        graceOutMinutes: number;
        overtimeCutoffMinutes: number | null;
        overtimeAutoApprove: boolean;
        overtimeMinMinutes: number;
        linkWindowMinutes: number;
        staleOpenHours: number;
        defaultShiftMinutes: number;
        compensationThresholdMinutes: number;
        saved: boolean;
    }[];
    clock: {
        propertyId: string;
        branchName: string;
        geofenceRadiusM: number;
        centre: {
            lat: number;
            lng: number;
        } | null;
        propertyHasCoordinates: boolean;
        hasCoordinates: boolean;
    }[];
}, {
    policies: {
        propertyId: string | null;
        graceInMinutes: number;
        graceOutMinutes: number;
        overtimeCutoffMinutes: number | null;
        overtimeAutoApprove: boolean;
        overtimeMinMinutes: number;
        linkWindowMinutes: number;
        staleOpenHours: number;
        defaultShiftMinutes: number;
        compensationThresholdMinutes: number;
        saved: boolean;
    }[];
    clock: {
        propertyId: string;
        branchName: string;
        geofenceRadiusM: number;
        centre: {
            lat: number;
            lng: number;
        } | null;
        propertyHasCoordinates: boolean;
        hasCoordinates: boolean;
    }[];
}>;
export type AttendanceSettings = z.infer<typeof AttendanceSettings>;
export declare const PutAttendancePolicyRequest: z.ZodObject<{
    graceInMinutes: z.ZodNumber;
    graceOutMinutes: z.ZodNumber;
    overtimeCutoffMinutes: z.ZodNullable<z.ZodNumber>;
    overtimeAutoApprove: z.ZodBoolean;
    overtimeMinMinutes: z.ZodNumber;
    linkWindowMinutes: z.ZodNumber;
    staleOpenHours: z.ZodNumber;
    defaultShiftMinutes: z.ZodNumber;
} & {
    propertyId: z.ZodNullable<z.ZodString>;
    compensationThresholdMinutes: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    propertyId: string | null;
    graceInMinutes: number;
    graceOutMinutes: number;
    overtimeCutoffMinutes: number | null;
    overtimeAutoApprove: boolean;
    overtimeMinMinutes: number;
    linkWindowMinutes: number;
    staleOpenHours: number;
    defaultShiftMinutes: number;
    compensationThresholdMinutes?: number | undefined;
}, {
    propertyId: string | null;
    graceInMinutes: number;
    graceOutMinutes: number;
    overtimeCutoffMinutes: number | null;
    overtimeAutoApprove: boolean;
    overtimeMinMinutes: number;
    linkWindowMinutes: number;
    staleOpenHours: number;
    defaultShiftMinutes: number;
    compensationThresholdMinutes?: number | undefined;
}>;
export type PutAttendancePolicyRequest = z.infer<typeof PutAttendancePolicyRequest>;
/** The radius, and the centre: null clears it back to the property's pin, absent leaves it. */
export declare const PutBranchClockSettingsRequest: z.ZodObject<{
    geofenceRadiusM: z.ZodNumber;
    centre: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        lat: z.ZodNumber;
        lng: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lng: number;
    }, {
        lat: number;
        lng: number;
    }>>>;
}, "strip", z.ZodTypeAny, {
    geofenceRadiusM: number;
    centre?: {
        lat: number;
        lng: number;
    } | null | undefined;
}, {
    geofenceRadiusM: number;
    centre?: {
        lat: number;
        lng: number;
    } | null | undefined;
}>;
export type PutBranchClockSettingsRequest = z.infer<typeof PutBranchClockSettingsRequest>;
export declare const KioskStatus: z.ZodEnum<["pairing", "active", "revoked"]>;
export type KioskStatus = z.infer<typeof KioskStatus>;
export declare const Kiosk: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodString;
    branchName: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["pairing", "active", "revoked"]>;
    allowedIps: z.ZodArray<z.ZodString, "many">;
    lastSeenAt: z.ZodNullable<z.ZodString>;
    pairingExpiresAt: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "revoked" | "pairing";
    name: string;
    id: string;
    createdAt: string;
    propertyId: string;
    branchName: string;
    allowedIps: string[];
    lastSeenAt: string | null;
    pairingExpiresAt: string | null;
}, {
    status: "active" | "revoked" | "pairing";
    name: string;
    id: string;
    createdAt: string;
    propertyId: string;
    branchName: string;
    allowedIps: string[];
    lastSeenAt: string | null;
    pairingExpiresAt: string | null;
}>;
export type Kiosk = z.infer<typeof Kiosk>;
export declare const KioskList: z.ZodObject<{
    kiosks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        branchName: z.ZodString;
        name: z.ZodString;
        status: z.ZodEnum<["pairing", "active", "revoked"]>;
        allowedIps: z.ZodArray<z.ZodString, "many">;
        lastSeenAt: z.ZodNullable<z.ZodString>;
        pairingExpiresAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "revoked" | "pairing";
        name: string;
        id: string;
        createdAt: string;
        propertyId: string;
        branchName: string;
        allowedIps: string[];
        lastSeenAt: string | null;
        pairingExpiresAt: string | null;
    }, {
        status: "active" | "revoked" | "pairing";
        name: string;
        id: string;
        createdAt: string;
        propertyId: string;
        branchName: string;
        allowedIps: string[];
        lastSeenAt: string | null;
        pairingExpiresAt: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    kiosks: {
        status: "active" | "revoked" | "pairing";
        name: string;
        id: string;
        createdAt: string;
        propertyId: string;
        branchName: string;
        allowedIps: string[];
        lastSeenAt: string | null;
        pairingExpiresAt: string | null;
    }[];
}, {
    kiosks: {
        status: "active" | "revoked" | "pairing";
        name: string;
        id: string;
        createdAt: string;
        propertyId: string;
        branchName: string;
        allowedIps: string[];
        lastSeenAt: string | null;
        pairingExpiresAt: string | null;
    }[];
}>;
export type KioskList = z.infer<typeof KioskList>;
export declare const CreateKioskRequest: z.ZodObject<{
    propertyId: z.ZodString;
    name: z.ZodString;
    allowedIps: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    propertyId: string;
    allowedIps?: string[] | undefined;
}, {
    name: string;
    propertyId: string;
    allowedIps?: string[] | undefined;
}>;
export type CreateKioskRequest = z.infer<typeof CreateKioskRequest>;
/** The pairing code is shown once, here, and lives ten minutes. */
export declare const KioskPairingCode: z.ZodObject<{
    kiosk: z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        branchName: z.ZodString;
        name: z.ZodString;
        status: z.ZodEnum<["pairing", "active", "revoked"]>;
        allowedIps: z.ZodArray<z.ZodString, "many">;
        lastSeenAt: z.ZodNullable<z.ZodString>;
        pairingExpiresAt: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "revoked" | "pairing";
        name: string;
        id: string;
        createdAt: string;
        propertyId: string;
        branchName: string;
        allowedIps: string[];
        lastSeenAt: string | null;
        pairingExpiresAt: string | null;
    }, {
        status: "active" | "revoked" | "pairing";
        name: string;
        id: string;
        createdAt: string;
        propertyId: string;
        branchName: string;
        allowedIps: string[];
        lastSeenAt: string | null;
        pairingExpiresAt: string | null;
    }>;
    pairingCode: z.ZodString;
    expiresAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresAt: string;
    kiosk: {
        status: "active" | "revoked" | "pairing";
        name: string;
        id: string;
        createdAt: string;
        propertyId: string;
        branchName: string;
        allowedIps: string[];
        lastSeenAt: string | null;
        pairingExpiresAt: string | null;
    };
    pairingCode: string;
}, {
    expiresAt: string;
    kiosk: {
        status: "active" | "revoked" | "pairing";
        name: string;
        id: string;
        createdAt: string;
        propertyId: string;
        branchName: string;
        allowedIps: string[];
        lastSeenAt: string | null;
        pairingExpiresAt: string | null;
    };
    pairingCode: string;
}>;
export type KioskPairingCode = z.infer<typeof KioskPairingCode>;
export declare const UnlockKioskPinRequest: z.ZodObject<{
    employeeId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
}, {
    employeeId: string;
}>;
export type UnlockKioskPinRequest = z.infer<typeof UnlockKioskPinRequest>;
/** `PUT /ops/employees/:id/kiosk-pin`: set or reset. Never shown again. */
export declare const SetKioskPinRequest: z.ZodObject<{
    pin: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pin: string;
}, {
    pin: string;
}>;
export type SetKioskPinRequest = z.infer<typeof SetKioskPinRequest>;
/** `PUT /me/work/:employeeId/kiosk-pin`: the current PIN proves it is them. */
export declare const ChangeMyKioskPinRequest: z.ZodObject<{
    currentPin: z.ZodString;
    pin: z.ZodString;
}, "strip", z.ZodTypeAny, {
    pin: string;
    currentPin: string;
}, {
    pin: string;
    currentPin: string;
}>;
export type ChangeMyKioskPinRequest = z.infer<typeof ChangeMyKioskPinRequest>;
export declare const KioskPinState: z.ZodObject<{
    hasPin: z.ZodBoolean;
    setAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    hasPin: boolean;
    setAt: string | null;
}, {
    hasPin: boolean;
    setAt: string | null;
}>;
export type KioskPinState = z.infer<typeof KioskPinState>;
/** `POST /kiosk/pair`: the tablet trades the code for its device cookie. */
export declare const KioskPairRequest: z.ZodObject<{
    code: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: string;
}, {
    code: string;
}>;
export type KioskPairRequest = z.infer<typeof KioskPairRequest>;
/** `GET /kiosk/session`: the branch, and never a list of people. */
export declare const KioskSession: z.ZodObject<{
    kioskName: z.ZodString;
    branchName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    branchName: string;
    kioskName: string;
}, {
    branchName: string;
    kioskName: string;
}>;
export type KioskSession = z.infer<typeof KioskSession>;
export declare const KioskPunchRequest: z.ZodObject<{
    employeeNumber: z.ZodString;
    pin: z.ZodString;
}, "strip", z.ZodTypeAny, {
    employeeNumber: string;
    pin: string;
}, {
    employeeNumber: string;
    pin: string;
}>;
export type KioskPunchRequest = z.infer<typeof KioskPunchRequest>;
/** Only after a correct PIN does the kiosk learn a name, to confirm the punch with. */
export declare const KioskPunchResult: z.ZodObject<{
    displayName: z.ZodString;
    direction: z.ZodEnum<["in", "out"]>;
    at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    direction: "in" | "out";
    at: string;
    displayName: string;
}, {
    direction: "in" | "out";
    at: string;
    displayName: string;
}>;
export type KioskPunchResult = z.infer<typeof KioskPunchResult>;
export declare const OrgHoliday: z.ZodObject<{
    id: z.ZodString;
    /** Null: every branch. */
    propertyId: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    fromDate: z.ZodString;
    toDate: z.ZodString;
    recurringYearly: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    propertyId: string | null;
    fromDate: string;
    toDate: string;
    recurringYearly: boolean;
}, {
    name: string;
    id: string;
    propertyId: string | null;
    fromDate: string;
    toDate: string;
    recurringYearly: boolean;
}>;
export type OrgHoliday = z.infer<typeof OrgHoliday>;
export declare const OrgHolidayList: z.ZodObject<{
    holidays: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** Null: every branch. */
        propertyId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        fromDate: z.ZodString;
        toDate: z.ZodString;
        recurringYearly: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        propertyId: string | null;
        fromDate: string;
        toDate: string;
        recurringYearly: boolean;
    }, {
        name: string;
        id: string;
        propertyId: string | null;
        fromDate: string;
        toDate: string;
        recurringYearly: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    holidays: {
        name: string;
        id: string;
        propertyId: string | null;
        fromDate: string;
        toDate: string;
        recurringYearly: boolean;
    }[];
}, {
    holidays: {
        name: string;
        id: string;
        propertyId: string | null;
        fromDate: string;
        toDate: string;
        recurringYearly: boolean;
    }[];
}>;
export type OrgHolidayList = z.infer<typeof OrgHolidayList>;
export declare const CreateOrgHolidayRequest: z.ZodEffects<z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodString;
    fromDate: z.ZodString;
    toDate: z.ZodString;
    recurringYearly: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    fromDate: string;
    toDate: string;
    propertyId?: string | null | undefined;
    recurringYearly?: boolean | undefined;
}, {
    name: string;
    fromDate: string;
    toDate: string;
    propertyId?: string | null | undefined;
    recurringYearly?: boolean | undefined;
}>, {
    name: string;
    fromDate: string;
    toDate: string;
    propertyId?: string | null | undefined;
    recurringYearly?: boolean | undefined;
}, {
    name: string;
    fromDate: string;
    toDate: string;
    propertyId?: string | null | undefined;
    recurringYearly?: boolean | undefined;
}>;
export type CreateOrgHolidayRequest = z.infer<typeof CreateOrgHolidayRequest>;
export declare const UpdateOrgHolidayRequest: z.ZodEffects<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    fromDate: z.ZodOptional<z.ZodString>;
    toDate: z.ZodOptional<z.ZodString>;
    recurringYearly: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    recurringYearly?: boolean | undefined;
}, {
    name?: string | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    recurringYearly?: boolean | undefined;
}>, {
    name?: string | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    recurringYearly?: boolean | undefined;
}, {
    name?: string | undefined;
    fromDate?: string | undefined;
    toDate?: string | undefined;
    recurringYearly?: boolean | undefined;
}>;
export type UpdateOrgHolidayRequest = z.infer<typeof UpdateOrgHolidayRequest>;
export declare const WeeklyOff: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodNullable<z.ZodString>;
    /** 0 Sunday to 6 Saturday. */
    weekday: z.ZodNumber;
    /** Empty: every week; else which weeks of the month. */
    weeks: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    propertyId: string | null;
    weekday: number;
    weeks: number[];
}, {
    id: string;
    propertyId: string | null;
    weekday: number;
    weeks: number[];
}>;
export type WeeklyOff = z.infer<typeof WeeklyOff>;
export declare const WeeklyOffList: z.ZodObject<{
    weeklyOffs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodNullable<z.ZodString>;
        /** 0 Sunday to 6 Saturday. */
        weekday: z.ZodNumber;
        /** Empty: every week; else which weeks of the month. */
        weeks: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        propertyId: string | null;
        weekday: number;
        weeks: number[];
    }, {
        id: string;
        propertyId: string | null;
        weekday: number;
        weeks: number[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    weeklyOffs: {
        id: string;
        propertyId: string | null;
        weekday: number;
        weeks: number[];
    }[];
}, {
    weeklyOffs: {
        id: string;
        propertyId: string | null;
        weekday: number;
        weeks: number[];
    }[];
}>;
export type WeeklyOffList = z.infer<typeof WeeklyOffList>;
export declare const CreateWeeklyOffRequest: z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    weekday: z.ZodNumber;
    weeks: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
}, "strip", z.ZodTypeAny, {
    weekday: number;
    propertyId?: string | null | undefined;
    weeks?: number[] | undefined;
}, {
    weekday: number;
    propertyId?: string | null | undefined;
    weeks?: number[] | undefined;
}>;
export type CreateWeeklyOffRequest = z.infer<typeof CreateWeeklyOffRequest>;
export declare const UpdateWeeklyOffRequest: z.ZodObject<{
    weeks: z.ZodArray<z.ZodNumber, "many">;
}, "strip", z.ZodTypeAny, {
    weeks: number[];
}, {
    weeks: number[];
}>;
export type UpdateWeeklyOffRequest = z.infer<typeof UpdateWeeklyOffRequest>;
export declare const LateEarlyRow: z.ZodObject<{
    recordId: z.ZodString;
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
    workDate: z.ZodString;
    shiftName: z.ZodNullable<z.ZodString>;
    lateMinutes: z.ZodNumber;
    earlyMinutes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    shiftName: string | null;
    workDate: string;
    lateMinutes: number;
    earlyMinutes: number;
    recordId: string;
}, {
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    shiftName: string | null;
    workDate: string;
    lateMinutes: number;
    earlyMinutes: number;
    recordId: string;
}>;
export type LateEarlyRow = z.infer<typeof LateEarlyRow>;
/** Rows by name, then date: never by a figure. */
export declare const LateEarlyReport: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    rows: z.ZodArray<z.ZodObject<{
        recordId: z.ZodString;
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
        workDate: z.ZodString;
        shiftName: z.ZodNullable<z.ZodString>;
        lateMinutes: z.ZodNumber;
        earlyMinutes: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        shiftName: string | null;
        workDate: string;
        lateMinutes: number;
        earlyMinutes: number;
        recordId: string;
    }, {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        shiftName: string | null;
        workDate: string;
        lateMinutes: number;
        earlyMinutes: number;
        recordId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    rows: {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        shiftName: string | null;
        workDate: string;
        lateMinutes: number;
        earlyMinutes: number;
        recordId: string;
    }[];
}, {
    from: string;
    to: string;
    rows: {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        shiftName: string | null;
        workDate: string;
        lateMinutes: number;
        earlyMinutes: number;
        recordId: string;
    }[];
}>;
export type LateEarlyReport = z.infer<typeof LateEarlyReport>;
export declare const MonthlySummaryRow: z.ZodObject<{
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
    daysWorked: z.ZodNumber;
    workedMinutes: z.ZodNumber;
    /** The rostered minutes of the month, breaks taken off. */
    expectedMinutes: z.ZodNumber;
    overtimeMinutes: z.ZodNumber;
    approvedOvertimeMinutes: z.ZodNumber;
    lateCount: z.ZodNumber;
    earlyCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    workedMinutes: number;
    overtimeMinutes: number;
    approvedOvertimeMinutes: number;
    daysWorked: number;
    expectedMinutes: number;
    lateCount: number;
    earlyCount: number;
}, {
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    workedMinutes: number;
    overtimeMinutes: number;
    approvedOvertimeMinutes: number;
    daysWorked: number;
    expectedMinutes: number;
    lateCount: number;
    earlyCount: number;
}>;
export type MonthlySummaryRow = z.infer<typeof MonthlySummaryRow>;
export declare const MonthlySummary: z.ZodObject<{
    month: z.ZodString;
    rows: z.ZodArray<z.ZodObject<{
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
        daysWorked: z.ZodNumber;
        workedMinutes: z.ZodNumber;
        /** The rostered minutes of the month, breaks taken off. */
        expectedMinutes: z.ZodNumber;
        overtimeMinutes: z.ZodNumber;
        approvedOvertimeMinutes: z.ZodNumber;
        lateCount: z.ZodNumber;
        earlyCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }, {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    month: string;
    rows: {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }[];
}, {
    month: string;
    rows: {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }[];
}>;
export type MonthlySummary = z.infer<typeof MonthlySummary>;
export declare const InsightsQuery: z.ZodEffects<z.ZodObject<{
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
}>, {
    from: string;
    to: string;
    propertyId?: string | undefined;
}, {
    from: string;
    to: string;
    propertyId?: string | undefined;
}>;
export type InsightsQuery = z.infer<typeof InsightsQuery>;
export declare const MonthlyQuery: z.ZodObject<{
    month: z.ZodString;
    propertyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    month: string;
    propertyId?: string | undefined;
}, {
    month: string;
    propertyId?: string | undefined;
}>;
export type MonthlyQuery = z.infer<typeof MonthlyQuery>;
/**
 * One file the caller holds at a business (AC-SS1). A file the person has left
 * stays listed and readable, and refuses every write (409).
 */
export declare const MyWorkFile: z.ZodObject<{
    employeeId: z.ZodString;
    orgId: z.ZodString;
    businessName: z.ZodString;
    displayName: z.ZodString;
    employeeNumber: z.ZodString;
    branchName: z.ZodNullable<z.ZodString>;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["active", "offboarded"]>;
    /** Somebody's reporting manager: the team routes answer for them. */
    hasReports: z.ZodBoolean;
    /** An open clock in, when there is one. */
    openRecord: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        clockInAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        clockInAt: string;
    }, {
        id: string;
        clockInAt: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "offboarded";
    orgId: string;
    businessName: string;
    employeeId: string;
    employeeNumber: string;
    displayName: string;
    jobPositionTitle: string | null;
    branchName: string | null;
    hasReports: boolean;
    openRecord: {
        id: string;
        clockInAt: string;
    } | null;
}, {
    status: "active" | "offboarded";
    orgId: string;
    businessName: string;
    employeeId: string;
    employeeNumber: string;
    displayName: string;
    jobPositionTitle: string | null;
    branchName: string | null;
    hasReports: boolean;
    openRecord: {
        id: string;
        clockInAt: string;
    } | null;
}>;
export type MyWorkFile = z.infer<typeof MyWorkFile>;
export declare const MyWorkFileList: z.ZodObject<{
    files: z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        orgId: z.ZodString;
        businessName: z.ZodString;
        displayName: z.ZodString;
        employeeNumber: z.ZodString;
        branchName: z.ZodNullable<z.ZodString>;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["active", "offboarded"]>;
        /** Somebody's reporting manager: the team routes answer for them. */
        hasReports: z.ZodBoolean;
        /** An open clock in, when there is one. */
        openRecord: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            clockInAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            id: string;
            clockInAt: string;
        }, {
            id: string;
            clockInAt: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "offboarded";
        orgId: string;
        businessName: string;
        employeeId: string;
        employeeNumber: string;
        displayName: string;
        jobPositionTitle: string | null;
        branchName: string | null;
        hasReports: boolean;
        openRecord: {
            id: string;
            clockInAt: string;
        } | null;
    }, {
        status: "active" | "offboarded";
        orgId: string;
        businessName: string;
        employeeId: string;
        employeeNumber: string;
        displayName: string;
        jobPositionTitle: string | null;
        branchName: string | null;
        hasReports: boolean;
        openRecord: {
            id: string;
            clockInAt: string;
        } | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    files: {
        status: "active" | "offboarded";
        orgId: string;
        businessName: string;
        employeeId: string;
        employeeNumber: string;
        displayName: string;
        jobPositionTitle: string | null;
        branchName: string | null;
        hasReports: boolean;
        openRecord: {
            id: string;
            clockInAt: string;
        } | null;
    }[];
}, {
    files: {
        status: "active" | "offboarded";
        orgId: string;
        businessName: string;
        employeeId: string;
        employeeNumber: string;
        displayName: string;
        jobPositionTitle: string | null;
        branchName: string | null;
        hasReports: boolean;
        openRecord: {
            id: string;
            clockInAt: string;
        } | null;
    }[];
}>;
export type MyWorkFileList = z.infer<typeof MyWorkFileList>;
/** `POST /me/work/:employeeId/clock-in` and `/clock-out`: where the phone says it is, when it says. */
export declare const PhoneClockRequest: z.ZodObject<{
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
    accuracyM: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    lat?: number | undefined;
    lng?: number | undefined;
    accuracyM?: number | undefined;
}, {
    lat?: number | undefined;
    lng?: number | undefined;
    accuracyM?: number | undefined;
}>;
export type PhoneClockRequest = z.infer<typeof PhoneClockRequest>;
/** What a phone punch came to: the record, and whether it waits for validation and why. */
export declare const PhoneClockResult: z.ZodObject<{
    record: z.ZodObject<{
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
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
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
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    }>;
    validated: z.ZodBoolean;
    /** Why it waits, in words; null when validated. */
    pendingReason: z.ZodNullable<z.ZodString>;
    distanceM: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    record: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "phone" | "supervisor" | "self" | "kiosk";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    };
    validated: boolean;
    pendingReason: string | null;
    distanceM: number | null;
}, {
    record: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "phone" | "supervisor" | "self" | "kiosk";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    };
    validated: boolean;
    pendingReason: string | null;
    distanceM: number | null;
}>;
export type PhoneClockResult = z.infer<typeof PhoneClockResult>;
export declare const RangeQuery: z.ZodEffects<z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>, {
    from: string;
    to: string;
}, {
    from: string;
    to: string;
}>;
export type RangeQuery = z.infer<typeof RangeQuery>;
/** `GET /me/work/:employeeId/roster`: published entries only (AC-TM2). */
export declare const MyRoster: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    entries: z.ZodArray<z.ZodObject<{
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
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
}, "strip", z.ZodTypeAny, {
    entries: {
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
    from: string;
    to: string;
}, {
    entries: {
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
    from: string;
    to: string;
}>;
export type MyRoster = z.infer<typeof MyRoster>;
export declare const MyShiftRequestList: z.ZodObject<{
    /** What the person asked. */
    mine: z.ZodArray<z.ZodObject<{
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
        /** Routed to the caller's own file. */
        routedToMe: z.ZodBoolean;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
    /** Swaps colleagues asked of them, waiting for an answer. */
    askedOfMe: z.ZodArray<z.ZodObject<{
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
        /** Routed to the caller's own file. */
        routedToMe: z.ZodBoolean;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
}, "strip", z.ZodTypeAny, {
    mine: {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
    askedOfMe: {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
}, {
    mine: {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
    askedOfMe: {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
}>;
export type MyShiftRequestList = z.infer<typeof MyShiftRequestList>;
export declare const MyAttendance: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    records: z.ZodArray<z.ZodObject<{
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
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
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
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    }>, "many">;
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
        workDate: z.ZodString;
        clockInAt: z.ZodString;
        clockOutAt: z.ZodString;
        /** The record it would put right; null asks for a missing one. */
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
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }[];
    from: string;
    to: string;
    records: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "phone" | "supervisor" | "self" | "kiosk";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    }[];
}, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }[];
    from: string;
    to: string;
    records: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "phone" | "supervisor" | "self" | "kiosk";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    }[];
}>;
export type MyAttendance = z.infer<typeof MyAttendance>;
export declare const MyAttendanceRequestList: z.ZodObject<{
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
        workDate: z.ZodString;
        clockInAt: z.ZodString;
        clockOutAt: z.ZodString;
        /** The record it would put right; null asks for a missing one. */
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
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }[];
}, {
    requests: {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }[];
}>;
export type MyAttendanceRequestList = z.infer<typeof MyAttendanceRequestList>;
export declare const MonthQuery: z.ZodObject<{
    month: z.ZodString;
}, "strip", z.ZodTypeAny, {
    month: string;
}, {
    month: string;
}>;
export type MonthQuery = z.infer<typeof MonthQuery>;
/** One person's month: their own figures, never a colleague's. */
export declare const MyMonthlySummary: z.ZodObject<{
    month: z.ZodString;
    summary: z.ZodObject<Omit<{
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
        daysWorked: z.ZodNumber;
        workedMinutes: z.ZodNumber;
        /** The rostered minutes of the month, breaks taken off. */
        expectedMinutes: z.ZodNumber;
        overtimeMinutes: z.ZodNumber;
        approvedOvertimeMinutes: z.ZodNumber;
        lateCount: z.ZodNumber;
        earlyCount: z.ZodNumber;
    }, "employee">, "strip", z.ZodTypeAny, {
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }, {
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }>;
}, "strip", z.ZodTypeAny, {
    month: string;
    summary: {
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    };
}, {
    month: string;
    summary: {
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    };
}>;
export type MyMonthlySummary = z.infer<typeof MyMonthlySummary>;
/** `GET /me/work/:employeeId/team`: direct reports, roster cards only (AC-SS15). */
export declare const MyTeam: z.ZodObject<{
    reports: z.ZodArray<z.ZodObject<{
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
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    reports: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }[];
}, {
    reports: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    }[];
}>;
export type MyTeam = z.infer<typeof MyTeam>;
export declare const MyTeamRoster: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    entries: z.ZodArray<z.ZodObject<{
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
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
}, "strip", z.ZodTypeAny, {
    entries: {
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
    from: string;
    to: string;
}, {
    entries: {
        status: "scheduled" | "cancelled";
        generated: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        publishedAt: string | null;
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
    from: string;
    to: string;
}>;
export type MyTeamRoster = z.infer<typeof MyTeamRoster>;
export declare const MyTeamAttendance: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    records: z.ZodArray<z.ZodObject<{
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
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
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
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    }>, "many">;
    /** Each report's month when the range is one month; else empty. */
    summaries: z.ZodArray<z.ZodObject<{
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
        daysWorked: z.ZodNumber;
        workedMinutes: z.ZodNumber;
        /** The rostered minutes of the month, breaks taken off. */
        expectedMinutes: z.ZodNumber;
        overtimeMinutes: z.ZodNumber;
        approvedOvertimeMinutes: z.ZodNumber;
        lateCount: z.ZodNumber;
        earlyCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }, {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    records: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "phone" | "supervisor" | "self" | "kiosk";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    }[];
    summaries: {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }[];
}, {
    from: string;
    to: string;
    records: {
        status: "superseded" | "open" | "closed";
        id: string;
        source: "phone" | "supervisor" | "self" | "kiosk";
        note: string | null;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        branchId: string | null;
        figures: {
            lateMinutes: number | null;
            earlyMinutes: number | null;
            workedMinutes: number;
            overtimeMinutes: number | null;
            approvedOvertimeMinutes: number | null;
            dayKind: "weekday" | "weekly_off" | "public_holiday" | null;
        } | null;
        workDate: string;
        rosterEntryId: string | null;
        clockInAt: string;
        clockOutAt: string | null;
        validated: boolean;
        supersedesId: string | null;
        autoClosed: boolean;
        location: {
            inDistanceM: number | null;
            inAccuracyM: number | null;
            outDistanceM: number | null;
            outAccuracyM: number | null;
        } | null;
    }[];
    summaries: {
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        workedMinutes: number;
        overtimeMinutes: number;
        approvedOvertimeMinutes: number;
        daysWorked: number;
        expectedMinutes: number;
        lateCount: number;
        earlyCount: number;
    }[];
}>;
export type MyTeamAttendance = z.infer<typeof MyTeamAttendance>;
/** Which requests routed to a manager to read: a swap is a shift request that names a colleague. */
export declare const TeamRequestKind: z.ZodEnum<["shift", "swap", "attendance", "leave", "allocation"]>;
export type TeamRequestKind = z.infer<typeof TeamRequestKind>;
export declare const TeamRequestsQuery: z.ZodObject<{
    kind: z.ZodOptional<z.ZodEnum<["shift", "swap", "attendance", "leave", "allocation"]>>;
    status: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    kind?: "shift" | "leave" | "swap" | "attendance" | "allocation" | undefined;
}, {
    status?: string | undefined;
    kind?: "shift" | "leave" | "swap" | "attendance" | "allocation" | undefined;
}>;
export type TeamRequestsQuery = z.infer<typeof TeamRequestsQuery>;
/** Requests routed to the caller, whatever kind, with their state: nothing here decides. */
export declare const MyTeamRequests: z.ZodObject<{
    shift: z.ZodArray<z.ZodObject<{
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
        /** Routed to the caller's own file. */
        routedToMe: z.ZodBoolean;
        decidedAt: z.ZodNullable<z.ZodString>;
        decidedByName: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
    attendance: z.ZodArray<z.ZodObject<{
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
        /** The record it would put right; null asks for a missing one. */
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
    }, "strip", z.ZodTypeAny, {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }, {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }>, "many">;
    /** 058-leave: leave and allocation requests routed to the caller. */
    leave: z.ZodArray<z.ZodObject<{
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
    allocation: z.ZodArray<z.ZodObject<{
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
    shift: {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
    leave: {
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
    attendance: {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }[];
    allocation: {
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
    shift: {
        status: "approved" | "rejected" | "cancelled" | "requested" | "awaiting_colleague";
        kind: "change" | "swap";
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
        routedToMe: boolean;
        decidedByName: string | null;
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
    leave: {
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
    attendance: {
        status: "approved" | "rejected" | "cancelled" | "requested";
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
        workDate: string;
        clockInAt: string;
        clockOutAt: string;
        routedToMe: boolean;
        decidedByName: string | null;
        routedTo: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        } | null;
        recordId: string | null;
        resultRecordId: string | null;
    }[];
    allocation: {
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
export type MyTeamRequests = z.infer<typeof MyTeamRequests>;
//# sourceMappingURL=time.d.ts.map