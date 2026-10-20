import { z } from "zod";
export declare const HousekeepingChecklistKind: z.ZodEnum<["cleaning", "inspection"]>;
export type HousekeepingChecklistKind = z.infer<typeof HousekeepingChecklistKind>;
export declare const HousekeepingChecklistItem: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["cleaning", "inspection"]>;
    sectionCode: z.ZodString;
    sectionTitle: z.ZodString;
    code: z.ZodString;
    label: z.ZodString;
    requiresPhoto: z.ZodBoolean;
    sortOrder: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code: string;
    kind: "inspection" | "cleaning";
    id: string;
    sortOrder: number;
    label: string;
    sectionCode: string;
    sectionTitle: string;
    requiresPhoto: boolean;
}, {
    code: string;
    kind: "inspection" | "cleaning";
    id: string;
    sortOrder: number;
    label: string;
    sectionCode: string;
    sectionTitle: string;
    requiresPhoto: boolean;
}>;
export type HousekeepingChecklistItem = z.infer<typeof HousekeepingChecklistItem>;
export declare const HousekeepingCheckResult: z.ZodEnum<["done", "pass", "fail"]>;
export type HousekeepingCheckResult = z.infer<typeof HousekeepingCheckResult>;
/** The result one checklist item got on one task. */
export declare const HousekeepingTaskCheck: z.ZodObject<{
    taskId: z.ZodString;
    itemId: z.ZodString;
    result: z.ZodEnum<["done", "pass", "fail"]>;
    photoObjectKey: z.ZodNullable<z.ZodString>;
    checkedByName: z.ZodNullable<z.ZodString>;
    checkedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    checkedAt: string;
    checkedByName: string | null;
    result: "done" | "pass" | "fail";
    taskId: string;
    itemId: string;
    photoObjectKey: string | null;
}, {
    checkedAt: string;
    checkedByName: string | null;
    result: "done" | "pass" | "fail";
    taskId: string;
    itemId: string;
    photoObjectKey: string | null;
}>;
export type HousekeepingTaskCheck = z.infer<typeof HousekeepingTaskCheck>;
/** `POST /ops/housekeeping/tasks/:id/checks`: tick (or untick) one cleaning step. */
export declare const SetHousekeepingCheckRequest: z.ZodObject<{
    itemId: z.ZodString;
    done: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    done: boolean;
    itemId: string;
}, {
    done: boolean;
    itemId: string;
}>;
export type SetHousekeepingCheckRequest = z.infer<typeof SetHousekeepingCheckRequest>;
/** One inspection check's verdict, sent with the inspection decision. */
export declare const InspectionCheckVerdict: z.ZodObject<{
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
}>;
export type InspectionCheckVerdict = z.infer<typeof InspectionCheckVerdict>;
export declare const MinibarStockItem: z.ZodObject<{
    id: z.ZodString;
    code: z.ZodString;
    label: z.ZodString;
    /** How many a room is stocked with. */
    parLevel: z.ZodNumber;
    sortOrder: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    code: string;
    id: string;
    sortOrder: number;
    label: string;
    parLevel: number;
}, {
    code: string;
    id: string;
    sortOrder: number;
    label: string;
    parLevel: number;
}>;
export type MinibarStockItem = z.infer<typeof MinibarStockItem>;
export declare const MinibarCount: z.ZodObject<{
    taskId: z.ZodString;
    itemId: z.ZodString;
    parLevel: z.ZodNumber;
    used: z.ZodNumber;
    countedByName: z.ZodNullable<z.ZodString>;
    countedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    taskId: string;
    itemId: string;
    parLevel: number;
    used: number;
    countedByName: string | null;
    countedAt: string;
}, {
    taskId: string;
    itemId: string;
    parLevel: number;
    used: number;
    countedByName: string | null;
    countedAt: string;
}>;
export type MinibarCount = z.infer<typeof MinibarCount>;
/**
 * `POST /ops/housekeeping/tasks/:id/minibar`: what was used, one line per item. Sending again replaces
 * the count. A report for the front desk, never a charge.
 */
