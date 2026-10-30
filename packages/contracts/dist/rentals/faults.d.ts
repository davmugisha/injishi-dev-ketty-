import { z } from "zod";
import { MaintenanceCategory, MaintenancePriority, MaintenanceStatus } from "../ops";
/** The states a fault is still being worked in. `wont_fix` and `cancelled` can be reached from any of them. */
export declare const OPEN_TICKET_STATUSES: readonly MaintenanceStatus[];
/** Is the ticket still being worked? */
export declare function isOpenTicket(status: MaintenanceStatus): boolean;
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
export declare const TICKET_MOVES: Readonly<Record<MaintenanceStatus, readonly MaintenanceStatus[]>>;
/** May a ticket go from `from` to `to`? Staying where it is is not a move. */
export declare function ticketMayMove(from: MaintenanceStatus, to: MaintenanceStatus): boolean;
/** The landlord's words for each state. */
export declare const FAULT_STATUS_LABEL: Readonly<Record<MaintenanceStatus, string>>;
/** The tenant's words for each state, as their list reads it. */
export declare const FAULT_STATUS_TENANT: Readonly<Record<MaintenanceStatus, string>>;
/** How long after a fault is settled (fixed, closed or refused) the tenant may say it is not right. */
export declare const FAULT_REOPEN_DAYS = 14;
/** The states a tenant may reopen. */
export declare const REOPENABLE_STATUSES: readonly MaintenanceStatus[];
/**
 * The last Kigali day the tenant may reopen a fault settled at `resolvedAt`,
 * or null when it cannot be reopened (still open, cancelled, or the 14 days
 * have passed).
 */
export declare function faultReopenUntil(status: MaintenanceStatus, resolvedAt: string | Date | null, today?: string): string | null;
export declare const FAULT_CATEGORY_LABEL: Readonly<Record<MaintenanceCategory, string>>;
export declare const FAULT_URGENCY_LABEL: Readonly<Record<MaintenancePriority, string>>;
/** Who did something on a fault's timeline. */
export declare const FaultActorRole: z.ZodEnum<["tenant", "landlord", "system"]>;
export type FaultActorRole = z.infer<typeof FaultActorRole>;
/** Whom a fault is handed to: someone on the landlord's team, or an outside fixer. */
export declare const FaultAssigneeKind: z.ZodEnum<["member", "contractor"]>;
export type FaultAssigneeKind = z.infer<typeof FaultAssigneeKind>;
/** When a photo was taken: with the report, while the work went on, or of the fix. */
export declare const FaultPhotoPhase: z.ZodEnum<["report", "progress", "fixed"]>;
export type FaultPhotoPhase = z.infer<typeof FaultPhotoPhase>;
export declare const FAULT_PHOTO_PHASE_LABEL: Readonly<Record<FaultPhotoPhase, string>>;
/** At most this many photos in each phase. */
export declare const FAULT_PHOTOS_PER_PHASE = 4;
/** One photo is at most 10 MB. */
export declare const FAULT_PHOTO_MAX_BYTES: number;
/**
 * The sentence a timeline shows for a move, in plain words. `who` is the
 * assignee for an assignment ("Eric is assigned to fix it."). The tenant reads
 * the same sentence about their landlord.
 */
