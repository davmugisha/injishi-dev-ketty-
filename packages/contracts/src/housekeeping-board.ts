import { z } from "zod";
import { HousekeepingStatus, HousekeepingTaskStatus, HousekeepingTaskType, RoomStatus } from "./ops";
import { Uuid } from "./primitives";
import { InspectionCheckVerdict } from "./staff-phone";

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
export const RoomServiceFlag = z.enum(["dnd", "make_up_room"]);
export type RoomServiceFlag = z.infer<typeof RoomServiceFlag>;

export const HousekeepingBoardRoom = z.object({
    id: Uuid,
    label: z.string().nullable(),
    floor: z.number().int().nullable(),
    roomTypeName: z.string(),
    /** INVENTORY status, owned by maintenance (an active block makes it `maintenance`). */
    status: RoomStatus,
    /** READINESS, owned by housekeeping. */
    housekeeping: HousekeepingStatus,
    housekeepingUpdatedAt: z.string().nullable(),
    serviceFlag: RoomServiceFlag.nullable(),
    /** The open stay in the room. */
    occupiedBy: z
        .object({ stayId: Uuid, guestName: z.string().nullable(), plannedExitAt: z.string().nullable() })
        .nullable(),
    /** A confirmed booking holding this room and arriving today, not yet checked in. */
    arrival: z
        .object({ guestName: z.string().nullable(), bookingReference: z.string().nullable(), checkInTime: z.string().nullable() })
        .nullable(),
    /** The open out-of-order block on the room (requested or active). */
    block: z
        .object({
            id: Uuid,
            status: z.enum(["requested", "active"]),
            workOrderId: Uuid.nullable(),
            workOrderReference: z.string().nullable(),
            startsAt: z.string(),
            endsAt: z.string().nullable(),
        })
        .nullable(),
});
export type HousekeepingBoardRoom = z.infer<typeof HousekeepingBoardRoom>;

export const HousekeepingBoardTask = z.object({
    id: Uuid,
    roomId: Uuid,
    roomLabel: z.string().nullable(),
    taskType: HousekeepingTaskType,
    status: HousekeepingTaskStatus,
    /** A re-clean after a failed inspection (the task it reopens). */
    reopenedFromTaskId: Uuid.nullable(),
    assignedToUserId: Uuid.nullable(),
    assignedToName: z.string().nullable(),
    priority: z.number().int(),
    note: z.string().nullable(),
    dueAt: z.string().nullable(),
    estimatedMinutes: z.number().int().nullable(),
    /** The rule that created it; null when a person added it by hand. */
    ruleId: Uuid.nullable(),
    ruleName: z.string().nullable(),
    startedAt: z.string().nullable(),
    completedAt: z.string().nullable(),
    inspectedAt: z.string().nullable(),
    inspectedByName: z.string().nullable(),
    createdAt: z.string(),
});
export type HousekeepingBoardTask = z.infer<typeof HousekeepingBoardTask>;

/** Who works housekeeping on this property today: the day's allocation sheet. */
export const HousekeepingAllocationRole = z.enum(["attendant", "supervisor"]);
export type HousekeepingAllocationRole = z.infer<typeof HousekeepingAllocationRole>;

export const HousekeepingBoardStaff = z.object({
    id: Uuid,
    userId: Uuid,
    name: z.string(),
    role: HousekeepingAllocationRole,
    /** The section they cover: "Floor 2", "Floors 1–4", "Floor 4, public areas". */
    section: z.string(),
    floors: z.array(z.number().int()),
    shiftStartsAt: z.string(),
    shiftEndsAt: z.string(),
});
export type HousekeepingBoardStaff = z.infer<typeof HousekeepingBoardStaff>;

/** A task the board escalated: not started by its due time, or waiting too long for inspection. */
export const HousekeepingEscalationKind = z.enum(["not_started", "awaiting_inspection"]);
export type HousekeepingEscalationKind = z.infer<typeof HousekeepingEscalationKind>;
export const HousekeepingEscalationLevel = z.enum(["supervisor", "manager"]);
export type HousekeepingEscalationLevel = z.infer<typeof HousekeepingEscalationLevel>;

