import { z } from "zod";
import { MaintenanceCategory, MaintenancePriority, MaintenanceStatus } from "./ops";
import { Uuid } from "./primitives";

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
export const RoomBlockStatus = z.enum(["requested", "active", "declined", "released"]);
export type RoomBlockStatus = z.infer<typeof RoomBlockStatus>;

export const WorkOrderEventKind = z.enum([
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
    // Rentals P4 (migration 0087): the steps of the shared ticket lifecycle a
    // hotel order never takes, and the fixer being paid.
    "acknowledged",
    "wont_fix",
    "reopened",
    "paid",
    "closed",
    "cancelled",
]);
export type WorkOrderEventKind = z.infer<typeof WorkOrderEventKind>;

export const WorkOrderPartState = z.enum(["requested", "ordered", "issued", "contractor"]);
export type WorkOrderPartState = z.infer<typeof WorkOrderPartState>;

export const WorkOrderPart = z.object({
    id: Uuid,
    name: z.string(),
    quantity: z.number(),
    unit: z.string().nullable(),
    /** Where it comes from, in words: "Store · issued by …", "PO-26-0147 · due 13 Oct". */
    source: z.string(),
    state: WorkOrderPartState,
});
export type WorkOrderPart = z.infer<typeof WorkOrderPart>;

export const WorkOrderEvent = z.object({
    id: Uuid,
    kind: WorkOrderEventKind,
    note: z.string().nullable(),
    actorName: z.string().nullable(),
    occurredAt: z.string(),
});
export type WorkOrderEvent = z.infer<typeof WorkOrderEvent>;

export const WorkOrderBlock = z.object({
    id: Uuid,
    status: RoomBlockStatus,
    startsAt: z.string(),
    /** Null: until released. */
    endsAt: z.string().nullable(),
    reason: z.string(),
    requestedByName: z.string().nullable(),
    requestedAt: z.string(),
    decidedByName: z.string().nullable(),
    decidedAt: z.string().nullable(),
    decisionNote: z.string().nullable(),
    releasedByName: z.string().nullable(),
    releasedAt: z.string().nullable(),
    /** Reservations holding the room inside the block's dates (they would need another room). */
    affectedReservations: z.number().int().nonnegative(),
});
export type WorkOrderBlock = z.infer<typeof WorkOrderBlock>;

export const WorkOrderPhoto = z.object({ key: z.string(), caption: z.string() });
export type WorkOrderPhoto = z.infer<typeof WorkOrderPhoto>;

export const WorkOrder = z.object({
    id: Uuid,
    /** "WO-318": what people say on the radio. Unique per business. */
    reference: z.string(),
    propertyId: Uuid.nullable(),
    roomId: Uuid.nullable(),
    roomLabel: z.string().nullable(),
    roomTypeName: z.string().nullable(),
    floor: z.number().int().nullable(),
    spaceId: Uuid.nullable(),
    spaceName: z.string().nullable(),
    assetId: Uuid.nullable(),
    assetName: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    category: MaintenanceCategory.nullable(),
    priority: MaintenancePriority,
    status: MaintenanceStatus,
    assignedToUserId: Uuid.nullable(),
    assignedToName: z.string().nullable(),
    /** An outside firm doing the work, when no staff member is. */
    assignedContractor: z.string().nullable(),
    scheduledFor: z.string().nullable(),
    raisedByName: z.string().nullable(),
    /** How it reached us: "staff app", "front desk · guest complaint", "planned schedule". */
    raisedVia: z.string().nullable(),
    raisedAt: z.string(),
    /** What the fault means for the operation while it is open ("Lake Bar keeps trading …"). */
    impactNote: z.string().nullable(),
    /** What has to be true before the room goes back on sale. */
    releaseNote: z.string().nullable(),
    photos: z.array(WorkOrderPhoto),
    parts: z.array(WorkOrderPart),
    /** Oldest first. */
    events: z.array(WorkOrderEvent),
    /** The latest block on the room for this order (any status), or null. */
    block: WorkOrderBlock.nullable(),
    resolvedAt: z.string().nullable(),
    verifiedAt: z.string().nullable(),
});
export type WorkOrder = z.infer<typeof WorkOrder>;

export const WorkOrderAssignee = z.object({ userId: Uuid.nullable(), name: z.string() });
export type WorkOrderAssignee = z.infer<typeof WorkOrderAssignee>;

