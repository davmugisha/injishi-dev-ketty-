"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDisciplinaryActionResponse = exports.CreateDisciplinaryActionRequest = exports.DisciplinaryActionList = exports.DisciplinaryAction = exports.UpdateStaffAnnouncementRequest = exports.CreateStaffAnnouncementRequest = exports.StaffAnnouncementList = exports.StaffAnnouncement = exports.UpdateStaffPolicyRequest = exports.CreateStaffPolicyRequest = exports.StaffPolicyList = exports.StaffPolicy = exports.HrTargets = exports.UpdateDocumentDatesRequest = exports.DecideDocumentRequest = exports.UploadEmployeeDocumentRequest = exports.CreateDocumentRequestRequest = exports.DocumentRequestList = exports.DocumentRequestSummary = exports.EmployeeDocumentList = exports.EmployeeDocument = exports.DocumentVersion = exports.CreateEmployeeNoteRequest = exports.EmployeeNoteList = exports.EmployeeNote = exports.UpdatePayAccountRequest = exports.CreatePayAccountRequest = exports.PayAccountList = exports.PayAccount = exports.UpdateHrSettingsRequest = exports.HrSettings = exports.UpdateHrCatalogItemRequest = exports.CreateHrCatalogItemRequest = exports.HrCatalogList = exports.HrCatalogItem = exports.HrCatalogStatus = exports.HrCatalogKind = exports.SetEmployeePhotoRequest = exports.FileLink = exports.HrUpload = exports.HrUploadPurpose = exports.LengthUnit = exports.DisciplinaryKind = exports.HrAudience = exports.PublishStatus = exports.DocumentFormat = exports.DocumentStatus = exports.PayAccountStatus = exports.PayAccountKind = exports.HR_PERMISSIONS = void 0;
exports.OrgChart = exports.OrgChartNode = void 0;
const zod_1 = require("zod");
const people_1 = require("./people");
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
const Uuid = zod_1.z.string().uuid();
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
/** A Rwandan mobile number as people type it; normalised to E.164 by the server. */
const PhoneInput = zod_1.z.string().trim().min(9, "Enter a phone number.").max(20);
const ObjectKey = zod_1.z.string().min(3).max(300);
/**
 * Every HR permission (ADR-058). Any one of them opens the Staff leaf and reads
 * what the whole business shares: its policies, staff announcements, HR catalogs
 * and HR settings. One list, so the app's nav and the API's routes cannot drift.
 */
