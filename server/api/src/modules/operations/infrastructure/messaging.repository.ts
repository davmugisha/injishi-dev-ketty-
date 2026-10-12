import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import {
  accountLabel,
  accountName,
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
import {
  inBranchScope,
  type BranchScope,
} from '../../../shared/auth/branch-scope';
import { ENDED_BOOKING_STATUSES } from '../domain/live-booking';

/**
 * A thread's branch (ADR-054): its booking's, else its stay's room's (a walk in
 * has no booking), else its department's. Null for a thread tied to none of
 * them, which only a member covering every branch sees (AC-T3).
 *
 * Raw SQL with its own aliases, on purpose. In a select from `threads` alone,
 * drizzle renders a column in the projection WITHOUT its table name, so
 * `${bookings.id}` came out as a bare `"id"` inside the subquery and Postgres
 * refused it as ambiguous. Every name here is written out in full instead.
 */
const THREAD_BRANCH = sql<string | null>`coalesce(
  (select tb_rt.property_id from bookings tb_b inner join room_types tb_rt on tb_rt.id = tb_b.room_type_id where tb_b.id = "threads"."booking_id"),
  (select tb_r.property_id from guest_stays tb_gs inner join rooms tb_r on tb_r.id = tb_gs.room_id where tb_gs.id = "threads"."guest_stay_id"),
  (select tb_d.property_id from departments tb_d where tb_d.id = "threads"."department_id")
)`;

export interface ThreadRow {
  id: string;
  workspaceId: string;
  bookingId: string | null;
  guestStayId: string | null;
  leaseId: string | null;
  /** The branch the thread belongs to, see `THREAD_BRANCH`. */
  branchPropertyId: string | null;
  status: 'active' | 'archived';
  /** The department the conversation is with, when it is with one (ADR-050 D-q). */
  departmentName: string | null;
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
  bodyType: 'text' | 'image' | 'voice' | 'system';
  body: string | null;
  serviceOrderId: string | null;
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
/** A guest reads their own threads by person, never by branch, so no branch. */
export interface GuestThreadRow extends Omit<ThreadRow, 'branchPropertyId'> {
  kind: 'reservation' | 'department_request' | 'dispute';
  propertyId: string | null;
  propertyName: string | null;
  updatedAt: Date;
}

/** A desk a guest may write to, as the property configured it. */
export interface RequestableDepartmentRow {
  id: string;
  /** Which property's desk it is. Every row here has one; the filter is by property. */
  propertyId: string | null;
  name: string;
  departmentCategory: string;
  phone: string | null;
}

/**
 * WHICH RECORD a desk conversation hangs off (ADR-050 D-q).
 *
 * A guest in house has a stay; a guest who has booked and not yet arrived has
 * only the booking, and until this existed they could reach no desk at all. The
 * two are one shape here because everything else about opening a conversation —
 * the read-then-insert, the archived rule, the retry into the winner's row — is
 * identical, and a second copy of that transaction is how the two would drift.
 *
 * `threads_scope_exactly_one` is why this is a union rather than a pair of
 * nullable ids: a thread hangs off exactly one subject, and a shape that can
 * hold both is a shape that can be filled in wrong.
 */
export type DeskSubject =
  | { kind: 'stay'; guestStayId: string }
  | { kind: 'booking'; bookingId: string };

/**
 * The partial unique that governs one-thread-per-subject-per-department, by
 * subject. ADR-050 D-q specifies both; they cannot be one index because a
 * conversation opened before arrival keeps its booking and gains no stay.
 */
const DESK_THREAD_UNIQUE: Readonly<Record<DeskSubject['kind'], string>> = {
  stay: 'threads_stay_department_request_uk',
  booking: 'threads_booking_department_request_uk',
};

/**
 * Order a desk's conversations so the one a guest can still write in comes
 * first. Written out rather than `asc(status)` — that would sort on the enum's
 * spelling, which is only accidentally the right order.
 */
const ACTIVE_FIRST = sql`(${threads.status} = 'active') desc`;

/**
 * The one scope column an insert sets. The other is left UNSET rather than
 * written as null, so `threads_scope_exactly_one` is satisfied by construction.
 */
function subjectColumn(
  on: DeskSubject,
): { guestStayId: string } | { bookingId: string } {
  return on.kind === 'stay'
    ? { guestStayId: on.guestStayId }
    : { bookingId: on.bookingId };
}

/** Is this a collision on the one-thread-per-subject-per-department index? */
function isDepartmentThreadCollision(
  error: unknown,
  constraint: string,
): boolean {
  const e = error as { code?: string; constraint?: string; cause?: unknown };
  const inner = e?.code === '23505' ? e : (e?.cause as typeof e | undefined);
  return inner?.code === '23505' && inner.constraint === constraint;
}

/** One property a guest may write to, and the record that opens its desks. */
export interface GuestPlaceRow {
  propertyId: string;
  propertyName: string;
  workspaceId: string;
  subjectId: string;
  bookingReference: string | null;
  /** The booking's check-in date, or the stay's entry instant. */
  checkIn: string | null;
}

/** A desk conversation that already exists, keyed back to what opened it. */
export interface DeskThreadRow {
  threadId: string;
  /** Never null in practice — the read asks for department threads — but the column is. */
  departmentId: string | null;
  guestStayId: string | null;
  bookingId: string | null;
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

  /**
   * The desk's inbox, optionally narrowed to ONE department.
   *
   * The filter is a `WHERE` clause and never a `.filter()` on the answer. An
   * inbox is the one read here that grows without limit — a property's whole
   * message history — so filtering after the read would pull every thread of
   * every department across the wire to render one department's board, and
   * would get slower exactly as the property gets busier. `threads_department_idx`
   * serves this.
   */
  async listThreads(
    workspaceId: string,
    scope: BranchScope,
    departmentId?: string,
  ): Promise<ThreadRow[]> {
    return this.db
      .select({
        id: threads.id,
        workspaceId: threads.workspaceId,
        bookingId: threads.bookingId,
        guestStayId: threads.guestStayId,
        leaseId: threads.leaseId,
        branchPropertyId: THREAD_BRANCH,
        status: threads.status,
        departmentName: departments.name,
      })
      .from(threads)
      .leftJoin(departments, eq(departments.id, threads.departmentId))
      .where(
        and(
          eq(threads.workspaceId, workspaceId),
          // A lease thread belongs to a residence org and is unscoped (ADR-054).
          or(isNotNull(threads.leaseId), inBranchScope(THREAD_BRANCH, scope)),
          departmentId ? eq(threads.departmentId, departmentId) : undefined,
        ),
      )
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
        branchPropertyId: THREAD_BRANCH,
        status: threads.status,
        departmentName: departments.name,
      })
      .from(threads)
      .leftJoin(departments, eq(departments.id, threads.departmentId))
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
        // A system line is readable text too: "Order A12 is ready." is the
        // preview a guest wants, not "[system]".
        row.bodyType === 'text' || row.bodyType === 'system' ? row.body : `[${row.bodyType}]`,
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
        .select({ threadId: bookings.id, name: accountLabel })
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
        .select({ stayId: guestStays.id, name: accountLabel })
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
          userName: accountName,
          email: users.email,
        })
        .from(leases)
        .leftJoin(users, eq(users.id, leases.tenantUserId))
        .where(inArray(leases.id, byLease.map((r) => r.leaseId as string)));
      // The lease carries a typed tenant name for a tenant with no account yet;
      // the account's own name wins when there is one.
      // Then the account's email, so the inbox can tell an unnamed tenant apart.
      const byId = new Map(found2.map((r) => [r.leaseId, r.userName ?? r.name ?? r.email]));
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
        senderName: accountLabel,
        bodyType: messages.bodyType,
        body: messages.body,
        serviceOrderId: messages.serviceOrderId,
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
        senderName: accountLabel,
        bodyType: messages.bodyType,
        body: messages.body,
        serviceOrderId: messages.serviceOrderId,
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
      propertyId: properties.id,
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
        senderName: accountLabel,
        bodyType: messages.bodyType,
        body: messages.body,
        serviceOrderId: messages.serviceOrderId,
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
   * The desks at one property a GUEST may write to (§6.8).
   *
   * `guest_requestable` is the filter, and it has existed since ADR-016 with
   * nothing reading it: no guest surface could start a conversation at all, so
   * every department was equally unreachable and the flag was decoration. It is
   * the property's own control over which of its internal desks take messages
   * from guests, and Accounting is not one of them.
   *
   * Archived departments are excluded. A retired desk keeps its revenue history
   * and its old threads; it does not keep the right to be messaged.
   */
  async requestableDepartments(
    propertyIds: readonly string[],
  ): Promise<RequestableDepartmentRow[]> {
    if (propertyIds.length === 0) return [];
    return this.db
      .select({
        id: departments.id,
        propertyId: departments.propertyId,
        name: departments.name,
        departmentCategory: departments.departmentCategory,
        phone: departments.phone,
      })
      .from(departments)
      .where(
        and(
          inArray(departments.propertyId, [...propertyIds]),
          eq(departments.status, 'active'),
          eq(departments.guestRequestable, true),
        ),
      )
      .orderBy(asc(departments.sortOrder), asc(departments.name));
  }

  /**
   * The desk conversations these subjects already have, in one read.
   *
   * SEPARATE from the department list above rather than a left join onto it,
   * because the two questions have different shapes: the desks are per
   * PROPERTY and the conversations are per STAY OR BOOKING, and a guest can
   * hold several of each. Joined, the desk list would have to be re-read once
   * per place; read apart and stitched, both are one query however many places
   * a person has.
   */
  async deskThreadsFor(subjects: readonly DeskSubject[]): Promise<DeskThreadRow[]> {
    const stayIds = subjects.flatMap((s) => (s.kind === 'stay' ? [s.guestStayId] : []));
    const bookingIds = subjects.flatMap((s) => (s.kind === 'booking' ? [s.bookingId] : []));
    if (stayIds.length === 0 && bookingIds.length === 0) return [];

    return this.db
      .select({
        threadId: threads.id,
        departmentId: threads.departmentId,
        guestStayId: threads.guestStayId,
        bookingId: threads.bookingId,
        updatedAt: threads.updatedAt,
      })
      .from(threads)
      .where(
        and(
          eq(threads.threadKind, 'department_request'),
          isNotNull(threads.departmentId),
          or(
            stayIds.length > 0 ? inArray(threads.guestStayId, stayIds) : undefined,
            bookingIds.length > 0 ? inArray(threads.bookingId, bookingIds) : undefined,
          ),
        ),
      )
      // Live conversations first. A booking may hold an archived conversation
      // AND a live one with the same desk — the booking index is partial on
      // `status = 'active'`, which is what allows that — and the desk list must
      // point at the one the guest can write in. Whichever is newest breaks a
      // tie, so the answer never depends on the planner's row order.
      .orderBy(ACTIVE_FIRST, desc(threads.updatedAt));
  }

  /**
   * Does this department take guest messages at all, and WHERE does it stand?
   *
   * By id alone, because `POST /me/threads` is named by the department and
   * nothing else: the guest tapped "Housekeeping" and the server is the one
   * that works out which record of theirs opens it. The property comes BACK
   * from this read and is then matched against the caller's own stays and
   * bookings — a property id supplied by the caller would be a caller choosing
   * which hotel to be treated as a guest of.
   */
  async findGuestRequestableDepartment(departmentId: string): Promise<{
    id: string;
    name: string;
    propertyId: string | null;
    workspaceId: string;
  } | null> {
    const [row] = await this.db
      .select({
        id: departments.id,
        name: departments.name,
        propertyId: departments.propertyId,
        workspaceId: departments.workspaceId,
      })
      .from(departments)
      .where(
        and(
          eq(departments.id, departmentId),
          eq(departments.status, 'active'),
          eq(departments.guestRequestable, true),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * The properties this person is IN HOUSE at right now.
   *
   * A stay with no room, and so no property, is dropped rather than listed
   * without one: a place a guest cannot be told the name of is a row they
   * cannot act on, and the desks hang off the property anyway.
   */
  async openStaysForGuest(userId: string): Promise<GuestPlaceRow[]> {
    const rows = await this.db
      .select({
        propertyId: rooms.propertyId,
        propertyName: properties.name,
        workspaceId: guestStays.workspaceId,
        subjectId: guestStays.id,
        bookingReference: bookings.reference,
        entryAt: guestStays.entryAt,
      })
      .from(guestStays)
      .innerJoin(rooms, eq(rooms.id, guestStays.roomId))
      .innerJoin(properties, eq(properties.id, rooms.propertyId))
      .leftJoin(bookings, eq(bookings.id, guestStays.bookingId))
      .where(
        and(eq(guestStays.guestUserId, userId), eq(guestStays.lifecycle, 'open')),
      )
      .orderBy(desc(guestStays.entryAt));

    return rows.map((row) => ({
      propertyId: row.propertyId,
      propertyName: row.propertyName,
      workspaceId: row.workspaceId,
      subjectId: row.subjectId,
      bookingReference: row.bookingReference,
      checkIn: row.entryAt.toISOString(),
    }));
  }

  /**
   * The properties this person holds a LIVE booking with (ADR-050 D-q).
   *
   * What makes a booking live is `isLiveBooking`'s to say and is rendered here
   * as SQL once, so the rule cannot be half-applied by a call site that forgot
   * the date half. `today` is the caller's, in the property's calendar, so one
   * request cannot straddle midnight.
   *
   * Ordered by check-in, soonest first, and then by id: when a guest holds two
   * live bookings at the same property, the desk conversation belongs to the
   * arrival they are about to make, and the tie-break keeps that answer the
   * same on every call rather than leaving it to the planner's row order.
   */
  async liveBookingsForGuest(
    userId: string,
    today: string,
  ): Promise<GuestPlaceRow[]> {
    const rows = await this.db
      .select({
        propertyId: roomTypes.propertyId,
        propertyName: properties.name,
        workspaceId: bookings.workspaceId,
        subjectId: bookings.id,
        bookingReference: bookings.reference,
        checkIn: bookings.checkIn,
      })
      .from(bookings)
      .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
      .innerJoin(properties, eq(properties.id, roomTypes.propertyId))
      .where(
        and(
          eq(bookings.guestUserId, userId),
          notInArray(bookings.status, [...ENDED_BOOKING_STATUSES]),
          gte(bookings.checkOut, today),
        ),
      )
      .orderBy(asc(bookings.checkIn), asc(bookings.id));

    return rows;
  }

  /**
   * OPEN THE CONVERSATION WITH ONE DESK AND SAY SOMETHING, in ONE transaction
   * (§6.8).
   *
   * ## Why the thread and the first message are written together
   *
   * A thread with no message in it is a row the desk reads as "a guest wanted
   * something and did not say what". Two calls mean a dropped connection
   * between them leaves exactly that, and the guest sees a conversation they
   * believe they sent.
   *
   * ## Why the existing thread is reused rather than a second one opened
   *
   * A guest tapping Housekeeping on Monday and again on Wednesday is having one
   * conversation with housekeeping, and splitting it would leave half of it in a
   * thread the desk has stopped looking at. The read-then-insert below is
   * exactly the check two simultaneous taps both pass, so the partial unique for
   * the subject — `threads_stay_department_request_uk` for a stay,
   * `threads_booking_department_request_uk` for a booking (ADR-050 D-q) — is
   * what actually refuses the loser, and the loser retries into the winner's row
   * rather than failing in front of the guest.
   *
   * ## Why a booking subject is the same method and not a second one
   *
   * A conversation opened before arrival hangs off the BOOKING, because there is
   * no stay yet and there may never be one. Everything else about opening it is
   * identical, and the part that is easy to get wrong — the race, the archived
   * rule, the retry — is the part a second copy would eventually get wrong in
   * only one of the two places.
   */
  async openDepartmentThread(input: {
    workspaceId: string;
    on: DeskSubject;
    departmentId: string;
    subject: string | null;
    body: string;
    senderUserId: string;
  }): Promise<{ threadId: string; created: boolean } | null> {
    try {
      return await this.insertDepartmentThread(input);
    } catch (error) {
      if (!isDepartmentThreadCollision(error, DESK_THREAD_UNIQUE[input.on.kind])) {
        throw error;
      }
      // Somebody else's tap won the race. Append to what they created.
      const existing = await this.findDepartmentThread(
        input.on,
        input.departmentId,
      );
      if (!existing) throw error;
      const messageId = await this.sendMessage(
        existing.id,
        input.senderUserId,
        input.body,
      );
      return messageId ? { threadId: existing.id, created: false } : null;
    }
  }

  private insertDepartmentThread(
    input: Parameters<MessagingRepository['openDepartmentThread']>[0],
  ): Promise<{ threadId: string; created: boolean } | null> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: threads.id, status: threads.status })
        .from(threads)
        .where(this.deskThreadWhere(input.on, input.departmentId))
        // The live one wins when a subject holds both. Without the order, a
        // guest whose old conversation with this desk was archived could be
        // answered "that conversation is closed" forever while an open one sat
        // beside it.
        .orderBy(ACTIVE_FIRST, desc(threads.updatedAt))
        .limit(1);

      const threadId =
        existing?.id ??
        (
          await tx
            .insert(threads)
            .values({
              workspaceId: input.workspaceId,
              ...subjectColumn(input.on),
              departmentId: input.departmentId,
              threadKind: 'department_request',
              subject: input.subject,
            })
            .returning({ id: threads.id })
        )[0]?.id;
      if (!threadId) return null;

      // An archived thread takes no writes, guest or operator (ADR-032 AC-19).
      // Reopening it here would be a guest un-archiving a conversation the
      // property closed, which is the property's decision and not theirs.
      if (existing && existing.status === 'archived') return null;

      const [created] = await tx
        .insert(messages)
        .values({
          threadId,
          senderUserId: input.senderUserId,
          bodyType: 'text',
          body: input.body,
        })
        .returning({ id: messages.id });
      if (!created) return null;

      await tx
        .update(threads)
        .set({ updatedAt: new Date() })
        .where(eq(threads.id, threadId));

      return { threadId, created: existing === undefined };
    });
  }

  /** The conversation this stay or booking already has with this desk, if any. */
  async findDepartmentThread(
    on: DeskSubject,
    departmentId: string,
  ): Promise<{ id: string } | null> {
    const [row] = await this.db
      .select({ id: threads.id })
      .from(threads)
      .where(this.deskThreadWhere(on, departmentId))
      .orderBy(ACTIVE_FIRST, desc(threads.updatedAt))
      .limit(1);
    return row ?? null;
  }

  /**
   * The one conversation a subject may have with a desk, as a `WHERE`.
   *
   * Written once and used by the read inside the transaction and by the retry
   * after a collision: those two must ask the same question, or the retry would
   * look for a row the insert never tried to write.
   */
  private deskThreadWhere(
    on: DeskSubject,
    departmentId: string,
  ): SQL | undefined {
    return and(
      on.kind === 'stay'
        ? eq(threads.guestStayId, on.guestStayId)
        : eq(threads.bookingId, on.bookingId),
      eq(threads.departmentId, departmentId),
      eq(threads.threadKind, 'department_request'),
    );
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
