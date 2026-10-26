"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NextPublicHoliday = exports.LeaveApproverList = exports.LeaveApprovalStep = exports.LeaveApproversQuery = exports.MyDocumentList = exports.MyDocument = exports.ResolveWorkOrderRequest = exports.WorkOrderTimerRequest = exports.WorkOrderTimeLogList = exports.WorkOrderTimeLog = exports.WorkOrderTimeKind = exports.HousekeepingPhone = exports.PhonePlace = exports.PhoneArrival = exports.PhoneFoundItem = exports.LogPhoneFoundItemRequest = exports.SendMinibarCountRequest = exports.MinibarCount = exports.MinibarStockItem = exports.InspectionCheckVerdict = exports.SetHousekeepingCheckRequest = exports.HousekeepingTaskCheck = exports.HousekeepingCheckResult = exports.HousekeepingChecklistItem = exports.HousekeepingChecklistKind = void 0;
const zod_1 = require("zod");
const lost_found_1 = require("./lost-found");
const primitives_1 = require("./primitives");
/**
 * The staff phone (real-data leaf 1.3.3): what a housekeeper, the housekeeping supervisor and the
 * maintenance technician read and record from their phones, beside the housekeeping board
 * (`housekeeping-board.ts`) and the work orders (`maintenance.ts`) they share with the office.
 *
 * Operator routes (`/ops/housekeeping/phone`, `/ops/housekeeping/tasks/:id/…`, `/ops/work-orders/:id/…`)
 * sit behind the same permissions as the boards they extend. Self routes (`/me/work/:employeeId/…`) are
 * `SessionGuard` only: the person's own file is the guard, and any other id is a 404.
 */
const IsoDate = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A date is YYYY-MM-DD.");
// ---------------------------------------------------------------------------
// Checklists
// ---------------------------------------------------------------------------
exports.HousekeepingChecklistKind = zod_1.z.enum(["cleaning", "inspection"]);
exports.HousekeepingChecklistItem = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: exports.HousekeepingChecklistKind,
    sectionCode: zod_1.z.string(),
    sectionTitle: zod_1.z.string(),
    code: zod_1.z.string(),
    label: zod_1.z.string(),
    requiresPhoto: zod_1.z.boolean(),
    sortOrder: zod_1.z.number().int(),
});
exports.HousekeepingCheckResult = zod_1.z.enum(["done", "pass", "fail"]);
/** The result one checklist item got on one task. */
exports.HousekeepingTaskCheck = zod_1.z.object({
    taskId: primitives_1.Uuid,
    itemId: primitives_1.Uuid,
    result: exports.HousekeepingCheckResult,
    photoObjectKey: zod_1.z.string().nullable(),
    checkedByName: zod_1.z.string().nullable(),
    checkedAt: zod_1.z.string(),
});
/** `POST /ops/housekeeping/tasks/:id/checks`: tick (or untick) one cleaning step. */
exports.SetHousekeepingCheckRequest = zod_1.z.object({
    itemId: primitives_1.Uuid,
    done: zod_1.z.boolean(),
});
/** One inspection check's verdict, sent with the inspection decision. */
exports.InspectionCheckVerdict = zod_1.z.object({
    itemId: primitives_1.Uuid,
    result: zod_1.z.enum(["pass", "fail"]),
    photoObjectKey: zod_1.z.string().trim().max(500).optional(),
});
// ---------------------------------------------------------------------------
// Minibar
// ---------------------------------------------------------------------------
exports.MinibarStockItem = zod_1.z.object({
    id: primitives_1.Uuid,
    code: zod_1.z.string(),
    label: zod_1.z.string(),
    /** How many a room is stocked with. */
    parLevel: zod_1.z.number().int(),
    sortOrder: zod_1.z.number().int(),
});
exports.MinibarCount = zod_1.z.object({
    taskId: primitives_1.Uuid,
    itemId: primitives_1.Uuid,
    parLevel: zod_1.z.number().int(),
    used: zod_1.z.number().int(),
    countedByName: zod_1.z.string().nullable(),
    countedAt: zod_1.z.string(),
});
/**
 * `POST /ops/housekeeping/tasks/:id/minibar`: what was used, one line per item. Sending again replaces
 * the count. A report for the front desk, never a charge.
 */
exports.SendMinibarCountRequest = zod_1.z.object({
    counts: zod_1.z
        .array(zod_1.z.object({ itemId: primitives_1.Uuid, used: zod_1.z.number().int().min(0).max(99) }))
        .min(1, "Count at least one item.")
        .max(50),
});
// ---------------------------------------------------------------------------
// Found items, logged from the room being cleaned
// ---------------------------------------------------------------------------
/**
 * `POST /ops/housekeeping/tasks/:id/found-items`: the cleaner logs what she found in the task's room.
 * It goes into the lost and found register (`found_items`) with her as the finder and today's
 * supervisor as the custodian it is handed to; the register itself stays `lostfound.manage`'s.
 */
