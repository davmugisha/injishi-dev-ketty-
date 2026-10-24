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
     * WHICH property this conversation is about, as an id.
     *
     * The name alone was not enough to act on. Ordering, the desks a guest may
     * write to and every other per-property question is asked of the server BY
     * ID (`GET /me/orderable?propertyId=…`), so a screen holding only
     * `propertyName` could render the conversation and nothing else about it —
     * which is why ordering inside a thread had to be a link out to a screen that
     * knew the property some other way.
     *
     * Null exactly where `propertyName` is null: they come from the same join.
     */
    propertyId: z.ZodNullable<z.ZodString>;
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
    kind: "dispute" | "reservation" | "department_request";
    id: string;
    subjectId: string;
    propertyName: string | null;
    scope: "lease" | "booking" | "stay";
    departmentName: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    messageCount: number;
    propertyId: string | null;
    unreadCount: number;
}, {
    status: "active" | "archived";
    kind: "dispute" | "reservation" | "department_request";
    id: string;
    subjectId: string;
    propertyName: string | null;
    scope: "lease" | "booking" | "stay";
    departmentName: string | null;
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    messageCount: number;
    propertyId: string | null;
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
         * WHICH property this conversation is about, as an id.
         *
         * The name alone was not enough to act on. Ordering, the desks a guest may
         * write to and every other per-property question is asked of the server BY
         * ID (`GET /me/orderable?propertyId=…`), so a screen holding only
         * `propertyName` could render the conversation and nothing else about it —
         * which is why ordering inside a thread had to be a link out to a screen that
         * knew the property some other way.
         *
         * Null exactly where `propertyName` is null: they come from the same join.
         */
        propertyId: z.ZodNullable<z.ZodString>;
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
        kind: "dispute" | "reservation" | "department_request";
        id: string;
        subjectId: string;
        propertyName: string | null;
        scope: "lease" | "booking" | "stay";
        departmentName: string | null;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
        propertyId: string | null;
        unreadCount: number;
    }, {
        status: "active" | "archived";
        kind: "dispute" | "reservation" | "department_request";
        id: string;
        subjectId: string;
        propertyName: string | null;
        scope: "lease" | "booking" | "stay";
        departmentName: string | null;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
        propertyId: string | null;
        unreadCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    threads: {
        status: "active" | "archived";
        kind: "dispute" | "reservation" | "department_request";
        id: string;
        subjectId: string;
        propertyName: string | null;
        scope: "lease" | "booking" | "stay";
        departmentName: string | null;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
        propertyId: string | null;
        unreadCount: number;
    }[];
}, {
    threads: {
        status: "active" | "archived";
        kind: "dispute" | "reservation" | "department_request";
        id: string;
        subjectId: string;
        propertyName: string | null;
        scope: "lease" | "booking" | "stay";
        departmentName: string | null;
        lastMessageAt: string | null;
        lastMessagePreview: string | null;
        messageCount: number;
        propertyId: string | null;
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
    /** `system` is a line the platform wrote, such as an order's status (ADR-050 D-s); `file` a document sent in a lease thread (migration 0073). */
    bodyType: z.ZodEnum<["text", "image", "voice", "system", "file"]>;
    body: z.ZodNullable<z.ZodString>;
    /** The order a `system` line reports on; read it from `GET /me/orders/:id`. */
    serviceOrderId: z.ZodNullable<z.ZodString>;
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
    bodyType: "text" | "image" | "voice" | "system" | "file";
    serviceOrderId: string | null;
    voiceDurationS: number | null;
}, {
    id: string;
    createdAt: string;
    body: string | null;
    threadId: string;
    senderUserId: string | null;
    senderName: string | null;
    fromUs: boolean;
    bodyType: "text" | "image" | "voice" | "system" | "file";
    serviceOrderId: string | null;
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
        /** `system` is a line the platform wrote, such as an order's status (ADR-050 D-s); `file` a document sent in a lease thread (migration 0073). */
        bodyType: z.ZodEnum<["text", "image", "voice", "system", "file"]>;
        body: z.ZodNullable<z.ZodString>;
        /** The order a `system` line reports on; read it from `GET /me/orders/:id`. */
        serviceOrderId: z.ZodNullable<z.ZodString>;
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
        bodyType: "text" | "image" | "voice" | "system" | "file";
        serviceOrderId: string | null;
        voiceDurationS: number | null;
    }, {
        id: string;
        createdAt: string;
        body: string | null;
        threadId: string;
        senderUserId: string | null;
        senderName: string | null;
        fromUs: boolean;
        bodyType: "text" | "image" | "voice" | "system" | "file";
        serviceOrderId: string | null;
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
        bodyType: "text" | "image" | "voice" | "system" | "file";
        serviceOrderId: string | null;
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
        bodyType: "text" | "image" | "voice" | "system" | "file";
        serviceOrderId: string | null;
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
/**
 * `POST /api/v1/me/threads` (ADR-050 D-q): open or resume the conversation with
 * one department, and say something.
 *
 * NAMED BY THE DEPARTMENT ALONE, and that is the whole point of this shape.
 * `POST /me/stays/:id/requests` could only be reached by a guest who had a
 * stay, so a person who had BOOKED and not yet arrived could reach no desk of
 * the property at all — the department capability was invisible to everyone
 * before check-in. The server resolves which record the conversation hangs off
 * (an open stay at that department's property, else a live booking with it),
 * because the guest does not know and should not have to say: they tapped
 * "Housekeeping".
 *
 * THE FIRST MESSAGE IS REQUIRED, for the same reason it is on the stay route: a
 * thread with nothing in it is a row the desk reads as a guest who wanted
 * something and did not say what.
 *
 * `.strict()` so a body that names its own stay, booking or workspace is
 * refused rather than quietly ignored — a field the server does not read is a
 * field a client will eventually believe in.
 */
export declare const OpenThreadRequest: z.ZodObject<{
    departmentId: z.ZodString;
    /** Optional one-liner for the desk's list view. */
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
}, "strict", z.ZodTypeAny, {
    body: string;
    departmentId: string;
    subject?: string | undefined;
}, {
    body: string;
    departmentId: string;
    subject?: string | undefined;
}>;
export type OpenThreadRequest = z.infer<typeof OpenThreadRequest>;
/**
 * One property a guest may write to right now, and the desks there.
 *
 * A PLACE, not a stay and not a booking: the guest thinks "the hotel I am at"
 * and "the hotel I am going to", and both offer the same desks. `context` and
 * `subjectId` say which record the server resolved the right from, so a screen
 * can link to the trip or the stay it came from, and `inHouse` says which of
 * the two wordings to use ("Message Housekeeping" versus "Ask before you
 * arrive"). They agree by construction — `context === "stay"` is exactly
 * `inHouse` — and are both here because a client should not have to know that.
 *
 * There is deliberately NO `canOrder` flag. Whether this person may order at
 * this property is the outlet policy's answer and it is a per-outlet one:
 * `GET /me/orderable?propertyId=…` is the verdict, and computing a summary of
 * it for every row of a list screen would cost a policy resolution per row to
 * produce a boolean that is wrong the moment an outlet closes.
 */
export declare const GuestDeskPlace: z.ZodObject<{
    propertyId: z.ZodString;
    propertyName: z.ZodString;
    /** Which record opens these desks: the stay they are on, or the booking. */
    context: z.ZodEnum<["stay", "booking"]>;
    /** The `guest_stays` id or the `bookings` id, per `context`. */
    subjectId: z.ZodString;
    /** The booking's reference, for a place a guest recognises by it. Null for a walk-in. */
    bookingReference: z.ZodNullable<z.ZodString>;
    /**
     * When they arrive, or arrived: the booking's check-in date for a booking,
     * the stay's entry instant for a stay. Read it as a moment, not as a format.
     */
    checkIn: z.ZodNullable<z.ZodString>;
    /** True when the guest is checked in here right now. */
    inHouse: z.ZodBoolean;
    /** Only the desks this property marked `guest_requestable`, its own control. */
    departments: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
        phone: z.ZodNullable<z.ZodString>;
        threadId: z.ZodNullable<z.ZodString>;
        unreadCount: z.ZodNumber;
        lastMessageAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        id: string;
        phone: string | null;
        lastMessageAt: string | null;
        threadId: string | null;
        departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
        unreadCount: number;
    }, {
        name: string;
        id: string;
        phone: string | null;
        lastMessageAt: string | null;
        threadId: string | null;
        departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
        unreadCount: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    subjectId: string;
    propertyName: string;
    checkIn: string | null;
    propertyId: string;
    departments: {
        name: string;
        id: string;
        phone: string | null;
        lastMessageAt: string | null;
        threadId: string | null;
        departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
        unreadCount: number;
    }[];
    context: "booking" | "stay";
    bookingReference: string | null;
    inHouse: boolean;
}, {
    subjectId: string;
    propertyName: string;
    checkIn: string | null;
    propertyId: string;
    departments: {
        name: string;
        id: string;
        phone: string | null;
        lastMessageAt: string | null;
        threadId: string | null;
        departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
        unreadCount: number;
    }[];
    context: "booking" | "stay";
    bookingReference: string | null;
    inHouse: boolean;
}>;
export type GuestDeskPlace = z.infer<typeof GuestDeskPlace>;
/**
 * `GET /api/v1/me/departments`: every desk this person may write to, anywhere.
 *
 * Session scoped and takes no parameter. The stay-scoped
 * `GET /me/stays/:id/departments` answers the same question for one stay and
 * stays where it is; this one is what an inbox opens with, because an inbox
 * does not know which stay or booking the guest has in mind.
 */
export declare const MyDepartments: z.ZodObject<{
    places: z.ZodArray<z.ZodObject<{
        propertyId: z.ZodString;
        propertyName: z.ZodString;
        /** Which record opens these desks: the stay they are on, or the booking. */
        context: z.ZodEnum<["stay", "booking"]>;
        /** The `guest_stays` id or the `bookings` id, per `context`. */
        subjectId: z.ZodString;
        /** The booking's reference, for a place a guest recognises by it. Null for a walk-in. */
        bookingReference: z.ZodNullable<z.ZodString>;
        /**
         * When they arrive, or arrived: the booking's check-in date for a booking,
         * the stay's entry instant for a stay. Read it as a moment, not as a format.
         */
        checkIn: z.ZodNullable<z.ZodString>;
        /** True when the guest is checked in here right now. */
        inHouse: z.ZodBoolean;
        /** Only the desks this property marked `guest_requestable`, its own control. */
        departments: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            departmentCategory: z.ZodEnum<["rooms", "fnb", "spa_recreation", "other_operated", "misc_income", "admin_general", "sales_marketing", "it", "engineering", "utilities", "hr"]>;
            phone: z.ZodNullable<z.ZodString>;
            threadId: z.ZodNullable<z.ZodString>;
            unreadCount: z.ZodNumber;
            lastMessageAt: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            id: string;
            phone: string | null;
            lastMessageAt: string | null;
            threadId: string | null;
            departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
            unreadCount: number;
        }, {
            name: string;
            id: string;
            phone: string | null;
            lastMessageAt: string | null;
            threadId: string | null;
            departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
            unreadCount: number;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        subjectId: string;
        propertyName: string;
        checkIn: string | null;
        propertyId: string;
        departments: {
            name: string;
            id: string;
            phone: string | null;
            lastMessageAt: string | null;
            threadId: string | null;
            departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
            unreadCount: number;
        }[];
        context: "booking" | "stay";
        bookingReference: string | null;
        inHouse: boolean;
    }, {
        subjectId: string;
        propertyName: string;
        checkIn: string | null;
        propertyId: string;
        departments: {
            name: string;
            id: string;
            phone: string | null;
            lastMessageAt: string | null;
            threadId: string | null;
            departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
            unreadCount: number;
        }[];
        context: "booking" | "stay";
        bookingReference: string | null;
        inHouse: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    places: {
        subjectId: string;
        propertyName: string;
        checkIn: string | null;
        propertyId: string;
        departments: {
            name: string;
            id: string;
            phone: string | null;
            lastMessageAt: string | null;
            threadId: string | null;
            departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
            unreadCount: number;
        }[];
        context: "booking" | "stay";
        bookingReference: string | null;
        inHouse: boolean;
    }[];
}, {
    places: {
        subjectId: string;
        propertyName: string;
        checkIn: string | null;
        propertyId: string;
        departments: {
            name: string;
            id: string;
            phone: string | null;
            lastMessageAt: string | null;
            threadId: string | null;
            departmentCategory: "hr" | "rooms" | "fnb" | "spa_recreation" | "other_operated" | "misc_income" | "admin_general" | "sales_marketing" | "it" | "engineering" | "utilities";
            unreadCount: number;
        }[];
        context: "booking" | "stay";
        bookingReference: string | null;
        inHouse: boolean;
    }[];
}>;
export type MyDepartments = z.infer<typeof MyDepartments>;
//# sourceMappingURL=inbox.d.ts.map