export declare const SendMinibarCountRequest: z.ZodObject<{
    counts: z.ZodArray<z.ZodObject<{
        itemId: z.ZodString;
        used: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        itemId: string;
        used: number;
    }, {
        itemId: string;
        used: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    counts: {
        itemId: string;
        used: number;
    }[];
}, {
    counts: {
        itemId: string;
        used: number;
    }[];
}>;
export type SendMinibarCountRequest = z.infer<typeof SendMinibarCountRequest>;
/**
 * `POST /ops/housekeeping/tasks/:id/found-items`: the cleaner logs what she found in the task's room.
 * It goes into the lost and found register (`found_items`) with her as the finder and today's
 * supervisor as the custodian it is handed to; the register itself stays `lostfound.manage`'s.
 */
export declare const LogPhoneFoundItemRequest: z.ZodObject<{
    description: z.ZodString;
    /** Where in the room: "bedside drawer". */
    spot: z.ZodString;
    /** What kind of thing it is; "other" when the phone does not ask. Valuables are never logged from the phone. */
    category: z.ZodOptional<z.ZodEnum<["electronics", "jewellery", "clothing", "accessories", "documents", "cash", "other"]>>;
    photoCount: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    description: string;
    spot: string;
    category?: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories" | undefined;
    photoCount?: number | undefined;
}, {
    description: string;
    spot: string;
    category?: "other" | "documents" | "cash" | "electronics" | "jewellery" | "clothing" | "accessories" | undefined;
    photoCount?: number | undefined;
}>;
export type LogPhoneFoundItemRequest = z.infer<typeof LogPhoneFoundItemRequest>;
/** An item the caller found, as the phone shows it. */
export declare const PhoneFoundItem: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodString;
    description: z.ZodString;
    roomLabel: z.ZodNullable<z.ZodString>;
    foundLocation: z.ZodString;
    foundSpot: z.ZodNullable<z.ZodString>;
    foundAt: z.ZodString;
    category: z.ZodString;
    photoCount: z.ZodNumber;
    custodianName: z.ZodNullable<z.ZodString>;
    status: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: string;
    id: string;
    reference: string;
    category: string;
    roomLabel: string | null;
    description: string;
    foundLocation: string;
    foundSpot: string | null;
    foundAt: string;
    custodianName: string | null;
    photoCount: number;
}, {
    status: string;
    id: string;
    reference: string;
    category: string;
    roomLabel: string | null;
    description: string;
    foundLocation: string;
    foundSpot: string | null;
    foundAt: string;
    custodianName: string | null;
    photoCount: number;
}>;
export type PhoneFoundItem = z.infer<typeof PhoneFoundItem>;
/** A booking arriving today into a room, with its party size (the board names the guest only). */
export declare const PhoneArrival: z.ZodObject<{
    roomId: z.ZodString;
    guests: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    guests: number;
    roomId: string;
}, {
    guests: number;
    roomId: string;
}>;
export type PhoneArrival = z.infer<typeof PhoneArrival>;
/** A place on the caller's floors that is not a room ("Corridor F2"), for reporting a fault. */
export declare const PhonePlace: z.ZodObject<{
    spaceId: z.ZodString;
    name: z.ZodString;
    floor: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    spaceId: string;
    floor: number | null;
}, {
    name: string;
    spaceId: string;
    floor: number | null;
}>;
export type PhonePlace = z.infer<typeof PhonePlace>;
/**
 * `GET /ops/housekeeping/phone`: the property's checklists, the results its open and today's tasks
 * got, the minibar stock and counts, today's arrivals' party sizes, the spaces on the caller's
 * floors, today's supervisor and the items the caller found. Read beside the housekeeping board.
 */
