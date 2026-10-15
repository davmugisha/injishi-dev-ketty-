"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspectHousekeepingTaskRequest = exports.AssignHousekeepingTaskRequest = exports.HousekeepingBoard = exports.RoomStatusEvent = exports.RoomEventKind = exports.HousekeepingBoardRule = exports.HousekeepingRuleCode = exports.HousekeepingBoardEscalation = exports.HousekeepingEscalationLevel = exports.HousekeepingEscalationKind = exports.HousekeepingBoardStaff = exports.HousekeepingAllocationRole = exports.HousekeepingBoardTask = exports.HousekeepingBoardRoom = exports.RoomServiceFlag = void 0;
const zod_1 = require("zod");
const ops_1 = require("./ops");
const primitives_1 = require("./primitives");
const staff_phone_1 = require("./staff-phone");
/**
 * The housekeeping board (`GET /api/v1/ops/housekeeping/board`): one property's rooms, today's
 * cleaning tasks, who works housekeeping today, the open escalations, the rules that create tasks,
 * and the recorded status history of its rooms.
 *
 * ONE PROPERTY, because a board is a building: an attendant walks floors, not a group. The request
 * names it (`?propertyId=`) or the branch header does; with neither, the board opens on the
 * workspace's head office (or its first branch in scope).
 */
