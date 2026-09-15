import { z } from "zod";
/**
 * The GUEST side of messaging — `GET/POST /api/v1/me/threads*`
 * ([ADR-032](../../../injishi.context/dox/adrs/032-guest-saved-and-messaging/032-messaging-surface.md)).
 *
 * The operator side of the same conversation is `OperatorThread` /
 * `OperatorMessage` in `ops.ts`, and the two are deliberately NOT one type. A
 * guest and a receptionist read the same rows and need different facts from
 * them: the guest needs the PROPERTY's name (they are talking to a hotel, not to
 * a workspace) and their own unread count; the operator needs the guest's name
 * and never has an unread count of the guest's. One type carrying both halves
 * would be a type where half the fields are always null.
 *
 * A NOTE ON NAMING, so the next person is not confused. ADR-032's build plan
 * asks for `OperatorThread`/`OperatorMessage` to be RENAMED to `Thread`/`Message`
 * with the old names kept as deprecated aliases. That rename is still owed: it
 * is a mechanical sweep across `ops.ts` and every operator call site, and doing
 * it inside this change would bury the new surface in it. So the guest shapes
 * are `GuestThread`/`GuestMessage` for now, and the rename stays on ADR-032's
 * follow-up list where it can be done as one reviewable diff.
 *
 * WHAT THE GUEST MAY SEE is not a filter applied after the fact. A thread's
 * `workspace_id` is the PROPERTY's, so `WorkspaceGuard` cannot authorize a
 * guest; ownership is derived from the thread's single subject
 * (`threads_scope_exactly_one`) joining to `bookings.guest_user_id`, the stay's
 * guest, or the lease's tenant. A thread that resolves to somebody else is
 * answered 404 rather than 403, so a probe cannot learn that an id exists.
 */
/** Which record a conversation hangs off. Exactly one, per the check constraint. */
export declare const ThreadScope: z.ZodEnum<["booking", "stay", "lease"]>;
export type ThreadScope = z.infer<typeof ThreadScope>;
/**
 * What kind of conversation it is (`threads.thread_kind`).
 *
 * `reservation` is the thread every booking gets at sale. `department_request`
 * is one that has been ROUTED to a department — housekeeping, the kitchen —
 * which is the property's move, not the guest's (D14: routing targets a
 * department and never a person). A guest sees the department's name on the row
 * once that has happened, which is why `departmentName` exists below.
 */