export declare const HousekeepingPhone: z.ZodObject<{
    propertyId: z.ZodString;
    checklist: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["cleaning", "inspection"]>;
        sectionCode: z.ZodString;
        sectionTitle: z.ZodString;
        code: z.ZodString;
        label: z.ZodString;
        requiresPhoto: z.ZodBoolean;
        sortOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        kind: "inspection" | "cleaning";
        id: string;
        sortOrder: number;
        label: string;
        sectionCode: string;
        sectionTitle: string;
        requiresPhoto: boolean;
    }, {
        code: string;
        kind: "inspection" | "cleaning";
        id: string;
        sortOrder: number;
        label: string;
        sectionCode: string;
        sectionTitle: string;
        requiresPhoto: boolean;
    }>, "many">;
    checks: z.ZodArray<z.ZodObject<{
        taskId: z.ZodString;
        itemId: z.ZodString;
        result: z.ZodEnum<["done", "pass", "fail"]>;
        photoObjectKey: z.ZodNullable<z.ZodString>;
        checkedByName: z.ZodNullable<z.ZodString>;
        checkedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        checkedAt: string;
        checkedByName: string | null;
        result: "done" | "pass" | "fail";
        taskId: string;
        itemId: string;
        photoObjectKey: string | null;
    }, {
        checkedAt: string;
        checkedByName: string | null;
        result: "done" | "pass" | "fail";
        taskId: string;
        itemId: string;
        photoObjectKey: string | null;
    }>, "many">;
    minibarItems: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        code: z.ZodString;
        label: z.ZodString;
        /** How many a room is stocked with. */
        parLevel: z.ZodNumber;
        sortOrder: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        code: string;
        id: string;
        sortOrder: number;
        label: string;
        parLevel: number;
    }, {
        code: string;
        id: string;
        sortOrder: number;
        label: string;
        parLevel: number;
    }>, "many">;
    minibarCounts: z.ZodArray<z.ZodObject<{
        taskId: z.ZodString;
        itemId: z.ZodString;
        parLevel: z.ZodNumber;
        used: z.ZodNumber;
        countedByName: z.ZodNullable<z.ZodString>;
        countedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        taskId: string;
        itemId: string;
        parLevel: number;
        used: number;
        countedByName: string | null;
        countedAt: string;
    }, {
        taskId: string;
        itemId: string;
        parLevel: number;
        used: number;
        countedByName: string | null;
        countedAt: string;
    }>, "many">;
    arrivals: z.ZodArray<z.ZodObject<{
        roomId: z.ZodString;
        guests: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        guests: number;
        roomId: string;
    }, {
        guests: number;
        roomId: string;
    }>, "many">;
    /** The floors today's allocation sheet gives the caller (empty when they are not on it). */
    myFloors: z.ZodArray<z.ZodNumber, "many">;
    places: z.ZodArray<z.ZodObject<{
        spaceId: z.ZodString;
        name: z.ZodString;
        floor: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        spaceId: string;
        floor: number | null;
    }, {
        name: string;
        spaceId: string;
        floor: number | null;
    }>, "many">;
    supervisor: z.ZodNullable<z.ZodObject<{
        userId: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        userId: string;
    }, {
        name: string;
        userId: string;
    }>>;
    /** Newest first: what the caller found and logged in the last thirty days. */
    foundItems: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodString;
        description: z.ZodString;
        roomLabel: z.ZodNullable<z.ZodString>;
        foundLocation: z.ZodString;
        foundSpot: z.ZodNullable<z.ZodString>;
        foundAt: z.ZodString;
        category: z.ZodString;
        photoCount: z.ZodNumber;
        custodianName: z.ZodNullable<z.ZodString>;
        status: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: string;
        id: string;
        reference: string;
        category: string;
        roomLabel: string | null;
        description: string;
        foundLocation: string;
        foundSpot: string | null;
        foundAt: string;
        custodianName: string | null;
        photoCount: number;
    }, {
        status: string;
        id: string;
        reference: string;
        category: string;
        roomLabel: string | null;
        description: string;
        foundLocation: string;
        foundSpot: string | null;
        foundAt: string;
        custodianName: string | null;
        photoCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    propertyId: string;
    supervisor: {
        name: string;
        userId: string;
    } | null;
    checklist: {
        code: string;
        kind: "inspection" | "cleaning";
        id: string;
        sortOrder: number;
        label: string;
        sectionCode: string;
        sectionTitle: string;
        requiresPhoto: boolean;
    }[];
    checks: {
        checkedAt: string;
        checkedByName: string | null;
        result: "done" | "pass" | "fail";
        taskId: string;
        itemId: string;
        photoObjectKey: string | null;
    }[];
    minibarItems: {
        code: string;
        id: string;
        sortOrder: number;
        label: string;
        parLevel: number;
    }[];
    minibarCounts: {
        taskId: string;
        itemId: string;
        parLevel: number;
        used: number;
        countedByName: string | null;
        countedAt: string;
    }[];
    arrivals: {
        guests: number;
        roomId: string;
    }[];
    myFloors: number[];
    places: {
        name: string;
        spaceId: string;
        floor: number | null;
    }[];
    foundItems: {
        status: string;
        id: string;
        reference: string;
        category: string;
        roomLabel: string | null;
        description: string;
        foundLocation: string;
        foundSpot: string | null;
        foundAt: string;
        custodianName: string | null;
        photoCount: number;
    }[];
}, {
    propertyId: string;
    supervisor: {
        name: string;
        userId: string;
    } | null;
    checklist: {
        code: string;
        kind: "inspection" | "cleaning";
        id: string;
        sortOrder: number;
        label: string;
        sectionCode: string;
        sectionTitle: string;
        requiresPhoto: boolean;
    }[];
    checks: {
        checkedAt: string;
        checkedByName: string | null;
        result: "done" | "pass" | "fail";
        taskId: string;
        itemId: string;
        photoObjectKey: string | null;
    }[];
    minibarItems: {
        code: string;
        id: string;
        sortOrder: number;
        label: string;
        parLevel: number;
    }[];
    minibarCounts: {
        taskId: string;
        itemId: string;
        parLevel: number;
        used: number;
        countedByName: string | null;
        countedAt: string;
    }[];
    arrivals: {
        guests: number;
        roomId: string;
    }[];
    myFloors: number[];
    places: {
        name: string;
        spaceId: string;
        floor: number | null;
    }[];
    foundItems: {
        status: string;
        id: string;
        reference: string;
        category: string;
        roomLabel: string | null;
        description: string;
        foundLocation: string;
        foundSpot: string | null;
        foundAt: string;
        custodianName: string | null;
        photoCount: number;
    }[];
}>;
export type HousekeepingPhone = z.infer<typeof HousekeepingPhone>;
export declare const WorkOrderTimeKind: z.ZodEnum<["diagnosis", "repair"]>;
export type WorkOrderTimeKind = z.infer<typeof WorkOrderTimeKind>;
export declare const WorkOrderTimeLog: z.ZodObject<{
    id: z.ZodString;
    ticketId: z.ZodString;
    userId: z.ZodString;
    userName: z.ZodNullable<z.ZodString>;
    kind: z.ZodEnum<["diagnosis", "repair"]>;
    startedAt: z.ZodString;
    /** Null while the timer runs. */
    endedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "diagnosis" | "repair";
    id: string;
    endedAt: string | null;
    userId: string;
    ticketId: string;
    startedAt: string;
    userName: string | null;
}, {
    kind: "diagnosis" | "repair";
    id: string;
    endedAt: string | null;
    userId: string;
    ticketId: string;
    startedAt: string;
    userName: string | null;
}>;
export type WorkOrderTimeLog = z.infer<typeof WorkOrderTimeLog>;
/** `GET /ops/maintenance-time-logs`: the sessions on the workspace's open orders (and those closed this week). */
export declare const WorkOrderTimeLogList: z.ZodObject<{
    logs: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        ticketId: z.ZodString;
        userId: z.ZodString;
        userName: z.ZodNullable<z.ZodString>;
        kind: z.ZodEnum<["diagnosis", "repair"]>;
        startedAt: z.ZodString;
        /** Null while the timer runs. */
        endedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "diagnosis" | "repair";
        id: string;
        endedAt: string | null;
        userId: string;
        ticketId: string;
        startedAt: string;
        userName: string | null;
    }, {
        kind: "diagnosis" | "repair";
        id: string;
        endedAt: string | null;
        userId: string;
        ticketId: string;
        startedAt: string;
        userName: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    logs: {
        kind: "diagnosis" | "repair";
        id: string;
        endedAt: string | null;
        userId: string;
        ticketId: string;
        startedAt: string;
        userName: string | null;
    }[];
}, {
    logs: {
        kind: "diagnosis" | "repair";
        id: string;
        endedAt: string | null;
        userId: string;
        ticketId: string;
        startedAt: string;
        userName: string | null;
    }[];
}>;
export type WorkOrderTimeLogList = z.infer<typeof WorkOrderTimeLogList>;
/** `POST /ops/work-orders/:id/timer`: start or stop the caller's own session. */
export declare const WorkOrderTimerRequest: z.ZodObject<{
    running: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    running: boolean;
}, {
    running: boolean;
}>;
export type WorkOrderTimerRequest = z.infer<typeof WorkOrderTimerRequest>;
/**
 * `POST /ops/work-orders/:id/resolve`: what was done, and, for a room taken off sale, whether the
 * technician asks for it to go back on sale. Asking never releases it: housekeeping inspects and a
 * manager releases (`listing.manage`).
 */