export const WorkOrderList = z.object({
    workOrders: z.array(WorkOrder),
    /** People and firms who have worked orders here: who "Assign to …" can name. */
    assignees: z.array(WorkOrderAssignee),
    /** Who usually takes the work: the staff member with the most orders in the last 30 days. */
    suggestedAssignee: WorkOrderAssignee.nullable(),
    /** Median hours from report to fixed, over orders closed in the last 30 days. */
    medianHoursToClose: z.number().nullable(),
});
export type WorkOrderList = z.infer<typeof WorkOrderList>;

/** Exactly one of a staff member or an outside firm. */
const Assignee = z
    .object({ userId: Uuid.optional(), contractor: z.string().trim().min(1).max(120).optional() })
    .refine((v) => Boolean(v.userId) !== Boolean(v.contractor), {
        message: "Name a staff member or a contractor, not both.",
    });

export const CreateWorkOrderRequest = z.object({
    /**
     * Where the fault is, as people say it: "Room 302", "Lake Bar", "Generator". The server resolves
     * it to a room, a space or a piece of equipment of the property, and refuses a place it does not
     * know rather than inventing one.
     */
    location: z.string().trim().min(1).max(120),
    propertyId: Uuid.optional(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    category: MaintenanceCategory.optional(),
    priority: MaintenancePriority.default("normal"),
    assignee: Assignee.optional(),
    /** Ask for the room to come off sale while the work is done (rooms only). Needs a manager's approval. */
    requestBlock: z.object({ reason: z.string().trim().min(1).max(300) }).optional(),
});
export type CreateWorkOrderRequest = z.infer<typeof CreateWorkOrderRequest>;

export const AssignWorkOrderRequest = Assignee;
export type AssignWorkOrderRequest = z.infer<typeof AssignWorkOrderRequest>;

export const AddWorkOrderNoteRequest = z.object({ note: z.string().trim().min(1).max(2000) });
export type AddWorkOrderNoteRequest = z.infer<typeof AddWorkOrderNoteRequest>;

export const DecideRoomBlockRequest = z.object({
    decision: z.enum(["approve", "decline"]),
    note: z.string().trim().max(300).optional(),
});
export type DecideRoomBlockRequest = z.infer<typeof DecideRoomBlockRequest>;

export const ReleaseRoomRequest = z.object({ note: z.string().trim().max(300).optional() });
export type ReleaseRoomRequest = z.infer<typeof ReleaseRoomRequest>;

// ---------------------------------------------------------------------------
// Condition signals: rules over equipment readings that RECOMMEND work. People decide.
// ---------------------------------------------------------------------------

export const ConditionSignalConfidence = z.enum(["high", "medium", "low"]);
export type ConditionSignalConfidence = z.infer<typeof ConditionSignalConfidence>;
export const ConditionSignalStatus = z.enum(["open", "actioned", "dismissed"]);
export type ConditionSignalStatus = z.infer<typeof ConditionSignalStatus>;

/** The work order a signal proposes, as the manager will see it before creating it. */
export const ConditionSignalDraft = z.object({
    title: z.string(),
    description: z.string(),
    priority: MaintenancePriority,
    location: z.string(),
});
export type ConditionSignalDraft = z.infer<typeof ConditionSignalDraft>;

export const ConditionSignal = z.object({
    id: Uuid,
    ruleCode: z.string(),
    ruleText: z.string(),
    assetId: Uuid.nullable(),
    assetName: z.string(),
    headline: z.string(),
    confidence: ConditionSignalConfidence,
    evidence: z.array(z.string()),
    dataQuality: z.string(),
    recommendation: z.string(),
    status: ConditionSignalStatus,
    draft: ConditionSignalDraft.nullable(),
    workOrderId: Uuid.nullable(),
    workOrderReference: z.string().nullable(),
    raisedAt: z.string(),
    reviewedByName: z.string().nullable(),
    reviewedAt: z.string().nullable(),
    reviewNote: z.string().nullable(),
});
export type ConditionSignal = z.infer<typeof ConditionSignal>;

export const ConditionSignalList = z.object({ signals: z.array(ConditionSignal) });
export type ConditionSignalList = z.infer<typeof ConditionSignalList>;

export const DismissConditionSignalRequest = z.object({ reason: z.string().trim().min(1).max(300) });
export type DismissConditionSignalRequest = z.infer<typeof DismissConditionSignalRequest>;
