import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';

import {
  bookings,
  departments,
  guestStays,
  leases,
  messages,
  properties,
  rooms,
  roomTypes,
  threadReads,
  threads,
  users,
} from '../../../database/drizzle/schema';
import {
  DRIZZLE,
  type Database,
} from '../../../shared/database/database.module';

export interface ThreadRow {
  id: string;
  workspaceId: string;
  bookingId: string | null;
  guestStayId: string | null;
  leaseId: string | null;
  status: 'active' | 'archived';
}

/** The last line and the count, so a list reads without opening every thread. */
export interface ThreadSummary {
  threadId: string;
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  messageCount: number;
}

export interface MessageRow {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderName: string | null;
  bodyType: 'text' | 'image' | 'voice';
  body: string | null;
  voiceDurationS: number | null;
  createdAt: Date;
}

/**
 * What an aggregate hands back, as a `Date`.
 *
 * `max(created_at)` comes out of Postgres as a string because the driver's
 * `timestamptz` parser is bound to the COLUMN, not to an expression built in a
 * template. A `sql<Date>` annotation is an assertion and changes nothing at
 * runtime, so this is the conversion the annotation was pretending to be.
 */
function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

/**
 * A thread as its GUEST needs it: the operator row plus the two things a guest
 * reads it by — which property they are talking to, and which department, once
 * the property has routed the conversation to one.
 */
export interface GuestThreadRow extends ThreadRow {
  kind: 'reservation' | 'department_request' | 'dispute';
  propertyName: string | null;
  departmentName: string | null;
  updatedAt: Date;
}

/**
 * Threads and messages for the operator (ADR-012 step 4, `message.send`).
 *
 * `messages` is append only by the schema's own rule, so there is no update and
 * no delete here at all. A message that was sent was sent.
 *
 * **The guest-scoped methods live here too** (ADR-032), and that is the same
 * decision the service records: one definition of what a thread and a message
 * are, so the two surfaces cannot disagree about a row they both read. What
 * differs is only how OWNERSHIP is proved — a workspace id for the operator, the
 * thread's subject for the guest.
 */
