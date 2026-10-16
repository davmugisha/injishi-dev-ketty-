"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DismissConditionSignalRequest = exports.ConditionSignalList = exports.ConditionSignal = exports.ConditionSignalDraft = exports.ConditionSignalStatus = exports.ConditionSignalConfidence = exports.ReleaseRoomRequest = exports.DecideRoomBlockRequest = exports.AddWorkOrderNoteRequest = exports.AssignWorkOrderRequest = exports.CreateWorkOrderRequest = exports.WorkOrderList = exports.WorkOrderAssignee = exports.WorkOrder = exports.WorkOrderPhoto = exports.WorkOrderBlock = exports.WorkOrderEvent = exports.WorkOrderPart = exports.WorkOrderPartState = exports.WorkOrderEventKind = exports.RoomBlockStatus = void 0;
const zod_1 = require("zod");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
/**
 * The hotel's maintenance board (`/api/v1/ops/work-orders`, `/api/v1/ops/condition-signals`):
 * work orders against a room, a space or a piece of equipment, the out-of-order blocks that take a
 * room off sale while it is repaired, and the condition signals that recommend work.
 *
 * A work order IS a `maintenance_tickets` row (one board for a hotel and a rented building); this
 * is the hotel's richer projection of it: a human reference, an assignee, parts, a timeline and the
 * room block. Residence tickets stay on `/ops/tickets`.
 */
