"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FAULT_APP_PATHS = exports.TenantFaultDetail = exports.TenantFaultList = exports.TenantFaultItem = exports.FaultDetail = exports.FaultEventView = exports.FaultPhotoView = exports.FaultListPage = exports.FaultCounts = exports.FaultListItem = exports.FaultAssigneeView = exports.FaultPhotoFields = exports.ReopenFaultRequest = exports.TenantFaultMessageRequest = exports.FaultMessageRequest = exports.AssignFaultRequest = exports.MoveFaultRequest = exports.RaiseFaultRequest = exports.ReportFaultRequest = exports.FaultListQuery = exports.FAULT_PAGE_SIZE = exports.FAULT_TAB_STATUSES = exports.FAULT_TAB_LABEL = exports.FaultTab = exports.FAULT_PHOTO_MAX_BYTES = exports.FAULT_PHOTOS_PER_PHASE = exports.FAULT_PHOTO_PHASE_LABEL = exports.FaultPhotoPhase = exports.FaultAssigneeKind = exports.FaultActorRole = exports.FAULT_URGENCY_LABEL = exports.FAULT_CATEGORY_LABEL = exports.REOPENABLE_STATUSES = exports.FAULT_REOPEN_DAYS = exports.FAULT_STATUS_TENANT = exports.FAULT_STATUS_LABEL = exports.TICKET_MOVES = exports.OPEN_TICKET_STATUSES = void 0;
exports.isOpenTicket = isOpenTicket;
exports.ticketMayMove = ticketMayMove;
exports.faultReopenUntil = faultReopenUntil;
exports.faultMoveWords = faultMoveWords;
exports.faultTabOf = faultTabOf;
const zod_1 = require("zod");
const ops_1 = require("../ops");
const phone_1 = require("../phone");
const primitives_1 = require("../primitives");
const dates_1 = require("./dates");
// ===========================================================================
// Faults: the one ticket lifecycle a rented home and a hotel share (WP 4.1)
// ===========================================================================
//
// A fault is a `maintenance_tickets` row, the same table a hotel work order
// is. Its chain is Reported, Seen, Assigned, In progress, Fixed, Closed, with
// "Won't fix" and "Cancelled" off any open state, and a way back to Reported:
// the landlord reopens a fixed, closed or refused fault, and the tenant does
// within 14 days of it being settled. The API is the only enforcer
// (`TicketLifecycle` in the operations module); this file is the rule both
// the API and the screens read, so a "Move to" menu offers only legal moves.
const IsoMoment = zod_1.z.string();
/** The states a fault is still being worked in. `wont_fix` and `cancelled` can be reached from any of them. */
exports.OPEN_TICKET_STATUSES = ["open", "acknowledged", "assigned", "in_progress"];
/** Is the ticket still being worked? */
function isOpenTicket(status) {
    return exports.OPEN_TICKET_STATUSES.includes(status);
}
/**
 * Which states a ticket may move to from each state, and nothing else.
 *
 * Forward along the chain, skipping steps (a landlord who fixes it the same
 * day goes from Reported to Fixed; a hotel order is assigned without being
 * "seen"); one step back inside the open states, to undo a mistaken press;
 * `wont_fix` and `cancelled` from any open state; and back to `open` from
 * Fixed, Closed and Won't fix (a reopen). `cancelled` is a ticket raised in
 * error and is final. Closing needs the fix first: Closed comes from Fixed.
 */
exports.TICKET_MOVES = {
    open: ["acknowledged", "assigned", "in_progress", "resolved", "wont_fix", "cancelled"],
    acknowledged: ["assigned", "in_progress", "resolved", "wont_fix", "cancelled"],
    assigned: ["acknowledged", "in_progress", "resolved", "wont_fix", "cancelled"],
    in_progress: ["assigned", "resolved", "wont_fix", "cancelled"],
    resolved: ["closed", "open"],
    closed: ["open"],
    wont_fix: ["open"],
    cancelled: [],
};
/** May a ticket go from `from` to `to`? Staying where it is is not a move. */
function ticketMayMove(from, to) {
    return exports.TICKET_MOVES[from].includes(to);
}
/** The landlord's words for each state. */
exports.FAULT_STATUS_LABEL = {
    open: "Reported",
    acknowledged: "Seen",
    assigned: "Assigned",
    in_progress: "In progress",
    resolved: "Fixed",
    closed: "Closed",
    wont_fix: "Won't fix",
    cancelled: "Cancelled",
};
/** The tenant's words for each state, as their list reads it. */
exports.FAULT_STATUS_TENANT = {
    open: "Reported",
    acknowledged: "Seen by your landlord",
    assigned: "Someone is assigned",
    in_progress: "Being fixed",
    resolved: "Fixed",
    closed: "Closed",
    wont_fix: "Won't be fixed",
    cancelled: "Cancelled",
};
/** How long after a fault is settled (fixed, closed or refused) the tenant may say it is not right. */
exports.FAULT_REOPEN_DAYS = 14;
/** The states a tenant may reopen. */
exports.REOPENABLE_STATUSES = ["resolved", "closed", "wont_fix"];
/**
 * The last Kigali day the tenant may reopen a fault settled at `resolvedAt`,
 * or null when it cannot be reopened (still open, cancelled, or the 14 days
 * have passed).
 */
