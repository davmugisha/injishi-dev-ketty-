import { z } from "zod";
import type { Permission } from "./authz";
import { RosterCard, TagTone } from "./people";
/**
 * The people file (ADR-058, 058-people-file): the full record beyond slice 1's
 * thin file. Pay accounts, notes, documents, policies, disciplinary records,
 * staff announcements, the org chart, the HR catalogs and the business's HR
 * settings. The file's own new fields (photo, family, address, emergency
 * contact, employee type, tags) are on `Employee` in `people.ts`, inside the two
 * file views.
 *
 * Who reads what (AC-PF2): pay accounts are `people.manage` or `payroll.run`;
 * notes, documents and disciplinary records are `people.manage` only, through
 * their own routes, whatever the file view. Every route's declaration says so.
 */
const Uuid = z.string().uuid();
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
/** A Rwandan mobile number as people type it; normalised to E.164 by the server. */
const PhoneInput = z.string().trim().min(9, "Enter a phone number.").max(20);
const ObjectKey = z.string().min(3).max(300);
/**
 * Every HR permission (ADR-058). Any one of them opens the Staff leaf and reads
 * what the whole business shares: its policies, staff announcements, HR catalogs
 * and HR settings. One list, so the app's nav and the API's routes cannot drift.
 */
export const HR_PERMISSIONS = [
    "people.view",
    "people.manage",
    "roster.manage",
    "attendance.record",
    "attendance.approve",
    "leave.approve",
    "payroll.run",
] as const satisfies readonly Permission[];
// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
// `MaritalStatus` and `TagTone` live in people.ts, which the file shapes need.
export const PayAccountKind = z.enum(["bank", "momo"]);
export type PayAccountKind = z.infer<typeof PayAccountKind>;
export const PayAccountStatus = z.enum(["active", "retired"]);
export type PayAccountStatus = z.infer<typeof PayAccountStatus>;
export const DocumentStatus = z.enum(["requested", "submitted", "approved", "rejected"]);
export type DocumentStatus = z.infer<typeof DocumentStatus>;
/** The closed list of formats a document request may ask for (AC-PF4). */
export const DocumentFormat = z.enum(["pdf", "jpg", "png", "heic"]);
export type DocumentFormat = z.infer<typeof DocumentFormat>;
export const PublishStatus = z.enum(["published", "archived"]);
export type PublishStatus = z.infer<typeof PublishStatus>;
export const HrAudience = z.enum(["all", "targeted"]);
export type HrAudience = z.infer<typeof HrAudience>;
export const DisciplinaryKind = z.enum(["warning", "suspension", "dismissal"]);
export type DisciplinaryKind = z.infer<typeof DisciplinaryKind>;
export const LengthUnit = z.enum(["days", "hours"]);
export type LengthUnit = z.infer<typeof LengthUnit>;
// ---------------------------------------------------------------------------
// Files: upload, then attach by key
// ---------------------------------------------------------------------------
/** What an HR upload is for; each is stored as its own kind and read by its own people. */
export const HrUploadPurpose = z.enum(["photo", "document", "attachment"]);
export type HrUploadPurpose = z.infer<typeof HrUploadPurpose>;
/** `POST /ops/hr/files` (multipart, a `purpose` field beside the file). */
export const HrUpload = z.object({
    objectKey: ObjectKey,
    purpose: HrUploadPurpose,
    mime: z.string(),
    sizeBytes: z.number().int().positive(),
});
export type HrUpload = z.infer<typeof HrUpload>;
/** A short lived link to a private file, fetched after a permission check. */
export const FileLink = z.object({
    url: z.string().url(),
    expiresInSeconds: z.number().int().positive(),
});
export type FileLink = z.infer<typeof FileLink>;
/** `PUT /ops/employees/:id/photo`: a stored `staff_photo`, or null to clear it. */
export const SetEmployeePhotoRequest = z.object({ objectKey: ObjectKey.nullable() });
export type SetEmployeePhotoRequest = z.infer<typeof SetEmployeePhotoRequest>;
// ---------------------------------------------------------------------------
// Catalogs and settings (AC-PF11, AC-PF12)
// ---------------------------------------------------------------------------
export const HrCatalogKind = z.enum(["employee-types", "tags", "disciplinary-types", "job-positions"]);
export type HrCatalogKind = z.infer<typeof HrCatalogKind>;
export const HrCatalogStatus = z.enum(["active", "archived"]);
export type HrCatalogStatus = z.infer<typeof HrCatalogStatus>;
export const HrCatalogItem = z.object({
    id: Uuid,
    title: z.string(),
    status: HrCatalogStatus,
    /** Tags only. */
    tone: TagTone.optional(),
    /** Disciplinary types only. */
    kind: DisciplinaryKind.optional(),
});
export type HrCatalogItem = z.infer<typeof HrCatalogItem>;
export const HrCatalogList = z.object({ items: z.array(HrCatalogItem) });
export type HrCatalogList = z.infer<typeof HrCatalogList>;
const CatalogTitle = z.string().trim().min(1, "Give it a name.").max(60);
export const CreateHrCatalogItemRequest = z.object({
    title: CatalogTitle,
    tone: TagTone.optional(),
    kind: DisciplinaryKind.optional(),
});
export type CreateHrCatalogItemRequest = z.infer<typeof CreateHrCatalogItemRequest>;
export const UpdateHrCatalogItemRequest = z
    .object({
    title: CatalogTitle,
    tone: TagTone,
    kind: DisciplinaryKind,
    status: HrCatalogStatus,
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateHrCatalogItemRequest = z.infer<typeof UpdateHrCatalogItemRequest>;
export const HrSettings = z.object({
    /** `EMP` makes the next number `EMP0007`. */
    employeeNumberPrefix: z.string().nullable(),
    /** 058-payroll AC-PY14: the day of the month the draft run is made by itself, 1 to 28. */
    payRunAutoDraftDay: z.number().int().nullable(),
    /** 058-payroll AC-PY14: printed on payslips and declarations; a run needs it to confirm. */
    rssbEmployerNumber: z.string().nullable(),
});
export type HrSettings = z.infer<typeof HrSettings>;
export const UpdateHrSettingsRequest = z
    .object({
        employeeNumberPrefix: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-Z0-9-]{1,8}$/, "A prefix is up to 8 capital letters, digits or dashes.")
            .nullable(),
        payRunAutoDraftDay: z.number().int().min(1).max(28).nullable(),
        rssbEmployerNumber: z.string().trim().min(3, "An RSSB employer number is at least 3 characters.").max(30).nullable(),
    })
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateHrSettingsRequest = z.infer<typeof UpdateHrSettingsRequest>;
// ---------------------------------------------------------------------------
// Pay accounts (AC-PF3)
// ---------------------------------------------------------------------------
export const PayAccount = z.object({
    id: Uuid,
    employeeId: Uuid,
    kind: PayAccountKind,
    bankName: z.string().nullable(),
    accountNumber: z.string().nullable(),
    branchName: z.string().nullable(),
    momoPhone: z.string().nullable(),
    isPrimary: z.boolean(),
    status: PayAccountStatus,
    createdAt: z.string(),
});
export type PayAccount = z.infer<typeof PayAccount>;
export const PayAccountList = z.object({ accounts: z.array(PayAccount) });
export type PayAccountList = z.infer<typeof PayAccountList>;
export const CreatePayAccountRequest = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("bank"),
        bankName: z.string().trim().min(2, "Name the bank.").max(80),
        accountNumber: z.string().trim().regex(/^[0-9 -]{5,34}$/, "An account number is digits, spaces or dashes."),
        branchName: z.string().trim().max(80).nullable().optional(),
        makePrimary: z.boolean().optional(),
    }),
    z.object({
        kind: z.literal("momo"),
        momoPhone: PhoneInput,
        makePrimary: z.boolean().optional(),
    }),
]);
export type CreatePayAccountRequest = z.infer<typeof CreatePayAccountRequest>;
/** `PATCH /ops/pay-accounts/:id`. An account is never edited in place: retire it, add another. */
export const UpdatePayAccountRequest = z.object({ action: z.enum(["retire", "make_primary"]) });
export type UpdatePayAccountRequest = z.infer<typeof UpdatePayAccountRequest>;
// ---------------------------------------------------------------------------
// Notes (AC-PF6)
// ---------------------------------------------------------------------------
export const EmployeeNote = z.object({
    id: Uuid,
    body: z.string(),
    fileKeys: z.array(z.string()),
    authorName: z.string().nullable(),
    createdAt: z.string(),
});
export type EmployeeNote = z.infer<typeof EmployeeNote>;
export const EmployeeNoteList = z.object({ notes: z.array(EmployeeNote) });
export type EmployeeNoteList = z.infer<typeof EmployeeNoteList>;
export const CreateEmployeeNoteRequest = z.object({
    body: z.string().trim().min(1, "Write the note.").max(4000),
    fileKeys: z.array(ObjectKey).max(5).optional(),
});
export type CreateEmployeeNoteRequest = z.infer<typeof CreateEmployeeNoteRequest>;
// ---------------------------------------------------------------------------
// Documents (AC-PF4, AC-PF5)
// ---------------------------------------------------------------------------
export const DocumentVersion = z.object({
    id: Uuid,
    uploadedAt: z.string(),
    uploadedByName: z.string().nullable(),
    status: z.enum(["submitted", "approved", "rejected"]),
    rejectReason: z.string().nullable(),
});
export type DocumentVersion = z.infer<typeof DocumentVersion>;
export const EmployeeDocument = z.object({
    id: Uuid,
    employee: RosterCard,
    requestId: Uuid.nullable(),
    title: z.string(),
    status: DocumentStatus,
    /** Past its expiry date today in Kigali; computed at read, never stored (AC-PF5). */
    expired: z.boolean(),
    rejectReason: z.string().nullable(),
    issuedOn: IsoDate.nullable(),
    expiresOn: IsoDate.nullable(),
    remindDaysBefore: z.number().int().nullable(),
    /** The formats and size its request asked for, when it came from one. */
    formats: z.array(DocumentFormat),
    maxMb: z.number().int(),
    dueOn: IsoDate.nullable(),
    versions: z.array(DocumentVersion),
    updatedAt: z.string(),
});
export type EmployeeDocument = z.infer<typeof EmployeeDocument>;
export const EmployeeDocumentList = z.object({ documents: z.array(EmployeeDocument) });
export type EmployeeDocumentList = z.infer<typeof EmployeeDocumentList>;
export const DocumentRequestSummary = z.object({
    id: Uuid,
    title: z.string(),
    description: z.string().nullable(),
    formats: z.array(DocumentFormat),
    maxMb: z.number().int(),
    dueOn: IsoDate.nullable(),
    createdAt: z.string(),
    /** How many of its documents sit at each status. */
    counts: z.object({
        requested: z.number().int(),
        submitted: z.number().int(),
        approved: z.number().int(),
        rejected: z.number().int(),
    }),
});
export type DocumentRequestSummary = z.infer<typeof DocumentRequestSummary>;
export const DocumentRequestList = z.object({ requests: z.array(DocumentRequestSummary) });
export type DocumentRequestList = z.infer<typeof DocumentRequestList>;
const DocumentTitle = z.string().trim().min(2, "Name the document.").max(120);
const RemindDays = z.number().int().min(0).max(365);
/** `POST /ops/document-requests`: one document row per person named (AC-PF4). */
export const CreateDocumentRequestRequest = z.object({
    title: DocumentTitle,
    description: z.string().trim().max(1000).nullable().optional(),
    formats: z.array(DocumentFormat).min(1).max(4),
    maxMb: z.number().int().min(1).max(10),
    dueOn: IsoDate.nullable().optional(),
    employeeIds: z.array(Uuid).min(1).max(200),
});
export type CreateDocumentRequestRequest = z.infer<typeof CreateDocumentRequestRequest>;
/**
 * `POST /ops/employees/:id/documents`: upload a file for one of the person's
 * requested documents (`documentId`), or a document nobody requested (`title`).
 */
