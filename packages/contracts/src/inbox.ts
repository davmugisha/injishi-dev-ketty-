import { z } from "zod";
import { Uuid } from "./primitives";

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
export const ThreadScope = z.enum(["booking", "stay", "lease"]);
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
export const ThreadKind = z.enum(["reservation", "department_request", "dispute"]);
export type ThreadKind = z.infer<typeof ThreadKind>;

export const GuestThread = z.object({
  id: Uuid,
  scope: ThreadScope,
  /** The booking, stay or lease this thread is about. */
  subjectId: Uuid,
  kind: ThreadKind,
  status: z.enum(["active", "archived"]),

  /**
   * Who the guest is talking to, as they think of it: the property.
   *
   * Nullable because the join can miss on a lease thread whose unit has no
   * property row yet, and a conversation with no resolvable name is still a
   * conversation the guest should be able to open.
   */
  propertyName: z.string().nullable(),
  /** Set only once a conversation has been routed to a department. */
  departmentName: z.string().nullable(),

  lastMessageAt: z.string().nullable(),
  lastMessagePreview: z.string().nullable(),
  messageCount: z.number().int().nonnegative(),
  /**
   * Messages newer than this person's `thread_reads.last_read_at`, computed at
   * read time. Never stored: a counter has to be right on every write path and
   * goes stale the first time one is missed. No read row means all of them.
   */
  unreadCount: z.number().int().nonnegative(),
});
export type GuestThread = z.infer<typeof GuestThread>;

export const MyThreads = z.object({ threads: z.array(GuestThread) });
export type MyThreads = z.infer<typeof MyThreads>;

/** One message, as the reader sees it. Bodies are redacted on the way out. */
export const GuestMessage = z.object({
  id: Uuid,
  threadId: Uuid,
  senderUserId: Uuid.nullable(),
  senderName: z.string().nullable(),
  /** True when the READER sent it, so a screen can side the bubble. */
  fromUs: z.boolean(),
  bodyType: z.enum(["text", "image", "voice"]),
  body: z.string().nullable(),
  voiceDurationS: z.number().int().nullable(),
  createdAt: z.string(),
});
export type GuestMessage = z.infer<typeof GuestMessage>;

/** Longest message accepted. A conversation, not a document. */
export const GUEST_MESSAGE_MAX = 4000;
/** Messages per page. A chat screen opens at the newest and pages backwards. */
export const GUEST_MESSAGE_PAGE = 30;
export const GUEST_MESSAGE_PAGE_MAX = 100;

/**
 * A page of messages, NEWEST first, with the cursor to ask for older ones.
 *
 * Cursor rather than offset: offset paging shifts under an insert, and in a live
 * conversation an insert is constant, so page two would skip or repeat a message
 * every time somebody replied mid-scroll.
 */
export const GuestMessagePage = z.object({
  messages: z.array(GuestMessage),
  /** Opaque. Pass it back as `?cursor=` for the next older page; null at the end. */
  nextCursor: z.string().nullable(),
});
export type GuestMessagePage = z.infer<typeof GuestMessagePage>;

export const MessagePageQuery = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(GUEST_MESSAGE_PAGE_MAX)
    .optional(),
});
export type MessagePageQuery = z.infer<typeof MessagePageQuery>;

/**
 * Sending one. The sender is the session, never a field — a body that could name
 * its own sender is a body that can impersonate one.
 */
export const SendGuestMessageInput = z
  .object({
    body: z.string().trim().min(1).max(GUEST_MESSAGE_MAX),
  })
  .strict();
export type SendGuestMessageInput = z.infer<typeof SendGuestMessageInput>;