function faultReopenUntil(status, resolvedAt, today = (0, dates_1.kigaliToday)()) {
    if (!exports.REOPENABLE_STATUSES.includes(status) || !resolvedAt)
        return null;
    const until = (0, dates_1.addDays)((0, dates_1.kigaliDateOf)(resolvedAt), exports.FAULT_REOPEN_DAYS);
    return today <= until ? until : null;
}
// --- Words --------------------------------------------------------------------
exports.FAULT_CATEGORY_LABEL = {
    plumbing: "Water and plumbing",
    electrical: "Electricity",
    hvac: "Heating or air",
    appliance: "Appliance",
    furniture: "Furniture",
    it_tech: "Internet or TV",
    safety: "Safety and security",
    other: "Something else",
    doors_windows: "Doors, windows and locks",
    decoration: "Walls and paint",
};
exports.FAULT_URGENCY_LABEL = {
    low: "Can wait",
    normal: "Soon",
    high: "Urgent",
    urgent: "Emergency",
};
/** Who did something on a fault's timeline. */
exports.FaultActorRole = zod_1.z.enum(["tenant", "landlord", "system"]);
/** Whom a fault is handed to: someone on the landlord's team, or an outside fixer. */
exports.FaultAssigneeKind = zod_1.z.enum(["member", "contractor"]);
/** When a photo was taken: with the report, while the work went on, or of the fix. */
exports.FaultPhotoPhase = zod_1.z.enum(["report", "progress", "fixed"]);
exports.FAULT_PHOTO_PHASE_LABEL = {
    report: "When reported",
    progress: "During the work",
    fixed: "After the fix",
};
/** At most this many photos in each phase. */
exports.FAULT_PHOTOS_PER_PHASE = 4;
/** One photo is at most 10 MB. */
exports.FAULT_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
/**
 * The sentence a timeline shows for a move, in plain words. `who` is the
 * assignee for an assignment ("Eric is assigned to fix it."). The tenant reads
 * the same sentence about their landlord.
 */
function faultMoveWords(to, opts = {}) {
    switch (to) {
        case "open":
            return opts.byTenant ? "Reopened: the tenant says it is not fixed." : opts.from ? "Reopened." : "Reported.";
        case "acknowledged":
            return "Your landlord has seen the report.";
        case "assigned":
            return opts.who ? `${opts.who} is assigned to fix it.` : "Someone is assigned to fix it.";
        case "in_progress":
            return "Work has started.";
        case "resolved":
            return "Marked fixed.";
        case "closed":
            return "Closed.";
        case "wont_fix":
            return "Your landlord won't fix this.";
        case "cancelled":
            return "Cancelled.";
    }
}
// --- Requests --------------------------------------------------------------------
/** Which faults a landlord's list shows. Reported is new (open or seen); In hand is assigned or being worked. */
exports.FaultTab = zod_1.z.enum(["open", "in_hand", "fixed", "closed"]);
exports.FAULT_TAB_LABEL = {
    open: "Reported",
    in_hand: "In hand",
    fixed: "Fixed",
    closed: "Closed",
};
exports.FAULT_TAB_STATUSES = {
    open: ["open", "acknowledged"],
    in_hand: ["assigned", "in_progress"],
    fixed: ["resolved"],
    closed: ["closed", "wont_fix", "cancelled"],
};
/** The tab a status sits under. */
function faultTabOf(status) {
    return Object.keys(exports.FAULT_TAB_STATUSES).find((tab) => exports.FAULT_TAB_STATUSES[tab].includes(status)) ?? "closed";
}
/** The fault list's page size. */
exports.FAULT_PAGE_SIZE = 25;
/** `GET /ops/faults?tab&unitId&q&page`. No tab: every fault. */
exports.FaultListQuery = zod_1.z.object({
    tab: exports.FaultTab.optional(),
    unitId: primitives_1.Uuid.optional(),
    q: zod_1.z.string().trim().max(120).optional(),
    page: zod_1.z.coerce.number().int().min(1).max(10000).default(1),
});
const FaultTitle = zod_1.z
    .string({ required_error: "Say what is wrong." })
    .trim()
    .min(3, "Say what is wrong in a few words.")
    .max(120, "Keep the title under 120 characters.");