export declare const ResolveWorkOrderRequest: z.ZodObject<{
    fix: z.ZodString;
    askRelease: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    fix: string;
    askRelease: boolean;
}, {
    fix: string;
    askRelease?: boolean | undefined;
}>;
export type ResolveWorkOrderRequest = z.infer<typeof ResolveWorkOrderRequest>;
/** One of the person's own papers: their contract, or a document kept on their file. */
export declare const MyDocument: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodEnum<["contract", "document"]>;
    title: z.ZodString;
    /** A document's state (requested, submitted, approved, rejected), or the contract's (active, …). */
    status: z.ZodString;
    contractType: z.ZodNullable<z.ZodString>;
    startsOn: z.ZodNullable<z.ZodString>;
    issuedOn: z.ZodNullable<z.ZodString>;
    expiresOn: z.ZodNullable<z.ZodString>;
    /** When HR last acted on it (approved a document). */
    checkedAt: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: string;
    kind: "document" | "contract";
    issuedOn: string | null;
    expiresOn: string | null;
    id: string;
    checkedAt: string | null;
    startsOn: string | null;
    title: string;
    contractType: string | null;
}, {
    status: string;
    kind: "document" | "contract";
    issuedOn: string | null;
    expiresOn: string | null;
    id: string;
    checkedAt: string | null;
    startsOn: string | null;
    title: string;
    contractType: string | null;
}>;
export type MyDocument = z.infer<typeof MyDocument>;
/** `GET /me/work/:employeeId/documents`. */
export declare const MyDocumentList: z.ZodObject<{
    documents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<["contract", "document"]>;
        title: z.ZodString;
        /** A document's state (requested, submitted, approved, rejected), or the contract's (active, …). */
        status: z.ZodString;
        contractType: z.ZodNullable<z.ZodString>;
        startsOn: z.ZodNullable<z.ZodString>;
        issuedOn: z.ZodNullable<z.ZodString>;
        expiresOn: z.ZodNullable<z.ZodString>;
        /** When HR last acted on it (approved a document). */
        checkedAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        kind: "document" | "contract";
        issuedOn: string | null;
        expiresOn: string | null;
        id: string;
        checkedAt: string | null;
        startsOn: string | null;
        title: string;
        contractType: string | null;
    }, {
        status: string;
        kind: "document" | "contract";
        issuedOn: string | null;
        expiresOn: string | null;
        id: string;
        checkedAt: string | null;
        startsOn: string | null;
        title: string;
        contractType: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    documents: {
        status: string;
        kind: "document" | "contract";
        issuedOn: string | null;
        expiresOn: string | null;
        id: string;
        checkedAt: string | null;
        startsOn: string | null;
        title: string;
        contractType: string | null;
    }[];
}, {
    documents: {
        status: string;
        kind: "document" | "contract";
        issuedOn: string | null;
        expiresOn: string | null;
        id: string;
        checkedAt: string | null;
        startsOn: string | null;
        title: string;
        contractType: string | null;
    }[];
}>;
export type MyDocumentList = z.infer<typeof MyDocumentList>;
export declare const LeaveApproversQuery: z.ZodObject<{
    leaveTypeId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    leaveTypeId?: string | undefined;
}, {
    leaveTypeId?: string | undefined;
}>;
export type LeaveApproversQuery = z.infer<typeof LeaveApproversQuery>;
/** One step of the approval a leave request will go through, and who decides it. */
export declare const LeaveApprovalStep: z.ZodObject<{
    order: z.ZodNumber;
    /** `line_manager` (the reporting manager) or `office` (whoever holds `leave.approve`, HR first). */
    role: z.ZodEnum<["line_manager", "office"]>;
    name: z.ZodString;
    jobTitle: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    role: "line_manager" | "office";
    order: number;
    jobTitle: string | null;
}, {
    name: string;
    role: "line_manager" | "office";
    order: number;
    jobTitle: string | null;
}>;
export type LeaveApprovalStep = z.infer<typeof LeaveApprovalStep>;
/** `GET /me/work/:employeeId/leave/approvers`: before asking, who will decide. */
export declare const LeaveApproverList: z.ZodObject<{
    steps: z.ZodArray<z.ZodObject<{
        order: z.ZodNumber;
        /** `line_manager` (the reporting manager) or `office` (whoever holds `leave.approve`, HR first). */
        role: z.ZodEnum<["line_manager", "office"]>;
        name: z.ZodString;
        jobTitle: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        role: "line_manager" | "office";
        order: number;
        jobTitle: string | null;
    }, {
        name: string;
        role: "line_manager" | "office";
        order: number;
        jobTitle: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    steps: {
        name: string;
        role: "line_manager" | "office";
        order: number;
        jobTitle: string | null;
    }[];
}, {
    steps: {
        name: string;
        role: "line_manager" | "office";
        order: number;
        jobTitle: string | null;
    }[];
}>;
export type LeaveApproverList = z.infer<typeof LeaveApproverList>;
/**
 * `GET /me/work/:employeeId/holidays/next`: the next national public holiday from today, read from the
 * recorded rule (`hr.rw.public_holidays`). Null when this year's and next year's are not recorded.
 */
export declare const NextPublicHoliday: z.ZodObject<{
    holiday: z.ZodNullable<z.ZodObject<{
        date: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        date: string;
        name: string;
    }, {
        date: string;
        name: string;
    }>>;
}, "strip", z.ZodTypeAny, {
    holiday: {
        date: string;
        name: string;
    } | null;
}, {
    holiday: {
        date: string;
        name: string;
    } | null;
}>;
export type NextPublicHoliday = z.infer<typeof NextPublicHoliday>;
//# sourceMappingURL=staff-phone.d.ts.map