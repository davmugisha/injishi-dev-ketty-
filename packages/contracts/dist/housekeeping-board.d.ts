import { z } from "zod";
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
export declare const RoomServiceFlag: z.ZodEnum<["dnd", "make_up_room"]>;
export type RoomServiceFlag = z.infer<typeof RoomServiceFlag>;
export declare const HousekeepingBoardRoom: z.ZodObject<{
    id: z.ZodString;
    label: z.ZodNullable<z.ZodString>;
    floor: z.ZodNullable<z.ZodNumber>;
    roomTypeName: z.ZodString;
    /** INVENTORY status, owned by maintenance (an active block makes it `maintenance`). */
    status: z.ZodEnum<["available", "maintenance", "out_of_service"]>;
    /** READINESS, owned by housekeeping. */
    housekeeping: z.ZodEnum<["clean", "dirty", "inspected", "out_of_order"]>;
    housekeepingUpdatedAt: z.ZodNullable<z.ZodString>;
    serviceFlag: z.ZodNullable<z.ZodEnum<["dnd", "make_up_room"]>>;
    /** The open stay in the room. */
    occupiedBy: z.ZodNullable<z.ZodObject<{
        stayId: z.ZodString;
        guestName: z.ZodNullable<z.ZodString>;
        plannedExitAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        stayId: string;
        guestName: string | null;
        plannedExitAt: string | null;
    }, {
        stayId: string;
        guestName: string | null;
        plannedExitAt: string | null;
    }>>;
    /** A confirmed booking holding this room and arriving today, not yet checked in. */
    arrival: z.ZodNullable<z.ZodObject<{
        guestName: z.ZodNullable<z.ZodString>;
        bookingReference: z.ZodNullable<z.ZodString>;
        checkInTime: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        guestName: string | null;
        checkInTime: string | null;
        bookingReference: string | null;
    }, {
        guestName: string | null;
        checkInTime: string | null;
        bookingReference: string | null;
    }>>;
    /** The open out-of-order block on the room (requested or active). */
    block: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["requested", "active"]>;
        workOrderId: z.ZodNullable<z.ZodString>;
        workOrderReference: z.ZodNullable<z.ZodString>;
        startsAt: z.ZodString;
        endsAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "requested";
        id: string;
        workOrderId: string | null;
        workOrderReference: string | null;
        startsAt: string;
        endsAt: string | null;
    }, {
        status: "active" | "requested";
        id: string;
        workOrderId: string | null;
        workOrderReference: string | null;
        startsAt: string;
        endsAt: string | null;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "available" | "maintenance" | "out_of_service";
    id: string;
    label: string | null;
    roomTypeName: string;
    housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
    occupiedBy: {
        stayId: string;
        guestName: string | null;
        plannedExitAt: string | null;
    } | null;
    housekeepingUpdatedAt: string | null;
    floor: number | null;
    serviceFlag: "dnd" | "make_up_room" | null;
    arrival: {
        guestName: string | null;
        checkInTime: string | null;
        bookingReference: string | null;
    } | null;
    block: {
        status: "active" | "requested";
        id: string;
        workOrderId: string | null;
        workOrderReference: string | null;
        startsAt: string;
        endsAt: string | null;
    } | null;
}, {
    status: "available" | "maintenance" | "out_of_service";
    id: string;
    label: string | null;
    roomTypeName: string;
    housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
    occupiedBy: {
        stayId: string;
        guestName: string | null;
        plannedExitAt: string | null;
    } | null;
    housekeepingUpdatedAt: string | null;
    floor: number | null;
    serviceFlag: "dnd" | "make_up_room" | null;
    arrival: {
        guestName: string | null;
        checkInTime: string | null;
        bookingReference: string | null;
    } | null;
    block: {
        status: "active" | "requested";
        id: string;
        workOrderId: string | null;
        workOrderReference: string | null;
        startsAt: string;
        endsAt: string | null;
    } | null;
}>;
export type HousekeepingBoardRoom = z.infer<typeof HousekeepingBoardRoom>;
export declare const HousekeepingBoardTask: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    roomLabel: z.ZodNullable<z.ZodString>;
    taskType: z.ZodEnum<["checkout_clean", "stayover_clean", "inspection", "deep_clean", "turndown"]>;
    status: z.ZodEnum<["pending", "in_progress", "done", "inspected", "blocked", "failed"]>;
    /** A re-clean after a failed inspection (the task it reopens). */
    reopenedFromTaskId: z.ZodNullable<z.ZodString>;
    assignedToUserId: z.ZodNullable<z.ZodString>;
    assignedToName: z.ZodNullable<z.ZodString>;
    priority: z.ZodNumber;
    note: z.ZodNullable<z.ZodString>;
    dueAt: z.ZodNullable<z.ZodString>;
    estimatedMinutes: z.ZodNullable<z.ZodNumber>;
    /** The rule that created it; null when a person added it by hand. */
    ruleId: z.ZodNullable<z.ZodString>;
    ruleName: z.ZodNullable<z.ZodString>;
    startedAt: z.ZodNullable<z.ZodString>;
    completedAt: z.ZodNullable<z.ZodString>;
    inspectedAt: z.ZodNullable<z.ZodString>;
    inspectedByName: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "pending" | "failed" | "inspected" | "in_progress" | "done" | "blocked";
    id: string;
    note: string | null;
    createdAt: string;
    roomId: string;
    roomLabel: string | null;
    priority: number;
    taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
    assignedToUserId: string | null;
    assignedToName: string | null;
    startedAt: string | null;
    completedAt: string | null;
    dueAt: string | null;
    estimatedMinutes: number | null;
    reopenedFromTaskId: string | null;
    ruleId: string | null;
    ruleName: string | null;
    inspectedAt: string | null;
    inspectedByName: string | null;
}, {
    status: "pending" | "failed" | "inspected" | "in_progress" | "done" | "blocked";
    id: string;
    note: string | null;
    createdAt: string;
    roomId: string;
    roomLabel: string | null;
    priority: number;
    taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
    assignedToUserId: string | null;
    assignedToName: string | null;
    startedAt: string | null;
    completedAt: string | null;
    dueAt: string | null;
    estimatedMinutes: number | null;
    reopenedFromTaskId: string | null;
    ruleId: string | null;
    ruleName: string | null;
    inspectedAt: string | null;
    inspectedByName: string | null;
}>;
export type HousekeepingBoardTask = z.infer<typeof HousekeepingBoardTask>;
/** Who works housekeeping on this property today: the day's allocation sheet. */
export declare const HousekeepingAllocationRole: z.ZodEnum<["attendant", "supervisor"]>;
export type HousekeepingAllocationRole = z.infer<typeof HousekeepingAllocationRole>;
export declare const HousekeepingBoardStaff: z.ZodObject<{
    id: z.ZodString;
    userId: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["attendant", "supervisor"]>;
    /** The section they cover: "Floor 2", "Floors 1–4", "Floor 4, public areas". */
    section: z.ZodString;
    floors: z.ZodArray<z.ZodNumber, "many">;
    shiftStartsAt: z.ZodString;
    shiftEndsAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    role: "supervisor" | "attendant";
    id: string;
    userId: string;
    section: string;
    floors: number[];
    shiftStartsAt: string;
    shiftEndsAt: string;
}, {
    name: string;
    role: "supervisor" | "attendant";
    id: string;
    userId: string;
    section: string;
    floors: number[];
    shiftStartsAt: string;
    shiftEndsAt: string;
}>;
export type HousekeepingBoardStaff = z.infer<typeof HousekeepingBoardStaff>;
/** A task the board escalated: not started by its due time, or waiting too long for inspection. */
export declare const HousekeepingEscalationKind: z.ZodEnum<["not_started", "awaiting_inspection"]>;
export type HousekeepingEscalationKind = z.infer<typeof HousekeepingEscalationKind>;
export declare const HousekeepingEscalationLevel: z.ZodEnum<["supervisor", "manager"]>;
export type HousekeepingEscalationLevel = z.infer<typeof HousekeepingEscalationLevel>;
export declare const HousekeepingBoardEscalation: z.ZodObject<{
    id: z.ZodString;
    taskId: z.ZodString;
    kind: z.ZodEnum<["not_started", "awaiting_inspection"]>;
    level: z.ZodEnum<["supervisor", "manager"]>;
    escalatedToUserId: z.ZodNullable<z.ZodString>;
    escalatedToName: z.ZodNullable<z.ZodString>;
    raisedAt: z.ZodString;
    remindedAt: z.ZodNullable<z.ZodString>;
    remindedByName: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "not_started" | "awaiting_inspection";
    id: string;
    level: "manager" | "supervisor";
    taskId: string;
    escalatedToUserId: string | null;
    escalatedToName: string | null;
    raisedAt: string;
    remindedAt: string | null;
    remindedByName: string | null;
}, {
    kind: "not_started" | "awaiting_inspection";
    id: string;
    level: "manager" | "supervisor";
    taskId: string;
    escalatedToUserId: string | null;
    escalatedToName: string | null;
    raisedAt: string;
    remindedAt: string | null;
    remindedByName: string | null;
}>;
export type HousekeepingBoardEscalation = z.infer<typeof HousekeepingBoardEscalation>;
export declare const HousekeepingRuleCode: z.ZodEnum<["checkout", "stayover", "inspection", "turndown", "deep_clean"]>;
export type HousekeepingRuleCode = z.infer<typeof HousekeepingRuleCode>;
export declare const HousekeepingBoardRule: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodEnum<["checkout", "stayover", "inspection", "turndown", "deep_clean"]>;
    name: z.ZodString;
    taskType: z.ZodEnum<["checkout_clean", "stayover_clean", "inspection", "deep_clean", "turndown"]>;
    /** When it fires, in words ("When the front desk checks a guest out"). */
    description: z.ZodString;
    estimatedMinutes: z.ZodNullable<z.ZodNumber>;
    active: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: "inspection" | "deep_clean" | "turndown" | "checkout" | "stayover";
    active: boolean;
    name: string;
    id: string;
    description: string;
    taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
    estimatedMinutes: number | null;
}, {
    code: "inspection" | "deep_clean" | "turndown" | "checkout" | "stayover";
    active: boolean;
    name: string;
    id: string;
    description: string;
    taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
    estimatedMinutes: number | null;
}>;
export type HousekeepingBoardRule = z.infer<typeof HousekeepingBoardRule>;
/** One recorded change of a room: readiness, inventory, a task, an escalation, a fault. */
export declare const RoomEventKind: z.ZodEnum<["housekeeping", "inventory", "occupancy", "task_assigned", "task_created", "inspection_failed", "escalation", "fault_reported", "block"]>;
export type RoomEventKind = z.infer<typeof RoomEventKind>;
export declare const RoomStatusEvent: z.ZodObject<{
    id: z.ZodString;
    roomId: z.ZodString;
    kind: z.ZodEnum<["housekeeping", "inventory", "occupancy", "task_assigned", "task_created", "inspection_failed", "escalation", "fault_reported", "block"]>;
    fromValue: z.ZodNullable<z.ZodString>;
    toValue: z.ZodNullable<z.ZodString>;
    /** What happened, in words ("Dirty → Clean", "Escalated to Aline Uwase"). */
    summary: z.ZodString;
    /** Who did it: a person's name, or a rule or the system when no person did. */
    actorName: z.ZodNullable<z.ZodString>;
    /** How or why: "staff app", "checked the guest out", "overdue 15 min". */
    detail: z.ZodNullable<z.ZodString>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "escalation" | "housekeeping" | "block" | "inventory" | "occupancy" | "task_assigned" | "task_created" | "inspection_failed" | "fault_reported";
    id: string;
    detail: string | null;
    occurredAt: string;
    actorName: string | null;
    roomId: string;
    summary: string;
    fromValue: string | null;
    toValue: string | null;
}, {
    kind: "escalation" | "housekeeping" | "block" | "inventory" | "occupancy" | "task_assigned" | "task_created" | "inspection_failed" | "fault_reported";
    id: string;
    detail: string | null;
    occurredAt: string;
    actorName: string | null;
    roomId: string;
    summary: string;
    fromValue: string | null;
    toValue: string | null;
}>;
export type RoomStatusEvent = z.infer<typeof RoomStatusEvent>;
export declare const HousekeepingBoard: z.ZodObject<{
    propertyId: z.ZodString;
    propertyName: z.ZodString;
    rooms: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        label: z.ZodNullable<z.ZodString>;
        floor: z.ZodNullable<z.ZodNumber>;
        roomTypeName: z.ZodString;
        /** INVENTORY status, owned by maintenance (an active block makes it `maintenance`). */
        status: z.ZodEnum<["available", "maintenance", "out_of_service"]>;
        /** READINESS, owned by housekeeping. */
        housekeeping: z.ZodEnum<["clean", "dirty", "inspected", "out_of_order"]>;
        housekeepingUpdatedAt: z.ZodNullable<z.ZodString>;
        serviceFlag: z.ZodNullable<z.ZodEnum<["dnd", "make_up_room"]>>;
        /** The open stay in the room. */
        occupiedBy: z.ZodNullable<z.ZodObject<{
            stayId: z.ZodString;
            guestName: z.ZodNullable<z.ZodString>;
            plannedExitAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        }, {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        }>>;
        /** A confirmed booking holding this room and arriving today, not yet checked in. */
        arrival: z.ZodNullable<z.ZodObject<{
            guestName: z.ZodNullable<z.ZodString>;
            bookingReference: z.ZodNullable<z.ZodString>;
            checkInTime: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            guestName: string | null;
            checkInTime: string | null;
            bookingReference: string | null;
        }, {
            guestName: string | null;
            checkInTime: string | null;
            bookingReference: string | null;
        }>>;
        /** The open out-of-order block on the room (requested or active). */
        block: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<["requested", "active"]>;
            workOrderId: z.ZodNullable<z.ZodString>;
            workOrderReference: z.ZodNullable<z.ZodString>;
            startsAt: z.ZodString;
            endsAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "requested";
            id: string;
            workOrderId: string | null;
            workOrderReference: string | null;
            startsAt: string;
            endsAt: string | null;
        }, {
            status: "active" | "requested";
            id: string;
            workOrderId: string | null;
            workOrderReference: string | null;
            startsAt: string;
            endsAt: string | null;
        }>>;
    }, "strip", z.ZodTypeAny, {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        label: string | null;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        occupiedBy: {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        } | null;
        housekeepingUpdatedAt: string | null;
        floor: number | null;
        serviceFlag: "dnd" | "make_up_room" | null;
        arrival: {
            guestName: string | null;
            checkInTime: string | null;
            bookingReference: string | null;
        } | null;
        block: {
            status: "active" | "requested";
            id: string;
            workOrderId: string | null;
            workOrderReference: string | null;
            startsAt: string;
            endsAt: string | null;
        } | null;
    }, {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        label: string | null;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        occupiedBy: {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        } | null;
        housekeepingUpdatedAt: string | null;
        floor: number | null;
        serviceFlag: "dnd" | "make_up_room" | null;
        arrival: {
            guestName: string | null;
            checkInTime: string | null;
            bookingReference: string | null;
        } | null;
        block: {
            status: "active" | "requested";
            id: string;
            workOrderId: string | null;
            workOrderReference: string | null;
            startsAt: string;
            endsAt: string | null;
        } | null;
    }>, "many">;
    tasks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        roomLabel: z.ZodNullable<z.ZodString>;
        taskType: z.ZodEnum<["checkout_clean", "stayover_clean", "inspection", "deep_clean", "turndown"]>;
        status: z.ZodEnum<["pending", "in_progress", "done", "inspected", "blocked", "failed"]>;
        /** A re-clean after a failed inspection (the task it reopens). */
        reopenedFromTaskId: z.ZodNullable<z.ZodString>;
        assignedToUserId: z.ZodNullable<z.ZodString>;
        assignedToName: z.ZodNullable<z.ZodString>;
        priority: z.ZodNumber;
        note: z.ZodNullable<z.ZodString>;
        dueAt: z.ZodNullable<z.ZodString>;
        estimatedMinutes: z.ZodNullable<z.ZodNumber>;
        /** The rule that created it; null when a person added it by hand. */
        ruleId: z.ZodNullable<z.ZodString>;
        ruleName: z.ZodNullable<z.ZodString>;
        startedAt: z.ZodNullable<z.ZodString>;
        completedAt: z.ZodNullable<z.ZodString>;
        inspectedAt: z.ZodNullable<z.ZodString>;
        inspectedByName: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "pending" | "failed" | "inspected" | "in_progress" | "done" | "blocked";
        id: string;
        note: string | null;
        createdAt: string;
        roomId: string;
        roomLabel: string | null;
        priority: number;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        assignedToUserId: string | null;
        assignedToName: string | null;
        startedAt: string | null;
        completedAt: string | null;
        dueAt: string | null;
        estimatedMinutes: number | null;
        reopenedFromTaskId: string | null;
        ruleId: string | null;
        ruleName: string | null;
        inspectedAt: string | null;
        inspectedByName: string | null;
    }, {
        status: "pending" | "failed" | "inspected" | "in_progress" | "done" | "blocked";
        id: string;
        note: string | null;
        createdAt: string;
        roomId: string;
        roomLabel: string | null;
        priority: number;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        assignedToUserId: string | null;
        assignedToName: string | null;
        startedAt: string | null;
        completedAt: string | null;
        dueAt: string | null;
        estimatedMinutes: number | null;
        reopenedFromTaskId: string | null;
        ruleId: string | null;
        ruleName: string | null;
        inspectedAt: string | null;
        inspectedByName: string | null;
    }>, "many">;
    staff: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        userId: z.ZodString;
        name: z.ZodString;
        role: z.ZodEnum<["attendant", "supervisor"]>;
        /** The section they cover: "Floor 2", "Floors 1–4", "Floor 4, public areas". */
        section: z.ZodString;
        floors: z.ZodArray<z.ZodNumber, "many">;
        shiftStartsAt: z.ZodString;
        shiftEndsAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        role: "supervisor" | "attendant";
        id: string;
        userId: string;
        section: string;
        floors: number[];
        shiftStartsAt: string;
        shiftEndsAt: string;
    }, {
        name: string;
        role: "supervisor" | "attendant";
        id: string;
        userId: string;
        section: string;
        floors: number[];
        shiftStartsAt: string;
        shiftEndsAt: string;
    }>, "many">;
    escalations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        taskId: z.ZodString;
        kind: z.ZodEnum<["not_started", "awaiting_inspection"]>;
        level: z.ZodEnum<["supervisor", "manager"]>;
        escalatedToUserId: z.ZodNullable<z.ZodString>;
        escalatedToName: z.ZodNullable<z.ZodString>;
        raisedAt: z.ZodString;
        remindedAt: z.ZodNullable<z.ZodString>;
        remindedByName: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "not_started" | "awaiting_inspection";
        id: string;
        level: "manager" | "supervisor";
        taskId: string;
        escalatedToUserId: string | null;
        escalatedToName: string | null;
        raisedAt: string;
        remindedAt: string | null;
        remindedByName: string | null;
    }, {
        kind: "not_started" | "awaiting_inspection";
        id: string;
        level: "manager" | "supervisor";
        taskId: string;
        escalatedToUserId: string | null;
        escalatedToName: string | null;
        raisedAt: string;
        remindedAt: string | null;
        remindedByName: string | null;
    }>, "many">;
    rules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodEnum<["checkout", "stayover", "inspection", "turndown", "deep_clean"]>;
        name: z.ZodString;
        taskType: z.ZodEnum<["checkout_clean", "stayover_clean", "inspection", "deep_clean", "turndown"]>;
        /** When it fires, in words ("When the front desk checks a guest out"). */
        description: z.ZodString;
        estimatedMinutes: z.ZodNullable<z.ZodNumber>;
        active: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        code: "inspection" | "deep_clean" | "turndown" | "checkout" | "stayover";
        active: boolean;
        name: string;
        id: string;
        description: string;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        estimatedMinutes: number | null;
    }, {
        code: "inspection" | "deep_clean" | "turndown" | "checkout" | "stayover";
        active: boolean;
        name: string;
        id: string;
        description: string;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        estimatedMinutes: number | null;
    }>, "many">;
    /** Newest first, at most the last ten per room. */
    history: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        roomId: z.ZodString;
        kind: z.ZodEnum<["housekeeping", "inventory", "occupancy", "task_assigned", "task_created", "inspection_failed", "escalation", "fault_reported", "block"]>;
        fromValue: z.ZodNullable<z.ZodString>;
        toValue: z.ZodNullable<z.ZodString>;
        /** What happened, in words ("Dirty → Clean", "Escalated to Aline Uwase"). */
        summary: z.ZodString;
        /** Who did it: a person's name, or a rule or the system when no person did. */
        actorName: z.ZodNullable<z.ZodString>;
        /** How or why: "staff app", "checked the guest out", "overdue 15 min". */
        detail: z.ZodNullable<z.ZodString>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "escalation" | "housekeeping" | "block" | "inventory" | "occupancy" | "task_assigned" | "task_created" | "inspection_failed" | "fault_reported";
        id: string;
        detail: string | null;
        occurredAt: string;
        actorName: string | null;
        roomId: string;
        summary: string;
        fromValue: string | null;
        toValue: string | null;
    }, {
        kind: "escalation" | "housekeeping" | "block" | "inventory" | "occupancy" | "task_assigned" | "task_created" | "inspection_failed" | "fault_reported";
        id: string;
        detail: string | null;
        occurredAt: string;
        actorName: string | null;
        roomId: string;
        summary: string;
        fromValue: string | null;
        toValue: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    history: {
        kind: "escalation" | "housekeeping" | "block" | "inventory" | "occupancy" | "task_assigned" | "task_created" | "inspection_failed" | "fault_reported";
        id: string;
        detail: string | null;
        occurredAt: string;
        actorName: string | null;
        roomId: string;
        summary: string;
        fromValue: string | null;
        toValue: string | null;
    }[];
    propertyName: string;
    escalations: {
        kind: "not_started" | "awaiting_inspection";
        id: string;
        level: "manager" | "supervisor";
        taskId: string;
        escalatedToUserId: string | null;
        escalatedToName: string | null;
        raisedAt: string;
        remindedAt: string | null;
        remindedByName: string | null;
    }[];
    staff: {
        name: string;
        role: "supervisor" | "attendant";
        id: string;
        userId: string;
        section: string;
        floors: number[];
        shiftStartsAt: string;
        shiftEndsAt: string;
    }[];
    rooms: {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        label: string | null;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        occupiedBy: {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        } | null;
        housekeepingUpdatedAt: string | null;
        floor: number | null;
        serviceFlag: "dnd" | "make_up_room" | null;
        arrival: {
            guestName: string | null;
            checkInTime: string | null;
            bookingReference: string | null;
        } | null;
        block: {
            status: "active" | "requested";
            id: string;
            workOrderId: string | null;
            workOrderReference: string | null;
            startsAt: string;
            endsAt: string | null;
        } | null;
    }[];
    propertyId: string;
    tasks: {
        status: "pending" | "failed" | "inspected" | "in_progress" | "done" | "blocked";
        id: string;
        note: string | null;
        createdAt: string;
        roomId: string;
        roomLabel: string | null;
        priority: number;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        assignedToUserId: string | null;
        assignedToName: string | null;
        startedAt: string | null;
        completedAt: string | null;
        dueAt: string | null;
        estimatedMinutes: number | null;
        reopenedFromTaskId: string | null;
        ruleId: string | null;
        ruleName: string | null;
        inspectedAt: string | null;
        inspectedByName: string | null;
    }[];
    rules: {
        code: "inspection" | "deep_clean" | "turndown" | "checkout" | "stayover";
        active: boolean;
        name: string;
        id: string;
        description: string;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        estimatedMinutes: number | null;
    }[];
}, {
    history: {
        kind: "escalation" | "housekeeping" | "block" | "inventory" | "occupancy" | "task_assigned" | "task_created" | "inspection_failed" | "fault_reported";
        id: string;
        detail: string | null;
        occurredAt: string;
        actorName: string | null;
        roomId: string;
        summary: string;
        fromValue: string | null;
        toValue: string | null;
    }[];
    propertyName: string;
    escalations: {
        kind: "not_started" | "awaiting_inspection";
        id: string;
        level: "manager" | "supervisor";
        taskId: string;
        escalatedToUserId: string | null;
        escalatedToName: string | null;
        raisedAt: string;
        remindedAt: string | null;
        remindedByName: string | null;
    }[];
    staff: {
        name: string;
        role: "supervisor" | "attendant";
        id: string;
        userId: string;
        section: string;
        floors: number[];
        shiftStartsAt: string;
        shiftEndsAt: string;
    }[];
    rooms: {
        status: "available" | "maintenance" | "out_of_service";
        id: string;
        label: string | null;
        roomTypeName: string;
        housekeeping: "dirty" | "clean" | "inspected" | "out_of_order";
        occupiedBy: {
            stayId: string;
            guestName: string | null;
            plannedExitAt: string | null;
        } | null;
        housekeepingUpdatedAt: string | null;
        floor: number | null;
        serviceFlag: "dnd" | "make_up_room" | null;
        arrival: {
            guestName: string | null;
            checkInTime: string | null;
            bookingReference: string | null;
        } | null;
        block: {
            status: "active" | "requested";
            id: string;
            workOrderId: string | null;
            workOrderReference: string | null;
            startsAt: string;
            endsAt: string | null;
        } | null;
    }[];
    propertyId: string;
    tasks: {
        status: "pending" | "failed" | "inspected" | "in_progress" | "done" | "blocked";
        id: string;
        note: string | null;
        createdAt: string;
        roomId: string;
        roomLabel: string | null;
        priority: number;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        assignedToUserId: string | null;
        assignedToName: string | null;
        startedAt: string | null;
        completedAt: string | null;
        dueAt: string | null;
        estimatedMinutes: number | null;
        reopenedFromTaskId: string | null;
        ruleId: string | null;
        ruleName: string | null;
        inspectedAt: string | null;
        inspectedByName: string | null;
    }[];
    rules: {
        code: "inspection" | "deep_clean" | "turndown" | "checkout" | "stayover";
        active: boolean;
        name: string;
        id: string;
        description: string;
        taskType: "checkout_clean" | "stayover_clean" | "inspection" | "deep_clean" | "turndown";
        estimatedMinutes: number | null;
    }[];
}>;
export type HousekeepingBoard = z.infer<typeof HousekeepingBoard>;
/** Give a task to someone, or take it off them (null leaves it unassigned). */
export declare const AssignHousekeepingTaskRequest: z.ZodObject<{
    assignedToUserId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    assignedToUserId: string | null;
}, {
    assignedToUserId: string | null;
}>;
export type AssignHousekeepingTaskRequest = z.infer<typeof AssignHousekeepingTaskRequest>;
/**
 * Pass or fail a cleaned room. Failing reopens it as a re-clean for the same person, with the reason;
 * the reason is required, because "failed" with no reason is a dispute nobody can settle.
 */