/** A guest-facing service flag hung on the door: do not disturb, or please make up the room. */
exports.RoomServiceFlag = zod_1.z.enum(["dnd", "make_up_room"]);
exports.HousekeepingBoardRoom = zod_1.z.object({
    id: primitives_1.Uuid,
    label: zod_1.z.string().nullable(),
    floor: zod_1.z.number().int().nullable(),
    roomTypeName: zod_1.z.string(),
    /** INVENTORY status, owned by maintenance (an active block makes it `maintenance`). */
    status: ops_1.RoomStatus,
    /** READINESS, owned by housekeeping. */
    housekeeping: ops_1.HousekeepingStatus,
    housekeepingUpdatedAt: zod_1.z.string().nullable(),
    serviceFlag: exports.RoomServiceFlag.nullable(),
    /** The open stay in the room. */
    occupiedBy: zod_1.z
        .object({ stayId: primitives_1.Uuid, guestName: zod_1.z.string().nullable(), plannedExitAt: zod_1.z.string().nullable() })
        .nullable(),
    /** A confirmed booking holding this room and arriving today, not yet checked in. */
    arrival: zod_1.z
        .object({ guestName: zod_1.z.string().nullable(), bookingReference: zod_1.z.string().nullable(), checkInTime: zod_1.z.string().nullable() })
        .nullable(),
    /** The open out-of-order block on the room (requested or active). */
    block: zod_1.z
        .object({
        id: primitives_1.Uuid,
        status: zod_1.z.enum(["requested", "active"]),
        workOrderId: primitives_1.Uuid.nullable(),
        workOrderReference: zod_1.z.string().nullable(),
        startsAt: zod_1.z.string(),
        endsAt: zod_1.z.string().nullable(),
    })
        .nullable(),
});
exports.HousekeepingBoardTask = zod_1.z.object({
    id: primitives_1.Uuid,
    roomId: primitives_1.Uuid,
    roomLabel: zod_1.z.string().nullable(),
    taskType: ops_1.HousekeepingTaskType,
    status: ops_1.HousekeepingTaskStatus,
    /** A re-clean after a failed inspection (the task it reopens). */
    reopenedFromTaskId: primitives_1.Uuid.nullable(),
    assignedToUserId: primitives_1.Uuid.nullable(),
    assignedToName: zod_1.z.string().nullable(),
    priority: zod_1.z.number().int(),
    note: zod_1.z.string().nullable(),
    dueAt: zod_1.z.string().nullable(),
    estimatedMinutes: zod_1.z.number().int().nullable(),
    /** The rule that created it; null when a person added it by hand. */
    ruleId: primitives_1.Uuid.nullable(),
    ruleName: zod_1.z.string().nullable(),
    startedAt: zod_1.z.string().nullable(),
    completedAt: zod_1.z.string().nullable(),
    inspectedAt: zod_1.z.string().nullable(),
    inspectedByName: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string(),
});
/** Who works housekeeping on this property today: the day's allocation sheet. */
exports.HousekeepingAllocationRole = zod_1.z.enum(["attendant", "supervisor"]);
exports.HousekeepingBoardStaff = zod_1.z.object({
    id: primitives_1.Uuid,
    userId: primitives_1.Uuid,
    name: zod_1.z.string(),
    role: exports.HousekeepingAllocationRole,
    /** The section they cover: "Floor 2", "Floors 1–4", "Floor 4, public areas". */
    section: zod_1.z.string(),
    floors: zod_1.z.array(zod_1.z.number().int()),
    shiftStartsAt: zod_1.z.string(),
    shiftEndsAt: zod_1.z.string(),
});
/** A task the board escalated: not started by its due time, or waiting too long for inspection. */
exports.HousekeepingEscalationKind = zod_1.z.enum(["not_started", "awaiting_inspection"]);
exports.HousekeepingEscalationLevel = zod_1.z.enum(["supervisor", "manager"]);
exports.HousekeepingBoardEscalation = zod_1.z.object({
    id: primitives_1.Uuid,
    taskId: primitives_1.Uuid,
    kind: exports.HousekeepingEscalationKind,
    level: exports.HousekeepingEscalationLevel,
    escalatedToUserId: primitives_1.Uuid.nullable(),
    escalatedToName: zod_1.z.string().nullable(),
    raisedAt: zod_1.z.string(),
    remindedAt: zod_1.z.string().nullable(),
    remindedByName: zod_1.z.string().nullable(),
});
exports.HousekeepingRuleCode = zod_1.z.enum(["checkout", "stayover", "inspection", "turndown", "deep_clean"]);
exports.HousekeepingBoardRule = zod_1.z.object({
    id: primitives_1.Uuid,
    code: exports.HousekeepingRuleCode,
    name: zod_1.z.string(),
    taskType: ops_1.HousekeepingTaskType,
    /** When it fires, in words ("When the front desk checks a guest out"). */
    description: zod_1.z.string(),
    estimatedMinutes: zod_1.z.number().int().nullable(),
    active: zod_1.z.boolean(),
});
/** One recorded change of a room: readiness, inventory, a task, an escalation, a fault. */
exports.RoomEventKind = zod_1.z.enum([
    "housekeeping",
    "inventory",
    "occupancy",
    "task_assigned",
    "task_created",
    "inspection_failed",
    "escalation",
    "fault_reported",
    "block",
]);
exports.RoomStatusEvent = zod_1.z.object({
    id: primitives_1.Uuid,
    roomId: primitives_1.Uuid,
    kind: exports.RoomEventKind,
    fromValue: zod_1.z.string().nullable(),
    toValue: zod_1.z.string().nullable(),
    /** What happened, in words ("Dirty → Clean", "Escalated to Aline Uwase"). */
    summary: zod_1.z.string(),
    /** Who did it: a person's name, or a rule or the system when no person did. */
    actorName: zod_1.z.string().nullable(),
    /** How or why: "staff app", "checked the guest out", "overdue 15 min". */
    detail: zod_1.z.string().nullable(),
    occurredAt: zod_1.z.string(),
});
exports.HousekeepingBoard = zod_1.z.object({
    propertyId: primitives_1.Uuid,
    propertyName: zod_1.z.string(),
    rooms: zod_1.z.array(exports.HousekeepingBoardRoom),
    tasks: zod_1.z.array(exports.HousekeepingBoardTask),
    staff: zod_1.z.array(exports.HousekeepingBoardStaff),
    escalations: zod_1.z.array(exports.HousekeepingBoardEscalation),
    rules: zod_1.z.array(exports.HousekeepingBoardRule),
    /** Newest first, at most the last ten per room. */
    history: zod_1.z.array(exports.RoomStatusEvent),
});
/** Give a task to someone, or take it off them (null leaves it unassigned). */
exports.AssignHousekeepingTaskRequest = zod_1.z.object({
    assignedToUserId: primitives_1.Uuid.nullable(),
});
/**
 * Pass or fail a cleaned room. Failing reopens it as a re-clean for the same person, with the reason;
 * the reason is required, because "failed" with no reason is a dispute nobody can settle.
 */
exports.InspectHousekeepingTaskRequest = zod_1.z
    .object({
    result: zod_1.z.enum(["pass", "fail"]),
    reason: zod_1.z.string().trim().min(1).max(300).optional(),
    /**
     * The inspection checklist, item by item (real-data 1.3.3, the supervisor's phone): written with the
     * decision, in the same transaction. A pass with a failed check is refused.
     */
    checks: zod_1.z.array(staff_phone_1.InspectionCheckVerdict).max(60).optional(),
})
    .refine((v) => v.result === "fail" || !(v.checks ?? []).some((c) => c.result === "fail"), {
    message: "A room with a failed check cannot pass.",
    path: ["checks"],
})
    .refine((v) => v.result === "pass" || Boolean(v.reason), {
    message: "Say what was not right, so the re-clean knows what to fix.",
    path: ["reason"],
});
//# sourceMappingURL=housekeeping-board.js.map