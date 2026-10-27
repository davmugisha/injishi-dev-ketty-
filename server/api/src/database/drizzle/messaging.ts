/**
 * §6.7 MESSAGING (shared).
 *
 * Carved out of the single 3,956-line `schema.ts` along the section headers
 * that file already carried. Every declaration below is byte-identical to the
 * one it replaced; only the import lines are new. `schema.ts` re-exports this
 * module, so `drizzle.config.ts`, every migration and every importer still see
 * one schema at one path.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { timestamps } from './columns';
import { messageBodyTypeEnum, threadKindEnum, threadStatusEnum } from './enums';
import { bookings, guestStays, storedObjects } from './hospitality';
import { departments, serviceOrders } from './operations';
import { workspaces } from './org';
import { leases, maintenanceTickets, tenantPlacements } from './residence';

export const threads = pgTable(
  'threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    bookingId: uuid('booking_id').references(() => bookings.id),
    guestStayId: uuid('guest_stay_id').references(() => guestStays.id),
    leaseId: uuid('lease_id').references(() => leases.id),
    /**
     * A broker and a landlord about one placement (2026-10-26): the broker's
     * account on one side, the landlord business's team on the other. Made
     * the first time either side opens it.
     */
    placementId: uuid('placement_id').references((): AnyPgColumn => tenantPlacements.id),
    /**
     * §14.8. The department this conversation is with, when it is with one.
     * Routing is to the department and not to a person (D14), so a shift change
     * never strands a guest's question.
     */
    departmentId: uuid('department_id').references(
      (): AnyPgColumn => departments.id,
    ),
    threadKind: threadKindEnum('thread_kind').notNull().default('reservation'),
    subject: text('subject'),
    /** A free form ask can spawn an order or a work order; these link back. */
    serviceOrderId: uuid('service_order_id').references(
      (): AnyPgColumn => serviceOrders.id,
    ),
    maintenanceTicketId: uuid('maintenance_ticket_id').references(
      (): AnyPgColumn => maintenanceTickets.id,
    ),
    status: threadStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [
    index('threads_workspace_idx').on(t.workspaceId),
    index('threads_department_idx').on(t.departmentId),
    index('threads_booking_idx').on(t.bookingId),
    check(
      'threads_scope_exactly_one',
      sql`(CASE WHEN ${t.bookingId} IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN ${t.guestStayId} IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN ${t.leaseId} IS NOT NULL THEN 1 ELSE 0 END
           + CASE WHEN ${t.placementId} IS NOT NULL THEN 1 ELSE 0 END) = 1`,
    ),
    /**
     * ONE conversation per stay per department, enforced where a race cannot
     * reach it.
     *
     * A guest opening housekeeping twice — two taps, two tabs, a retried
     * request — must land in the conversation they already have, not in a
     * second one that splits the history and leaves half their messages in a
     * thread the desk has stopped looking at. The service reads-then-inserts,
     * which is exactly the check two concurrent taps both pass, so the index is
     * what actually refuses the loser; it retries into the winner's row.
     *
     * Partial on the kind, because a `dispute` raised about the same stay and
     * routed to the same department is a genuinely separate conversation.
     */
    uniqueIndex('threads_stay_department_request_uk')
      .on(t.guestStayId, t.departmentId)
      .where(
        sql`${t.threadKind} = 'department_request'
             AND ${t.guestStayId} IS NOT NULL
             AND ${t.departmentId} IS NOT NULL`,
      ),
    /**
     * THE SAME RULE FOR A CONVERSATION OPENED BEFORE ARRIVAL (ADR-050 D-q).
     *
     * A guest who has booked and not yet arrived has no stay, so their desk
     * conversation hangs off the BOOKING and the index above cannot see it:
     * two taps on "Message Housekeeping" from the trip screen would have opened
     * two threads, split the history, and left half of it where the desk had
     * stopped looking — the exact failure the stay index exists to prevent.
     *
     * `guest_stay_id IS NULL` is what keeps the two from overlapping. A thread
     * is scoped to a booking or to a stay and never to both
     * (`threads_scope_exactly_one`), so the predicate is belt and braces on a
     * rule the check constraint already holds — and it is the ADR's own wording.
     *
     * Partial on `status = 'active'` as well, which the stay index is not. That
     * is the shape D-q specifies, and it decides nothing on its own: the
     * service reads the existing conversation whatever its status and refuses
     * to write into an archived one (a guest does not re-open what the property
     * closed). The narrower predicate only means the database would not stop a
     * later, deliberate re-open — it is not a second answer to that question.
     */
    uniqueIndex('threads_booking_department_request_uk')
      .on(t.bookingId, t.departmentId)
      .where(
        sql`${t.threadKind} = 'department_request'
             AND ${t.guestStayId} IS NULL
             AND ${t.bookingId} IS NOT NULL
             AND ${t.departmentId} IS NOT NULL
             AND ${t.status} = 'active'`,
      ),
    /**
     * Rentals P3.4: ONE conversation per lease, landlord and tenant. Made when
     * the lease is signed or on the first message; the service inserts with
     * ON CONFLICT DO NOTHING and reads the winner, and this index is what
     * refuses the second of two racing first messages.
     */
    uniqueIndex('threads_lease_uk')
      .on(t.leaseId)
      .where(sql`${t.leaseId} IS NOT NULL`),
    /** One conversation per placement, broker and landlord; the same race rule as a lease's. */
    uniqueIndex('threads_placement_uk')
      .on(t.placementId)
      .where(sql`${t.placementId} IS NOT NULL`),
  ],
);