exports.HR_PERMISSIONS = [
    "people.view",
    "people.manage",
    "roster.manage",
    "attendance.record",
    "attendance.approve",
    "leave.approve",
    "payroll.run",
];
// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------
// `MaritalStatus` and `TagTone` live in people.ts, which the file shapes need.
exports.PayAccountKind = zod_1.z.enum(["bank", "momo"]);
exports.PayAccountStatus = zod_1.z.enum(["active", "retired"]);
exports.DocumentStatus = zod_1.z.enum(["requested", "submitted", "approved", "rejected"]);
/** The closed list of formats a document request may ask for (AC-PF4). */
exports.DocumentFormat = zod_1.z.enum(["pdf", "jpg", "png", "heic"]);
exports.PublishStatus = zod_1.z.enum(["published", "archived"]);
exports.HrAudience = zod_1.z.enum(["all", "targeted"]);
exports.DisciplinaryKind = zod_1.z.enum(["warning", "suspension", "dismissal"]);
exports.LengthUnit = zod_1.z.enum(["days", "hours"]);
// ---------------------------------------------------------------------------
// Files: upload, then attach by key
// ---------------------------------------------------------------------------
/** What an HR upload is for; each is stored as its own kind and read by its own people. */
exports.HrUploadPurpose = zod_1.z.enum(["photo", "document", "attachment"]);
/** `POST /ops/hr/files` (multipart, a `purpose` field beside the file). */
exports.HrUpload = zod_1.z.object({
    objectKey: ObjectKey,
    purpose: exports.HrUploadPurpose,
    mime: zod_1.z.string(),
    sizeBytes: zod_1.z.number().int().positive(),
});
/** A short lived link to a private file, fetched after a permission check. */
exports.FileLink = zod_1.z.object({
    url: zod_1.z.string().url(),
    expiresInSeconds: zod_1.z.number().int().positive(),
});
/** `PUT /ops/employees/:id/photo`: a stored `staff_photo`, or null to clear it. */
exports.SetEmployeePhotoRequest = zod_1.z.object({ objectKey: ObjectKey.nullable() });
// ---------------------------------------------------------------------------
// Catalogs and settings (AC-PF11, AC-PF12)
// ---------------------------------------------------------------------------
exports.HrCatalogKind = zod_1.z.enum(["employee-types", "tags", "disciplinary-types", "job-positions"]);
exports.HrCatalogStatus = zod_1.z.enum(["active", "archived"]);
exports.HrCatalogItem = zod_1.z.object({
    id: Uuid,
    title: zod_1.z.string(),
    status: exports.HrCatalogStatus,
    /** Tags only. */
    tone: people_1.TagTone.optional(),
    /** Disciplinary types only. */
    kind: exports.DisciplinaryKind.optional(),
});
exports.HrCatalogList = zod_1.z.object({ items: zod_1.z.array(exports.HrCatalogItem) });
const CatalogTitle = zod_1.z.string().trim().min(1, "Give it a name.").max(60);
exports.CreateHrCatalogItemRequest = zod_1.z.object({
    title: CatalogTitle,
    tone: people_1.TagTone.optional(),
    kind: exports.DisciplinaryKind.optional(),
});
exports.UpdateHrCatalogItemRequest = zod_1.z
    .object({
    title: CatalogTitle,
    tone: people_1.TagTone,
    kind: exports.DisciplinaryKind,
    status: exports.HrCatalogStatus,
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
exports.HrSettings = zod_1.z.object({
    /** `EMP` makes the next number `EMP0007`. */
    employeeNumberPrefix: zod_1.z.string().nullable(),
});
exports.UpdateHrSettingsRequest = zod_1.z.object({
    employeeNumberPrefix: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{1,8}$/, "A prefix is up to 8 capital letters, digits or dashes.")
        .nullable(),
});
// ---------------------------------------------------------------------------
// Pay accounts (AC-PF3)
// ---------------------------------------------------------------------------
exports.PayAccount = zod_1.z.object({
    id: Uuid,
    employeeId: Uuid,
    kind: exports.PayAccountKind,
    bankName: zod_1.z.string().nullable(),
    accountNumber: zod_1.z.string().nullable(),
    branchName: zod_1.z.string().nullable(),
    momoPhone: zod_1.z.string().nullable(),
    isPrimary: zod_1.z.boolean(),
    status: exports.PayAccountStatus,
    createdAt: zod_1.z.string(),
});
exports.PayAccountList = zod_1.z.object({ accounts: zod_1.z.array(exports.PayAccount) });
exports.CreatePayAccountRequest = zod_1.z.discriminatedUnion("kind", [
    zod_1.z.object({
        kind: zod_1.z.literal("bank"),
        bankName: zod_1.z.string().trim().min(2, "Name the bank.").max(80),
        accountNumber: zod_1.z.string().trim().regex(/^[0-9 -]{5,34}$/, "An account number is digits, spaces or dashes."),
        branchName: zod_1.z.string().trim().max(80).nullable().optional(),
        makePrimary: zod_1.z.boolean().optional(),
    }),
    zod_1.z.object({
        kind: zod_1.z.literal("momo"),
        momoPhone: PhoneInput,
        makePrimary: zod_1.z.boolean().optional(),
    }),
]);
/** `PATCH /ops/pay-accounts/:id`. An account is never edited in place: retire it, add another. */
exports.UpdatePayAccountRequest = zod_1.z.object({ action: zod_1.z.enum(["retire", "make_primary"]) });
// ---------------------------------------------------------------------------
// Notes (AC-PF6)
// ---------------------------------------------------------------------------
exports.EmployeeNote = zod_1.z.object({
    id: Uuid,
    body: zod_1.z.string(),
    fileKeys: zod_1.z.array(zod_1.z.string()),
    authorName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
exports.EmployeeNoteList = zod_1.z.object({ notes: zod_1.z.array(exports.EmployeeNote) });
exports.CreateEmployeeNoteRequest = zod_1.z.object({
    body: zod_1.z.string().trim().min(1, "Write the note.").max(4000),
    fileKeys: zod_1.z.array(ObjectKey).max(5).optional(),
});
// ---------------------------------------------------------------------------
// Documents (AC-PF4, AC-PF5)
// ---------------------------------------------------------------------------
exports.DocumentVersion = zod_1.z.object({
    id: Uuid,
    uploadedAt: zod_1.z.string(),
    uploadedByName: zod_1.z.string().nullable(),
    status: zod_1.z.enum(["submitted", "approved", "rejected"]),
    rejectReason: zod_1.z.string().nullable(),
});
exports.EmployeeDocument = zod_1.z.object({
    id: Uuid,
    employee: people_1.RosterCard,
    requestId: Uuid.nullable(),
    title: zod_1.z.string(),
    status: exports.DocumentStatus,
    /** Past its expiry date today in Kigali; computed at read, never stored (AC-PF5). */
    expired: zod_1.z.boolean(),
    rejectReason: zod_1.z.string().nullable(),
    issuedOn: IsoDate.nullable(),
    expiresOn: IsoDate.nullable(),
    remindDaysBefore: zod_1.z.number().int().nullable(),
    /** The formats and size its request asked for, when it came from one. */
    formats: zod_1.z.array(exports.DocumentFormat),
    maxMb: zod_1.z.number().int(),
    dueOn: IsoDate.nullable(),
    versions: zod_1.z.array(exports.DocumentVersion),
    updatedAt: zod_1.z.string(),
});
exports.EmployeeDocumentList = zod_1.z.object({ documents: zod_1.z.array(exports.EmployeeDocument) });
exports.DocumentRequestSummary = zod_1.z.object({
    id: Uuid,
    title: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    formats: zod_1.z.array(exports.DocumentFormat),
    maxMb: zod_1.z.number().int(),
    dueOn: IsoDate.nullable(),
    createdAt: zod_1.z.string(),
    /** How many of its documents sit at each status. */
    counts: zod_1.z.object({
        requested: zod_1.z.number().int(),
        submitted: zod_1.z.number().int(),
        approved: zod_1.z.number().int(),
        rejected: zod_1.z.number().int(),
    }),
});
exports.DocumentRequestList = zod_1.z.object({ requests: zod_1.z.array(exports.DocumentRequestSummary) });
const DocumentTitle = zod_1.z.string().trim().min(2, "Name the document.").max(120);
const RemindDays = zod_1.z.number().int().min(0).max(365);
/** `POST /ops/document-requests`: one document row per person named (AC-PF4). */
exports.CreateDocumentRequestRequest = zod_1.z.object({
    title: DocumentTitle,
    description: zod_1.z.string().trim().max(1000).nullable().optional(),
    formats: zod_1.z.array(exports.DocumentFormat).min(1).max(4),
    maxMb: zod_1.z.number().int().min(1).max(10),
    dueOn: IsoDate.nullable().optional(),
    employeeIds: zod_1.z.array(Uuid).min(1).max(200),
});
/**
 * `POST /ops/employees/:id/documents`: upload a file for one of the person's
 * requested documents (`documentId`), or a document nobody requested (`title`).
 */
exports.UploadEmployeeDocumentRequest = zod_1.z
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
/** `POST /ops/documents/:id/decide`: approve the newest version, or refuse it with a reason. */
exports.DecideDocumentRequest = zod_1.z
    .object({
    decision: zod_1.z.enum(["approve", "reject"]),
    reason: zod_1.z.string().trim().min(3).max(500).optional(),
})
    .refine((b) => b.decision === "approve" || b.reason !== undefined, {
    message: "Say why it is refused.",
    path: ["reason"],
});
/** `PATCH /ops/documents/:id`: the dates; moving the expiry or the lead clears its reminder (AC-PF5). */
exports.UpdateDocumentDatesRequest = zod_1.z
    .object({
    issuedOn: IsoDate.nullable(),
    expiresOn: IsoDate.nullable(),
    remindDaysBefore: RemindDays.nullable(),
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
// ---------------------------------------------------------------------------
// Audiences, policies and announcements (AC-PF7, AC-PF9)
// ---------------------------------------------------------------------------
/** Who a targeted policy or announcement is for. A department and positions together narrow it. */
exports.HrTargets = zod_1.z.object({
    departmentIds: zod_1.z.array(Uuid).max(50),
    jobPositionIds: zod_1.z.array(Uuid).max(50),
    employeeIds: zod_1.z.array(Uuid).max(200),
});
exports.StaffPolicy = zod_1.z.object({
    id: Uuid,
    title: zod_1.z.string(),
    body: zod_1.z.string(),
    fileKeys: zod_1.z.array(zod_1.z.string()),
    audience: exports.HrAudience,
    targets: exports.HrTargets,
    status: exports.PublishStatus,
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.StaffPolicyList = zod_1.z.object({ policies: zod_1.z.array(exports.StaffPolicy) });
const AudienceInput = zod_1.z
    .object({
    audience: exports.HrAudience,
    targets: exports.HrTargets.optional(),
})
    .refine((b) => b.audience === "all" ||
    (b.targets !== undefined &&
        b.targets.departmentIds.length + b.targets.jobPositionIds.length + b.targets.employeeIds.length > 0), { message: "Choose who it is for.", path: ["targets"] });
exports.CreateStaffPolicyRequest = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(2, "Give it a title.").max(120),
    body: zod_1.z.string().trim().min(1, "Write the policy.").max(20000),
    fileKeys: zod_1.z.array(ObjectKey).max(5).optional(),
})
    .and(AudienceInput);
exports.UpdateStaffPolicyRequest = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(2).max(120),
    body: zod_1.z.string().trim().min(1).max(20000),
    fileKeys: zod_1.z.array(ObjectKey).max(5),
    audience: exports.HrAudience,
    targets: exports.HrTargets,
    status: exports.PublishStatus,
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
exports.StaffAnnouncement = zod_1.z.object({
    id: Uuid,
    title: zod_1.z.string(),
    body: zod_1.z.string(),
    fileKeys: zod_1.z.array(zod_1.z.string()),
    audience: exports.HrAudience,
    targets: exports.HrTargets,
    expiresOn: IsoDate.nullable(),
    commentsAllowed: zod_1.z.boolean(),
    status: exports.PublishStatus,
    /** First views recorded so far, and comments. */
    viewCount: zod_1.z.number().int(),
    commentCount: zod_1.z.number().int(),
    createdAt: zod_1.z.string(),
    updatedAt: zod_1.z.string(),
});
exports.StaffAnnouncementList = zod_1.z.object({ announcements: zod_1.z.array(exports.StaffAnnouncement) });
exports.CreateStaffAnnouncementRequest = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(2, "Give it a title.").max(120),
    body: zod_1.z.string().trim().min(1, "Write the announcement.").max(10000),
    fileKeys: zod_1.z.array(ObjectKey).max(5).optional(),
    expiresOn: IsoDate.nullable().optional(),
    commentsAllowed: zod_1.z.boolean().optional(),
})
    .and(AudienceInput);
exports.UpdateStaffAnnouncementRequest = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(2).max(120),
    body: zod_1.z.string().trim().min(1).max(10000),
    fileKeys: zod_1.z.array(ObjectKey).max(5),
    audience: exports.HrAudience,
    targets: exports.HrTargets,
    expiresOn: IsoDate.nullable(),
    commentsAllowed: zod_1.z.boolean(),
    status: exports.PublishStatus,
})
    .partial()
    .refine((b) => Object.keys(b).length > 0, { message: "Nothing to change." });
// ---------------------------------------------------------------------------
// Discipline (AC-PF8)
// ---------------------------------------------------------------------------
exports.DisciplinaryAction = zod_1.z.object({
    id: Uuid,
    employee: people_1.RosterCard,
    type: zod_1.z.object({ id: Uuid, title: zod_1.z.string(), kind: exports.DisciplinaryKind }),
    description: zod_1.z.string(),
    unit: exports.LengthUnit.nullable(),
    length: zod_1.z.number().int().nullable(),
    startsOn: IsoDate,
    hasFile: zod_1.z.boolean(),
    createdAt: zod_1.z.string(),
    createdByName: zod_1.z.string().nullable(),
});
exports.DisciplinaryActionList = zod_1.z.object({ actions: zod_1.z.array(exports.DisciplinaryAction) });
/** `POST /ops/disciplinary-actions`: naming several people writes one row each. */
exports.CreateDisciplinaryActionRequest = zod_1.z
    .object({
    employeeIds: zod_1.z.array(Uuid).min(1).max(50),
    typeId: Uuid,
    description: zod_1.z.string().trim().min(3, "Say what happened.").max(4000),
    unit: exports.LengthUnit.nullable().optional(),
    length: zod_1.z.number().int().min(1).max(365).nullable().optional(),
    startsOn: IsoDate,
    fileKey: ObjectKey.nullable().optional(),
})
    .refine((b) => (b.unit == null) === (b.length == null), {
    message: "Give a length with its unit, or neither.",
    path: ["length"],
});
/** What recording discipline answers: the rows written, and whether to offer offboarding. */
exports.CreateDisciplinaryActionResponse = zod_1.z.object({
    actions: zod_1.z.array(exports.DisciplinaryAction),
    /** A `dismissal` offboards nobody by itself; the screen offers to start it (AC-PF8). */
    offerOffboarding: zod_1.z.boolean(),
});
// ---------------------------------------------------------------------------
// The org chart (AC-PF10)
// ---------------------------------------------------------------------------
exports.OrgChartNode = zod_1.z.object({
    employeeId: Uuid,
    displayName: zod_1.z.string(),
    jobPositionTitle: zod_1.z.string().nullable(),
    /** Null for the top of a tree, or a manager outside the caller's branches. */
    reportingManagerId: Uuid.nullable(),
    hasPhoto: zod_1.z.boolean(),
});
exports.OrgChart = zod_1.z.object({ nodes: zod_1.z.array(exports.OrgChartNode) });
//# sourceMappingURL=people-file.js.map