const FaultDescription = zod_1.z
    .string()
    .trim()
    .max(2000, "Keep it under 2000 characters.")
    .optional()
    .transform((v) => (v ? v : undefined));
/** `true`, `false`, `"true"`, `"false"`, `"on"`: a checkbox from a form or a JSON body. */
const FormBoolean = zod_1.z.preprocess((v) => {
    if (v === "true" || v === "on" || v === "1" || v === "yes")
        return true;
    if (v === "false" || v === "0" || v === "no" || v === "")
        return false;
    return v;
}, zod_1.z.boolean());
/** The tenant reports a fault on their home (photos come as files beside these fields). */
exports.ReportFaultRequest = zod_1.z.object({
    title: FaultTitle,
    category: ops_1.MaintenanceCategory.default("other"),
    description: FaultDescription,
    urgency: ops_1.MaintenancePriority.default("normal"),
    /** May someone let themselves in when nobody is home? */
    staffMayEnter: FormBoolean.default(false),
});
/** The landlord writes down a fault on a unit: one a tenant phoned in, or one found on a visit. */
exports.RaiseFaultRequest = zod_1.z.object({
    unitId: primitives_1.Uuid,
    title: FaultTitle,
    category: ops_1.MaintenanceCategory.default("other"),
    description: FaultDescription,
    urgency: ops_1.MaintenancePriority.default("normal"),
    staffMayEnter: FormBoolean.optional(),
});
const FaultNote = zod_1.z
    .string()
    .trim()
    .max(1000, "Keep it under 1000 characters.")
    .optional()
    .transform((v) => (v ? v : undefined));
/** Move a fault along its chain. "Won't fix" needs the reason, which the tenant is told. */
exports.MoveFaultRequest = zod_1.z
    .object({
    to: ops_1.MaintenanceStatus,
    note: FaultNote,
})
    .superRefine((v, ctx) => {
    if (v.to === "wont_fix" && (!v.note || v.note.length < 3)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["note"], message: "Say why it won't be fixed. The tenant is told." });
    }
});
/** Hand a fault to someone on the team, or to an outside fixer with their phone. */
exports.AssignFaultRequest = zod_1.z
    .object({
    memberUserId: primitives_1.Uuid.optional(),
    contractorName: zod_1.z
        .string()
        .trim()
        .max(120, "Keep the name under 120 characters.")
        .optional()
        .transform((v) => (v ? v : undefined)),
    contractorPhone: phone_1.RwPhoneNumber.optional(),
    note: FaultNote,
})
    .superRefine((v, ctx) => {
    const member = Boolean(v.memberUserId);
    const contractor = Boolean(v.contractorName || v.contractorPhone);
    if (member === contractor) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["memberUserId"], message: "Pick someone on your team, or name a fixer." });
        return;
    }
    if (contractor && (!v.contractorName || v.contractorName.length < 2)) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["contractorName"], message: "Enter the fixer's name." });
    }
    if (contractor && !v.contractorPhone) {
        ctx.addIssue({ code: zod_1.z.ZodIssueCode.custom, path: ["contractorPhone"], message: "Enter the fixer's phone, like 0788 123 456." });
    }
});
const MessageBody = zod_1.z
    .string({ required_error: "Write a message." })
    .trim()
    .min(1, "Write a message.")
    .max(2000, "Keep it under 2000 characters.");