export const HousekeepingBoardEscalation = z.object({
    id: Uuid,
    taskId: Uuid,
    kind: HousekeepingEscalationKind,
    level: HousekeepingEscalationLevel,
    escalatedToUserId: Uuid.nullable(),
    escalatedToName: z.string().nullable(),
    raisedAt: z.string(),
    remindedAt: z.string().nullable(),
    remindedByName: z.string().nullable(),
});
export type HousekeepingBoardEscalation = z.infer<typeof HousekeepingBoardEscalation>;

export const HousekeepingRuleCode = z.enum(["checkout", "stayover", "inspection", "turndown", "deep_clean"]);
export type HousekeepingRuleCode = z.infer<typeof HousekeepingRuleCode>;

export const HousekeepingBoardRule = z.object({
    id: Uuid,
    code: HousekeepingRuleCode,
    name: z.string(),
    taskType: HousekeepingTaskType,
    /** When it fires, in words ("When the front desk checks a guest out"). */
    description: z.string(),
    estimatedMinutes: z.number().int().nullable(),
    active: z.boolean(),
});
export type HousekeepingBoardRule = z.infer<typeof HousekeepingBoardRule>;

/** One recorded change of a room: readiness, inventory, a task, an escalation, a fault. */
export const RoomEventKind = z.enum([
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
export type RoomEventKind = z.infer<typeof RoomEventKind>;

export const RoomStatusEvent = z.object({
    id: Uuid,
    roomId: Uuid,
    kind: RoomEventKind,
    fromValue: z.string().nullable(),
    toValue: z.string().nullable(),
    /** What happened, in words ("Dirty → Clean", "Escalated to Aline Uwase"). */
    summary: z.string(),
    /** Who did it: a person's name, or a rule or the system when no person did. */
    actorName: z.string().nullable(),
    /** How or why: "staff app", "checked the guest out", "overdue 15 min". */
    detail: z.string().nullable(),
    occurredAt: z.string(),
});
export type RoomStatusEvent = z.infer<typeof RoomStatusEvent>;

export const HousekeepingBoard = z.object({
    propertyId: Uuid,
    propertyName: z.string(),
    rooms: z.array(HousekeepingBoardRoom),
    tasks: z.array(HousekeepingBoardTask),
    staff: z.array(HousekeepingBoardStaff),
    escalations: z.array(HousekeepingBoardEscalation),
    rules: z.array(HousekeepingBoardRule),
    /** Newest first, at most the last ten per room. */
    history: z.array(RoomStatusEvent),
});
export type HousekeepingBoard = z.infer<typeof HousekeepingBoard>;

/** Give a task to someone, or take it off them (null leaves it unassigned). */
export const AssignHousekeepingTaskRequest = z.object({
    assignedToUserId: Uuid.nullable(),
});
export type AssignHousekeepingTaskRequest = z.infer<typeof AssignHousekeepingTaskRequest>;

/**
 * Pass or fail a cleaned room. Failing reopens it as a re-clean for the same person, with the reason;
 * the reason is required, because "failed" with no reason is a dispute nobody can settle.
 */
export const InspectHousekeepingTaskRequest = z
    .object({
        result: z.enum(["pass", "fail"]),
        reason: z.string().trim().min(1).max(300).optional(),
        /**
         * The inspection checklist, item by item (real-data 1.3.3, the supervisor's phone): written with the
         * decision, in the same transaction. A pass with a failed check is refused.
         */
        checks: z.array(InspectionCheckVerdict).max(60).optional(),
    })
    .refine((v) => v.result === "fail" || !(v.checks ?? []).some((c) => c.result === "fail"), {
        message: "A room with a failed check cannot pass.",
        path: ["checks"],
    })
    .refine((v) => v.result === "pass" || Boolean(v.reason), {
        message: "Say what was not right, so the re-clean knows what to fix.",
        path: ["reason"],
    });
export type InspectHousekeepingTaskRequest = z.infer<typeof InspectHousekeepingTaskRequest>;