export const UploadEmployeeDocumentRequest = z
    .object({
    documentId: Uuid.optional(),
    title: DocumentTitle.optional(),
    fileKey: ObjectKey,
    issuedOn: IsoDate.nullable().optional(),
    expiresOn: IsoDate.nullable().optional(),
    remindDaysBefore: RemindDays.nullable().optional(),
})
    .refine((b) => (b.documentId === undefined) !== (b.title === undefined), {
    message: "Name the requested document, or give a title for a new one.",
    path: ["title"],
});
export type UploadEmployeeDocumentRequest = z.infer<typeof UploadEmployeeDocumentRequest>;
/** `POST /ops/documents/:id/decide`: approve the newest version, or refuse it with a reason. */
export const DecideDocumentRequest = z
    .object({
    decision: z.enum(["approve", "reject"]),
    reason: z.string().trim().min(3).max(500).optional(),
})
    .refine((b) => b.decision === "approve" || b.reason !== undefined, {
    message: "Say why it is refused.",
    path: ["reason"],
});
export type DecideDocumentRequest = z.infer<typeof DecideDocumentRequest>;
/** `PATCH /ops/documents/:id`: the dates; moving the expiry or the lead clears its reminder (AC-PF5). */
export const UpdateDocumentDatesRequest = z
    .object({
    issuedOn: IsoDate.nullable(),
    expiresOn: IsoDate.nullable(),
    remindDaysBefore: RemindDays.nullable(),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateDocumentDatesRequest = z.infer<typeof UpdateDocumentDatesRequest>;
// ---------------------------------------------------------------------------
// Audiences, policies and announcements (AC-PF7, AC-PF9)
// ---------------------------------------------------------------------------
/** Who a targeted policy or announcement is for. A department and positions together narrow it. */
export const HrTargets = z.object({
    departmentIds: z.array(Uuid).max(50),
    jobPositionIds: z.array(Uuid).max(50),
    employeeIds: z.array(Uuid).max(200),
});
export type HrTargets = z.infer<typeof HrTargets>;
export const StaffPolicy = z.object({
    id: Uuid,
    title: z.string(),
    body: z.string(),
    fileKeys: z.array(z.string()),
    audience: HrAudience,
    targets: HrTargets,
    status: PublishStatus,
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type StaffPolicy = z.infer<typeof StaffPolicy>;
export const StaffPolicyList = z.object({ policies: z.array(StaffPolicy) });
export type StaffPolicyList = z.infer<typeof StaffPolicyList>;
const AudienceInput = z
    .object({
    audience: HrAudience,
    targets: HrTargets.optional(),
})
    .refine((b) => b.audience === "all" ||
    (b.targets !== undefined &&
        b.targets.departmentIds.length + b.targets.jobPositionIds.length + b.targets.employeeIds.length > 0), { message: "Choose who it is for.", path: ["targets"] });
export const CreateStaffPolicyRequest = z
    .object({
    title: z.string().trim().min(2, "Give it a title.").max(120),
    body: z.string().trim().min(1, "Write the policy.").max(20000),
    fileKeys: z.array(ObjectKey).max(5).optional(),
})
    .and(AudienceInput);
export type CreateStaffPolicyRequest = z.infer<typeof CreateStaffPolicyRequest>;
export const UpdateStaffPolicyRequest = z
    .object({
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().min(1).max(20000),
    fileKeys: z.array(ObjectKey).max(5),
    audience: HrAudience,
    targets: HrTargets,
    status: PublishStatus,
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateStaffPolicyRequest = z.infer<typeof UpdateStaffPolicyRequest>;
export const StaffAnnouncement = z.object({
    id: Uuid,
    title: z.string(),
    body: z.string(),
    fileKeys: z.array(z.string()),
    audience: HrAudience,
    targets: HrTargets,
    expiresOn: IsoDate.nullable(),
    commentsAllowed: z.boolean(),
    status: PublishStatus,
    /** First views recorded so far, and comments. */
    viewCount: z.number().int(),
    commentCount: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type StaffAnnouncement = z.infer<typeof StaffAnnouncement>;
export const StaffAnnouncementList = z.object({ announcements: z.array(StaffAnnouncement) });
export type StaffAnnouncementList = z.infer<typeof StaffAnnouncementList>;
export const CreateStaffAnnouncementRequest = z
    .object({
    title: z.string().trim().min(2, "Give it a title.").max(120),
    body: z.string().trim().min(1, "Write the announcement.").max(10000),
    fileKeys: z.array(ObjectKey).max(5).optional(),
    expiresOn: IsoDate.nullable().optional(),
    commentsAllowed: z.boolean().optional(),
})
    .and(AudienceInput);
export type CreateStaffAnnouncementRequest = z.infer<typeof CreateStaffAnnouncementRequest>;
export const UpdateStaffAnnouncementRequest = z
    .object({
    title: z.string().trim().min(2).max(120),
    body: z.string().trim().min(1).max(10000),
    fileKeys: z.array(ObjectKey).max(5),
    audience: HrAudience,
    targets: HrTargets,
    expiresOn: IsoDate.nullable(),
    commentsAllowed: z.boolean(),
    status: PublishStatus,
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
export type UpdateStaffAnnouncementRequest = z.infer<typeof UpdateStaffAnnouncementRequest>;
// ---------------------------------------------------------------------------
// Discipline (AC-PF8)
// ---------------------------------------------------------------------------
export const DisciplinaryAction = z.object({
    id: Uuid,
    employee: RosterCard,
    type: z.object({ id: Uuid, title: z.string(), kind: DisciplinaryKind }),
    description: z.string(),
    unit: LengthUnit.nullable(),
    length: z.number().int().nullable(),
    startsOn: IsoDate,
    hasFile: z.boolean(),
    createdAt: z.string(),
    createdByName: z.string().nullable(),
});
export type DisciplinaryAction = z.infer<typeof DisciplinaryAction>;
export const DisciplinaryActionList = z.object({ actions: z.array(DisciplinaryAction) });
export type DisciplinaryActionList = z.infer<typeof DisciplinaryActionList>;
/** `POST /ops/disciplinary-actions`: naming several people writes one row each. */
export const CreateDisciplinaryActionRequest = z
    .object({
    employeeIds: z.array(Uuid).min(1).max(50),
    typeId: Uuid,
    description: z.string().trim().min(3, "Say what happened.").max(4000),
    unit: LengthUnit.nullable().optional(),
    length: z.number().int().min(1).max(365).nullable().optional(),
    startsOn: IsoDate,
    fileKey: ObjectKey.nullable().optional(),
})
    .refine((b) => (b.unit == null) === (b.length == null), {
    message: "Give a length with its unit, or neither.",
    path: ["length"],
});
export type CreateDisciplinaryActionRequest = z.infer<typeof CreateDisciplinaryActionRequest>;
/** What recording discipline answers: the rows written, and whether to offer offboarding. */
export const CreateDisciplinaryActionResponse = z.object({
    actions: z.array(DisciplinaryAction),
    /** A `dismissal` offboards nobody by itself; the screen offers to start it (AC-PF8). */
    offerOffboarding: z.boolean(),
});
export type CreateDisciplinaryActionResponse = z.infer<typeof CreateDisciplinaryActionResponse>;
// ---------------------------------------------------------------------------
// The org chart (AC-PF10)
// ---------------------------------------------------------------------------
export const OrgChartNode = z.object({
    employeeId: Uuid,
    displayName: z.string(),
    jobPositionTitle: z.string().nullable(),
    /** Null for the top of a tree, or a manager outside the caller's branches. */
    reportingManagerId: Uuid.nullable(),
    hasPhoto: z.boolean(),
});
export type OrgChartNode = z.infer<typeof OrgChartNode>;
export const OrgChart = z.object({ nodes: z.array(OrgChartNode) });
export type OrgChart = z.infer<typeof OrgChart>;