/** A room's out-of-order block: requested by whoever works the order, decided by a manager. */
exports.RoomBlockStatus = zod_1.z.enum(["requested", "active", "declined", "released"]);
exports.WorkOrderEventKind = zod_1.z.enum([
    "reported",
    "assigned",
    "block_requested",
    "block_approved",
    "block_declined",
    "block_released",
    "parts",
    "scheduled",
    "started",
    "note",
    "next_step",
    "fixed",
    "verified",
    "from_signal",
    "planned",
]);
exports.WorkOrderPartState = zod_1.z.enum(["requested", "ordered", "issued", "contractor"]);
exports.WorkOrderPart = zod_1.z.object({
    id: primitives_1.Uuid,
    name: zod_1.z.string(),
    quantity: zod_1.z.number(),
    unit: zod_1.z.string().nullable(),
    /** Where it comes from, in words: "Store · issued by …", "PO-26-0147 · due 13 Oct". */
    source: zod_1.z.string(),
    state: exports.WorkOrderPartState,
});
exports.WorkOrderEvent = zod_1.z.object({
    id: primitives_1.Uuid,
    kind: exports.WorkOrderEventKind,
    note: zod_1.z.string().nullable(),
    actorName: zod_1.z.string().nullable(),
    occurredAt: zod_1.z.string(),
});
exports.WorkOrderBlock = zod_1.z.object({
    id: primitives_1.Uuid,
    status: exports.RoomBlockStatus,
    startsAt: zod_1.z.string(),
    /** Null: until released. */
    endsAt: zod_1.z.string().nullable(),
    reason: zod_1.z.string(),
    requestedByName: zod_1.z.string().nullable(),
    requestedAt: zod_1.z.string(),
    decidedByName: zod_1.z.string().nullable(),
    decidedAt: zod_1.z.string().nullable(),
    decisionNote: zod_1.z.string().nullable(),
    releasedByName: zod_1.z.string().nullable(),
    releasedAt: zod_1.z.string().nullable(),
    /** Reservations holding the room inside the block's dates (they would need another room). */
    affectedReservations: zod_1.z.number().int().nonnegative(),
});
exports.WorkOrderPhoto = zod_1.z.object({ key: zod_1.z.string(), caption: zod_1.z.string() });
exports.WorkOrder = zod_1.z.object({
    id: primitives_1.Uuid,
    /** "WO-318": what people say on the radio. Unique per business. */
    reference: zod_1.z.string(),
    propertyId: primitives_1.Uuid.nullable(),
    roomId: primitives_1.Uuid.nullable(),
    roomLabel: zod_1.z.string().nullable(),
    roomTypeName: zod_1.z.string().nullable(),
    floor: zod_1.z.number().int().nullable(),
    spaceId: primitives_1.Uuid.nullable(),
    spaceName: zod_1.z.string().nullable(),
    assetId: primitives_1.Uuid.nullable(),
    assetName: zod_1.z.string().nullable(),
    title: zod_1.z.string(),
    description: zod_1.z.string().nullable(),
    category: ops_1.MaintenanceCategory.nullable(),
    priority: ops_1.MaintenancePriority,
    status: ops_1.MaintenanceStatus,
    assignedToUserId: primitives_1.Uuid.nullable(),
    assignedToName: zod_1.z.string().nullable(),
    /** An outside firm doing the work, when no staff member is. */
    assignedContractor: zod_1.z.string().nullable(),
    scheduledFor: zod_1.z.string().nullable(),
    raisedByName: zod_1.z.string().nullable(),
    /** How it reached us: "staff app", "front desk · guest complaint", "planned schedule". */
    raisedVia: zod_1.z.string().nullable(),
    raisedAt: zod_1.z.string(),
    /** What the fault means for the operation while it is open ("Lake Bar keeps trading …"). */
    impactNote: zod_1.z.string().nullable(),
    /** What has to be true before the room goes back on sale. */
    releaseNote: zod_1.z.string().nullable(),
    photos: zod_1.z.array(exports.WorkOrderPhoto),
    parts: zod_1.z.array(exports.WorkOrderPart),
    /** Oldest first. */
    events: zod_1.z.array(exports.WorkOrderEvent),
    /** The latest block on the room for this order (any status), or null. */
    block: exports.WorkOrderBlock.nullable(),
    resolvedAt: zod_1.z.string().nullable(),
    verifiedAt: zod_1.z.string().nullable(),
});
exports.WorkOrderAssignee = zod_1.z.object({ userId: primitives_1.Uuid.nullable(), name: zod_1.z.string() });
exports.WorkOrderList = zod_1.z.object({
    workOrders: zod_1.z.array(exports.WorkOrder),
    /** People and firms who have worked orders here: who "Assign to …" can name. */
    assignees: zod_1.z.array(exports.WorkOrderAssignee),
    /** Who usually takes the work: the staff member with the most orders in the last 30 days. */
    suggestedAssignee: exports.WorkOrderAssignee.nullable(),
    /** Median hours from report to fixed, over orders closed in the last 30 days. */
    medianHoursToClose: zod_1.z.number().nullable(),
});
/** Exactly one of a staff member or an outside firm. */
const Assignee = zod_1.z
    .object({ userId: primitives_1.Uuid.optional(), contractor: zod_1.z.string().trim().min(1).max(120).optional() })
    .refine((v) => Boolean(v.userId) !== Boolean(v.contractor), {
    message: "Name a staff member or a contractor, not both.",
});
exports.CreateWorkOrderRequest = zod_1.z.object({
    /**
     * Where the fault is, as people say it: "Room 302", "Lake Bar", "Generator". The server resolves
     * it to a room, a space or a piece of equipment of the property, and refuses a place it does not
     * know rather than inventing one.
     */
    location: zod_1.z.string().trim().min(1).max(120),
    propertyId: primitives_1.Uuid.optional(),
    title: zod_1.z.string().trim().min(1).max(200),
    description: zod_1.z.string().trim().max(2000).optional(),
    category: ops_1.MaintenanceCategory.optional(),
    priority: ops_1.MaintenancePriority.default("normal"),
    assignee: Assignee.optional(),
    /** Ask for the room to come off sale while the work is done (rooms only). Needs a manager's approval. */
    requestBlock: zod_1.z.object({ reason: zod_1.z.string().trim().min(1).max(300) }).optional(),
});
exports.AssignWorkOrderRequest = Assignee;
exports.AddWorkOrderNoteRequest = zod_1.z.object({ note: zod_1.z.string().trim().min(1).max(2000) });
exports.DecideRoomBlockRequest = zod_1.z.object({
    decision: zod_1.z.enum(["approve", "decline"]),
    note: zod_1.z.string().trim().max(300).optional(),
});
exports.ReleaseRoomRequest = zod_1.z.object({ note: zod_1.z.string().trim().max(300).optional() });
// ---------------------------------------------------------------------------
// Condition signals: rules over equipment readings that RECOMMEND work. People decide.
// ---------------------------------------------------------------------------
exports.ConditionSignalConfidence = zod_1.z.enum(["high", "medium", "low"]);
exports.ConditionSignalStatus = zod_1.z.enum(["open", "actioned", "dismissed"]);
/** The work order a signal proposes, as the manager will see it before creating it. */
exports.ConditionSignalDraft = zod_1.z.object({
    title: zod_1.z.string(),
    description: zod_1.z.string(),
    priority: ops_1.MaintenancePriority,
    location: zod_1.z.string(),
});
exports.ConditionSignal = zod_1.z.object({
    id: primitives_1.Uuid,
    ruleCode: zod_1.z.string(),
    ruleText: zod_1.z.string(),
    assetId: primitives_1.Uuid.nullable(),
    assetName: zod_1.z.string(),
    headline: zod_1.z.string(),
    confidence: exports.ConditionSignalConfidence,
    evidence: zod_1.z.array(zod_1.z.string()),
    dataQuality: zod_1.z.string(),
    recommendation: zod_1.z.string(),
    status: exports.ConditionSignalStatus,
    draft: exports.ConditionSignalDraft.nullable(),
    workOrderId: primitives_1.Uuid.nullable(),
    workOrderReference: zod_1.z.string().nullable(),
    raisedAt: zod_1.z.string(),
    reviewedByName: zod_1.z.string().nullable(),
    reviewedAt: zod_1.z.string().nullable(),
    reviewNote: zod_1.z.string().nullable(),
});
exports.ConditionSignalList = zod_1.z.object({ signals: zod_1.z.array(exports.ConditionSignal) });
exports.DismissConditionSignalRequest = zod_1.z.object({ reason: zod_1.z.string().trim().min(1).max(300) });
//# sourceMappingURL=maintenance.js.map