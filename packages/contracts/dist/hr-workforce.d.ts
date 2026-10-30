import { z } from "zod";
/** A team inside a department at one branch: Housekeeping and Front office under Rooms. */
export declare const HrTeam: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    name: z.ZodString;
    propertyId: z.ZodString;
    departmentId: z.ZodNullable<z.ZodString>;
    departmentName: z.ZodNullable<z.ZodString>;
    leadEmployeeId: z.ZodNullable<z.ZodString>;
    sortOrder: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    id: string;
    sortOrder: number;
    departmentName: string | null;
    propertyId: string;
    departmentId: string | null;
    leadEmployeeId: string | null;
}, {
    code: string;
    name: string;
    id: string;
    sortOrder: number;
    departmentName: string | null;
    propertyId: string;
    departmentId: string | null;
    leadEmployeeId: string | null;
}>;
export type HrTeam = z.infer<typeof HrTeam>;
/** Where one person works, and the work fields the directory shows beside the file. */
export declare const HrPlacement: z.ZodObject<{
    employeeId: z.ZodString;
    /** Null: in no team yet. */
    teamId: z.ZodNullable<z.ZodString>;
    /** From the file: null for a reader who holds no file permission (the desk). */
    grade: z.ZodNullable<z.ZodString>;
    /** A kiosk PIN is set (never the PIN): who clocks in at the desk until one is. */
    hasKioskPin: z.ZodBoolean;
    /** The current contract's last day of probation, when it starts one; null for a reader who holds no file permission. */
    probationEndsOn: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    teamId: string | null;
    grade: string | null;
    hasKioskPin: boolean;
    probationEndsOn: string | null;
}, {
    employeeId: string;
    teamId: string | null;
    grade: string | null;
    hasKioskPin: boolean;
    probationEndsOn: string | null;
}>;
export type HrPlacement = z.infer<typeof HrPlacement>;
export declare const HrTeamList: z.ZodObject<{
    teams: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        name: z.ZodString;
        propertyId: z.ZodString;
        departmentId: z.ZodNullable<z.ZodString>;
        departmentName: z.ZodNullable<z.ZodString>;
        leadEmployeeId: z.ZodNullable<z.ZodString>;
        sortOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        name: string;
        id: string;
        sortOrder: number;
        departmentName: string | null;
        propertyId: string;
        departmentId: string | null;
        leadEmployeeId: string | null;
    }, {
        code: string;
        name: string;
        id: string;
        sortOrder: number;
        departmentName: string | null;
        propertyId: string;
        departmentId: string | null;
        leadEmployeeId: string | null;
    }>, "many">;
    /** Every file of the business in the caller's branches, active or leaving. */
    placements: z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        /** Null: in no team yet. */
        teamId: z.ZodNullable<z.ZodString>;
        /** From the file: null for a reader who holds no file permission (the desk). */
        grade: z.ZodNullable<z.ZodString>;
        /** A kiosk PIN is set (never the PIN): who clocks in at the desk until one is. */
        hasKioskPin: z.ZodBoolean;
        /** The current contract's last day of probation, when it starts one; null for a reader who holds no file permission. */
        probationEndsOn: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        employeeId: string;
        teamId: string | null;
        grade: string | null;
        hasKioskPin: boolean;
        probationEndsOn: string | null;
    }, {
        employeeId: string;
        teamId: string | null;
        grade: string | null;
        hasKioskPin: boolean;
        probationEndsOn: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    placements: {
        employeeId: string;
        teamId: string | null;
        grade: string | null;
        hasKioskPin: boolean;
        probationEndsOn: string | null;
    }[];
    teams: {
        code: string;
        name: string;
        id: string;
        sortOrder: number;
        departmentName: string | null;
        propertyId: string;
        departmentId: string | null;
        leadEmployeeId: string | null;
    }[];
}, {
    placements: {
        employeeId: string;
        teamId: string | null;
        grade: string | null;
        hasKioskPin: boolean;
        probationEndsOn: string | null;
    }[];
    teams: {
        code: string;
        name: string;
        id: string;
        sortOrder: number;
        departmentName: string | null;
        propertyId: string;
        departmentId: string | null;
        leadEmployeeId: string | null;
    }[];
}>;
export type HrTeamList = z.infer<typeof HrTeamList>;
export declare const CoverRequirement: z.ZodObject<{
    id: z.ZodString;
    propertyId: z.ZodString;
    teamId: z.ZodString;
    teamCode: z.ZodString;
    teamName: z.ZodString;
    /** The cover row's name on the roster ("Morning cover"). */
    label: z.ZodString;
    /** Shift templates of the branch that count toward the cover. */
    shiftTemplateIds: z.ZodArray<z.ZodString, "many">;
    /** Seven minimums, Monday to Sunday. */
    minByWeekday: z.ZodArray<z.ZodNumber, "many">;
    note: z.ZodNullable<z.ZodString>;
    setByName: z.ZodNullable<z.ZodString>;
    sortOrder: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    sortOrder: number;
    note: string | null;
    label: string;
    propertyId: string;
    teamId: string;
    teamCode: string;
    teamName: string;
    shiftTemplateIds: string[];
    minByWeekday: number[];
    setByName: string | null;
}, {
    id: string;
    sortOrder: number;
    note: string | null;
    label: string;
    propertyId: string;
    teamId: string;
    teamCode: string;
    teamName: string;
    shiftTemplateIds: string[];
    minByWeekday: number[];
    setByName: string | null;
}>;
export type CoverRequirement = z.infer<typeof CoverRequirement>;
export declare const CoverRequirementList: z.ZodObject<{
    requirements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        propertyId: z.ZodString;
        teamId: z.ZodString;
        teamCode: z.ZodString;
        teamName: z.ZodString;
        /** The cover row's name on the roster ("Morning cover"). */
        label: z.ZodString;
        /** Shift templates of the branch that count toward the cover. */
        shiftTemplateIds: z.ZodArray<z.ZodString, "many">;
        /** Seven minimums, Monday to Sunday. */
        minByWeekday: z.ZodArray<z.ZodNumber, "many">;
        note: z.ZodNullable<z.ZodString>;
        setByName: z.ZodNullable<z.ZodString>;
        sortOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        sortOrder: number;
        note: string | null;
        label: string;
        propertyId: string;
        teamId: string;
        teamCode: string;
        teamName: string;
        shiftTemplateIds: string[];
        minByWeekday: number[];
        setByName: string | null;
    }, {
        id: string;
        sortOrder: number;
        note: string | null;
        label: string;
        propertyId: string;
        teamId: string;
        teamCode: string;
        teamName: string;
        shiftTemplateIds: string[];
        minByWeekday: number[];
        setByName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requirements: {
        id: string;
        sortOrder: number;
        note: string | null;
        label: string;
        propertyId: string;
        teamId: string;
        teamCode: string;
        teamName: string;
        shiftTemplateIds: string[];
        minByWeekday: number[];
        setByName: string | null;
    }[];
}, {
    requirements: {
        id: string;
        sortOrder: number;
        note: string | null;
        label: string;
        propertyId: string;
        teamId: string;
        teamCode: string;
        teamName: string;
        shiftTemplateIds: string[];
        minByWeekday: number[];
        setByName: string | null;
    }[];
}>;
export type CoverRequirementList = z.infer<typeof CoverRequirementList>;
/** Every branch in the caller's scope when no branch is named. */
export declare const CoverQuery: z.ZodObject<{
    propertyId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    propertyId?: string | undefined;
}, {
    propertyId?: string | undefined;
}>;
export type CoverQuery = z.infer<typeof CoverQuery>;
/** The terms a contract was made on: its pay, why, and who made it. */
export declare const ContractTerms: z.ZodObject<{
    contractId: z.ZodString;
    employeeId: z.ZodString;
    contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
    startsOn: z.ZodString;
    endsOn: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["scheduled", "active", "ended"]>;
    wageRwf: z.ZodNumber;
    /** The fixed allowances of the contract's pay structure, a month, in whole francs. */
    allowanceRwf: z.ZodNumber;
    probationEndsOn: z.ZodNullable<z.ZodString>;
    changeReason: z.ZodNullable<z.ZodString>;
    endReason: z.ZodNullable<z.ZodString>;
    /** Who made the contract (a person who holds `people.manage`), and when. */
    decidedByName: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "scheduled" | "ended";
    decidedAt: string;
    startsOn: string;
    decidedByName: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    endsOn: string | null;
    wageRwf: number;
    endReason: string | null;
    contractId: string;
    probationEndsOn: string | null;
    allowanceRwf: number;
    changeReason: string | null;
}, {
    status: "active" | "scheduled" | "ended";
    decidedAt: string;
    startsOn: string;
    decidedByName: string | null;
    employeeId: string;
    contractType: "permanent" | "fixed_term" | "casual";
    endsOn: string | null;
    wageRwf: number;
    endReason: string | null;
    contractId: string;
    probationEndsOn: string | null;
    allowanceRwf: number;
    changeReason: string | null;
}>;
export type ContractTerms = z.infer<typeof ContractTerms>;
/** Where a person's pay goes, as a pay screen names it: the network or bank and the last digits only. */
export declare const PayAccountLabel: z.ZodObject<{
    employeeId: z.ZodString;
    kind: z.ZodEnum<["bank", "momo"]>;
    /** "MTN MoMo", "Airtel Money", or the bank's name. */
    provider: z.ZodString;
    /** The last three or four digits. */
    lastDigits: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "momo" | "bank";
    employeeId: string;
    provider: string;
    lastDigits: string;
}, {
    kind: "momo" | "bank";
    employeeId: string;
    provider: string;
    lastDigits: string;
}>;
export type PayAccountLabel = z.infer<typeof PayAccountLabel>;
export declare const HrCompensation: z.ZodObject<{
    /** Every contract of every file in the caller's branches, newest start first per person. */
    contracts: z.ZodArray<z.ZodObject<{
        contractId: z.ZodString;
        employeeId: z.ZodString;
        contractType: z.ZodEnum<["permanent", "fixed_term", "casual"]>;
        startsOn: z.ZodString;
        endsOn: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["scheduled", "active", "ended"]>;
        wageRwf: z.ZodNumber;
        /** The fixed allowances of the contract's pay structure, a month, in whole francs. */
        allowanceRwf: z.ZodNumber;
        probationEndsOn: z.ZodNullable<z.ZodString>;
        changeReason: z.ZodNullable<z.ZodString>;
        endReason: z.ZodNullable<z.ZodString>;
        /** Who made the contract (a person who holds `people.manage`), and when. */
        decidedByName: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "scheduled" | "ended";
        decidedAt: string;
        startsOn: string;
        decidedByName: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        endsOn: string | null;
        wageRwf: number;
        endReason: string | null;
        contractId: string;
        probationEndsOn: string | null;
        allowanceRwf: number;
        changeReason: string | null;
    }, {
        status: "active" | "scheduled" | "ended";
        decidedAt: string;
        startsOn: string;
        decidedByName: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        endsOn: string | null;
        wageRwf: number;
        endReason: string | null;
        contractId: string;
        probationEndsOn: string | null;
        allowanceRwf: number;
        changeReason: string | null;
    }>, "many">;
    /** Each person's primary active pay account. */
    payAccounts: z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        kind: z.ZodEnum<["bank", "momo"]>;
        /** "MTN MoMo", "Airtel Money", or the bank's name. */
        provider: z.ZodString;
        /** The last three or four digits. */
        lastDigits: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "momo" | "bank";
        employeeId: string;
        provider: string;
        lastDigits: string;
    }, {
        kind: "momo" | "bank";
        employeeId: string;
        provider: string;
        lastDigits: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    contracts: {
        status: "active" | "scheduled" | "ended";
        decidedAt: string;
        startsOn: string;
        decidedByName: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        endsOn: string | null;
        wageRwf: number;
        endReason: string | null;
        contractId: string;
        probationEndsOn: string | null;
        allowanceRwf: number;
        changeReason: string | null;
    }[];
    payAccounts: {
        kind: "momo" | "bank";
        employeeId: string;
        provider: string;
        lastDigits: string;
    }[];
}, {
    contracts: {
        status: "active" | "scheduled" | "ended";
        decidedAt: string;
        startsOn: string;
        decidedByName: string | null;
        employeeId: string;
        contractType: "permanent" | "fixed_term" | "casual";
        endsOn: string | null;
        wageRwf: number;
        endReason: string | null;
        contractId: string;
        probationEndsOn: string | null;
        allowanceRwf: number;
        changeReason: string | null;
    }[];
    payAccounts: {
        kind: "momo" | "bank";
        employeeId: string;
        provider: string;
        lastDigits: string;
    }[];
}>;
export type HrCompensation = z.infer<typeof HrCompensation>;
export declare const ExpiringDocument: z.ZodObject<{
    documentId: z.ZodString;
    employeeId: z.ZodString;
    title: z.ZodString;
    expiresOn: z.ZodString;
}, "strip", z.ZodTypeAny, {
    expiresOn: string;
    title: string;
    employeeId: string;
    documentId: string;
}, {
    expiresOn: string;
    title: string;
    employeeId: string;
    documentId: string;
}>;
export type ExpiringDocument = z.infer<typeof ExpiringDocument>;
export declare const ExpiringDocumentList: z.ZodObject<{
    documents: z.ZodArray<z.ZodObject<{
        documentId: z.ZodString;
        employeeId: z.ZodString;
        title: z.ZodString;
        expiresOn: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        expiresOn: string;
        title: string;
        employeeId: string;
        documentId: string;
    }, {
        expiresOn: string;
        title: string;
        employeeId: string;
        documentId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    documents: {
        expiresOn: string;
        title: string;
        employeeId: string;
        documentId: string;
    }[];
}, {
    documents: {
        expiresOn: string;
        title: string;
        employeeId: string;
        documentId: string;
    }[];
}>;
export type ExpiringDocumentList = z.infer<typeof ExpiringDocumentList>;
/** From today, at most a year ahead. */
export declare const ExpiringDocumentQuery: z.ZodObject<{
    withinDays: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    withinDays?: number | undefined;
}, {
    withinDays?: number | undefined;
}>;
export type ExpiringDocumentQuery = z.infer<typeof ExpiringDocumentQuery>;
export declare const HrChecklistKind: z.ZodEnum<["onboarding", "offboarding"]>;
export type HrChecklistKind = z.infer<typeof HrChecklistKind>;
export declare const HrChecklistItem: z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    checklist: z.ZodEnum<["onboarding", "offboarding"]>;
    code: z.ZodString;
    title: z.ZodString;
    detail: z.ZodNullable<z.ZodString>;
    /** Only someone who may manage the team ticks it. */
    ownerOnly: z.ZodBoolean;
    sortOrder: z.ZodNumber;
    doneAt: z.ZodNullable<z.ZodString>;
    doneByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code: string;
    id: string;
    sortOrder: number;
    title: string;
    detail: string | null;
    employeeId: string;
    doneAt: string | null;
    doneByName: string | null;
    checklist: "onboarding" | "offboarding";
    ownerOnly: boolean;
}, {
    code: string;
    id: string;
    sortOrder: number;
    title: string;
    detail: string | null;
    employeeId: string;
    doneAt: string | null;
    doneByName: string | null;
    checklist: "onboarding" | "offboarding";
    ownerOnly: boolean;
}>;
export type HrChecklistItem = z.infer<typeof HrChecklistItem>;
export declare const HrChecklistItemList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        checklist: z.ZodEnum<["onboarding", "offboarding"]>;
        code: z.ZodString;
        title: z.ZodString;
        detail: z.ZodNullable<z.ZodString>;
        /** Only someone who may manage the team ticks it. */
        ownerOnly: z.ZodBoolean;
        sortOrder: z.ZodNumber;
        doneAt: z.ZodNullable<z.ZodString>;
        doneByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        id: string;
        sortOrder: number;
        title: string;
        detail: string | null;
        employeeId: string;
        doneAt: string | null;
        doneByName: string | null;
        checklist: "onboarding" | "offboarding";
        ownerOnly: boolean;
    }, {
        code: string;
        id: string;
        sortOrder: number;
        title: string;
        detail: string | null;
        employeeId: string;
        doneAt: string | null;
        doneByName: string | null;
        checklist: "onboarding" | "offboarding";
        ownerOnly: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        code: string;
        id: string;
        sortOrder: number;
        title: string;
        detail: string | null;
        employeeId: string;
        doneAt: string | null;
        doneByName: string | null;
        checklist: "onboarding" | "offboarding";
        ownerOnly: boolean;
    }[];
}, {
    items: {
        code: string;
        id: string;
        sortOrder: number;
        title: string;
        detail: string | null;
        employeeId: string;
        doneAt: string | null;
        doneByName: string | null;
        checklist: "onboarding" | "offboarding";
        ownerOnly: boolean;
    }[];
}>;
export type HrChecklistItemList = z.infer<typeof HrChecklistItemList>;
export declare const HrChecklistQuery: z.ZodObject<{
    checklist: z.ZodEnum<["onboarding", "offboarding"]>;
    employeeId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    checklist: "onboarding" | "offboarding";
    employeeId?: string | undefined;
}, {
    checklist: "onboarding" | "offboarding";
    employeeId?: string | undefined;
}>;
export type HrChecklistQuery = z.infer<typeof HrChecklistQuery>;
/** Tick a step, or take the tick back. */
export declare const MarkChecklistItemRequest: z.ZodObject<{
    done: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    done: boolean;
}, {
    done: boolean;
}>;
export type MarkChecklistItemRequest = z.infer<typeof MarkChecklistItemRequest>;
export declare const DependantRelation: z.ZodEnum<["spouse", "child", "parent", "sibling", "other"]>;
export type DependantRelation = z.infer<typeof DependantRelation>;
export declare const EmployeeDependant: z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    name: z.ZodString;
    relation: z.ZodEnum<["spouse", "child", "parent", "sibling", "other"]>;
    sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
    dateOfBirth: z.ZodNullable<z.ZodString>;
    phone: z.ZodNullable<z.ZodString>;
    isEmergencyContact: z.ZodBoolean;
    medicalDependant: z.ZodBoolean;
    /** Share of a death benefit, 0 to 100; null when not a beneficiary. */
    beneficiaryPercent: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    dateOfBirth: string | null;
    phone: string | null;
    sex: "female" | "male" | null;
    employeeId: string;
    relation: "other" | "sibling" | "spouse" | "child" | "parent";
    isEmergencyContact: boolean;
    medicalDependant: boolean;
    beneficiaryPercent: number | null;
}, {
    name: string;
    id: string;
    dateOfBirth: string | null;
    phone: string | null;
    sex: "female" | "male" | null;
    employeeId: string;
    relation: "other" | "sibling" | "spouse" | "child" | "parent";
    isEmergencyContact: boolean;
    medicalDependant: boolean;
    beneficiaryPercent: number | null;
}>;
export type EmployeeDependant = z.infer<typeof EmployeeDependant>;
export declare const EmployeeDependantList: z.ZodObject<{
    dependants: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        name: z.ZodString;
        relation: z.ZodEnum<["spouse", "child", "parent", "sibling", "other"]>;
        sex: z.ZodNullable<z.ZodEnum<["female", "male"]>>;
        dateOfBirth: z.ZodNullable<z.ZodString>;
        phone: z.ZodNullable<z.ZodString>;
        isEmergencyContact: z.ZodBoolean;
        medicalDependant: z.ZodBoolean;
        /** Share of a death benefit, 0 to 100; null when not a beneficiary. */
        beneficiaryPercent: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        dateOfBirth: string | null;
        phone: string | null;
        sex: "female" | "male" | null;
        employeeId: string;
        relation: "other" | "sibling" | "spouse" | "child" | "parent";
        isEmergencyContact: boolean;
        medicalDependant: boolean;
        beneficiaryPercent: number | null;
    }, {
        name: string;
        id: string;
        dateOfBirth: string | null;
        phone: string | null;
        sex: "female" | "male" | null;
        employeeId: string;
        relation: "other" | "sibling" | "spouse" | "child" | "parent";
        isEmergencyContact: boolean;
        medicalDependant: boolean;
        beneficiaryPercent: number | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    dependants: {
        name: string;
        id: string;
        dateOfBirth: string | null;
        phone: string | null;
        sex: "female" | "male" | null;
        employeeId: string;
        relation: "other" | "sibling" | "spouse" | "child" | "parent";
        isEmergencyContact: boolean;
        medicalDependant: boolean;
        beneficiaryPercent: number | null;
    }[];
}, {
    dependants: {
        name: string;
        id: string;
        dateOfBirth: string | null;
        phone: string | null;
        sex: "female" | "male" | null;
        employeeId: string;
        relation: "other" | "sibling" | "spouse" | "child" | "parent";
        isEmergencyContact: boolean;
        medicalDependant: boolean;
        beneficiaryPercent: number | null;
    }[];
}>;
export type EmployeeDependantList = z.infer<typeof EmployeeDependantList>;
//# sourceMappingURL=hr-workforce.d.ts.map