export declare const ThreadKind: z.ZodEnum<["reservation", "department_request", "dispute"]>;
export type ThreadKind = z.infer<typeof ThreadKind>;
export declare const GuestThread: z.ZodObject<{
    id: z.ZodString;
    scope: z.ZodEnum<["booking", "stay", "lease"]>;
    /** The booking, stay or lease this thread is about. */
    subjectId: z.ZodString;
    kind: z.ZodEnum<["reservation", "department_request", "dispute"]>;
    status: z.ZodEnum<["active", "archived"]>;
    /**
     * Who the guest is talking to, as they think of it: the property.
     *
     * Nullable because the join can miss on a lease thread whose unit has no
     * property row yet, and a conversation with no resolvable name is still a
     * conversation the guest should be able to open.
     */
    propertyName: z.ZodNullable<z.ZodString>;
    /** Set only once a conversation has been routed to a department. */
    departmentName: z.ZodNullable<z.ZodString>;
    lastMessageAt: z.ZodNullable<z.ZodString>;
    lastMessagePreview: z.ZodNullable<z.ZodString>;
    messageCount: z.ZodNumber;
    /**
     * Messages newer than this person's `thread_reads.last_read_at`, computed at
     * read time. Never stored: a counter has to be right on every write path and
     * goes stale the first time one is missed. No read row means all of them.
     */
    unreadCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "active" | "archived";
    id: string;
    kind: "dispute" | "reservation" | "department_request";
    subjectId: string;
    propertyName: string | null;
    scope: "lease" | "booking" | "stay";
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    messageCount: number;
    departmentName: string | null;
    unreadCount: number;
}, {
    status: "active" | "archived";
    id: string;
    kind: "dispute" | "reservation" | "department_request";
    subjectId: string;
    propertyName: string | null;
    scope: "lease" | "booking" | "stay";
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    messageCount: number;
    departmentName: string | null;
    unreadCount: number;
}>;
export type GuestThread = z.infer<typeof GuestThread>;
export declare const MyThreads: z.ZodObject<{
    threads: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        scope: z.ZodEnum<["booking", "stay", "lease"]>;
        /** The booking, stay or lease this thread is about. */
        subjectId: z.ZodString;
        kind: z.ZodEnum<["reservation", "department_request", "dispute"]>;
        status: z.ZodEnum<["active", "archived"]>;
        /**
         * Who the guest is talking to, as they think of it: the property.
         *
         * Nullable because the join can miss on a lease thread whose unit has no
         * property row yet, and a conversation with no resolvable name is still a
         * conversation the guest should be able to open.
         */
        propertyName: z.ZodNullable<z.ZodString>;
        /** Set only once a conversation has been routed to a department. */
        departmentName: z.ZodNullable<z.ZodString>;
        lastMessageAt: z.ZodNullable<z.ZodString>;
        lastMessagePreview: z.ZodNullable<z.ZodString>;
        messageCount: z.ZodNumber;
        /**
         * Messages newer than this person's `thread_reads.last_read_at`, computed at
         * read time. Never stored: a counter has to be right on every write path and
         * goes stale the first time one is missed. No read row means all of them.
         */
        unreadCount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        status: "active" | "archived";
        id: string;
        kind: "dispute" | "reservation" | "department_request";
        subjectId: string;
        propertyName: string | null;
        scope: "lease" | "booking" | "stay";
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
        departmentName: string | null;
        unreadCount: number;
    }, {
        status: "active" | "archived";
        id: string;
        kind: "dispute" | "reservation" | "department_request";
        subjectId: string;
        propertyName: string | null;
        scope: "lease" | "booking" | "stay";
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
        departmentName: string | null;
        unreadCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    threads: {
        status: "active" | "archived";
        id: string;
        kind: "dispute" | "reservation" | "department_request";
        subjectId: string;
        propertyName: string | null;
        scope: "lease" | "booking" | "stay";
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
        departmentName: string | null;
        unreadCount: number;
    }[];
}, {
    threads: {
        status: "active" | "archived";
        id: string;
        kind: "dispute" | "reservation" | "department_request";
        subjectId: string;
        propertyName: string | null;
        scope: "lease" | "booking" | "stay";
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
        departmentName: string | null;
        unreadCount: number;
    }[];
}>;
export type MyThreads = z.infer<typeof MyThreads>;
/** One message, as the reader sees it. Bodies are redacted on the way out. */
export declare const GuestMessage: z.ZodObject<{
    id: z.ZodString;
    threadId: z.ZodString;
    senderUserId: z.ZodNullable<z.ZodString>;
    senderName: z.ZodNullable<z.ZodString>;
    /** True when the READER sent it, so a screen can side the bubble. */
    fromUs: z.ZodBoolean;
    bodyType: z.ZodEnum<["text", "image", "voice"]>;
    body: z.ZodNullable<z.ZodString>;
    voiceDurationS: z.ZodNullable<z.ZodNumber>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: string;
    body: string | null;
    threadId: string;
    senderUserId: string | null;
    senderName: string | null;
    fromUs: boolean;
    bodyType: "text" | "image" | "voice";
    voiceDurationS: number | null;
}, {
    id: string;
    createdAt: string;
    body: string | null;
    threadId: string;
    senderUserId: string | null;
    senderName: string | null;
    fromUs: boolean;
    bodyType: "text" | "image" | "voice";
    voiceDurationS: number | null;
}>;
export type GuestMessage = z.infer<typeof GuestMessage>;
/** Longest message accepted. A conversation, not a document. */
export declare const GUEST_MESSAGE_MAX = 4000;
/** Messages per page. A chat screen opens at the newest and pages backwards. */
export declare const GUEST_MESSAGE_PAGE = 30;
export declare const GUEST_MESSAGE_PAGE_MAX = 100;
/**
 * A page of messages, NEWEST first, with the cursor to ask for older ones.
 *
 * Cursor rather than offset: offset paging shifts under an insert, and in a live
 * conversation an insert is constant, so page two would skip or repeat a message
 * every time somebody replied mid-scroll.
 */
export declare const GuestMessagePage: z.ZodObject<{
    messages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        threadId: z.ZodString;
        senderUserId: z.ZodNullable<z.ZodString>;
        senderName: z.ZodNullable<z.ZodString>;
        /** True when the READER sent it, so a screen can side the bubble. */
        fromUs: z.ZodBoolean;
        bodyType: z.ZodEnum<["text", "image", "voice"]>;
        body: z.ZodNullable<z.ZodString>;
        voiceDurationS: z.ZodNullable<z.ZodNumber>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice";
        voiceDurationS: number | null;
    }, {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice";
        voiceDurationS: number | null;
    }>, "many">;
    /** Opaque. Pass it back as `?cursor=` for the next older page; null at the end. */
    nextCursor: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    nextCursor: string | null;
    messages: {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice";
        voiceDurationS: number | null;
    }[];
}, {
    nextCursor: string | null;
    messages: {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice";
        voiceDurationS: number | null;
    }[];
}>;
export type GuestMessagePage = z.infer<typeof GuestMessagePage>;
export declare const MessagePageQuery: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    cursor?: string | undefined;
    limit?: number | undefined;
}, {
    cursor?: string | undefined;
    limit?: number | undefined;
}>;
export type MessagePageQuery = z.infer<typeof MessagePageQuery>;
/**
 * Sending one. The sender is the session, never a field — a body that could name
 * its own sender is a body that can impersonate one.
 */
export declare const SendGuestMessageInput: z.ZodObject<{
    body: z.ZodString;
}, "strict", z.ZodTypeAny, {
    body: string;
}, {
    body: string;
}>;
export type SendGuestMessageInput = z.infer<typeof SendGuestMessageInput>;
//# sourceMappingURL=inbox.d.ts.map