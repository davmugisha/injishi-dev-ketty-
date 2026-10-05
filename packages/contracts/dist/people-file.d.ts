import { z } from "zod";
/**
 * Every HR permission (ADR-058). Any one of them opens the Staff leaf and reads
 * what the whole business shares: its policies, staff announcements, HR catalogs
 * and HR settings. One list, so the app's nav and the API's routes cannot drift.
 */
export declare const HR_PERMISSIONS: readonly ["people.view", "people.manage", "roster.manage", "attendance.record", "attendance.approve", "leave.approve", "payroll.run"];
export declare const PayAccountKind: z.ZodEnum<["bank", "momo"]>;
export type PayAccountKind = z.infer<typeof PayAccountKind>;
export declare const PayAccountStatus: z.ZodEnum<["active", "retired"]>;
export type PayAccountStatus = z.infer<typeof PayAccountStatus>;
export declare const DocumentStatus: z.ZodEnum<["requested", "submitted", "approved", "rejected"]>;
export type DocumentStatus = z.infer<typeof DocumentStatus>;
/** The closed list of formats a document request may ask for (AC-PF4). */
export declare const DocumentFormat: z.ZodEnum<["pdf", "jpg", "png", "heic"]>;
export type DocumentFormat = z.infer<typeof DocumentFormat>;
export declare const PublishStatus: z.ZodEnum<["published", "archived"]>;
export type PublishStatus = z.infer<typeof PublishStatus>;
export declare const HrAudience: z.ZodEnum<["all", "targeted"]>;
export type HrAudience = z.infer<typeof HrAudience>;
export declare const DisciplinaryKind: z.ZodEnum<["warning", "suspension", "dismissal"]>;
export type DisciplinaryKind = z.infer<typeof DisciplinaryKind>;
export declare const LengthUnit: z.ZodEnum<["days", "hours"]>;
export type LengthUnit = z.infer<typeof LengthUnit>;
/** What an HR upload is for; each is stored as its own kind and read by its own people. */
export declare const HrUploadPurpose: z.ZodEnum<["photo", "document", "attachment"]>;
export type HrUploadPurpose = z.infer<typeof HrUploadPurpose>;
/** `POST /ops/hr/files` (multipart, a `purpose` field beside the file). */
export declare const HrUpload: z.ZodObject<{
    objectKey: z.ZodString;
    purpose: z.ZodEnum<["photo", "document", "attachment"]>;
    mime: z.ZodString;
    sizeBytes: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    objectKey: string;
    mime: string;
    sizeBytes: number;
    purpose: "document" | "photo" | "attachment";
}, {
    objectKey: string;
    mime: string;
    sizeBytes: number;
    purpose: "document" | "photo" | "attachment";
}>;
export type HrUpload = z.infer<typeof HrUpload>;
/** A short lived link to a private file, fetched after a permission check. */
export declare const FileLink: z.ZodObject<{
    url: z.ZodString;
    expiresInSeconds: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    url: string;
    expiresInSeconds: number;
}, {
    url: string;
    expiresInSeconds: number;
}>;
export type FileLink = z.infer<typeof FileLink>;
/** `PUT /ops/employees/:id/photo`: a stored `staff_photo`, or null to clear it. */
export declare const SetEmployeePhotoRequest: z.ZodObject<{
    objectKey: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    objectKey: string | null;
}, {
    objectKey: string | null;
}>;
export type SetEmployeePhotoRequest = z.infer<typeof SetEmployeePhotoRequest>;
export declare const HrCatalogKind: z.ZodEnum<["employee-types", "tags", "disciplinary-types", "job-positions"]>;
export type HrCatalogKind = z.infer<typeof HrCatalogKind>;
export declare const HrCatalogStatus: z.ZodEnum<["active", "archived"]>;
export type HrCatalogStatus = z.infer<typeof HrCatalogStatus>;
export declare const HrCatalogItem: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    status: z.ZodEnum<["active", "archived"]>;
    /** Tags only. */
    tone: z.ZodOptional<z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>>;
    /** Disciplinary types only. */
    kind: z.ZodOptional<z.ZodEnum<["warning", "suspension", "dismissal"]>>;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    id: string;
    title: string;
    kind?: "warning" | "suspension" | "dismissal" | undefined;
    tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
}, {
    status: "active" | "archived";
    id: string;
    title: string;
    kind?: "warning" | "suspension" | "dismissal" | undefined;
    tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
}>;
export type HrCatalogItem = z.infer<typeof HrCatalogItem>;
export declare const HrCatalogList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        status: z.ZodEnum<["active", "archived"]>;
        /** Tags only. */
        tone: z.ZodOptional<z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>>;
        /** Disciplinary types only. */
        kind: z.ZodOptional<z.ZodEnum<["warning", "suspension", "dismissal"]>>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        id: string;
        title: string;
        kind?: "warning" | "suspension" | "dismissal" | undefined;
        tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
    }, {
        status: "active" | "archived";
        id: string;
        title: string;
        kind?: "warning" | "suspension" | "dismissal" | undefined;
        tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "active" | "archived";
        id: string;
        title: string;
        kind?: "warning" | "suspension" | "dismissal" | undefined;
        tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
    }[];
}, {
    items: {
        status: "active" | "archived";
        id: string;
        title: string;
        kind?: "warning" | "suspension" | "dismissal" | undefined;
        tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
    }[];
}>;
export type HrCatalogList = z.infer<typeof HrCatalogList>;
export declare const CreateHrCatalogItemRequest: z.ZodObject<{
    title: z.ZodString;
    tone: z.ZodOptional<z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>>;
    kind: z.ZodOptional<z.ZodEnum<["warning", "suspension", "dismissal"]>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    kind?: "warning" | "suspension" | "dismissal" | undefined;
    tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
}, {
    title: string;
    kind?: "warning" | "suspension" | "dismissal" | undefined;
    tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
}>;
export type CreateHrCatalogItemRequest = z.infer<typeof CreateHrCatalogItemRequest>;
export declare const UpdateHrCatalogItemRequest: z.ZodEffects<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    tone: z.ZodOptional<z.ZodEnum<["neutral", "info", "ok", "warn", "bad"]>>;
    kind: z.ZodOptional<z.ZodEnum<["warning", "suspension", "dismissal"]>>;
    status: z.ZodOptional<z.ZodEnum<["active", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "archived" | undefined;
    kind?: "warning" | "suspension" | "dismissal" | undefined;
    title?: string | undefined;
    tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
}, {
    status?: "active" | "archived" | undefined;
    kind?: "warning" | "suspension" | "dismissal" | undefined;
    title?: string | undefined;
    tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
}>, {
    status?: "active" | "archived" | undefined;
    kind?: "warning" | "suspension" | "dismissal" | undefined;
    title?: string | undefined;
    tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
}, {
    status?: "active" | "archived" | undefined;
    kind?: "warning" | "suspension" | "dismissal" | undefined;
    title?: string | undefined;
    tone?: "ok" | "neutral" | "info" | "warn" | "bad" | undefined;
}>;
export type UpdateHrCatalogItemRequest = z.infer<typeof UpdateHrCatalogItemRequest>;
export declare const HrSettings: z.ZodObject<{
    /** `EMP` makes the next number `EMP0007`. */
    employeeNumberPrefix: z.ZodNullable<z.ZodString>;
    /** 058-payroll AC-PY14: the day of the month the draft run is made by itself, 1 to 28. */
    payRunAutoDraftDay: z.ZodNullable<z.ZodNumber>;
    /** 058-payroll AC-PY14: printed on payslips and declarations; a run needs it to confirm. */
    rssbEmployerNumber: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    employeeNumberPrefix: string | null;
    payRunAutoDraftDay: number | null;
    rssbEmployerNumber: string | null;
}, {
    employeeNumberPrefix: string | null;
    payRunAutoDraftDay: number | null;
    rssbEmployerNumber: string | null;
}>;
export type HrSettings = z.infer<typeof HrSettings>;
export declare const UpdateHrSettingsRequest: z.ZodEffects<z.ZodObject<{
    employeeNumberPrefix: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    payRunAutoDraftDay: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    rssbEmployerNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    employeeNumberPrefix?: string | null | undefined;
    payRunAutoDraftDay?: number | null | undefined;
    rssbEmployerNumber?: string | null | undefined;
}, {
    employeeNumberPrefix?: string | null | undefined;
    payRunAutoDraftDay?: number | null | undefined;
    rssbEmployerNumber?: string | null | undefined;
}>, {
    employeeNumberPrefix?: string | null | undefined;
    payRunAutoDraftDay?: number | null | undefined;
    rssbEmployerNumber?: string | null | undefined;
}, {
    employeeNumberPrefix?: string | null | undefined;
    payRunAutoDraftDay?: number | null | undefined;
    rssbEmployerNumber?: string | null | undefined;
}>;
export type UpdateHrSettingsRequest = z.infer<typeof UpdateHrSettingsRequest>;
export declare const PayAccount: z.ZodObject<{
    id: z.ZodString;
    employeeId: z.ZodString;
    kind: z.ZodEnum<["bank", "momo"]>;
    bankName: z.ZodNullable<z.ZodString>;
    accountNumber: z.ZodNullable<z.ZodString>;
    branchName: z.ZodNullable<z.ZodString>;
    momoPhone: z.ZodNullable<z.ZodString>;
    isPrimary: z.ZodBoolean;
    status: z.ZodEnum<["active", "retired"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "active" | "retired";
    kind: "bank" | "momo";
    id: string;
    createdAt: string;
    isPrimary: boolean;
    employeeId: string;
    branchName: string | null;
    bankName: string | null;
    accountNumber: string | null;
    momoPhone: string | null;
}, {
    status: "active" | "retired";
    kind: "bank" | "momo";
    id: string;
    createdAt: string;
    isPrimary: boolean;
    employeeId: string;
    branchName: string | null;
    bankName: string | null;
    accountNumber: string | null;
    momoPhone: string | null;
}>;
export type PayAccount = z.infer<typeof PayAccount>;
export declare const PayAccountList: z.ZodObject<{
    accounts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        employeeId: z.ZodString;
        kind: z.ZodEnum<["bank", "momo"]>;
        bankName: z.ZodNullable<z.ZodString>;
        accountNumber: z.ZodNullable<z.ZodString>;
        branchName: z.ZodNullable<z.ZodString>;
        momoPhone: z.ZodNullable<z.ZodString>;
        isPrimary: z.ZodBoolean;
        status: z.ZodEnum<["active", "retired"]>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "retired";
        kind: "bank" | "momo";
        id: string;
        createdAt: string;
        isPrimary: boolean;
        employeeId: string;
        branchName: string | null;
        bankName: string | null;
        accountNumber: string | null;
        momoPhone: string | null;
    }, {
        status: "active" | "retired";
        kind: "bank" | "momo";
        id: string;
        createdAt: string;
        isPrimary: boolean;
        employeeId: string;
        branchName: string | null;
        bankName: string | null;
        accountNumber: string | null;
        momoPhone: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    accounts: {
        status: "active" | "retired";
        kind: "bank" | "momo";
        id: string;
        createdAt: string;
        isPrimary: boolean;
        employeeId: string;
        branchName: string | null;
        bankName: string | null;
        accountNumber: string | null;
        momoPhone: string | null;
    }[];
}, {
    accounts: {
        status: "active" | "retired";
        kind: "bank" | "momo";
        id: string;
        createdAt: string;
        isPrimary: boolean;
        employeeId: string;
        branchName: string | null;
        bankName: string | null;
        accountNumber: string | null;
        momoPhone: string | null;
    }[];
}>;
export type PayAccountList = z.infer<typeof PayAccountList>;
export declare const CreatePayAccountRequest: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"bank">;
    bankName: z.ZodString;
    accountNumber: z.ZodString;
    branchName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    makePrimary: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    kind: "bank";
    bankName: string;
    accountNumber: string;
    branchName?: string | null | undefined;
    makePrimary?: boolean | undefined;
}, {
    kind: "bank";
    bankName: string;
    accountNumber: string;
    branchName?: string | null | undefined;
    makePrimary?: boolean | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"momo">;
    momoPhone: z.ZodString;
    makePrimary: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    kind: "momo";
    momoPhone: string;
    makePrimary?: boolean | undefined;
}, {
    kind: "momo";
    momoPhone: string;
    makePrimary?: boolean | undefined;
}>]>;
export type CreatePayAccountRequest = z.infer<typeof CreatePayAccountRequest>;
/** `PATCH /ops/pay-accounts/:id`. An account is never edited in place: retire it, add another. */
export declare const UpdatePayAccountRequest: z.ZodObject<{
    action: z.ZodEnum<["retire", "make_primary"]>;
}, "strip", z.ZodTypeAny, {
    action: "retire" | "make_primary";
}, {
    action: "retire" | "make_primary";
}>;
export type UpdatePayAccountRequest = z.infer<typeof UpdatePayAccountRequest>;
export declare const EmployeeNote: z.ZodObject<{
    id: z.ZodString;
    body: z.ZodString;
    fileKeys: z.ZodArray<z.ZodString, "many">;
    authorName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    authorName: string | null;
    body: string;
    fileKeys: string[];
}, {
    id: string;
    createdAt: string;
    authorName: string | null;
    body: string;
    fileKeys: string[];
}>;
export type EmployeeNote = z.infer<typeof EmployeeNote>;
export declare const EmployeeNoteList: z.ZodObject<{
    notes: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        body: z.ZodString;
        fileKeys: z.ZodArray<z.ZodString, "many">;
        authorName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        authorName: string | null;
        body: string;
        fileKeys: string[];
    }, {
        id: string;
        createdAt: string;
        authorName: string | null;
        body: string;
        fileKeys: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    notes: {
        id: string;
        createdAt: string;
        authorName: string | null;
        body: string;
        fileKeys: string[];
    }[];
}, {
    notes: {
        id: string;
        createdAt: string;
        authorName: string | null;
        body: string;
        fileKeys: string[];
    }[];
}>;
export type EmployeeNoteList = z.infer<typeof EmployeeNoteList>;
export declare const CreateEmployeeNoteRequest: z.ZodObject<{
    body: z.ZodString;
    fileKeys: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    body: string;
    fileKeys?: string[] | undefined;
}, {
    body: string;
    fileKeys?: string[] | undefined;
}>;
export type CreateEmployeeNoteRequest = z.infer<typeof CreateEmployeeNoteRequest>;
export declare const DocumentVersion: z.ZodObject<{
    id: z.ZodString;
    uploadedAt: z.ZodString;
    uploadedByName: z.ZodNullable<z.ZodString>;
    status: z.ZodEnum<["submitted", "approved", "rejected"]>;
    rejectReason: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "approved" | "rejected";
    id: string;
    uploadedAt: string;
    uploadedByName: string | null;
    rejectReason: string | null;
}, {
    status: "submitted" | "approved" | "rejected";
    id: string;
    uploadedAt: string;
    uploadedByName: string | null;
    rejectReason: string | null;
}>;
export type DocumentVersion = z.infer<typeof DocumentVersion>;
export declare const EmployeeDocument: z.ZodObject<{
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
    requestId: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    status: z.ZodEnum<["requested", "submitted", "approved", "rejected"]>;
    /** Past its expiry date today in Kigali; computed at read, never stored (AC-PF5). */
    expired: z.ZodBoolean;
    rejectReason: z.ZodNullable<z.ZodString>;
    issuedOn: z.ZodNullable<z.ZodString>;
    expiresOn: z.ZodNullable<z.ZodString>;
    remindDaysBefore: z.ZodNullable<z.ZodNumber>;
    /** The formats and size its request asked for, when it came from one. */
    formats: z.ZodArray<z.ZodEnum<["pdf", "jpg", "png", "heic"]>, "many">;
    maxMb: z.ZodNumber;
    dueOn: z.ZodNullable<z.ZodString>;
    versions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        uploadedAt: z.ZodString;
        uploadedByName: z.ZodNullable<z.ZodString>;
        status: z.ZodEnum<["submitted", "approved", "rejected"]>;
        rejectReason: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "approved" | "rejected";
        id: string;
        uploadedAt: string;
        uploadedByName: string | null;
        rejectReason: string | null;
    }, {
        status: "submitted" | "approved" | "rejected";
        id: string;
        uploadedAt: string;
        uploadedByName: string | null;
        rejectReason: string | null;
    }>, "many">;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "submitted" | "approved" | "rejected" | "requested";
    issuedOn: string | null;
    expiresOn: string | null;
    expired: boolean;
    id: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    title: string;
    updatedAt: string;
    requestId: string | null;
    rejectReason: string | null;
    remindDaysBefore: number | null;
    formats: ("pdf" | "jpg" | "png" | "heic")[];
    maxMb: number;
    dueOn: string | null;
    versions: {
        status: "submitted" | "approved" | "rejected";
        id: string;
        uploadedAt: string;
        uploadedByName: string | null;
        rejectReason: string | null;
    }[];
}, {
    status: "submitted" | "approved" | "rejected" | "requested";
    issuedOn: string | null;
    expiresOn: string | null;
    expired: boolean;
    id: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    title: string;
    updatedAt: string;
    requestId: string | null;
    rejectReason: string | null;
    remindDaysBefore: number | null;
    formats: ("pdf" | "jpg" | "png" | "heic")[];
    maxMb: number;
    dueOn: string | null;
    versions: {
        status: "submitted" | "approved" | "rejected";
        id: string;
        uploadedAt: string;
        uploadedByName: string | null;
        rejectReason: string | null;
    }[];
}>;
export type EmployeeDocument = z.infer<typeof EmployeeDocument>;
export declare const EmployeeDocumentList: z.ZodObject<{
    documents: z.ZodArray<z.ZodObject<{
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
        requestId: z.ZodNullable<z.ZodString>;
        title: z.ZodString;
        status: z.ZodEnum<["requested", "submitted", "approved", "rejected"]>;
        /** Past its expiry date today in Kigali; computed at read, never stored (AC-PF5). */
        expired: z.ZodBoolean;
        rejectReason: z.ZodNullable<z.ZodString>;
        issuedOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        remindDaysBefore: z.ZodNullable<z.ZodNumber>;
        /** The formats and size its request asked for, when it came from one. */
        formats: z.ZodArray<z.ZodEnum<["pdf", "jpg", "png", "heic"]>, "many">;
        maxMb: z.ZodNumber;
        dueOn: z.ZodNullable<z.ZodString>;
        versions: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            uploadedAt: z.ZodString;
            uploadedByName: z.ZodNullable<z.ZodString>;
            status: z.ZodEnum<["submitted", "approved", "rejected"]>;
            rejectReason: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "submitted" | "approved" | "rejected";
            id: string;
            uploadedAt: string;
            uploadedByName: string | null;
            rejectReason: string | null;
        }, {
            status: "submitted" | "approved" | "rejected";
            id: string;
            uploadedAt: string;
            uploadedByName: string | null;
            rejectReason: string | null;
        }>, "many">;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "submitted" | "approved" | "rejected" | "requested";
        issuedOn: string | null;
        expiresOn: string | null;
        expired: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        title: string;
        updatedAt: string;
        requestId: string | null;
        rejectReason: string | null;
        remindDaysBefore: number | null;
        formats: ("pdf" | "jpg" | "png" | "heic")[];
        maxMb: number;
        dueOn: string | null;
        versions: {
            status: "submitted" | "approved" | "rejected";
            id: string;
            uploadedAt: string;
            uploadedByName: string | null;
            rejectReason: string | null;
        }[];
    }, {
        status: "submitted" | "approved" | "rejected" | "requested";
        issuedOn: string | null;
        expiresOn: string | null;
        expired: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        title: string;
        updatedAt: string;
        requestId: string | null;
        rejectReason: string | null;
        remindDaysBefore: number | null;
        formats: ("pdf" | "jpg" | "png" | "heic")[];
        maxMb: number;
        dueOn: string | null;
        versions: {
            status: "submitted" | "approved" | "rejected";
            id: string;
            uploadedAt: string;
            uploadedByName: string | null;
            rejectReason: string | null;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    documents: {
        status: "submitted" | "approved" | "rejected" | "requested";
        issuedOn: string | null;
        expiresOn: string | null;
        expired: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        title: string;
        updatedAt: string;
        requestId: string | null;
        rejectReason: string | null;
        remindDaysBefore: number | null;
        formats: ("pdf" | "jpg" | "png" | "heic")[];
        maxMb: number;
        dueOn: string | null;
        versions: {
            status: "submitted" | "approved" | "rejected";
            id: string;
            uploadedAt: string;
            uploadedByName: string | null;
            rejectReason: string | null;
        }[];
    }[];
}, {
    documents: {
        status: "submitted" | "approved" | "rejected" | "requested";
        issuedOn: string | null;
        expiresOn: string | null;
        expired: boolean;
        id: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        title: string;
        updatedAt: string;
        requestId: string | null;
        rejectReason: string | null;
        remindDaysBefore: number | null;
        formats: ("pdf" | "jpg" | "png" | "heic")[];
        maxMb: number;
        dueOn: string | null;
        versions: {
            status: "submitted" | "approved" | "rejected";
            id: string;
            uploadedAt: string;
            uploadedByName: string | null;
            rejectReason: string | null;
        }[];
    }[];
}>;
export type EmployeeDocumentList = z.infer<typeof EmployeeDocumentList>;
export declare const DocumentRequestSummary: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    formats: z.ZodArray<z.ZodEnum<["pdf", "jpg", "png", "heic"]>, "many">;
    maxMb: z.ZodNumber;
    dueOn: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    /** How many of its documents sit at each status. */
    counts: z.ZodObject<{
        requested: z.ZodNumber;
        submitted: z.ZodNumber;
        approved: z.ZodNumber;
        rejected: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        submitted: number;
        approved: number;
        rejected: number;
        requested: number;
    }, {
        submitted: number;
        approved: number;
        rejected: number;
        requested: number;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    title: string;
    createdAt: string;
    description: string | null;
    counts: {
        submitted: number;
        approved: number;
        rejected: number;
        requested: number;
    };
    formats: ("pdf" | "jpg" | "png" | "heic")[];
    maxMb: number;
    dueOn: string | null;
}, {
    id: string;
    title: string;
    createdAt: string;
    description: string | null;
    counts: {
        submitted: number;
        approved: number;
        rejected: number;
        requested: number;
    };
    formats: ("pdf" | "jpg" | "png" | "heic")[];
    maxMb: number;
    dueOn: string | null;
}>;
export type DocumentRequestSummary = z.infer<typeof DocumentRequestSummary>;
export declare const DocumentRequestList: z.ZodObject<{
    requests: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        formats: z.ZodArray<z.ZodEnum<["pdf", "jpg", "png", "heic"]>, "many">;
        maxMb: z.ZodNumber;
        dueOn: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
        /** How many of its documents sit at each status. */
        counts: z.ZodObject<{
            requested: z.ZodNumber;
            submitted: z.ZodNumber;
            approved: z.ZodNumber;
            rejected: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            submitted: number;
            approved: number;
            rejected: number;
            requested: number;
        }, {
            submitted: number;
            approved: number;
            rejected: number;
            requested: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        title: string;
        createdAt: string;
        description: string | null;
        counts: {
            submitted: number;
            approved: number;
            rejected: number;
            requested: number;
        };
        formats: ("pdf" | "jpg" | "png" | "heic")[];
        maxMb: number;
        dueOn: string | null;
    }, {
        id: string;
        title: string;
        createdAt: string;
        description: string | null;
        counts: {
            submitted: number;
            approved: number;
            rejected: number;
            requested: number;
        };
        formats: ("pdf" | "jpg" | "png" | "heic")[];
        maxMb: number;
        dueOn: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    requests: {
        id: string;
        title: string;
        createdAt: string;
        description: string | null;
        counts: {
            submitted: number;
            approved: number;
            rejected: number;
            requested: number;
        };
        formats: ("pdf" | "jpg" | "png" | "heic")[];
        maxMb: number;
        dueOn: string | null;
    }[];
}, {
    requests: {
        id: string;
        title: string;
        createdAt: string;
        description: string | null;
        counts: {
            submitted: number;
            approved: number;
            rejected: number;
            requested: number;
        };
        formats: ("pdf" | "jpg" | "png" | "heic")[];
        maxMb: number;
        dueOn: string | null;
    }[];
}>;
export type DocumentRequestList = z.infer<typeof DocumentRequestList>;
/** `POST /ops/document-requests`: one document row per person named (AC-PF4). */
export declare const CreateDocumentRequestRequest: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    formats: z.ZodArray<z.ZodEnum<["pdf", "jpg", "png", "heic"]>, "many">;
    maxMb: z.ZodNumber;
    dueOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    employeeIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    title: string;
    formats: ("pdf" | "jpg" | "png" | "heic")[];
    maxMb: number;
    employeeIds: string[];
    description?: string | null | undefined;
    dueOn?: string | null | undefined;
}, {
    title: string;
    formats: ("pdf" | "jpg" | "png" | "heic")[];
    maxMb: number;
    employeeIds: string[];
    description?: string | null | undefined;
    dueOn?: string | null | undefined;
}>;
export type CreateDocumentRequestRequest = z.infer<typeof CreateDocumentRequestRequest>;
/**
 * `POST /ops/employees/:id/documents`: upload a file for one of the person's
 * requested documents (`documentId`), or a document nobody requested (`title`).
 */
export declare const UploadEmployeeDocumentRequest: z.ZodEffects<z.ZodObject<{
    documentId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    fileKey: z.ZodString;
    issuedOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiresOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    remindDaysBefore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    fileKey: string;
    issuedOn?: string | null | undefined;
    expiresOn?: string | null | undefined;
    title?: string | undefined;
    remindDaysBefore?: number | null | undefined;
    documentId?: string | undefined;
}, {
    fileKey: string;
    issuedOn?: string | null | undefined;
    expiresOn?: string | null | undefined;
    title?: string | undefined;
    remindDaysBefore?: number | null | undefined;
    documentId?: string | undefined;
}>, {
    fileKey: string;
    issuedOn?: string | null | undefined;
    expiresOn?: string | null | undefined;
    title?: string | undefined;
    remindDaysBefore?: number | null | undefined;
    documentId?: string | undefined;
}, {
    fileKey: string;
    issuedOn?: string | null | undefined;
    expiresOn?: string | null | undefined;
    title?: string | undefined;
    remindDaysBefore?: number | null | undefined;
    documentId?: string | undefined;
}>;
export type UploadEmployeeDocumentRequest = z.infer<typeof UploadEmployeeDocumentRequest>;
/** `POST /ops/documents/:id/decide`: approve the newest version, or refuse it with a reason. */
export declare const DecideDocumentRequest: z.ZodEffects<z.ZodObject<{
    decision: z.ZodEnum<["approve", "reject"]>;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: "approve" | "reject";
    reason?: string | undefined;
}, {
    decision: "approve" | "reject";
    reason?: string | undefined;
}>, {
    decision: "approve" | "reject";
    reason?: string | undefined;
}, {
    decision: "approve" | "reject";
    reason?: string | undefined;
}>;
export type DecideDocumentRequest = z.infer<typeof DecideDocumentRequest>;
/** `PATCH /ops/documents/:id`: the dates; moving the expiry or the lead clears its reminder (AC-PF5). */
export declare const UpdateDocumentDatesRequest: z.ZodEffects<z.ZodObject<{
    issuedOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    expiresOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    remindDaysBefore: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    issuedOn?: string | null | undefined;
    expiresOn?: string | null | undefined;
    remindDaysBefore?: number | null | undefined;
}, {
    issuedOn?: string | null | undefined;
    expiresOn?: string | null | undefined;
    remindDaysBefore?: number | null | undefined;
}>, {
    issuedOn?: string | null | undefined;
    expiresOn?: string | null | undefined;
    remindDaysBefore?: number | null | undefined;
}, {
    issuedOn?: string | null | undefined;
    expiresOn?: string | null | undefined;
    remindDaysBefore?: number | null | undefined;
}>;
export type UpdateDocumentDatesRequest = z.infer<typeof UpdateDocumentDatesRequest>;
/** Who a targeted policy or announcement is for. A department and positions together narrow it. */
export declare const HrTargets: z.ZodObject<{
    departmentIds: z.ZodArray<z.ZodString, "many">;
    jobPositionIds: z.ZodArray<z.ZodString, "many">;
    employeeIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    jobPositionIds: string[];
    employeeIds: string[];
    departmentIds: string[];
}, {
    jobPositionIds: string[];
    employeeIds: string[];
    departmentIds: string[];
}>;
export type HrTargets = z.infer<typeof HrTargets>;
export declare const StaffPolicy: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    body: z.ZodString;
    fileKeys: z.ZodArray<z.ZodString, "many">;
    audience: z.ZodEnum<["all", "targeted"]>;
    targets: z.ZodObject<{
        departmentIds: z.ZodArray<z.ZodString, "many">;
        jobPositionIds: z.ZodArray<z.ZodString, "many">;
        employeeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }>;
    status: z.ZodEnum<["published", "archived"]>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "published" | "archived";
    id: string;
    title: string;
    createdAt: string;
    body: string;
    audience: "all" | "targeted";
    updatedAt: string;
    targets: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    };
    fileKeys: string[];
}, {
    status: "published" | "archived";
    id: string;
    title: string;
    createdAt: string;
    body: string;
    audience: "all" | "targeted";
    updatedAt: string;
    targets: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    };
    fileKeys: string[];
}>;
export type StaffPolicy = z.infer<typeof StaffPolicy>;
export declare const StaffPolicyList: z.ZodObject<{
    policies: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        body: z.ZodString;
        fileKeys: z.ZodArray<z.ZodString, "many">;
        audience: z.ZodEnum<["all", "targeted"]>;
        targets: z.ZodObject<{
            departmentIds: z.ZodArray<z.ZodString, "many">;
            jobPositionIds: z.ZodArray<z.ZodString, "many">;
            employeeIds: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        }, {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        }>;
        status: z.ZodEnum<["published", "archived"]>;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "published" | "archived";
        id: string;
        title: string;
        createdAt: string;
        body: string;
        audience: "all" | "targeted";
        updatedAt: string;
        targets: {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        };
        fileKeys: string[];
    }, {
        status: "published" | "archived";
        id: string;
        title: string;
        createdAt: string;
        body: string;
        audience: "all" | "targeted";
        updatedAt: string;
        targets: {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        };
        fileKeys: string[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    policies: {
        status: "published" | "archived";
        id: string;
        title: string;
        createdAt: string;
        body: string;
        audience: "all" | "targeted";
        updatedAt: string;
        targets: {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        };
        fileKeys: string[];
    }[];
}, {
    policies: {
        status: "published" | "archived";
        id: string;
        title: string;
        createdAt: string;
        body: string;
        audience: "all" | "targeted";
        updatedAt: string;
        targets: {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        };
        fileKeys: string[];
    }[];
}>;
export type StaffPolicyList = z.infer<typeof StaffPolicyList>;
export declare const CreateStaffPolicyRequest: z.ZodIntersection<z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
    fileKeys: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    title: string;
    body: string;
    fileKeys?: string[] | undefined;
}, {
    title: string;
    body: string;
    fileKeys?: string[] | undefined;
}>, z.ZodEffects<z.ZodObject<{
    audience: z.ZodEnum<["all", "targeted"]>;
    targets: z.ZodOptional<z.ZodObject<{
        departmentIds: z.ZodArray<z.ZodString, "many">;
        jobPositionIds: z.ZodArray<z.ZodString, "many">;
        employeeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }>>;
}, "strip", z.ZodTypeAny, {
    audience: "all" | "targeted";
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
}, {
    audience: "all" | "targeted";
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
}>, {
    audience: "all" | "targeted";
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
}, {
    audience: "all" | "targeted";
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
}>>;
export type CreateStaffPolicyRequest = z.infer<typeof CreateStaffPolicyRequest>;
export declare const UpdateStaffPolicyRequest: z.ZodEffects<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    fileKeys: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    audience: z.ZodOptional<z.ZodEnum<["all", "targeted"]>>;
    targets: z.ZodOptional<z.ZodObject<{
        departmentIds: z.ZodArray<z.ZodString, "many">;
        jobPositionIds: z.ZodArray<z.ZodString, "many">;
        employeeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }>>;
    status: z.ZodOptional<z.ZodEnum<["published", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "published" | "archived" | undefined;
    title?: string | undefined;
    body?: string | undefined;
    audience?: "all" | "targeted" | undefined;
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
    fileKeys?: string[] | undefined;
}, {
    status?: "published" | "archived" | undefined;
    title?: string | undefined;
    body?: string | undefined;
    audience?: "all" | "targeted" | undefined;
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
    fileKeys?: string[] | undefined;
}>, {
    status?: "published" | "archived" | undefined;
    title?: string | undefined;
    body?: string | undefined;
    audience?: "all" | "targeted" | undefined;
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
    fileKeys?: string[] | undefined;
}, {
    status?: "published" | "archived" | undefined;
    title?: string | undefined;
    body?: string | undefined;
    audience?: "all" | "targeted" | undefined;
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
    fileKeys?: string[] | undefined;
}>;
export type UpdateStaffPolicyRequest = z.infer<typeof UpdateStaffPolicyRequest>;
export declare const StaffAnnouncement: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    body: z.ZodString;
    fileKeys: z.ZodArray<z.ZodString, "many">;
    audience: z.ZodEnum<["all", "targeted"]>;
    targets: z.ZodObject<{
        departmentIds: z.ZodArray<z.ZodString, "many">;
        jobPositionIds: z.ZodArray<z.ZodString, "many">;
        employeeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }>;
    expiresOn: z.ZodNullable<z.ZodString>;
    commentsAllowed: z.ZodBoolean;
    status: z.ZodEnum<["published", "archived"]>;
    /** First views recorded so far, and comments. */
    viewCount: z.ZodNumber;
    commentCount: z.ZodNumber;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "published" | "archived";
    expiresOn: string | null;
    id: string;
    title: string;
    createdAt: string;
    body: string;
    audience: "all" | "targeted";
    updatedAt: string;
    targets: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    };
    fileKeys: string[];
    commentsAllowed: boolean;
    viewCount: number;
    commentCount: number;
}, {
    status: "published" | "archived";
    expiresOn: string | null;
    id: string;
    title: string;
    createdAt: string;
    body: string;
    audience: "all" | "targeted";
    updatedAt: string;
    targets: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    };
    fileKeys: string[];
    commentsAllowed: boolean;
    viewCount: number;
    commentCount: number;
}>;
export type StaffAnnouncement = z.infer<typeof StaffAnnouncement>;
export declare const StaffAnnouncementList: z.ZodObject<{
    announcements: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        body: z.ZodString;
        fileKeys: z.ZodArray<z.ZodString, "many">;
        audience: z.ZodEnum<["all", "targeted"]>;
        targets: z.ZodObject<{
            departmentIds: z.ZodArray<z.ZodString, "many">;
            jobPositionIds: z.ZodArray<z.ZodString, "many">;
            employeeIds: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        }, {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        }>;
        expiresOn: z.ZodNullable<z.ZodString>;
        commentsAllowed: z.ZodBoolean;
        status: z.ZodEnum<["published", "archived"]>;
        /** First views recorded so far, and comments. */
        viewCount: z.ZodNumber;
        commentCount: z.ZodNumber;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "published" | "archived";
        expiresOn: string | null;
        id: string;
        title: string;
        createdAt: string;
        body: string;
        audience: "all" | "targeted";
        updatedAt: string;
        targets: {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        };
        fileKeys: string[];
        commentsAllowed: boolean;
        viewCount: number;
        commentCount: number;
    }, {
        status: "published" | "archived";
        expiresOn: string | null;
        id: string;
        title: string;
        createdAt: string;
        body: string;
        audience: "all" | "targeted";
        updatedAt: string;
        targets: {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        };
        fileKeys: string[];
        commentsAllowed: boolean;
        viewCount: number;
        commentCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    announcements: {
        status: "published" | "archived";
        expiresOn: string | null;
        id: string;
        title: string;
        createdAt: string;
        body: string;
        audience: "all" | "targeted";
        updatedAt: string;
        targets: {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        };
        fileKeys: string[];
        commentsAllowed: boolean;
        viewCount: number;
        commentCount: number;
    }[];
}, {
    announcements: {
        status: "published" | "archived";
        expiresOn: string | null;
        id: string;
        title: string;
        createdAt: string;
        body: string;
        audience: "all" | "targeted";
        updatedAt: string;
        targets: {
            jobPositionIds: string[];
            employeeIds: string[];
            departmentIds: string[];
        };
        fileKeys: string[];
        commentsAllowed: boolean;
        viewCount: number;
        commentCount: number;
    }[];
}>;
export type StaffAnnouncementList = z.infer<typeof StaffAnnouncementList>;
export declare const CreateStaffAnnouncementRequest: z.ZodIntersection<z.ZodObject<{
    title: z.ZodString;
    body: z.ZodString;
    fileKeys: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    expiresOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    commentsAllowed: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title: string;
    body: string;
    expiresOn?: string | null | undefined;
    fileKeys?: string[] | undefined;
    commentsAllowed?: boolean | undefined;
}, {
    title: string;
    body: string;
    expiresOn?: string | null | undefined;
    fileKeys?: string[] | undefined;
    commentsAllowed?: boolean | undefined;
}>, z.ZodEffects<z.ZodObject<{
    audience: z.ZodEnum<["all", "targeted"]>;
    targets: z.ZodOptional<z.ZodObject<{
        departmentIds: z.ZodArray<z.ZodString, "many">;
        jobPositionIds: z.ZodArray<z.ZodString, "many">;
        employeeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }>>;
}, "strip", z.ZodTypeAny, {
    audience: "all" | "targeted";
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
}, {
    audience: "all" | "targeted";
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
}>, {
    audience: "all" | "targeted";
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
}, {
    audience: "all" | "targeted";
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
}>>;
export type CreateStaffAnnouncementRequest = z.infer<typeof CreateStaffAnnouncementRequest>;
export declare const UpdateStaffAnnouncementRequest: z.ZodEffects<z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    fileKeys: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    audience: z.ZodOptional<z.ZodEnum<["all", "targeted"]>>;
    targets: z.ZodOptional<z.ZodObject<{
        departmentIds: z.ZodArray<z.ZodString, "many">;
        jobPositionIds: z.ZodArray<z.ZodString, "many">;
        employeeIds: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }, {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    }>>;
    expiresOn: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    commentsAllowed: z.ZodOptional<z.ZodBoolean>;
    status: z.ZodOptional<z.ZodEnum<["published", "archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "published" | "archived" | undefined;
    expiresOn?: string | null | undefined;
    title?: string | undefined;
    body?: string | undefined;
    audience?: "all" | "targeted" | undefined;
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
    fileKeys?: string[] | undefined;
    commentsAllowed?: boolean | undefined;
}, {
    status?: "published" | "archived" | undefined;
    expiresOn?: string | null | undefined;
    title?: string | undefined;
    body?: string | undefined;
    audience?: "all" | "targeted" | undefined;
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
    fileKeys?: string[] | undefined;
    commentsAllowed?: boolean | undefined;
}>, {
    status?: "published" | "archived" | undefined;
    expiresOn?: string | null | undefined;
    title?: string | undefined;
    body?: string | undefined;
    audience?: "all" | "targeted" | undefined;
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
    fileKeys?: string[] | undefined;
    commentsAllowed?: boolean | undefined;
}, {
    status?: "published" | "archived" | undefined;
    expiresOn?: string | null | undefined;
    title?: string | undefined;
    body?: string | undefined;
    audience?: "all" | "targeted" | undefined;
    targets?: {
        jobPositionIds: string[];
        employeeIds: string[];
        departmentIds: string[];
    } | undefined;
    fileKeys?: string[] | undefined;
    commentsAllowed?: boolean | undefined;
}>;
export type UpdateStaffAnnouncementRequest = z.infer<typeof UpdateStaffAnnouncementRequest>;
export declare const DisciplinaryAction: z.ZodObject<{
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
    type: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        kind: z.ZodEnum<["warning", "suspension", "dismissal"]>;
    }, "strip", z.ZodTypeAny, {
        kind: "warning" | "suspension" | "dismissal";
        id: string;
        title: string;
    }, {
        kind: "warning" | "suspension" | "dismissal";
        id: string;
        title: string;
    }>;
    description: z.ZodString;
    unit: z.ZodNullable<z.ZodEnum<["days", "hours"]>>;
    length: z.ZodNullable<z.ZodNumber>;
    startsOn: z.ZodString;
    hasFile: z.ZodBoolean;
    createdAt: z.ZodString;
    createdByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    length: number | null;
    type: {
        kind: "warning" | "suspension" | "dismissal";
        id: string;
        title: string;
    };
    id: string;
    startsOn: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    unit: "days" | "hours" | null;
    createdAt: string;
    description: string;
    createdByName: string | null;
    hasFile: boolean;
}, {
    length: number | null;
    type: {
        kind: "warning" | "suspension" | "dismissal";
        id: string;
        title: string;
    };
    id: string;
    startsOn: string;
    employee: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
    };
    unit: "days" | "hours" | null;
    createdAt: string;
    description: string;
    createdByName: string | null;
    hasFile: boolean;
}>;
export type DisciplinaryAction = z.infer<typeof DisciplinaryAction>;
export declare const DisciplinaryActionList: z.ZodObject<{
    actions: z.ZodArray<z.ZodObject<{
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
        type: z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            kind: z.ZodEnum<["warning", "suspension", "dismissal"]>;
        }, "strip", z.ZodTypeAny, {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        }, {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        }>;
        description: z.ZodString;
        unit: z.ZodNullable<z.ZodEnum<["days", "hours"]>>;
        length: z.ZodNullable<z.ZodNumber>;
        startsOn: z.ZodString;
        hasFile: z.ZodBoolean;
        createdAt: z.ZodString;
        createdByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        length: number | null;
        type: {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        };
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        unit: "days" | "hours" | null;
        createdAt: string;
        description: string;
        createdByName: string | null;
        hasFile: boolean;
    }, {
        length: number | null;
        type: {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        };
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        unit: "days" | "hours" | null;
        createdAt: string;
        description: string;
        createdByName: string | null;
        hasFile: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    actions: {
        length: number | null;
        type: {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        };
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        unit: "days" | "hours" | null;
        createdAt: string;
        description: string;
        createdByName: string | null;
        hasFile: boolean;
    }[];
}, {
    actions: {
        length: number | null;
        type: {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        };
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        unit: "days" | "hours" | null;
        createdAt: string;
        description: string;
        createdByName: string | null;
        hasFile: boolean;
    }[];
}>;
export type DisciplinaryActionList = z.infer<typeof DisciplinaryActionList>;
/** `POST /ops/disciplinary-actions`: naming several people writes one row each. */
export declare const CreateDisciplinaryActionRequest: z.ZodEffects<z.ZodObject<{
    employeeIds: z.ZodArray<z.ZodString, "many">;
    typeId: z.ZodString;
    description: z.ZodString;
    unit: z.ZodOptional<z.ZodNullable<z.ZodEnum<["days", "hours"]>>>;
    length: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    startsOn: z.ZodString;
    fileKey: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    startsOn: string;
    description: string;
    employeeIds: string[];
    typeId: string;
    length?: number | null | undefined;
    unit?: "days" | "hours" | null | undefined;
    fileKey?: string | null | undefined;
}, {
    startsOn: string;
    description: string;
    employeeIds: string[];
    typeId: string;
    length?: number | null | undefined;
    unit?: "days" | "hours" | null | undefined;
    fileKey?: string | null | undefined;
}>, {
    startsOn: string;
    description: string;
    employeeIds: string[];
    typeId: string;
    length?: number | null | undefined;
    unit?: "days" | "hours" | null | undefined;
    fileKey?: string | null | undefined;
}, {
    startsOn: string;
    description: string;
    employeeIds: string[];
    typeId: string;
    length?: number | null | undefined;
    unit?: "days" | "hours" | null | undefined;
    fileKey?: string | null | undefined;
}>;
export type CreateDisciplinaryActionRequest = z.infer<typeof CreateDisciplinaryActionRequest>;
/** What recording discipline answers: the rows written, and whether to offer offboarding. */
export declare const CreateDisciplinaryActionResponse: z.ZodObject<{
    actions: z.ZodArray<z.ZodObject<{
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
        type: z.ZodObject<{
            id: z.ZodString;
            title: z.ZodString;
            kind: z.ZodEnum<["warning", "suspension", "dismissal"]>;
        }, "strip", z.ZodTypeAny, {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        }, {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        }>;
        description: z.ZodString;
        unit: z.ZodNullable<z.ZodEnum<["days", "hours"]>>;
        length: z.ZodNullable<z.ZodNumber>;
        startsOn: z.ZodString;
        hasFile: z.ZodBoolean;
        createdAt: z.ZodString;
        createdByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        length: number | null;
        type: {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        };
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        unit: "days" | "hours" | null;
        createdAt: string;
        description: string;
        createdByName: string | null;
        hasFile: boolean;
    }, {
        length: number | null;
        type: {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        };
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        unit: "days" | "hours" | null;
        createdAt: string;
        description: string;
        createdByName: string | null;
        hasFile: boolean;
    }>, "many">;
    /** A `dismissal` offboards nobody by itself; the screen offers to start it (AC-PF8). */
    offerOffboarding: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    actions: {
        length: number | null;
        type: {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        };
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        unit: "days" | "hours" | null;
        createdAt: string;
        description: string;
        createdByName: string | null;
        hasFile: boolean;
    }[];
    offerOffboarding: boolean;
}, {
    actions: {
        length: number | null;
        type: {
            kind: "warning" | "suspension" | "dismissal";
            id: string;
            title: string;
        };
        id: string;
        startsOn: string;
        employee: {
            employeeId: string;
            displayName: string;
            jobPositionTitle: string | null;
        };
        unit: "days" | "hours" | null;
        createdAt: string;
        description: string;
        createdByName: string | null;
        hasFile: boolean;
    }[];
    offerOffboarding: boolean;
}>;
export type CreateDisciplinaryActionResponse = z.infer<typeof CreateDisciplinaryActionResponse>;
export declare const OrgChartNode: z.ZodObject<{
    employeeId: z.ZodString;
    displayName: z.ZodString;
    jobPositionTitle: z.ZodNullable<z.ZodString>;
    /** Null for the top of a tree, or a manager outside the caller's branches. */
    reportingManagerId: z.ZodNullable<z.ZodString>;
    hasPhoto: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    employeeId: string;
    displayName: string;
    jobPositionTitle: string | null;
    hasPhoto: boolean;
    reportingManagerId: string | null;
}, {
    employeeId: string;
    displayName: string;
    jobPositionTitle: string | null;
    hasPhoto: boolean;
    reportingManagerId: string | null;
}>;
export type OrgChartNode = z.infer<typeof OrgChartNode>;
export declare const OrgChart: z.ZodObject<{
    nodes: z.ZodArray<z.ZodObject<{
        employeeId: z.ZodString;
        displayName: z.ZodString;
        jobPositionTitle: z.ZodNullable<z.ZodString>;
        /** Null for the top of a tree, or a manager outside the caller's branches. */
        reportingManagerId: z.ZodNullable<z.ZodString>;
        hasPhoto: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
        hasPhoto: boolean;
        reportingManagerId: string | null;
    }, {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
        hasPhoto: boolean;
        reportingManagerId: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    nodes: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
        hasPhoto: boolean;
        reportingManagerId: string | null;
    }[];
}, {
    nodes: {
        employeeId: string;
        displayName: string;
        jobPositionTitle: string | null;
        hasPhoto: boolean;
        reportingManagerId: string | null;
    }[];
}>;
export type OrgChart = z.infer<typeof OrgChart>;
//# sourceMappingURL=people-file.d.ts.map