/** A landlord's message on a fault: a reply the tenant sees, or a note for the team only. */
exports.FaultMessageRequest = zod_1.z.object({
    body: MessageBody,
    visibleToTenant: FormBoolean.default(true),
});
/** The tenant's message on their fault. */
exports.TenantFaultMessageRequest = zod_1.z.object({ body: MessageBody });
/** The tenant says the fix did not hold, or asks again after "won't fix". */
exports.ReopenFaultRequest = zod_1.z.object({
    reason: zod_1.z
        .string({ required_error: "Say what is still wrong." })
        .trim()
        .min(3, "Say what is still wrong.")
        .max(1000, "Keep it under 1000 characters."),
});
/** `POST …/photos`: which phase the files are of (the files themselves are multipart). */
exports.FaultPhotoFields = zod_1.z.object({ phase: exports.FaultPhotoPhase.default("report") });
// --- Views -------------------------------------------------------------------------
/** Whoever is fixing it. The phone is the landlord's to see; the tenant gets the name. */
exports.FaultAssigneeView = zod_1.z.object({
    kind: exports.FaultAssigneeKind,
    userId: primitives_1.Uuid.nullable(),
    name: zod_1.z.string(),
    phone: zod_1.z.string().nullable(),
});
/** One row of the landlord's fault list. */
exports.FaultListItem = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string().nullable(),
    title: zod_1.z.string(),
    category: ops_1.MaintenanceCategory.nullable(),
    urgency: ops_1.MaintenancePriority,
    status: ops_1.MaintenanceStatus,
    tab: exports.FaultTab,
    unitId: primitives_1.Uuid.nullable(),
    unitLabel: zod_1.z.string().nullable(),
    propertyId: primitives_1.Uuid.nullable(),
    propertyName: zod_1.z.string().nullable(),
    leaseId: primitives_1.Uuid.nullable(),
    leaseReference: zod_1.z.string().nullable(),
    tenantName: zod_1.z.string().nullable(),
    /** Who reported it: the tenant from their home, or the landlord's side. */
    reportedBy: zod_1.z.enum(["tenant", "landlord"]),
    reportedAt: IsoMoment,
    updatedAt: IsoMoment,
    assigneeName: zod_1.z.string().nullable(),
    photoCount: zod_1.z.number().int(),
});
exports.FaultCounts = zod_1.z.record(exports.FaultTab, zod_1.z.number().int());
exports.FaultListPage = zod_1.z.object({
    items: zod_1.z.array(exports.FaultListItem),
    total: zod_1.z.number().int(),
    page: zod_1.z.number().int().min(1),
    pageSize: zod_1.z.number().int(),
    tab: exports.FaultTab.nullable(),
    counts: exports.FaultCounts,
});
exports.FaultPhotoView = zod_1.z.object({
    id: primitives_1.Uuid,
    url: zod_1.z.string(),
    phase: exports.FaultPhotoPhase,
    position: zod_1.z.number().int(),
    byTenant: zod_1.z.boolean(),
    uploadedAt: IsoMoment,
});
/** One line of a fault's timeline. `words` is the plain sentence; `note` is what the person wrote. */
exports.FaultEventView = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: zod_1.z.string(),
    from: ops_1.MaintenanceStatus.nullable(),
    to: ops_1.MaintenanceStatus.nullable(),
    words: zod_1.z.string(),
    note: zod_1.z.string().nullable(),
    actorName: zod_1.z.string().nullable(),
    actorRole: exports.FaultActorRole,
    visibleToTenant: zod_1.z.boolean(),
    at: IsoMoment,
});
/** One fault in full, for the landlord's side panel. */
exports.FaultDetail = exports.FaultListItem.extend({
    description: zod_1.z.string().nullable(),
    staffMayEnter: zod_1.z.boolean().nullable(),
    assignee: exports.FaultAssigneeView.nullable(),
    acknowledgedAt: IsoMoment.nullable(),
    resolvedAt: IsoMoment.nullable(),
    wontFixReason: zod_1.z.string().nullable(),
    reopenedCount: zod_1.z.number().int(),
    /** The last day the tenant may reopen it, while they still may. */
    reopenUntil: zod_1.z.string().nullable(),
    /** The moves the "Move to" menu offers: only the legal ones. */
    allowedMoves: zod_1.z.array(ops_1.MaintenanceStatus),
    /** The Kigali day it was reported: a payment for it cannot be dated before it. */
    reportedOn: zod_1.z.string(),
    photos: zod_1.z.array(exports.FaultPhotoView),
    events: zod_1.z.array(exports.FaultEventView),
});
/** One of the tenant's faults: no money, no team notes, no fixer's phone. */
exports.TenantFaultItem = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string().nullable(),
    title: zod_1.z.string(),
    category: ops_1.MaintenanceCategory.nullable(),
    urgency: ops_1.MaintenancePriority,
    status: ops_1.MaintenanceStatus,
    statusWords: zod_1.z.string(),
    reportedAt: IsoMoment,
    updatedAt: IsoMoment,
    assigneeName: zod_1.z.string().nullable(),
    photoCount: zod_1.z.number().int(),
    reopenUntil: zod_1.z.string().nullable(),
});
exports.TenantFaultList = zod_1.z.object({ items: zod_1.z.array(exports.TenantFaultItem) });
exports.TenantFaultDetail = exports.TenantFaultItem.extend({
    description: zod_1.z.string().nullable(),
    staffMayEnter: zod_1.z.boolean().nullable(),
    wontFixReason: zod_1.z.string().nullable(),
    canReopen: zod_1.z.boolean(),
    photos: zod_1.z.array(exports.FaultPhotoView),
    /** Only what the tenant may see. */
    events: zod_1.z.array(exports.FaultEventView),
});
/** The app's fault pages a mail opens. */
exports.FAULT_APP_PATHS = {
    tenantFaults: (leaseId) => `/home/${encodeURIComponent(leaseId)}/faults`,
    landlordFault: (ticketId) => `/faults/${encodeURIComponent(ticketId)}`,
};
//# sourceMappingURL=faults.js.map