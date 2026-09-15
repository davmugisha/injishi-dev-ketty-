"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendGuestMessageInput = exports.MessagePageQuery = exports.GuestMessagePage = exports.GUEST_MESSAGE_PAGE_MAX = exports.GUEST_MESSAGE_PAGE = exports.GUEST_MESSAGE_MAX = exports.GuestMessage = exports.MyThreads = exports.GuestThread = exports.ThreadKind = exports.ThreadScope = void 0;
const zod_1 = require("zod");
const primitives_1 = require("./primitives");
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
exports.ThreadScope = zod_1.z.enum(["booking", "stay", "lease"]);
/**
 * What kind of conversation it is (`threads.thread_kind`).
 *
 * `reservation` is the thread every booking gets at sale. `department_request`
 * is one that has been ROUTED to a department — housekeeping, the kitchen —
 * which is the property's move, not the guest's (D14: routing targets a
 * department and never a person). A guest sees the department's name on the row
 * once that has happened, which is why `departmentName` exists below.
 */
exports.ThreadKind = zod_1.z.enum(["reservation", "department_request", "dispute"]);
exports.GuestThread = zod_1.z.object({
    id: primitives_1.Uuid,
    scope: exports.ThreadScope,
    /** The booking, stay or lease this thread is about. */
    subjectId: primitives_1.Uuid,
    kind: exports.ThreadKind,
    status: zod_1.z.enum(["active", "archived"]),
    /**
     * Who the guest is talking to, as they think of it: the property.
     *
     * Nullable because the join can miss on a lease thread whose unit has no
     * property row yet, and a conversation with no resolvable name is still a
     * conversation the guest should be able to open.
     */
    propertyName: zod_1.z.string().nullable(),
    /** Set only once a conversation has been routed to a department. */
    departmentName: zod_1.z.string().nullable(),
    lastMessageAt: zod_1.z.string().nullable(),
    lastMessagePreview: zod_1.z.string().nullable(),
    messageCount: zod_1.z.number().int().nonnegative(),
    /**
     * Messages newer than this person's `thread_reads.last_read_at`, computed at
     * read time. Never stored: a counter has to be right on every write path and
     * goes stale the first time one is missed. No read row means all of them.
     */
    unreadCount: zod_1.z.number().int().nonnegative(),
});
exports.MyThreads = zod_1.z.object({ threads: zod_1.z.array(exports.GuestThread) });
/** One message, as the reader sees it. Bodies are redacted on the way out. */
exports.GuestMessage = zod_1.z.object({
    id: primitives_1.Uuid,
    threadId: primitives_1.Uuid,
    senderUserId: primitives_1.Uuid.nullable(),
    senderName: zod_1.z.string().nullable(),
    /** True when the READER sent it, so a screen can side the bubble. */
    fromUs: zod_1.z.boolean(),
    bodyType: zod_1.z.enum(["text", "image", "voice"]),
    body: zod_1.z.string().nullable(),
    voiceDurationS: zod_1.z.number().int().nullable(),
    createdAt: zod_1.z.string(),
});
/** Longest message accepted. A conversation, not a document. */
exports.GUEST_MESSAGE_MAX = 4000;
/** Messages per page. A chat screen opens at the newest and pages backwards. */
exports.GUEST_MESSAGE_PAGE = 30;
exports.GUEST_MESSAGE_PAGE_MAX = 100;
/**
 * A page of messages, NEWEST first, with the cursor to ask for older ones.
 *
 * Cursor rather than offset: offset paging shifts under an insert, and in a live
 * conversation an insert is constant, so page two would skip or repeat a message
 * every time somebody replied mid-scroll.
 */
exports.GuestMessagePage = zod_1.z.object({
    messages: zod_1.z.array(exports.GuestMessage),
    /** Opaque. Pass it back as `?cursor=` for the next older page; null at the end. */
    nextCursor: zod_1.z.string().nullable(),
});
exports.MessagePageQuery = zod_1.z.object({
    cursor: zod_1.z.string().min(1).optional(),
    limit: zod_1.z.coerce
        .number()
        .int()
        .positive()
        .max(exports.GUEST_MESSAGE_PAGE_MAX)
        .optional(),
});
/**
 * Sending one. The sender is the session, never a field — a body that could name
 * its own sender is a body that can impersonate one.
 */
exports.SendGuestMessageInput = zod_1.z
    .object({
    body: zod_1.z.string().trim().min(1).max(exports.GUEST_MESSAGE_MAX),
})
    .strict();
//# sourceMappingURL=inbox.js.map