export declare function faultMoveWords(to: MaintenanceStatus, opts?: {
    from?: MaintenanceStatus | null;
    who?: string | null;
    byTenant?: boolean;
}): string;
/** Which faults a landlord's list shows. Reported is new (open or seen); In hand is assigned or being worked. */
export declare const FaultTab: z.ZodEnum<["open", "in_hand", "fixed", "closed"]>;
export type FaultTab = z.infer<typeof FaultTab>;
export declare const FAULT_TAB_LABEL: Readonly<Record<FaultTab, string>>;
export declare const FAULT_TAB_STATUSES: Readonly<Record<FaultTab, readonly MaintenanceStatus[]>>;
/** The tab a status sits under. */
export declare function faultTabOf(status: MaintenanceStatus): FaultTab;
/** The fault list's page size. */
export declare const FAULT_PAGE_SIZE = 25;
/** `GET /ops/faults?tab&unitId&q&page`. No tab: every fault. */
export declare const FaultListQuery: z.ZodObject<{
    tab: z.ZodOptional<z.ZodEnum<["open", "in_hand", "fixed", "closed"]>>;
    unitId: z.ZodOptional<z.ZodString>;
    q: z.ZodOptional<z.ZodString>;
    page: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    page: number;
    q?: string | undefined;
    unitId?: string | undefined;
    tab?: "fixed" | "open" | "closed" | "in_hand" | undefined;
}, {
    q?: string | undefined;
    page?: number | undefined;
    unitId?: string | undefined;
    tab?: "fixed" | "open" | "closed" | "in_hand" | undefined;
}>;
export type FaultListQuery = z.infer<typeof FaultListQuery>;
/** The tenant reports a fault on their home (photos come as files beside these fields). */
export declare const ReportFaultRequest: z.ZodObject<{
    title: z.ZodString;
    category: z.ZodDefault<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    description: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    urgency: z.ZodDefault<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
    /** May someone let themselves in when nobody is home? */
    staffMayEnter: z.ZodDefault<z.ZodEffects<z.ZodBoolean, boolean, unknown>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration";
    staffMayEnter: boolean;
    urgency: "low" | "normal" | "high" | "urgent";
    description?: string | undefined;
}, {
    title: string;
    description?: string | undefined;
    category?: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | undefined;
    staffMayEnter?: unknown;
    urgency?: "low" | "normal" | "high" | "urgent" | undefined;
}>;
export type ReportFaultRequest = z.infer<typeof ReportFaultRequest>;
/** The landlord writes down a fault on a unit: one a tenant phoned in, or one found on a visit. */
export declare const RaiseFaultRequest: z.ZodObject<{
    unitId: z.ZodString;
    title: z.ZodString;
    category: z.ZodDefault<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    description: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    urgency: z.ZodDefault<z.ZodEnum<["low", "normal", "high", "urgent"]>>;
    staffMayEnter: z.ZodOptional<z.ZodEffects<z.ZodBoolean, boolean, unknown>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration";
    unitId: string;
    urgency: "low" | "normal" | "high" | "urgent";
    description?: string | undefined;
    staffMayEnter?: boolean | undefined;
}, {
    title: string;
    unitId: string;
    description?: string | undefined;
    category?: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | undefined;
    staffMayEnter?: unknown;
    urgency?: "low" | "normal" | "high" | "urgent" | undefined;
}>;
export type RaiseFaultRequest = z.infer<typeof RaiseFaultRequest>;
/** Move a fault along its chain. "Won't fix" needs the reason, which the tenant is told. */
export declare const MoveFaultRequest: z.ZodEffects<z.ZodObject<{
    to: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
    note: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    note?: string | undefined;
}, {
    to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    note?: string | undefined;
}>, {
    to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    note?: string | undefined;
}, {
    to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    note?: string | undefined;
}>;
export type MoveFaultRequest = z.infer<typeof MoveFaultRequest>;
/** Hand a fault to someone on the team, or to an outside fixer with their phone. */
export declare const AssignFaultRequest: z.ZodEffects<z.ZodObject<{
    memberUserId: z.ZodOptional<z.ZodString>;
    contractorName: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    contractorPhone: z.ZodOptional<z.ZodPipeline<z.ZodEffects<z.ZodString, string | null, string>, z.ZodString>>;
    note: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    note?: string | undefined;
    memberUserId?: string | undefined;
    contractorName?: string | undefined;
    contractorPhone?: string | undefined;
}, {
    note?: string | undefined;
    memberUserId?: string | undefined;
    contractorName?: string | undefined;
    contractorPhone?: string | undefined;
}>, {
    note?: string | undefined;
    memberUserId?: string | undefined;
    contractorName?: string | undefined;
    contractorPhone?: string | undefined;
}, {
    note?: string | undefined;
    memberUserId?: string | undefined;
    contractorName?: string | undefined;
    contractorPhone?: string | undefined;
}>;
export type AssignFaultRequest = z.infer<typeof AssignFaultRequest>;
/** A landlord's message on a fault: a reply the tenant sees, or a note for the team only. */
export declare const FaultMessageRequest: z.ZodObject<{
    body: z.ZodString;
    visibleToTenant: z.ZodDefault<z.ZodEffects<z.ZodBoolean, boolean, unknown>>;
}, "strip", z.ZodTypeAny, {
    body: string;
    visibleToTenant: boolean;
}, {
    body: string;
    visibleToTenant?: unknown;
}>;
export type FaultMessageRequest = z.infer<typeof FaultMessageRequest>;
/** The tenant's message on their fault. */
export declare const TenantFaultMessageRequest: z.ZodObject<{
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
}, {
    body: string;
}>;
export type TenantFaultMessageRequest = z.infer<typeof TenantFaultMessageRequest>;
/** The tenant says the fix did not hold, or asks again after "won't fix". */
export declare const ReopenFaultRequest: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export type ReopenFaultRequest = z.infer<typeof ReopenFaultRequest>;
/** `POST …/photos`: which phase the files are of (the files themselves are multipart). */
export declare const FaultPhotoFields: z.ZodObject<{
    phase: z.ZodDefault<z.ZodEnum<["report", "progress", "fixed"]>>;
}, "strip", z.ZodTypeAny, {
    phase: "fixed" | "report" | "progress";
}, {
    phase?: "fixed" | "report" | "progress" | undefined;
}>;
export type FaultPhotoFields = z.infer<typeof FaultPhotoFields>;
/** Whoever is fixing it. The phone is the landlord's to see; the tenant gets the name. */
export declare const FaultAssigneeView: z.ZodObject<{
    kind: z.ZodEnum<["member", "contractor"]>;
    userId: z.ZodNullable<z.ZodString>;
    name: z.ZodString;
    phone: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    kind: "member" | "contractor";
    userId: string | null;
    phone: string | null;
}, {
    name: string;
    kind: "member" | "contractor";
    userId: string | null;
    phone: string | null;
}>;
export type FaultAssigneeView = z.infer<typeof FaultAssigneeView>;
/** One row of the landlord's fault list. */
export declare const FaultListItem: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    urgency: z.ZodEnum<["low", "normal", "high", "urgent"]>;
    status: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
    tab: z.ZodEnum<["open", "in_hand", "fixed", "closed"]>;
    unitId: z.ZodNullable<z.ZodString>;
    unitLabel: z.ZodNullable<z.ZodString>;
    propertyId: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    leaseId: z.ZodNullable<z.ZodString>;
    leaseReference: z.ZodNullable<z.ZodString>;
    tenantName: z.ZodNullable<z.ZodString>;
    /** Who reported it: the tenant from their home, or the landlord's side. */
    reportedBy: z.ZodEnum<["tenant", "landlord"]>;
    reportedAt: z.ZodString;
    updatedAt: z.ZodString;
    assigneeName: z.ZodNullable<z.ZodString>;
    photoCount: z.ZodNumber;
    /** A short-lived read of the first photo (the report's first), for the list's thumbnail; null without photos. */
    thumbUrl: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    title: string;
    propertyName: string | null;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    leaseId: string | null;
    unitLabel: string | null;
    tenantName: string | null;
    propertyId: string | null;
    unitId: string | null;
    tab: "fixed" | "open" | "closed" | "in_hand";
    photoCount: number;
    updatedAt: string;
    leaseReference: string | null;
    urgency: "low" | "normal" | "high" | "urgent";
    reportedBy: "landlord" | "tenant";
    reportedAt: string;
    assigneeName: string | null;
    thumbUrl: string | null;
}, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    title: string;
    propertyName: string | null;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    leaseId: string | null;
    unitLabel: string | null;
    tenantName: string | null;
    propertyId: string | null;
    unitId: string | null;
    tab: "fixed" | "open" | "closed" | "in_hand";
    photoCount: number;
    updatedAt: string;
    leaseReference: string | null;
    urgency: "low" | "normal" | "high" | "urgent";
    reportedBy: "landlord" | "tenant";
    reportedAt: string;
    assigneeName: string | null;
    thumbUrl: string | null;
}>;
export type FaultListItem = z.infer<typeof FaultListItem>;
export declare const FaultCounts: z.ZodRecord<z.ZodEnum<["open", "in_hand", "fixed", "closed"]>, z.ZodNumber>;
export type FaultCounts = z.infer<typeof FaultCounts>;
export declare const FaultListPage: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodNullable<z.ZodString>;
        title: z.ZodString;
        category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
        urgency: z.ZodEnum<["low", "normal", "high", "urgent"]>;
        status: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
        tab: z.ZodEnum<["open", "in_hand", "fixed", "closed"]>;
        unitId: z.ZodNullable<z.ZodString>;
        unitLabel: z.ZodNullable<z.ZodString>;
        propertyId: z.ZodNullable<z.ZodString>;
        propertyName: z.ZodNullable<z.ZodString>;
        leaseId: z.ZodNullable<z.ZodString>;
        leaseReference: z.ZodNullable<z.ZodString>;
        tenantName: z.ZodNullable<z.ZodString>;
        /** Who reported it: the tenant from their home, or the landlord's side. */
        reportedBy: z.ZodEnum<["tenant", "landlord"]>;
        reportedAt: z.ZodString;
        updatedAt: z.ZodString;
        assigneeName: z.ZodNullable<z.ZodString>;
        photoCount: z.ZodNumber;
        /** A short-lived read of the first photo (the report's first), for the list's thumbnail; null without photos. */
        thumbUrl: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        title: string;
        propertyName: string | null;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        leaseId: string | null;
        unitLabel: string | null;
        tenantName: string | null;
        propertyId: string | null;
        unitId: string | null;
        tab: "fixed" | "open" | "closed" | "in_hand";
        photoCount: number;
        updatedAt: string;
        leaseReference: string | null;
        urgency: "low" | "normal" | "high" | "urgent";
        reportedBy: "landlord" | "tenant";
        reportedAt: string;
        assigneeName: string | null;
        thumbUrl: string | null;
    }, {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        title: string;
        propertyName: string | null;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        leaseId: string | null;
        unitLabel: string | null;
        tenantName: string | null;
        propertyId: string | null;
        unitId: string | null;
        tab: "fixed" | "open" | "closed" | "in_hand";
        photoCount: number;
        updatedAt: string;
        leaseReference: string | null;
        urgency: "low" | "normal" | "high" | "urgent";
        reportedBy: "landlord" | "tenant";
        reportedAt: string;
        assigneeName: string | null;
        thumbUrl: string | null;
    }>, "many">;
    total: z.ZodNumber;
    page: z.ZodNumber;
    pageSize: z.ZodNumber;
    tab: z.ZodNullable<z.ZodEnum<["open", "in_hand", "fixed", "closed"]>>;
    counts: z.ZodRecord<z.ZodEnum<["open", "in_hand", "fixed", "closed"]>, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        title: string;
        propertyName: string | null;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        leaseId: string | null;
        unitLabel: string | null;
        tenantName: string | null;
        propertyId: string | null;
        unitId: string | null;
        tab: "fixed" | "open" | "closed" | "in_hand";
        photoCount: number;
        updatedAt: string;
        leaseReference: string | null;
        urgency: "low" | "normal" | "high" | "urgent";
        reportedBy: "landlord" | "tenant";
        reportedAt: string;
        assigneeName: string | null;
        thumbUrl: string | null;
    }[];
    total: number;
    counts: Partial<Record<"fixed" | "open" | "closed" | "in_hand", number>>;
    page: number;
    pageSize: number;
    tab: "fixed" | "open" | "closed" | "in_hand" | null;
}, {
    items: {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        title: string;
        propertyName: string | null;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        leaseId: string | null;
        unitLabel: string | null;
        tenantName: string | null;
        propertyId: string | null;
        unitId: string | null;
        tab: "fixed" | "open" | "closed" | "in_hand";
        photoCount: number;
        updatedAt: string;
        leaseReference: string | null;
        urgency: "low" | "normal" | "high" | "urgent";
        reportedBy: "landlord" | "tenant";
        reportedAt: string;
        assigneeName: string | null;
        thumbUrl: string | null;
    }[];
    total: number;
    counts: Partial<Record<"fixed" | "open" | "closed" | "in_hand", number>>;
    page: number;
    pageSize: number;
    tab: "fixed" | "open" | "closed" | "in_hand" | null;
}>;
export type FaultListPage = z.infer<typeof FaultListPage>;
export declare const FaultPhotoView: z.ZodObject<{
    id: z.ZodString;
    url: z.ZodString;
    phase: z.ZodEnum<["report", "progress", "fixed"]>;
    position: z.ZodNumber;
    byTenant: z.ZodBoolean;
    uploadedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    url: string;
    uploadedAt: string;
    position: number;
    phase: "fixed" | "report" | "progress";
    byTenant: boolean;
}, {
    id: string;
    url: string;
    uploadedAt: string;
    position: number;
    phase: "fixed" | "report" | "progress";
    byTenant: boolean;
}>;
export type FaultPhotoView = z.infer<typeof FaultPhotoView>;
/** One line of a fault's timeline. `words` is the plain sentence; `note` is what the person wrote. */
export declare const FaultEventView: z.ZodObject<{
    id: z.ZodString;
    kind: z.ZodString;
    from: z.ZodNullable<z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>>;
    to: z.ZodNullable<z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>>;
    words: z.ZodString;
    note: z.ZodNullable<z.ZodString>;
    actorName: z.ZodNullable<z.ZodString>;
    actorRole: z.ZodEnum<["tenant", "landlord", "system"]>;
    visibleToTenant: z.ZodBoolean;
    at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    kind: string;
    note: string | null;
    actorName: string | null;
    at: string;
    from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
    to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
    actorRole: "landlord" | "tenant" | "system";
    visibleToTenant: boolean;
    words: string;
}, {
    id: string;
    kind: string;
    note: string | null;
    actorName: string | null;
    at: string;
    from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
    to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
    actorRole: "landlord" | "tenant" | "system";
    visibleToTenant: boolean;
    words: string;
}>;
export type FaultEventView = z.infer<typeof FaultEventView>;
/** One fault in full, for the landlord's side panel. */
export declare const FaultDetail: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    urgency: z.ZodEnum<["low", "normal", "high", "urgent"]>;
    status: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
    tab: z.ZodEnum<["open", "in_hand", "fixed", "closed"]>;
    unitId: z.ZodNullable<z.ZodString>;
    unitLabel: z.ZodNullable<z.ZodString>;
    propertyId: z.ZodNullable<z.ZodString>;
    propertyName: z.ZodNullable<z.ZodString>;
    leaseId: z.ZodNullable<z.ZodString>;
    leaseReference: z.ZodNullable<z.ZodString>;
    tenantName: z.ZodNullable<z.ZodString>;
    /** Who reported it: the tenant from their home, or the landlord's side. */
    reportedBy: z.ZodEnum<["tenant", "landlord"]>;
    reportedAt: z.ZodString;
    updatedAt: z.ZodString;
    assigneeName: z.ZodNullable<z.ZodString>;
    photoCount: z.ZodNumber;
    /** A short-lived read of the first photo (the report's first), for the list's thumbnail; null without photos. */
    thumbUrl: z.ZodNullable<z.ZodString>;
} & {
    description: z.ZodNullable<z.ZodString>;
    staffMayEnter: z.ZodNullable<z.ZodBoolean>;
    assignee: z.ZodNullable<z.ZodObject<{
        kind: z.ZodEnum<["member", "contractor"]>;
        userId: z.ZodNullable<z.ZodString>;
        name: z.ZodString;
        phone: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        kind: "member" | "contractor";
        userId: string | null;
        phone: string | null;
    }, {
        name: string;
        kind: "member" | "contractor";
        userId: string | null;
        phone: string | null;
    }>>;
    acknowledgedAt: z.ZodNullable<z.ZodString>;
    resolvedAt: z.ZodNullable<z.ZodString>;
    wontFixReason: z.ZodNullable<z.ZodString>;
    reopenedCount: z.ZodNumber;
    /** The last day the tenant may reopen it, while they still may. */
    reopenUntil: z.ZodNullable<z.ZodString>;
    /** The moves the "Move to" menu offers: only the legal ones. */
    allowedMoves: z.ZodArray<z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>, "many">;
    /** The Kigali day it was reported: a payment for it cannot be dated before it. */
    reportedOn: z.ZodString;
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        url: z.ZodString;
        phase: z.ZodEnum<["report", "progress", "fixed"]>;
        position: z.ZodNumber;
        byTenant: z.ZodBoolean;
        uploadedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        url: string;
        uploadedAt: string;
        position: number;
        phase: "fixed" | "report" | "progress";
        byTenant: boolean;
    }, {
        id: string;
        url: string;
        uploadedAt: string;
        position: number;
        phase: "fixed" | "report" | "progress";
        byTenant: boolean;
    }>, "many">;
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodString;
        from: z.ZodNullable<z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>>;
        to: z.ZodNullable<z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>>;
        words: z.ZodString;
        note: z.ZodNullable<z.ZodString>;
        actorName: z.ZodNullable<z.ZodString>;
        actorRole: z.ZodEnum<["tenant", "landlord", "system"]>;
        visibleToTenant: z.ZodBoolean;
        at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: string;
        note: string | null;
        actorName: string | null;
        at: string;
        from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        actorRole: "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        words: string;
    }, {
        id: string;
        kind: string;
        note: string | null;
        actorName: string | null;
        at: string;
        from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        actorRole: "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        words: string;
    }>, "many">;
    /** What was paid for the fix (WP 4.3). Null for someone who may not see the money. */
    payments: z.ZodNullable<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        source: z.ZodEnum<["gateway", "recorded"]>;
        status: z.ZodEnum<["waiting", "paid", "failed", "voided"]>;
        amountRwf: z.ZodNumber;
        payeeName: z.ZodNullable<z.ZodString>;
        destination: z.ZodNullable<z.ZodString>;
        method: z.ZodNullable<z.ZodEnum<["cash", "momo", "bank", "other"]>>;
        paidOn: z.ZodNullable<z.ZodEffects<z.ZodString, string, string>>;
        failureReason: z.ZodNullable<z.ZodString>;
        expenseId: z.ZodNullable<z.ZodString>;
        receiptUrl: z.ZodNullable<z.ZodString>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        status: "failed" | "waiting" | "paid" | "voided";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        source: "gateway" | "recorded";
        createdAt: string;
        method: "other" | "cash" | "momo" | "bank" | null;
        paidOn: string | null;
        destination: string | null;
        payeeName: string | null;
        receiptUrl: string | null;
        expenseId: string | null;
    }, {
        status: "failed" | "waiting" | "paid" | "voided";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        source: "gateway" | "recorded";
        createdAt: string;
        method: "other" | "cash" | "momo" | "bank" | null;
        paidOn: string | null;
        destination: string | null;
        payeeName: string | null;
        receiptUrl: string | null;
        expenseId: string | null;
    }>, "many">>;
    /** The fix's cost so far: paid and recorded, not voided. Null with `payments`. */
    paidRwf: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    description: string | null;
    paidRwf: number | null;
    title: string;
    events: {
        id: string;
        kind: string;
        note: string | null;
        actorName: string | null;
        at: string;
        from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        actorRole: "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        words: string;
    }[];
    propertyName: string | null;
    payments: {
        status: "failed" | "waiting" | "paid" | "voided";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        source: "gateway" | "recorded";
        createdAt: string;
        method: "other" | "cash" | "momo" | "bank" | null;
        paidOn: string | null;
        destination: string | null;
        payeeName: string | null;
        receiptUrl: string | null;
        expenseId: string | null;
    }[] | null;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    resolvedAt: string | null;
    leaseId: string | null;
    unitLabel: string | null;
    tenantName: string | null;
    propertyId: string | null;
    unitId: string | null;
    photos: {
        id: string;
        url: string;
        uploadedAt: string;
        position: number;
        phase: "fixed" | "report" | "progress";
        byTenant: boolean;
    }[];
    tab: "fixed" | "open" | "closed" | "in_hand";
    photoCount: number;
    updatedAt: string;
    assignee: {
        name: string;
        kind: "member" | "contractor";
        userId: string | null;
        phone: string | null;
    } | null;
    staffMayEnter: boolean | null;
    acknowledgedAt: string | null;
    leaseReference: string | null;
    urgency: "low" | "normal" | "high" | "urgent";
    reportedBy: "landlord" | "tenant";
    reportedAt: string;
    assigneeName: string | null;
    thumbUrl: string | null;
    wontFixReason: string | null;
    reopenedCount: number;
    reopenUntil: string | null;
    allowedMoves: ("cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix")[];
    reportedOn: string;
}, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    description: string | null;
    paidRwf: number | null;
    title: string;
    events: {
        id: string;
        kind: string;
        note: string | null;
        actorName: string | null;
        at: string;
        from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        actorRole: "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        words: string;
    }[];
    propertyName: string | null;
    payments: {
        status: "failed" | "waiting" | "paid" | "voided";
        id: string;
        amountRwf: number;
        failureReason: string | null;
        source: "gateway" | "recorded";
        createdAt: string;
        method: "other" | "cash" | "momo" | "bank" | null;
        paidOn: string | null;
        destination: string | null;
        payeeName: string | null;
        receiptUrl: string | null;
        expenseId: string | null;
    }[] | null;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    resolvedAt: string | null;
    leaseId: string | null;
    unitLabel: string | null;
    tenantName: string | null;
    propertyId: string | null;
    unitId: string | null;
    photos: {
        id: string;
        url: string;
        uploadedAt: string;
        position: number;
        phase: "fixed" | "report" | "progress";
        byTenant: boolean;
    }[];
    tab: "fixed" | "open" | "closed" | "in_hand";
    photoCount: number;
    updatedAt: string;
    assignee: {
        name: string;
        kind: "member" | "contractor";
        userId: string | null;
        phone: string | null;
    } | null;
    staffMayEnter: boolean | null;
    acknowledgedAt: string | null;
    leaseReference: string | null;
    urgency: "low" | "normal" | "high" | "urgent";
    reportedBy: "landlord" | "tenant";
    reportedAt: string;
    assigneeName: string | null;
    thumbUrl: string | null;
    wontFixReason: string | null;
    reopenedCount: number;
    reopenUntil: string | null;
    allowedMoves: ("cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix")[];
    reportedOn: string;
}>;
export type FaultDetail = z.infer<typeof FaultDetail>;
/** One of the tenant's faults: no money, no team notes, no fixer's phone. */
export declare const TenantFaultItem: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    urgency: z.ZodEnum<["low", "normal", "high", "urgent"]>;
    status: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
    statusWords: z.ZodString;
    reportedAt: z.ZodString;
    updatedAt: z.ZodString;
    assigneeName: z.ZodNullable<z.ZodString>;
    photoCount: z.ZodNumber;
    reopenUntil: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    title: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    photoCount: number;
    updatedAt: string;
    statusWords: string;
    urgency: "low" | "normal" | "high" | "urgent";
    reportedAt: string;
    assigneeName: string | null;
    reopenUntil: string | null;
}, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    title: string;
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    photoCount: number;
    updatedAt: string;
    statusWords: string;
    urgency: "low" | "normal" | "high" | "urgent";
    reportedAt: string;
    assigneeName: string | null;
    reopenUntil: string | null;
}>;
export type TenantFaultItem = z.infer<typeof TenantFaultItem>;
export declare const TenantFaultList: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        reference: z.ZodNullable<z.ZodString>;
        title: z.ZodString;
        category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
        urgency: z.ZodEnum<["low", "normal", "high", "urgent"]>;
        status: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
        statusWords: z.ZodString;
        reportedAt: z.ZodString;
        updatedAt: z.ZodString;
        assigneeName: z.ZodNullable<z.ZodString>;
        photoCount: z.ZodNumber;
        reopenUntil: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        title: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        photoCount: number;
        updatedAt: string;
        statusWords: string;
        urgency: "low" | "normal" | "high" | "urgent";
        reportedAt: string;
        assigneeName: string | null;
        reopenUntil: string | null;
    }, {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        title: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        photoCount: number;
        updatedAt: string;
        statusWords: string;
        urgency: "low" | "normal" | "high" | "urgent";
        reportedAt: string;
        assigneeName: string | null;
        reopenUntil: string | null;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    items: {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        title: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        photoCount: number;
        updatedAt: string;
        statusWords: string;
        urgency: "low" | "normal" | "high" | "urgent";
        reportedAt: string;
        assigneeName: string | null;
        reopenUntil: string | null;
    }[];
}, {
    items: {
        status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
        id: string;
        reference: string | null;
        title: string;
        category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
        photoCount: number;
        updatedAt: string;
        statusWords: string;
        urgency: "low" | "normal" | "high" | "urgent";
        reportedAt: string;
        assigneeName: string | null;
        reopenUntil: string | null;
    }[];
}>;
export type TenantFaultList = z.infer<typeof TenantFaultList>;
export declare const TenantFaultDetail: z.ZodObject<{
    id: z.ZodString;
    reference: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    category: z.ZodNullable<z.ZodEnum<["plumbing", "electrical", "hvac", "appliance", "furniture", "it_tech", "safety", "other", "doors_windows", "decoration"]>>;
    urgency: z.ZodEnum<["low", "normal", "high", "urgent"]>;
    status: z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>;
    statusWords: z.ZodString;
    reportedAt: z.ZodString;
    updatedAt: z.ZodString;
    assigneeName: z.ZodNullable<z.ZodString>;
    photoCount: z.ZodNumber;
    reopenUntil: z.ZodNullable<z.ZodString>;
} & {
    description: z.ZodNullable<z.ZodString>;
    staffMayEnter: z.ZodNullable<z.ZodBoolean>;
    wontFixReason: z.ZodNullable<z.ZodString>;
    canReopen: z.ZodBoolean;
    photos: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        url: z.ZodString;
        phase: z.ZodEnum<["report", "progress", "fixed"]>;
        position: z.ZodNumber;
        byTenant: z.ZodBoolean;
        uploadedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        url: string;
        uploadedAt: string;
        position: number;
        phase: "fixed" | "report" | "progress";
        byTenant: boolean;
    }, {
        id: string;
        url: string;
        uploadedAt: string;
        position: number;
        phase: "fixed" | "report" | "progress";
        byTenant: boolean;
    }>, "many">;
    /** Only what the tenant may see. */
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodString;
        from: z.ZodNullable<z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>>;
        to: z.ZodNullable<z.ZodEnum<["open", "acknowledged", "assigned", "in_progress", "resolved", "closed", "wont_fix", "cancelled"]>>;
        words: z.ZodString;
        note: z.ZodNullable<z.ZodString>;
        actorName: z.ZodNullable<z.ZodString>;
        actorRole: z.ZodEnum<["tenant", "landlord", "system"]>;
        visibleToTenant: z.ZodBoolean;
        at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        kind: string;
        note: string | null;
        actorName: string | null;
        at: string;
        from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        actorRole: "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        words: string;
    }, {
        id: string;
        kind: string;
        note: string | null;
        actorName: string | null;
        at: string;
        from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        actorRole: "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        words: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    description: string | null;
    title: string;
    events: {
        id: string;
        kind: string;
        note: string | null;
        actorName: string | null;
        at: string;
        from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        actorRole: "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        words: string;
    }[];
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    photos: {
        id: string;
        url: string;
        uploadedAt: string;
        position: number;
        phase: "fixed" | "report" | "progress";
        byTenant: boolean;
    }[];
    photoCount: number;
    updatedAt: string;
    staffMayEnter: boolean | null;
    statusWords: string;
    urgency: "low" | "normal" | "high" | "urgent";
    reportedAt: string;
    assigneeName: string | null;
    wontFixReason: string | null;
    reopenUntil: string | null;
    canReopen: boolean;
}, {
    status: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix";
    id: string;
    reference: string | null;
    description: string | null;
    title: string;
    events: {
        id: string;
        kind: string;
        note: string | null;
        actorName: string | null;
        at: string;
        from: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        to: "cancelled" | "open" | "resolved" | "closed" | "acknowledged" | "assigned" | "in_progress" | "wont_fix" | null;
        actorRole: "landlord" | "tenant" | "system";
        visibleToTenant: boolean;
        words: string;
    }[];
    category: "other" | "plumbing" | "electrical" | "hvac" | "appliance" | "furniture" | "it_tech" | "safety" | "doors_windows" | "decoration" | null;
    photos: {
        id: string;
        url: string;
        uploadedAt: string;
        position: number;
        phase: "fixed" | "report" | "progress";
        byTenant: boolean;
    }[];
    photoCount: number;
    updatedAt: string;
    staffMayEnter: boolean | null;
    statusWords: string;
    urgency: "low" | "normal" | "high" | "urgent";
    reportedAt: string;
    assigneeName: string | null;
    wontFixReason: string | null;
    reopenUntil: string | null;
    canReopen: boolean;
}>;
export type TenantFaultDetail = z.infer<typeof TenantFaultDetail>;
/** The app's fault pages a mail opens. */
export declare const FAULT_APP_PATHS: {
    readonly tenantFaults: (leaseId: string) => string;
    readonly landlordFault: (ticketId: string) => string;
};
//# sourceMappingURL=faults.d.ts.map