export declare const InspectHousekeepingTaskRequest: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    result: z.ZodEnum<["pass", "fail"]>;
    reason: z.ZodOptional<z.ZodString>;
    /**
     * The inspection checklist, item by item (real-data 1.3.3, the supervisor's phone): written with the
     * decision, in the same transaction. A pass with a failed check is refused.
     */
    checks: z.ZodOptional<z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        result: z.ZodEnum<["pass", "fail"]>;
        photoObjectKey: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        result: "pass" | "fail";
        itemId: string;
        photoObjectKey?: string | undefined;
    }, {
        result: "pass" | "fail";
        itemId: string;
        photoObjectKey?: string | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    result: "pass" | "fail";
    reason?: string | undefined;
    checks?: {
        result: "pass" | "fail";
        itemId: string;
        photoObjectKey?: string | undefined;
    }[] | undefined;
}, {
    result: "pass" | "fail";
    reason?: string | undefined;
    checks?: {
        result: "pass" | "fail";
        itemId: string;
        photoObjectKey?: string | undefined;
    }[] | undefined;
}>, {
    result: "pass" | "fail";
    reason?: string | undefined;
    checks?: {
        result: "pass" | "fail";
        itemId: string;
        photoObjectKey?: string | undefined;
    }[] | undefined;
}, {
    result: "pass" | "fail";
    reason?: string | undefined;
    checks?: {
        result: "pass" | "fail";
        itemId: string;
        photoObjectKey?: string | undefined;
    }[] | undefined;
}>, {
    result: "pass" | "fail";
    reason?: string | undefined;
    checks?: {
        result: "pass" | "fail";
        itemId: string;
        photoObjectKey?: string | undefined;
    }[] | undefined;
}, {
    result: "pass" | "fail";
    reason?: string | undefined;
    checks?: {
        result: "pass" | "fail";
        itemId: string;
        photoObjectKey?: string | undefined;
    }[] | undefined;
}>;
export type InspectHousekeepingTaskRequest = z.infer<typeof InspectHousekeepingTaskRequest>;
//# sourceMappingURL=housekeeping-board.d.ts.map