@Injectable()
export class MessagingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listThreads(workspaceId: string): Promise<ThreadRow[]> {
    return this.db
      .select({
        id: threads.id,
        workspaceId: threads.workspaceId,
        bookingId: threads.bookingId,
        guestStayId: threads.guestStayId,
        leaseId: threads.leaseId,
        status: threads.status,
      })
      .from(threads)
      .where(eq(threads.workspaceId, workspaceId))
      .orderBy(desc(threads.updatedAt));
  }

  async findThread(threadId: string): Promise<ThreadRow | null> {
    const [row] = await this.db
      .select({
        id: threads.id,
        workspaceId: threads.workspaceId,
        bookingId: threads.bookingId,
        guestStayId: threads.guestStayId,
        leaseId: threads.leaseId,
        status: threads.status,
      })
      .from(threads)
      .where(eq(threads.id, threadId))
      .limit(1);

    return row ?? null;
  }

  /**
   * The last line and the message count for each thread, in one query.
   *
   * Aggregated in SQL rather than by reading every message and counting in
   * JavaScript: an inbox with a year of history would otherwise pull the whole
   * year across the wire to render twenty preview lines.
   */
  async summarise(threadIds: string[]): Promise<Map<string, ThreadSummary>> {
    const found = new Map<string, ThreadSummary>();
    if (threadIds.length === 0) return found;

    const rows = await this.db
      .select({
        threadId: messages.threadId,
        /*
         * A RAW aggregate, so nothing parses it into a Date.
         *
         * `sql<Date | null>` is an assertion, not a conversion: a column read
         * through the schema gets node-postgres' `timestamptz` parser, and an
         * aggregate built in a template string does not. Postgres hands back
         * `2026-09-12 09:00:00+00` as a STRING, the type says `Date`, and the
         * first caller to trust the type — here, `lastMessageAt.toISOString()` —
         * throws `not a function` at runtime with nothing wrong on screen until
         * a thread actually has a message in it.
         *
         * It is typed honestly here and converted below, in one place, because
         * BOTH surfaces read this map: the operator inbox carried the same
         * latent crash and the guest inbox is simply what reached it first.
         */
        lastMessageAt: sql<string | Date | null>`max(${messages.createdAt})`,
        messageCount: sql<number>`count(*)::int`,
      })
      .from(messages)
      .where(inArray(messages.threadId, threadIds))
      .groupBy(messages.threadId);

    // The preview text needs the newest ROW, which an aggregate cannot give.
    // One extra ordered read, then first-one-wins per thread.
    const newest = await this.db
      .select({
        threadId: messages.threadId,
        body: messages.body,
        bodyType: messages.bodyType,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(inArray(messages.threadId, threadIds))
      .orderBy(desc(messages.createdAt));

    const preview = new Map<string, string | null>();
    for (const row of newest) {
      if (preview.has(row.threadId)) continue;
      preview.set(
        row.threadId,
        row.bodyType === 'text' ? row.body : `[${row.bodyType}]`,
      );
    }

    for (const row of rows) {
      found.set(row.threadId, {
        threadId: row.threadId,
        // The one conversion, so every caller gets the Date the type promises.
        lastMessageAt: toDate(row.lastMessageAt),
        lastMessagePreview: preview.get(row.threadId) ?? null,
        messageCount: row.messageCount,
      });
    }
    return found;
  }

  /**
   * The name on the other side of each thread.
   *
   * Three joins because a thread hangs off exactly one of three things, and the
   * database check constraint guarantees exactly one, so the three lookups can
   * never disagree about who the counterpart is.
   */
  async counterparts(rows: ThreadRow[]): Promise<Map<string, string | null>> {
    const found = new Map<string, string | null>();
    if (rows.length === 0) return found;

    const byBooking = rows.filter((r) => r.bookingId);
    if (byBooking.length > 0) {
      const found2 = await this.db
        .select({ threadId: bookings.id, name: users.name })
        .from(bookings)
        .leftJoin(users, eq(users.id, bookings.guestUserId))
        .where(inArray(bookings.id, byBooking.map((r) => r.bookingId as string)));
      const byId = new Map(found2.map((r) => [r.threadId, r.name]));
      for (const r of byBooking) {
        found.set(r.id, byId.get(r.bookingId as string) ?? null);
      }
    }

    const byStay = rows.filter((r) => r.guestStayId);
    if (byStay.length > 0) {
      const found2 = await this.db
        .select({ stayId: guestStays.id, name: users.name })
        .from(guestStays)
        .leftJoin(users, eq(users.id, guestStays.guestUserId))
        .where(inArray(guestStays.id, byStay.map((r) => r.guestStayId as string)));
      const byId = new Map(found2.map((r) => [r.stayId, r.name]));
      for (const r of byStay) {
        found.set(r.id, byId.get(r.guestStayId as string) ?? null);
      }
    }

    const byLease = rows.filter((r) => r.leaseId);
    if (byLease.length > 0) {
      const found2 = await this.db
        .select({
          leaseId: leases.id,
          name: leases.tenantName,
          userName: users.name,
        })
        .from(leases)
        .leftJoin(users, eq(users.id, leases.tenantUserId))
        .where(inArray(leases.id, byLease.map((r) => r.leaseId as string)));
      // The lease carries a typed tenant name for a tenant with no account yet;
      // the account's own name wins when there is one.
      const byId = new Map(found2.map((r) => [r.leaseId, r.userName ?? r.name]));
      for (const r of byLease) {
        found.set(r.id, byId.get(r.leaseId as string) ?? null);
      }
    }

    return found;
  }

  /**
   * The ACCOUNT on the other side of one thread: the booking's guest, the
   * stay's guest or the lease's tenant. Null when that person has no account
   * (a walk-in, a tenant typed in by name), in which case nobody in the thread
   * can be them.
   *
   * What the desk needs to side a bubble. On the desk every line NOT written by
   * this person is the property's, whichever colleague typed it, so the desk
   * cannot side from the reader the way the guest does (demo-comms, 2026-09-14).
   */
  async counterpartUserId(row: ThreadRow): Promise<string | null> {
    if (row.bookingId) {
      const [found] = await this.db
        .select({ userId: bookings.guestUserId })
        .from(bookings)
        .where(eq(bookings.id, row.bookingId))
        .limit(1);
      return found?.userId ?? null;
    }
    if (row.guestStayId) {
      const [found] = await this.db
        .select({ userId: guestStays.guestUserId })
        .from(guestStays)
        .where(eq(guestStays.id, row.guestStayId))
        .limit(1);
      return found?.userId ?? null;
    }
    if (row.leaseId) {
      const [found] = await this.db
        .select({ userId: leases.tenantUserId })
        .from(leases)
        .where(eq(leases.id, row.leaseId))
        .limit(1);
      return found?.userId ?? null;
    }
    return null;
  }

  async listMessages(threadId: string): Promise<MessageRow[]> {
    return this.db
      .select({
        id: messages.id,
        threadId: messages.threadId,
        senderUserId: messages.senderUserId,
        senderName: users.name,
        bodyType: messages.bodyType,
        body: messages.body,
        voiceDurationS: messages.voiceDurationS,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderUserId))
      .where(eq(messages.threadId, threadId))
      .orderBy(asc(messages.createdAt));
  }

  /**
   * Append a message, and touch the thread so an inbox sorts correctly.
   *
   * One transaction: a message whose thread did not move to the top is a
   * message nobody sees.
   */
  async sendMessage(
    threadId: string,
    senderUserId: string,
    body: string,
  ): Promise<string | null> {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(messages)
        .values({ threadId, senderUserId, bodyType: 'text', body })
        .returning({ id: messages.id });

      if (!created) return null;

      await tx
        .update(threads)
        .set({ updatedAt: new Date() })
        .where(eq(threads.id, threadId));

      return created.id;
    });
  }

  async findMessage(messageId: string): Promise<MessageRow | null> {
    const [row] = await this.db
      .select({
        id: messages.id,
        threadId: messages.threadId,
        senderUserId: messages.senderUserId,
        senderName: users.name,
        bodyType: messages.bodyType,
        body: messages.body,
        voiceDurationS: messages.voiceDurationS,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderUserId))
      .where(eq(messages.id, messageId))
      .limit(1);

    return row ?? null;
  }

  /* ------------------------------------------------------ the guest's side */

  /**
   * Every thread this person owns, newest activity first (ADR-032).
   *
   * THREE QUERIES, NOT ONE, and deliberately. `threads_scope_exactly_one` means
   * a thread hangs off a booking, a stay or a lease — never two — and each of
   * those resolves to its owner down a different path. Written as one statement
   * it would be a three-way OR across three left joins, which Postgres cannot
   * serve from `bookings_guest_idx` or `leases_tenant_idx`: it would degrade to a
   * scan of every thread on the platform as the table grows. Three indexed
   * lookups, merged in memory, stay fast and stay readable.
   *
   * Every scope reaches its property through `rooms`/`room_types`, which both
   * carry the property, so the name a guest reads is the one in the database.
   */
  async listThreadsForGuest(userId: string): Promise<GuestThreadRow[]> {
    const columns = {
      id: threads.id,
      workspaceId: threads.workspaceId,
      bookingId: threads.bookingId,
      guestStayId: threads.guestStayId,
      leaseId: threads.leaseId,
      status: threads.status,
      kind: threads.threadKind,
      propertyName: properties.name,
      departmentName: departments.name,
      updatedAt: threads.updatedAt,
    };

    const byBooking = this.db
      .select(columns)
      .from(threads)
      .innerJoin(bookings, eq(bookings.id, threads.bookingId))
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .leftJoin(properties, eq(properties.id, roomTypes.propertyId))
      .leftJoin(departments, eq(departments.id, threads.departmentId))
      .where(eq(bookings.guestUserId, userId));

    const byStay = this.db
      .select(columns)
      .from(threads)
      .innerJoin(guestStays, eq(guestStays.id, threads.guestStayId))
      .leftJoin(rooms, eq(rooms.id, guestStays.roomId))
      .leftJoin(properties, eq(properties.id, rooms.propertyId))
      .leftJoin(departments, eq(departments.id, threads.departmentId))
      .where(eq(guestStays.guestUserId, userId));

    const byLease = this.db
      .select(columns)
      .from(threads)
      .innerJoin(leases, eq(leases.id, threads.leaseId))
      .leftJoin(rooms, eq(rooms.id, leases.roomId))
      .leftJoin(properties, eq(properties.id, rooms.propertyId))
      .leftJoin(departments, eq(departments.id, threads.departmentId))
      .where(eq(leases.tenantUserId, userId));

    const [fromBookings, fromStays, fromLeases] = await Promise.all([
      byBooking,
      byStay,
      byLease,
    ]);

    // A thread can appear once at most — one scope column is set — so the merge
    // needs no dedupe, only an order. Newest activity first, which is what puts
    // the conversation somebody just replied to at the top.
    return [...fromBookings, ...fromStays, ...fromLeases].sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
    );
  }

  /**
   * One thread, only if this person owns it.
   *
   * The ownership test is IN the query. A `findThread` followed by a check would
   * have the row in memory already, which is the same leak one refactor later —
   * and the service turns a miss into a 404 rather than a 403 so that a probe
   * cannot learn whether the id exists at all.
   */
  async findThreadForGuest(
    threadId: string,
    userId: string,
  ): Promise<GuestThreadRow | null> {
    const mine = await this.listThreadsForGuest(userId);
    return mine.find((row) => row.id === threadId) ?? null;
  }

  /**
   * Unread per thread for one person: messages newer than their `last_read_at`.
   *
   * No read row means the whole thread is unread, which is why this is a LEFT
   * join from messages to `thread_reads` rather than an inner one. Messages the
   * person sent themselves are excluded — a reply you typed is not news to you,
   * and counting it would leave every thread you have just answered showing 1.
   *
   * The count is computed here every time and never stored: a stored counter has
   * to be correct on every write path and goes stale the first time one is not.
   */
  async unreadCounts(
    threadIds: string[],
    userId: string,
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (threadIds.length === 0) return counts;

    const rows = await this.db
      .select({
        threadId: messages.threadId,
        unread: sql<number>`count(*)::int`,
      })
      .from(messages)
      .leftJoin(
        threadReads,
        and(
          eq(threadReads.threadId, messages.threadId),
          eq(threadReads.userId, userId),
        ),
      )
      .where(
        and(
          inArray(messages.threadId, threadIds),
          or(
            isNull(threadReads.lastReadAt),
            gt(messages.createdAt, threadReads.lastReadAt),
          ),
          or(
            isNull(messages.senderUserId),
            ne(messages.senderUserId, userId),
          ),
        ),
      )
      .groupBy(messages.threadId);

    for (const row of rows) counts.set(row.threadId, row.unread);
    return counts;
  }

  /**
   * One page of a conversation, NEWEST first.
   *
   * Keyset paging on `(created_at, id)`, not an offset: a chat gains messages
   * while somebody scrolls, and an offset would skip or repeat a line every time
   * it did. The id breaks ties so two messages written in the same millisecond
   * cannot hide each other.
   *
   * It asks for one row more than the caller wants, which is how the service
   * knows whether there is an older page without a second count query.
   */
  async messagePage(
    threadId: string,
    limit: number,
    before?: { createdAt: Date; id: string },
  ): Promise<MessageRow[]> {
    return this.db
      .select({
        id: messages.id,
        threadId: messages.threadId,
        senderUserId: messages.senderUserId,
        senderName: users.name,
        bodyType: messages.bodyType,
        body: messages.body,
        voiceDurationS: messages.voiceDurationS,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.senderUserId))
      .where(
        before
          ? and(
              eq(messages.threadId, threadId),
              or(
                lt(messages.createdAt, before.createdAt),
                and(
                  eq(messages.createdAt, before.createdAt),
                  lt(messages.id, before.id),
                ),
              ),
            )
          : eq(messages.threadId, threadId),
      )
      .orderBy(desc(messages.createdAt), desc(messages.id))
      .limit(limit + 1);
  }

  /**
   * Mark a thread read, at the SERVER's clock.
   *
   * Never a client-supplied time: a device with a fast clock would mark messages
   * that have not arrived yet as already read, and they would never show as
   * unread again (ADR-032 § Value sourcing).
   */
  async markRead(threadId: string, userId: string, at: Date): Promise<void> {
    await this.db
      .insert(threadReads)
      .values({ threadId, userId, lastReadAt: at })
      .onConflictDoUpdate({
        target: [threadReads.threadId, threadReads.userId],
        set: { lastReadAt: at },
      });
  }
}
