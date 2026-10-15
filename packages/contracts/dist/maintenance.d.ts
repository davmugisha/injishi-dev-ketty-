import { z } from "zod";
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
export declare const RoomBlockStatus: z.ZodEnum<["requested", "active", "declined", "released"]>;
export type RoomBlockStatus = z.infer<typeof RoomBlockStatus>;
export declare const WorkOrderEventKind: z.ZodEnum<["reported", "assigned", "block_requested", "block_approved", "block_declined", "block_released", "parts", "scheduled", "started", "note", "next_step", "fixed", "verified", "from_signal", "planned"]>;
export type WorkOrderEventKind = z.infer<typeof WorkOrderEventKind>;
export declare const WorkOrderPartState: z.ZodEnum<["requested", "ordered", "issued", "contractor"]>;
export type WorkOrderPartState = z.infer<typeof WorkOrderPartState>;
export declare const WorkOrderPart: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    quantity: z.ZodNumber;
    unit: z.ZodNullable<z.ZodString>;
    /** Where it comes from, in words: "Store · issued by …", "PO-26-0147 · due 13 Oct". */
    source: z.ZodString;
    state: z.ZodEnum<["requested", "ordered", "issued", "contractor"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    id: string;
    source: string;
    unit: string | null;
    state: "requested" | "ordered" | "issued" | "contractor";
    quantity: number;
}, {
    name: string;
    id: string;
    source: string;
    unit: string | null;
    state: "requested" | "ordered" | "issued" | "contractor";
    quantity: number;
}>;
export type WorkOrderPart = z.infer<typeof WorkOrderPart>;
export declare const WorkOrderEvent: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["reported", "assigned", "block_requested", "block_approved", "block_declined", "block_released", "parts", "scheduled", "started", "note", "next_step", "fixed", "verified", "from_signal", "planned"]>;
    note: z.ZodNullable<z.ZodString>;
    actorName: z.ZodNullable<z.ZodString>;
    occurredAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
    id: string;
    note: string | null;
    occurredAt: string;
    actorName: string | null;
}, {
    kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
    id: string;
    note: string | null;
    occurredAt: string;
    actorName: string | null;
}>;
export type WorkOrderEvent = z.infer<typeof WorkOrderEvent>;
export declare const WorkOrderBlock: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<["requested", "active", "declined", "released"]>;
    startsAt: z.ZodString;
    /** Null: until released. */
    endsAt: z.ZodNullable<z.ZodString>;
    reason: z.ZodString;
    requestedByName: z.ZodNullable<z.ZodString>;
    requestedAt: z.ZodString;
    decidedByName: z.ZodNullable<z.ZodString>;
    decidedAt: z.ZodNullable<z.ZodString>;
    decisionNote: z.ZodNullable<z.ZodString>;
    releasedByName: z.ZodNullable<z.ZodString>;
    releasedAt: z.ZodNullable<z.ZodString>;
    /** Reservations holding the room inside the block's dates (they would need another room). */
    affectedReservations: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "declined" | "released" | "requested";
    decidedAt: string | null;
    id: string;
    reason: string;
    decisionNote: string | null;
    releasedAt: string | null;
    startsAt: string;
    endsAt: string | null;
    decidedByName: string | null;
    requestedByName: string | null;
    requestedAt: string;
    releasedByName: string | null;
    affectedReservations: number;
}, {
    status: "active" | "declined" | "released" | "requested";
    decidedAt: string | null;
    id: string;
    reason: string;
    decisionNote: string | null;
    releasedAt: string | null;
    startsAt: string;
    endsAt: string | null;
    decidedByName: string | null;
    requestedByName: string | null;
    requestedAt: string;
    releasedByName: string | null;
    affectedReservations: number;
}>;
export type WorkOrderBlock = z.infer<typeof WorkOrderBlock>;
export declare const WorkOrderPhoto: z.ZodObject<{
    key: z.ZodString;
    caption: z.ZodString;
}, "strip", z.ZodTypeAny, {
    key: string;
    caption: string;
}, {
    key: string;
    caption: string;
}>;
export type WorkOrderPhoto = z.infer<typeof WorkOrderPhoto>;
export declare const WorkOrder: z.ZodObject<{
    id: z.ZodString;
    /** "WO-318": what people say on the radio. Unique per business. */
    reference: z.ZodString;
    propertyId: z.ZodNullable<z.ZodString>;
    roomId: z.ZodNullable<z.ZodString>;
    roomLabel: z.ZodNullable<z.ZodString>;
    roomTypeName: z.ZodNullable<z.ZodString>;
    floor: z.ZodNullable<z.ZodNumber>;
    spaceId: z.ZodNullable<z.ZodString>;
    spaceName: z.ZodNullable<z.ZodString>;
    assetId: z.ZodNullable<z.ZodString>;
    assetName: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    priority: z.ZodEnum<["low", "normal", "high", "urgent"]>;
    status: z.ZodEnum<["open", "assigned", "in_progress", "resolved", "closed", "cancelled"]>;
    assignedToUserId: z.ZodNullable<z.ZodString>;
    assignedToName: z.ZodNullable<z.ZodString>;
    /** An outside firm doing the work, when no staff member is. */
    assignedContractor: z.ZodNullable<z.ZodString>;
    scheduledFor: z.ZodNullable<z.ZodString>;
    raisedByName: z.ZodNullable<z.ZodString>;
    /** How it reached us: "staff app", "front desk · guest complaint", "planned schedule". */
    raisedVia: z.ZodNullable<z.ZodString>;
    raisedAt: z.ZodString;
    /** What the fault means for the operation while it is open ("Lake Bar keeps trading …"). */
    impactNote: z.ZodNullable<z.ZodString>;
    /** What has to be true before the room goes back on sale. */
    releaseNote: z.ZodNullable<z.ZodString>;
    photos: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        caption: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        key: string;
        caption: string;
    }, {
        key: string;
        caption: string;
    }>, "many">;
    parts: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        quantity: z.ZodNumber;
        unit: z.ZodNullable<z.ZodString>;
        /** Where it comes from, in words: "Store · issued by …", "PO-26-0147 · due 13 Oct". */
        source: z.ZodString;
        state: z.ZodEnum<["requested", "ordered", "issued", "contractor"]>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        source: string;
        unit: string | null;
        state: "requested" | "ordered" | "issued" | "contractor";
        quantity: number;
    }, {
        name: string;
        id: string;
        source: string;
        unit: string | null;
        state: "requested" | "ordered" | "issued" | "contractor";
        quantity: number;
    }>, "many">;
    /** Oldest first. */
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["reported", "assigned", "block_requested", "block_approved", "block_declined", "block_released", "parts", "scheduled", "started", "note", "next_step", "fixed", "verified", "from_signal", "planned"]>;
        note: z.ZodNullable<z.ZodString>;
        actorName: z.ZodNullable<z.ZodString>;
        occurredAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
        id: string;
        note: string | null;
        occurredAt: string;
        actorName: string | null;
    }, {
        kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
        id: string;
        note: string | null;
        occurredAt: string;
        actorName: string | null;
    }>, "many">;
    /** The latest block on the room for this order (any status), or null. */
    block: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        status: z.ZodEnum<["requested", "active", "declined", "released"]>;
        startsAt: z.ZodString;
        /** Null: until released. */
        endsAt: z.ZodNullable<z.ZodString>;
        reason: z.ZodString;
        requestedByName: z.ZodNullable<z.ZodString>;
        requestedAt: z.ZodString;
        decidedByName: z.ZodNullable<z.ZodString>;
        decidedAt: z.ZodNullable<z.ZodString>;
        decisionNote: z.ZodNullable<z.ZodString>;
        releasedByName: z.ZodNullable<z.ZodString>;
        releasedAt: z.ZodNullable<z.ZodString>;
        /** Reservations holding the room inside the block's dates (they would need another room). */
        affectedReservations: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "declined" | "released" | "requested";
        decidedAt: string | null;
        id: string;
        reason: string;
        decisionNote: string | null;
        releasedAt: string | null;
        startsAt: string;
        endsAt: string | null;
        decidedByName: string | null;
        requestedByName: string | null;
        requestedAt: string;
        releasedByName: string | null;
        affectedReservations: number;
    }, {
        status: "active" | "declined" | "released" | "requested";
        decidedAt: string | null;
        id: string;
        reason: string;
        decisionNote: string | null;
        releasedAt: string | null;
        startsAt: string;
        endsAt: string | null;
        decidedByName: string | null;
        requestedByName: string | null;
        requestedAt: string;
        releasedByName: string | null;
        affectedReservations: number;
    }>>;
    resolvedAt: z.ZodNullable<z.ZodString>;
    verifiedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
    id: string;
    title: string;
    events: {
        kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
        id: string;
        note: string | null;
        occurredAt: string;
        actorName: string | null;
    }[];
    reference: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    resolvedAt: string | null;
    roomTypeName: string | null;
    roomId: string | null;
    roomLabel: string | null;
    raisedByName: string | null;
    description: string | null;
    priority: "low" | "normal" | "high" | "urgent";
    propertyId: string | null;
    assignedToUserId: string | null;
    assignedToName: string | null;
    floor: number | null;
    block: {
        status: "active" | "declined" | "released" | "requested";
        decidedAt: string | null;
        id: string;
        reason: string;
        decisionNote: string | null;
        releasedAt: string | null;
        startsAt: string;
        endsAt: string | null;
        decidedByName: string | null;
        requestedByName: string | null;
        requestedAt: string;
        releasedByName: string | null;
        affectedReservations: number;
    } | null;
    raisedAt: string;
    verifiedAt: string | null;
    photos: {
        key: string;
        caption: string;
    }[];
    parts: {
        name: string;
        id: string;
        source: string;
        unit: string | null;
        state: "requested" | "ordered" | "issued" | "contractor";
        quantity: number;
    }[];
    spaceId: string | null;
    spaceName: string | null;
    assetId: string | null;
    assetName: string | null;
    assignedContractor: string | null;
    scheduledFor: string | null;
    raisedVia: string | null;
    impactNote: string | null;
    releaseNote: string | null;
}, {
    status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
    id: string;
    title: string;
    events: {
        kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
        id: string;
        note: string | null;
        occurredAt: string;
        actorName: string | null;
    }[];
    reference: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    resolvedAt: string | null;
    roomTypeName: string | null;
    roomId: string | null;
    roomLabel: string | null;
    raisedByName: string | null;
    description: string | null;
    priority: "low" | "normal" | "high" | "urgent";
    propertyId: string | null;
    assignedToUserId: string | null;
    assignedToName: string | null;
    floor: number | null;
    block: {
        status: "active" | "declined" | "released" | "requested";
        decidedAt: string | null;
        id: string;
        reason: string;
        decisionNote: string | null;
        releasedAt: string | null;
        startsAt: string;
        endsAt: string | null;
        decidedByName: string | null;
        requestedByName: string | null;
        requestedAt: string;
        releasedByName: string | null;
        affectedReservations: number;
    } | null;
    raisedAt: string;
    verifiedAt: string | null;
    photos: {
        key: string;
        caption: string;
    }[];
    parts: {
        name: string;
        id: string;
        source: string;
        unit: string | null;
        state: "requested" | "ordered" | "issued" | "contractor";
        quantity: number;
    }[];
    spaceId: string | null;
    spaceName: string | null;
    assetId: string | null;
    assetName: string | null;
    assignedContractor: string | null;
    scheduledFor: string | null;
    raisedVia: string | null;
    impactNote: string | null;
    releaseNote: string | null;
}>;
export type WorkOrder = z.infer<typeof WorkOrder>;
export declare const WorkOrderAssignee: z.ZodObject<{
    userId: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    userId: string | null;
}, {
    name: string;
    userId: string | null;
}>;
export type WorkOrderAssignee = z.infer<typeof WorkOrderAssignee>;
export declare const WorkOrderList: z.ZodObject<{
    workOrders: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        /** "WO-318": what people say on the radio. Unique per business. */
        reference: z.ZodString;
        propertyId: z.ZodNullable<z.ZodString>;
        roomId: z.ZodNullable<z.ZodString>;
        roomLabel: z.ZodNullable<z.ZodString>;
        roomTypeName: z.ZodNullable<z.ZodString>;
        floor: z.ZodNullable<z.ZodNumber>;
        spaceId: z.ZodNullable<z.ZodString>;
        spaceName: z.ZodNullable<z.ZodString>;
        assetId: z.ZodNullable<z.ZodString>;
        assetName: z.ZodNullable<z.ZodString>;
        title: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
        category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
        priority: z.ZodEnum<["low", "normal", "high", "urgent"]>;
        status: z.ZodEnum<["open", "assigned", "in_progress", "resolved", "closed", "cancelled"]>;
        assignedToUserId: z.ZodNullable<z.ZodString>;
        assignedToName: z.ZodNullable<z.ZodString>;
        /** An outside firm doing the work, when no staff member is. */
        assignedContractor: z.ZodNullable<z.ZodString>;
        scheduledFor: z.ZodNullable<z.ZodString>;
        raisedByName: z.ZodNullable<z.ZodString>;
        /** How it reached us: "staff app", "front desk · guest complaint", "planned schedule". */
        raisedVia: z.ZodNullable<z.ZodString>;
        raisedAt: z.ZodString;
        /** What the fault means for the operation while it is open ("Lake Bar keeps trading …"). */
        impactNote: z.ZodNullable<z.ZodString>;
        /** What has to be true before the room goes back on sale. */
        releaseNote: z.ZodNullable<z.ZodString>;
        photos: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            caption: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            key: string;
            caption: string;
        }, {
            key: string;
            caption: string;
        }>, "many">;
        parts: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            quantity: z.ZodNumber;
            unit: z.ZodNullable<z.ZodString>;
            /** Where it comes from, in words: "Store · issued by …", "PO-26-0147 · due 13 Oct". */
            source: z.ZodString;
            state: z.ZodEnum<["requested", "ordered", "issued", "contractor"]>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            source: string;
            unit: string | null;
            state: "requested" | "ordered" | "issued" | "contractor";
            quantity: number;
        }, {
            name: string;
            id: string;
            source: string;
            unit: string | null;
            state: "requested" | "ordered" | "issued" | "contractor";
            quantity: number;
        }>, "many">;
        /** Oldest first. */
        events: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            kind: z.ZodEnum<["reported", "assigned", "block_requested", "block_approved", "block_declined", "block_released", "parts", "scheduled", "started", "note", "next_step", "fixed", "verified", "from_signal", "planned"]>;
            note: z.ZodNullable<z.ZodString>;
            actorName: z.ZodNullable<z.ZodString>;
            occurredAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
            id: string;
            note: string | null;
            occurredAt: string;
            actorName: string | null;
        }, {
            kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
            id: string;
            note: string | null;
            occurredAt: string;
            actorName: string | null;
        }>, "many">;
        /** The latest block on the room for this order (any status), or null. */
        block: z.ZodNullable<z.ZodObject<{
            id: z.ZodString;
            status: z.ZodEnum<["requested", "active", "declined", "released"]>;
            startsAt: z.ZodString;
            /** Null: until released. */
            endsAt: z.ZodNullable<z.ZodString>;
            reason: z.ZodString;
            requestedByName: z.ZodNullable<z.ZodString>;
            requestedAt: z.ZodString;
            decidedByName: z.ZodNullable<z.ZodString>;
            decidedAt: z.ZodNullable<z.ZodString>;
            decisionNote: z.ZodNullable<z.ZodString>;
            releasedByName: z.ZodNullable<z.ZodString>;
            releasedAt: z.ZodNullable<z.ZodString>;
            /** Reservations holding the room inside the block's dates (they would need another room). */
            affectedReservations: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            status: "active" | "declined" | "released" | "requested";
            decidedAt: string | null;
            id: string;
            reason: string;
            decisionNote: string | null;
            releasedAt: string | null;
            startsAt: string;
            endsAt: string | null;
            decidedByName: string | null;
            requestedByName: string | null;
            requestedAt: string;
            releasedByName: string | null;
            affectedReservations: number;
        }, {
            status: "active" | "declined" | "released" | "requested";
            decidedAt: string | null;
            id: string;
            reason: string;
            decisionNote: string | null;
            releasedAt: string | null;
            startsAt: string;
            endsAt: string | null;
            decidedByName: string | null;
            requestedByName: string | null;
            requestedAt: string;
            releasedByName: string | null;
            affectedReservations: number;
        }>>;
        resolvedAt: z.ZodNullable<z.ZodString>;
        verifiedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
        id: string;
        title: string;
        events: {
            kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
            id: string;
            note: string | null;
            occurredAt: string;
            actorName: string | null;
        }[];
        reference: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        resolvedAt: string | null;
        roomTypeName: string | null;
        roomId: string | null;
        roomLabel: string | null;
        raisedByName: string | null;
        description: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        propertyId: string | null;
        assignedToUserId: string | null;
        assignedToName: string | null;
        floor: number | null;
        block: {
            status: "active" | "declined" | "released" | "requested";
            decidedAt: string | null;
            id: string;
            reason: string;
            decisionNote: string | null;
            releasedAt: string | null;
            startsAt: string;
            endsAt: string | null;
            decidedByName: string | null;
            requestedByName: string | null;
            requestedAt: string;
            releasedByName: string | null;
            affectedReservations: number;
        } | null;
        raisedAt: string;
        verifiedAt: string | null;
        photos: {
            key: string;
            caption: string;
        }[];
        parts: {
            name: string;
            id: string;
            source: string;
            unit: string | null;
            state: "requested" | "ordered" | "issued" | "contractor";
            quantity: number;
        }[];
        spaceId: string | null;
        spaceName: string | null;
        assetId: string | null;
        assetName: string | null;
        assignedContractor: string | null;
        scheduledFor: string | null;
        raisedVia: string | null;
        impactNote: string | null;
        releaseNote: string | null;
    }, {
        status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
        id: string;
        title: string;
        events: {
            kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
            id: string;
            note: string | null;
            occurredAt: string;
            actorName: string | null;
        }[];
        reference: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        resolvedAt: string | null;
        roomTypeName: string | null;
        roomId: string | null;
        roomLabel: string | null;
        raisedByName: string | null;
        description: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        propertyId: string | null;
        assignedToUserId: string | null;
        assignedToName: string | null;
        floor: number | null;
        block: {
            status: "active" | "declined" | "released" | "requested";
            decidedAt: string | null;
            id: string;
            reason: string;
            decisionNote: string | null;
            releasedAt: string | null;
            startsAt: string;
            endsAt: string | null;
            decidedByName: string | null;
            requestedByName: string | null;
            requestedAt: string;
            releasedByName: string | null;
            affectedReservations: number;
        } | null;
        raisedAt: string;
        verifiedAt: string | null;
        photos: {
            key: string;
            caption: string;
        }[];
        parts: {
            name: string;
            id: string;
            source: string;
            unit: string | null;
            state: "requested" | "ordered" | "issued" | "contractor";
            quantity: number;
        }[];
        spaceId: string | null;
        spaceName: string | null;
        assetId: string | null;
        assetName: string | null;
        assignedContractor: string | null;
        scheduledFor: string | null;
        raisedVia: string | null;
        impactNote: string | null;
        releaseNote: string | null;
    }>, "many">;
    /** People and firms who have worked orders here: who "Assign to …" can name. */
    assignees: z.ZodArray<z.ZodObject<{
        userId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        userId: string | null;
    }, {
        name: string;
        userId: string | null;
    }>, "many">;
    /** Who usually takes the work: the staff member with the most orders in the last 30 days. */
    suggestedAssignee: z.ZodNullable<z.ZodObject<{
        userId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        userId: string | null;
    }, {
        name: string;
        userId: string | null;
    }>>;
    /** Median hours from report to fixed, over orders closed in the last 30 days. */
    medianHoursToClose: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    workOrders: {
        status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
        id: string;
        title: string;
        events: {
            kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
            id: string;
            note: string | null;
            occurredAt: string;
            actorName: string | null;
        }[];
        reference: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        resolvedAt: string | null;
        roomTypeName: string | null;
        roomId: string | null;
        roomLabel: string | null;
        raisedByName: string | null;
        description: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        propertyId: string | null;
        assignedToUserId: string | null;
        assignedToName: string | null;
        floor: number | null;
        block: {
            status: "active" | "declined" | "released" | "requested";
            decidedAt: string | null;
            id: string;
            reason: string;
            decisionNote: string | null;
            releasedAt: string | null;
            startsAt: string;
            endsAt: string | null;
            decidedByName: string | null;
            requestedByName: string | null;
            requestedAt: string;
            releasedByName: string | null;
            affectedReservations: number;
        } | null;
        raisedAt: string;
        verifiedAt: string | null;
        photos: {
            key: string;
            caption: string;
        }[];
        parts: {
            name: string;
            id: string;
            source: string;
            unit: string | null;
            state: "requested" | "ordered" | "issued" | "contractor";
            quantity: number;
        }[];
        spaceId: string | null;
        spaceName: string | null;
        assetId: string | null;
        assetName: string | null;
        assignedContractor: string | null;
        scheduledFor: string | null;
        raisedVia: string | null;
        impactNote: string | null;
        releaseNote: string | null;
    }[];
    assignees: {
        name: string;
        userId: string | null;
    }[];
    suggestedAssignee: {
        name: string;
        userId: string | null;
    } | null;
    medianHoursToClose: number | null;
}, {
    workOrders: {
        status: "open" | "resolved" | "closed" | "cancelled" | "assigned" | "in_progress";
        id: string;
        title: string;
        events: {
            kind: "verified" | "fixed" | "note" | "scheduled" | "assigned" | "reported" | "block_requested" | "block_approved" | "block_declined" | "block_released" | "parts" | "started" | "next_step" | "from_signal" | "planned";
            id: string;
            note: string | null;
            occurredAt: string;
            actorName: string | null;
        }[];
        reference: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        resolvedAt: string | null;
        roomTypeName: string | null;
        roomId: string | null;
        roomLabel: string | null;
        raisedByName: string | null;
        description: string | null;
        priority: "low" | "normal" | "high" | "urgent";
        propertyId: string | null;
        assignedToUserId: string | null;
        assignedToName: string | null;
        floor: number | null;
        block: {
            status: "active" | "declined" | "released" | "requested";
            decidedAt: string | null;
            id: string;
            reason: string;
            decisionNote: string | null;
            releasedAt: string | null;
            startsAt: string;
            endsAt: string | null;
            decidedByName: string | null;
            requestedByName: string | null;
            requestedAt: string;
            releasedByName: string | null;
            affectedReservations: number;
        } | null;
        raisedAt: string;
        verifiedAt: string | null;
        photos: {
            key: string;
            caption: string;
        }[];
        parts: {
            name: string;
            id: string;
            source: string;
            unit: string | null;
            state: "requested" | "ordered" | "issued" | "contractor";
            quantity: number;
        }[];
        spaceId: string | null;
        spaceName: string | null;
        assetId: string | null;
        assetName: string | null;
        assignedContractor: string | null;
        scheduledFor: string | null;
        raisedVia: string | null;
        impactNote: string | null;
        releaseNote: string | null;
    }[];
    assignees: {
        name: string;
        userId: string | null;
    }[];
    suggestedAssignee: {
        name: string;
        userId: string | null;
    } | null;
    medianHoursToClose: number | null;
}>;
export type WorkOrderList = z.infer<typeof WorkOrderList>;
export declare const CreateWorkOrderRequest: z.ZodObject<{
    /**
     * Where the fault is, as people say it: "Room 302", "Lake Bar", "Generator". The server resolves
     * it to a room, a space or a piece of equipment of the property, and refuses a place it does not
     * know rather than inventing one.
     */
    location: z.ZodString;
    propertyId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    priority: z.ZodDefault<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
    assignee: z.ZodOptional<z.ZodEffects<z.ZodObject<{
        userId: z.ZodOptional<z.ZodString>;
        contractor: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        userId?: string | undefined;
        contractor?: string | undefined;
    }, {
        userId?: string | undefined;
        contractor?: string | undefined;
    }>, {
        userId?: string | undefined;
        contractor?: string | undefined;
    }, {
        userId?: string | undefined;
        contractor?: string | undefined;
    }>>;
    /** Ask for the room to come off sale while the work is done (rooms only). Needs a manager's approval. */
    requestBlock: z.ZodOptional<z.ZodObject<{
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string;
    }, {
        reason: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    priority: "low" | "normal" | "high" | "urgent";
    location: string;
    category?: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | undefined;
    description?: string | undefined;
    propertyId?: string | undefined;
    assignee?: {
        userId?: string | undefined;
        contractor?: string | undefined;
    } | undefined;
    requestBlock?: {
        reason: string;
    } | undefined;
}, {
    title: string;
    location: string;
    category?: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | undefined;
    description?: string | undefined;
    priority?: "low" | "normal" | "high" | "urgent" | undefined;
    propertyId?: string | undefined;
    assignee?: {
        userId?: string | undefined;
        contractor?: string | undefined;
    } | undefined;
    requestBlock?: {
        reason: string;
    } | undefined;
}>;
export type CreateWorkOrderRequest = z.infer<typeof CreateWorkOrderRequest>;
export declare const AssignWorkOrderRequest: z.ZodEffects<z.ZodObject<{
    userId: z.ZodOptional<z.ZodString>;
    contractor: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    userId?: string | undefined;
    contractor?: string | undefined;
}, {
    userId?: string | undefined;
    contractor?: string | undefined;
}>, {
    userId?: string | undefined;
    contractor?: string | undefined;
}, {
    userId?: string | undefined;
    contractor?: string | undefined;
}>;
export type AssignWorkOrderRequest = z.infer<typeof AssignWorkOrderRequest>;
export declare const AddWorkOrderNoteRequest: z.ZodObject<{
    note: z.ZodString;
}, "strip", z.ZodTypeAny, {
    note: string;
}, {
    note: string;
}>;
export type AddWorkOrderNoteRequest = z.infer<typeof AddWorkOrderNoteRequest>;
export declare const DecideRoomBlockRequest: z.ZodObject<{
    decision: z.ZodEnum<["approve", "decline"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    decision: "approve" | "decline";
    note?: string | undefined;
}, {
    decision: "approve" | "decline";
    note?: string | undefined;
}>;
export type DecideRoomBlockRequest = z.infer<typeof DecideRoomBlockRequest>;
export declare const ReleaseRoomRequest: z.ZodObject<{
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
}, {
    note?: string | undefined;
}>;
export type ReleaseRoomRequest = z.infer<typeof ReleaseRoomRequest>;
export declare const ConditionSignalConfidence: z.ZodEnum<["high", "medium", "low"]>;
export type ConditionSignalConfidence = z.infer<typeof ConditionSignalConfidence>;
export declare const ConditionSignalStatus: z.ZodEnum<["open", "actioned", "dismissed"]>;
export type ConditionSignalStatus = z.infer<typeof ConditionSignalStatus>;
/** The work order a signal proposes, as the manager will see it before creating it. */
export declare const ConditionSignalDraft: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    priority: z.ZodEnum<["low", "normal", "high", "urgent"]>;
    location: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    priority: "low" | "normal" | "high" | "urgent";
    location: string;
}, {
    title: string;
    description: string;
    priority: "low" | "normal" | "high" | "urgent";
    location: string;
}>;
export type ConditionSignalDraft = z.infer<typeof ConditionSignalDraft>;
export declare const ConditionSignal: z.ZodObject<{
    id: z.ZodString;
    ruleCode: z.ZodString;
    ruleText: z.ZodString;
    assetId: z.ZodNullable<z.ZodString>;
    assetName: z.ZodString;
    headline: z.ZodString;
    confidence: z.ZodEnum<["high", "medium", "low"]>;
    evidence: z.ZodArray<z.ZodString, "many">;
    dataQuality: z.ZodString;
    recommendation: z.ZodString;
    status: z.ZodEnum<["open", "actioned", "dismissed"]>;
    draft: z.ZodNullable<z.ZodObject<{
        title: z.ZodString;
        description: z.ZodString;
        priority: z.ZodEnum<["low", "normal", "high", "urgent"]>;
        location: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        title: string;
        description: string;
        priority: "low" | "normal" | "high" | "urgent";
        location: string;
    }, {
        title: string;
        description: string;
        priority: "low" | "normal" | "high" | "urgent";
        location: string;
    }>>;
    workOrderId: z.ZodNullable<z.ZodString>;
    workOrderReference: z.ZodNullable<z.ZodString>;
    raisedAt: z.ZodString;
    reviewedByName: z.ZodNullable<z.ZodString>;
    reviewedAt: z.ZodNullable<z.ZodString>;
    reviewNote: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "open" | "actioned" | "dismissed";
    id: string;
    draft: {
        title: string;
        description: string;
        priority: "low" | "normal" | "high" | "urgent";
        location: string;
    } | null;
    workOrderId: string | null;
    workOrderReference: string | null;
    raisedAt: string;
    evidence: string[];
    headline: string;
    assetId: string | null;
    assetName: string;
    ruleCode: string;
    ruleText: string;
    confidence: "low" | "high" | "medium";
    dataQuality: string;
    recommendation: string;
    reviewedByName: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
}, {
    status: "open" | "actioned" | "dismissed";
    id: string;
    draft: {
        title: string;
        description: string;
        priority: "low" | "normal" | "high" | "urgent";
        location: string;
    } | null;
    workOrderId: string | null;
    workOrderReference: string | null;
    raisedAt: string;
    evidence: string[];
    headline: string;
    assetId: string | null;
    assetName: string;
    ruleCode: string;
    ruleText: string;
    confidence: "low" | "high" | "medium";
    dataQuality: string;
    recommendation: string;
    reviewedByName: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
}>;
export type ConditionSignal = z.infer<typeof ConditionSignal>;
export declare const ConditionSignalList: z.ZodObject<{
    signals: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ruleCode: z.ZodString;
        ruleText: z.ZodString;
        assetId: z.ZodNullable<z.ZodString>;
        assetName: z.ZodString;
        headline: z.ZodString;
        confidence: z.ZodEnum<["high", "medium", "low"]>;
        evidence: z.ZodArray<z.ZodString, "many">;
        dataQuality: z.ZodString;
        recommendation: z.ZodString;
        status: z.ZodEnum<["open", "actioned", "dismissed"]>;
        draft: z.ZodNullable<z.ZodObject<{
            title: z.ZodString;
            description: z.ZodString;
            priority: z.ZodEnum<["low", "normal", "high", "urgent"]>;
            location: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            title: string;
            description: string;
            priority: "low" | "normal" | "high" | "urgent";
            location: string;
        }, {
            title: string;
            description: string;
            priority: "low" | "normal" | "high" | "urgent";
            location: string;
        }>>;
        workOrderId: z.ZodNullable<z.ZodString>;
        workOrderReference: z.ZodNullable<z.ZodString>;
        raisedAt: z.ZodString;
        reviewedByName: z.ZodNullable<z.ZodString>;
        reviewedAt: z.ZodNullable<z.ZodString>;
        reviewNote: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "open" | "actioned" | "dismissed";
        id: string;
        draft: {
            title: string;
            description: string;
            priority: "low" | "normal" | "high" | "urgent";
            location: string;
        } | null;
        workOrderId: string | null;
        workOrderReference: string | null;
        raisedAt: string;
        evidence: string[];
        headline: string;
        assetId: string | null;
        assetName: string;
        ruleCode: string;
        ruleText: string;
        confidence: "low" | "high" | "medium";
        dataQuality: string;
        recommendation: string;
        reviewedByName: string | null;
        reviewedAt: string | null;
        reviewNote: string | null;
    }, {
        status: "open" | "actioned" | "dismissed";
        id: string;
        draft: {
            title: string;
            description: string;
            priority: "low" | "normal" | "high" | "urgent";
            location: string;
        } | null;
        workOrderId: string | null;
        workOrderReference: string | null;
        raisedAt: string;
        evidence: string[];
        headline: string;
        assetId: string | null;
        assetName: string;
        ruleCode: string;
        ruleText: string;
        confidence: "low" | "high" | "medium";
        dataQuality: string;
        recommendation: string;
        reviewedByName: string | null;
        reviewedAt: string | null;
        reviewNote: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    signals: {
        status: "open" | "actioned" | "dismissed";
        id: string;
        draft: {
            title: string;
            description: string;
            priority: "low" | "normal" | "high" | "urgent";
            location: string;
        } | null;
        workOrderId: string | null;
        workOrderReference: string | null;
        raisedAt: string;
        evidence: string[];
        headline: string;
        assetId: string | null;
        assetName: string;
        ruleCode: string;
        ruleText: string;
        confidence: "low" | "high" | "medium";
        dataQuality: string;
        recommendation: string;
        reviewedByName: string | null;
        reviewedAt: string | null;
        reviewNote: string | null;
    }[];
}, {
    signals: {
        status: "open" | "actioned" | "dismissed";
        id: string;
        draft: {
            title: string;
            description: string;
            priority: "low" | "normal" | "high" | "urgent";
            location: string;
        } | null;
        workOrderId: string | null;
        workOrderReference: string | null;
        raisedAt: string;
        evidence: string[];
        headline: string;
        assetId: string | null;
        assetName: string;
        ruleCode: string;
        ruleText: string;
        confidence: "low" | "high" | "medium";
        dataQuality: string;
        recommendation: string;
        reviewedByName: string | null;
        reviewedAt: string | null;
        reviewNote: string | null;
    }[];
}>;
export type ConditionSignalList = z.infer<typeof ConditionSignalList>;
export declare const DismissConditionSignalRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type DismissConditionSignalRequest = z.infer<typeof DismissConditionSignalRequest>;
//# sourceMappingURL=maintenance.d.ts.map