exports.LogPhoneFoundItemRequest = zod_1.z.object({
    description: zod_1.z.string().trim().min(1, "Say what it is.").max(300),
    /** Where in the room: "bedside drawer". */
    spot: zod_1.z.string().trim().min(1).max(200),
    /** What kind of thing it is; "other" when the phone does not ask. Valuables are never logged from the phone. */
    category: lost_found_1.FoundItemCategory.optional(),
    photoCount: zod_1.z.number().int().min(0).max(20).optional(),
});
/** An item the caller found, as the phone shows it. */
exports.PhoneFoundItem = zod_1.z.object({
    id: primitives_1.Uuid,
    reference: zod_1.z.string(),
    description: zod_1.z.string(),
    roomLabel: zod_1.z.string().nullable(),
    foundLocation: zod_1.z.string(),
    foundSpot: zod_1.z.string().nullable(),
    foundAt: zod_1.z.string(),
    category: zod_1.z.string(),
    photoCount: zod_1.z.number().int(),
    custodianName: zod_1.z.string().nullable(),
    status: zod_1.z.string(),
});
// ---------------------------------------------------------------------------
// The phone's read
// ---------------------------------------------------------------------------
/** A booking arriving today into a room, with its party size (the board names the guest only). */
exports.PhoneArrival = zod_1.z.object({
    roomId: primitives_1.Uuid,
    guests: zod_1.z.number().int(),
});
/** A place on the caller's floors that is not a room ("Corridor F2"), for reporting a fault. */
exports.PhonePlace = zod_1.z.object({
    spaceId: primitives_1.Uuid,
    name: zod_1.z.string(),
    floor: zod_1.z.number().int().nullable(),
});
/**
 * `GET /ops/housekeeping/phone`: the property's checklists, the results its open and today's tasks
 * got, the minibar stock and counts, today's arrivals' party sizes, the spaces on the caller's
 * floors, today's supervisor and the items the caller found. Read beside the housekeeping board.
 */
exports.HousekeepingPhone = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    checklist: zod_1.z.array(exports.HousekeepingChecklistItem),
    checks: zod_1.z.array(exports.HousekeepingTaskCheck),
    minibarItems: zod_1.z.array(exports.MinibarStockItem),
    minibarCounts: zod_1.z.array(exports.MinibarCount),
    arrivals: zod_1.z.array(exports.PhoneArrival),
    /** The floors today's allocation sheet gives the caller (empty when they are not on it). */
    myFloors: zod_1.z.array(zod_1.z.number().int()),
    places: zod_1.z.array(exports.PhonePlace),
    supervisor: zod_1.z.object({ userId: primitives_1.Uuid, name: zod_1.z.string() }).nullable(),
    /** Newest first: what the caller found and logged in the last thirty days. */
    foundItems: zod_1.z.array(exports.PhoneFoundItem),
});
// ---------------------------------------------------------------------------
// Time on a work order
// ---------------------------------------------------------------------------
exports.WorkOrderTimeKind = zod_1.z.enum(["diagnosis", "repair"]);
exports.WorkOrderTimeLog = zod_1.z.object({
    id: primitives_1.Uuid,
    ticketId: primitives_1.Uuid,
    userId: primitives_1.Uuid,
    userName: zod_1.z.string().nullable(),
    kind: exports.WorkOrderTimeKind,
    startedAt: zod_1.z.string(),
    /** Null while the timer runs. */
    endedAt: zod_1.z.string().nullable(),
});
/** `GET /ops/maintenance-time-logs`: the sessions on the workspace's open orders (and those closed this week). */
exports.WorkOrderTimeLogList = zod_1.z.object({ logs: zod_1.z.array(exports.WorkOrderTimeLog) });
/** `POST /ops/work-orders/:id/timer`: start or stop the caller's own session. */
exports.WorkOrderTimerRequest = zod_1.z.object({ running: zod_1.z.boolean() });
/**
 * `POST /ops/work-orders/:id/resolve`: what was done, and, for a room taken off sale, whether the
 * technician asks for it to go back on sale. Asking never releases it: housekeeping inspects and a
 * manager releases (`listing.manage`).
 */
exports.ResolveWorkOrderRequest = zod_1.z.object({
    fix: zod_1.z.string().trim().min(1, "Say what you did.").max(2000),
    askRelease: zod_1.z.boolean().default(false),
});
// ---------------------------------------------------------------------------
// Self service: documents, who approves leave
// ---------------------------------------------------------------------------
/** One of the person's own papers: their contract, or a document kept on their file. */
exports.MyDocument = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: zod_1.z.enum(["contract", "document"]),
    title: zod_1.z.string(),
    /** A document's state (requested, submitted, approved, rejected), or the contract's (active, …). */
    status: zod_1.z.string(),
    contractType: zod_1.z.string().nullable(),
    startsOn: IsoDate.nullable(),
    issuedOn: IsoDate.nullable(),
    expiresOn: IsoDate.nullable(),
    /** When HR last acted on it (approved a document). */
    checkedAt: zod_1.z.string().nullable(),
});
/** `GET /me/work/:employeeId/documents`. */
exports.MyDocumentList = zod_1.z.object({ documents: zod_1.z.array(exports.MyDocument) });
exports.LeaveApproversQuery = zod_1.z.object({ leaveTypeId: primitives_1.Uuid.optional() });
/** One step of the approval a leave request will go through, and who decides it. */
exports.LeaveApprovalStep = zod_1.z.object({
    order: zod_1.z.number().int(),
    /** `line_manager` (the reporting manager) or `office` (whoever holds `leave.approve`, HR first). */
    role: zod_1.z.enum(["line_manager", "office"]),
    name: zod_1.z.string(),
    jobTitle: zod_1.z.string().nullable(),
});
/** `GET /me/work/:employeeId/leave/approvers`: before asking, who will decide. */
exports.LeaveApproverList = zod_1.z.object({ steps: zod_1.z.array(exports.LeaveApprovalStep) });
/**
 * `GET /me/work/:employeeId/holidays/next`: the next national public holiday from today, read from the
 * recorded rule (`hr.rw.public_holidays`). Null when this year's and next year's are not recorded.
 */
exports.NextPublicHoliday = zod_1.z.object({
    holiday: zod_1.z.object({ date: IsoDate, name: zod_1.z.string() }).nullable(),
});
//# sourceMappingURL=staff-phone.js.map