export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id').references(() => users.id),
    bodyType: messageBodyTypeEnum('body_type').notNull().default('text'),
    body: text('body'),
    /**
     * ADR-050 D-s: the order a `system` line reports on. The order itself
     * stays one record; this is only what lets a conversation draw its card.
     */
    serviceOrderId: uuid('service_order_id').references(
      (): AnyPgColumn => serviceOrders.id,
    ),
    voiceDurationS: integer('voice_duration_s'),
    /**
     * Rentals P3.4: the fault a lease conversation line is about (the tenant's
     * report, or a reply either side wrote on it), so the conversation shows
     * it and links to it. The fault's own timeline stays the record.
     */
    maintenanceTicketId: uuid('maintenance_ticket_id').references(
      (): AnyPgColumn => maintenanceTickets.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('messages_thread_idx').on(t.threadId),
    index('messages_thread_created_idx').on(t.threadId, t.createdAt),
    // Rentals P3.4: a voice note is up to two minutes (`VOICE_NOTE_MAX_S`).
    check(
      'messages_voice_duration_cap',
      sql`${t.voiceDurationS} IS NULL OR ${t.voiceDurationS} BETWEEN 1 AND 120`,
    ),
  ],
);


/**
 * ADR-032. Per person, per thread read state.
 *
 * The only durable answer to "has this person seen this conversation". It is
 * not device state: read on a phone should mean read on a laptop, and a
 * reinstall should not resurrect a month of unread dots.
 *
 * **No row means everything in the thread is unread**, which is the correct
 * reading for a thread you have never opened and avoids writing a row for every
 * participant at thread creation.
 *
 * The unread COUNT is never stored. It is messages newer than `last_read_at`,
 * computed at read time, because a stored counter has to be correct on every
 * write path and goes stale the first time one is missed.
 *
 * This closes the same gap the operator inbox has, so `apps/pms` gets unread
 * state from the same table.
 *
 * Read receipts are inference — they say when a person was awake and looking at
 * their phone — so in this build a row is visible only to its own owner and no
 * read state crosses the guest and operator boundary. Surfacing "seen" to the
 * other party would be a new decision, not an extension of this one.
 */
export const threadReads = pgTable(
  'thread_reads',
  {
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Server clock at the time of the call, never a client supplied time. */
    lastReadAt: timestamp('last_read_at', { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.threadId, t.userId] })],
);

export const messageAttachments = pgTable(
  'message_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    storedObjectId: uuid('stored_object_id')
      .notNull()
      .references(() => storedObjects.id),
    /** Rentals P3.4: the name the sender's file had, for a document card. */
    filename: text('filename'),
    /** Rentals P3.4: the order the files were sent in. */
    position: integer('position').notNull().default(0),
  },
  (t) => [index('message_attachments_message_idx').on(t.messageId)],
);

/**
 * Rentals P3.4: the unread-message emails, one row per conversation and side.
 *
 * A reader who leaves a message unread for a few minutes gets ONE email for
 * everything waiting for them, never one per message. `notified_through` is
 * the newest message the last email covered, so the next one is only about
 * what came after it; `sent_at` spaces two emails to the same side of the
 * same conversation (`MESSAGE_DIGEST_COOLDOWN_MIN`).
 */
export const threadDigests = pgTable(
  'thread_digests',
  {
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    side: text('side').notNull(),
    notifiedThrough: timestamp('notified_through', { withTimezone: true }).notNull(),
    sentAt: timestamp('sent_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.threadId, t.side] }),
    check('thread_digests_side', sql`${t.side} IN ('landlord', 'tenant', 'broker')`),
  ],
);

// ===========================================================================
// §8  MONEY  (ledger is truth; domain money objects post to it)
// ===========================================================================
