import type {
  DepartmentCategory,
  GuestMessage,
  GuestMessagePage,
  GuestThread,
  MyDepartments,
  OperatorMessage,
  OpenDepartmentRequest,
  OpenDepartmentResult,
  OpenThreadRequest,
  OperatorThread,
  SendGuestMessageInput,
  SendMessageRequest,
  StayDepartment,
  StayDepartments,
} from '@injishi/contracts';
import { GUEST_MESSAGE_PAGE, GUEST_MESSAGE_PAGE_MAX } from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import {
  assertInBranchScope,
  type ScopedWorkspace,
} from '../../../shared/auth/branch-scope';
import { localToday } from '../../pms/domain/pricing';
import { scrubPhoneNumbers } from './scrub';
import {
  type DeskSubject,
  type DeskThreadRow,
  type GuestPlaceRow,
  type GuestThreadRow,
  type MessageRow,
  type ThreadRow,
  MessagingRepository,
} from '../infrastructure/messaging.repository';
import type { MyStayRow } from '../infrastructure/stay-claim.repository';

/**
 * The page cursor: a message's `(created_at, id)`, base64url so it reads as
 * opaque and nobody builds one by hand.
 *
 * Both halves are needed. `created_at` alone cannot break a tie between two
 * messages written in the same millisecond, and a tie in a keyset cursor means
 * one of them is skipped or repeated on the page boundary — in a conversation,
 * the one message somebody was looking for.
 */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString(
    'base64url',
  );
}

function decodeCursor(
  cursor: string | undefined,
): { createdAt: Date; id: string } | undefined {
  if (!cursor) return undefined;
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = at ? new Date(at) : null;
  // A malformed cursor is treated as no cursor: the reader gets the newest page
  // rather than a 400 about a token they never typed.
  if (!createdAt || Number.isNaN(createdAt.getTime()) || !id) return undefined;
  return { createdAt, id };
}

/**
 * An archived thread takes no writes (ADR-032, AC-19).
 *
 * `architecture-schema.md` §6.7 calls an archived thread read only without
 * naming a side, and `sendMessage` had no status check at all, so this is the
 * schema's own rule finally being enforced rather than a new restriction.
 *
 * **It changes `apps/pms` too, and that is deliberate.** The guest and operator
 * surfaces share this method on purpose, so refusing the guest necessarily
 * refuses property staff writing into an archived thread as well. There is no
 * version of this that holds for one side only without forking the service,
 * which is the thing ADR-032 set out not to do. It is a live behaviour change
 * to a shipped surface: whoever operates `apps/pms` should hear about it before
 * it deploys.
 *
 * 409 and not 403: the caller may well be allowed to write here, the thread is
 * simply closed. That is a conflict with the row's state, not a permission.
 */
function assertWritable(status: 'active' | 'archived'): void {
  if (status === 'archived') {
    throw new ConflictException(
      'This conversation is closed. The stay it belongs to has ended.',
    );
  }
}

/**
 * Operator messaging (ADR-012 step 4, `message.send`).
 *
 * One inbox serves all three scopes — a booking, a stay, a lease — because the
 * shape is identical and only the noun changes. That is the same call
 * `Conversation.tsx` already makes on the client side, so the two agree.
 */
@Injectable()
export class MessagingService {
  constructor(private readonly messaging: MessagingRepository) {}

  /**
   * The desk's inbox, all of it or one department's (ADR-050 D-q).
   *
   * The department filter is passed down to the query rather than applied to
   * the answer: see `MessagingRepository.listThreads`. A department that cannot
   * find its own conversations is the complaint this exists to answer — one
   * flat list per workspace made Housekeeping read the restaurant's messages to
   * find its own.
   */
  async listThreads(
    ws: ScopedWorkspace,
    departmentId?: string,
  ): Promise<OperatorThread[]> {
    const rows = await this.messaging.listThreads(
      ws.workspaceId,
      ws.branchScope,
      departmentId,
    );
    const summaries = await this.messaging.summarise(rows.map((r) => r.id));
    const counterparts = await this.messaging.counterparts(rows);

    return rows.map((row) => {
      const summary = summaries.get(row.id);
      return {
        ...this.presentThread(row),
        counterpartName: counterparts.get(row.id) ?? null,
        departmentName: row.departmentName,
        lastMessageAt: summary?.lastMessageAt?.toISOString() ?? null,
        // The preview is a message body leaving the API, so it redacts too.
        // ADR-032 describes the call site as `presentMessage()`, which the
        // preview does not go through; the invariant it states is that NO body
        // leaves unscrubbed, and a number in the last line would otherwise show
        // verbatim on the row. Worth confirming with /architect.
        lastMessagePreview: scrubPhoneNumbers(summary?.lastMessagePreview ?? null),
        messageCount: summary?.messageCount ?? 0,
      };
    });
  }

  /**
   * Every message in one thread.
   *
   * The thread is proved to belong to this workspace before a single message is
   * read. Reading first and filtering after would mean the rows were already in
   * memory, which is the same leak one refactor later.
   */
  async listMessages(
    ws: ScopedWorkspace,
    threadId: string,
    viewerUserId: string,
  ): Promise<OperatorMessage[]> {
    const thread = this.ownThread(ws, await this.messaging.findThread(threadId));
    const [rows, counterpart] = await Promise.all([
      this.messaging.listMessages(thread.id),
      this.messaging.counterpartUserId(thread),
    ]);
    return rows.map((row) => this.presentDeskMessage(row, counterpart, viewerUserId));
  }

  /**
   * Send into a thread.
   *
   * No idempotency key, deliberately. A repeated message is visible, cheap and
   * fixable by the person who sent it; a swallowed one is none of those. The
   * key belongs on commands that move money, where a repeat is invisible and
   * permanent.
   */
  async sendMessage(
    ws: ScopedWorkspace,
    threadId: string,
    body: SendMessageRequest,
    senderUserId: string,
  ): Promise<OperatorMessage> {
    const thread = this.ownThread(ws, await this.messaging.findThread(threadId));
    assertWritable(thread.status);

    const messageId = await this.messaging.sendMessage(
      thread.id,
      senderUserId,
      body.body,
    );
    if (!messageId) {
      throw new BadRequestException('That message could not be sent. Try again.');
    }

    const created = await this.messaging.findMessage(messageId);
    if (!created) {
      throw new BadRequestException('That message could not be sent. Try again.');
    }
    const counterpart = await this.messaging.counterpartUserId(thread);
    return this.presentDeskMessage(created, counterpart, senderUserId);
  }

  /**
   * The thread a route named, proved to be this workspace's and on a branch in
   * scope (ADR-054 AC-T2, AC-T3). A lease thread is unscoped: residence orgs
   * have no branches.
   */
  private ownThread(ws: ScopedWorkspace, row: ThreadRow | null): ThreadRow {
    const thread = assertOwned(row, ws);
    if (!thread.leaseId) assertInBranchScope(ws, thread.branchPropertyId);
    return thread;
  }

  /* ------------------------------------------------------ the guest's side */

  /**
   * Every conversation this person owns (ADR-032).
   *
   * EXTENDED, not forked. The operator and the guest read the same rows, and two
   * services would be two answers to "what is a message" and "what gets
   * redacted" — the second of which is a privacy rule (F-S06). So the scrubbing,
   * the bubble siding and the archived rule below are literally the same code
   * paths the desk uses.
   *
   * What differs is only how ownership is proved. A thread's `workspace_id` is
   * the PROPERTY's, so `WorkspaceGuard` cannot authorize a guest; the subject
   * does, through `bookings.guest_user_id`, the stay's guest or the lease's
   * tenant.
   */
  async listGuestThreads(userId: string): Promise<GuestThread[]> {
    const rows = await this.messaging.listThreadsForGuest(userId);
    const ids = rows.map((r) => r.id);
    const [summaries, unread] = await Promise.all([
      this.messaging.summarise(ids),
      this.messaging.unreadCounts(ids, userId),
    ]);

    return rows.map((row) => {
      const summary = summaries.get(row.id);
      const scoped = this.presentThread(row);
      return {
        id: scoped.id,
        scope: scoped.scope,
        subjectId: scoped.subjectId,
        status: scoped.status,
        kind: row.kind,
        // The id as well as the name: a screen that can only NAME the property
        // cannot ask what is orderable there, which is why ordering from inside
        // a conversation had to be a link out to a screen that knew.
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        departmentName: row.departmentName,
        lastMessageAt: summary?.lastMessageAt?.toISOString() ?? null,
        // A preview is a message body leaving the API, so it redacts too.
        lastMessagePreview: scrubPhoneNumbers(summary?.lastMessagePreview ?? null),
        messageCount: summary?.messageCount ?? 0,
        unreadCount: unread.get(row.id) ?? 0,
      };
    });
  }

  /**
   * One page of a conversation the caller owns, newest first.
   *
   * Ownership first, always: the thread is proved before a message is read, so
   * the rows never reach memory on a thread that is not this person's.
   */
  async listGuestMessages(
    userId: string,
    threadId: string,
    page: { cursor?: string; limit?: number } = {},
  ): Promise<GuestMessagePage> {
    const thread = await this.assertMine(threadId, userId);

    const limit = Math.min(
      page.limit ?? GUEST_MESSAGE_PAGE,
      GUEST_MESSAGE_PAGE_MAX,
    );
    const rows = await this.messaging.messagePage(
      threadId,
      limit,
      decodeCursor(page.cursor),
    );

    // The repository asked for one more than we want: its presence is how we
    // know an older page exists, without a second count query.
    const hasOlder = rows.length > limit;
    const window = hasOlder ? rows.slice(0, limit) : rows;
    const last = window[window.length - 1];

    return {
      messages: window.map((row) => this.presentToGuest(row, userId, thread.departmentName)),
      nextCursor: hasOlder && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /** Send as the guest. The sender is the session, never a request field. */
  async sendGuestMessage(
    userId: string,
    threadId: string,
    body: SendGuestMessageInput,
  ): Promise<GuestMessage> {
    const thread = await this.assertMine(threadId, userId);
    assertWritable(thread.status);

    const messageId = await this.messaging.sendMessage(
      thread.id,
      userId,
      body.body,
    );
    const created = messageId ? await this.messaging.findMessage(messageId) : null;
    if (!created) {
      throw new BadRequestException('That message could not be sent. Try again.');
    }
    return this.presentMessage(created, userId);
  }

  /**
   * Mark the conversation read, at the server's clock.
   *
   * Idempotent: pressing it twice writes the same row twice with a later time,
   * which is exactly what opening a thread twice means.
   */
  async markGuestRead(userId: string, threadId: string): Promise<void> {
    await this.assertMine(threadId, userId);
    await this.messaging.markRead(threadId, userId, new Date());
  }

  /* ------------------------------------- the guest's side: the departments */

  /**
   * THE DESKS A GUEST MAY WRITE TO, for one stay of theirs (§6.8).
   *
   * The ownership of the stay is proved by the CALLER — the route resolves it
   * through `StayClaimService.mine`, which answers 404 for a stay that is not
   * this person's — and the row is passed in rather than re-read here. One
   * ownership check per request, at the top, is the arrangement every route on
   * this surface uses; a second check in here would be a second answer to the
   * same question and eventually a different one.
   *
   * A stay with no property resolves to no departments rather than to an error.
   * That happens on a stay whose room has been deleted, and a guest who cannot
   * work out who to message is better served by "no desks here" than by a 500.
   */
  async departmentsForStay(
    userId: string,
    stay: MyStayRow,
  ): Promise<StayDepartments> {
    if (!stay.propertyId) return { stayId: stay.id, departments: [] };

    const desks = await this.desksFor(userId, [
      { propertyId: stay.propertyId, on: { kind: 'stay', guestStayId: stay.id } },
    ]);
    return { stayId: stay.id, departments: desks.get(stay.id) ?? [] };
  }

  /**
   * EVERY DESK THIS PERSON MAY WRITE TO, anywhere (ADR-050 D-q).
   *
   * The answer `/inbox` opens with, and the reason it exists: the stay-scoped
   * route above can only be reached by a guest who HAS a stay, so a person who
   * had booked and not yet arrived saw no departments at all — the whole
   * capability was invisible until a receptionist checked them in, which is the
   * opposite of when a guest most wants to ask something.
   *
   * A place is a property plus the record that opens its desks: an open stay,
   * else a live booking. In house wins when a person is both — they are HERE,
   * and the conversation should hang off the stay the desk is working, not off
   * a booking for next month.
   *
   * A KNOWN SEAM, recorded rather than hidden: a conversation opened before
   * arrival hangs off the booking, and checking in does not move it. From that
   * moment the desk picker offers the STAY's conversation with that department,
   * and the pre-arrival one stays in the guest's inbox where they left it,
   * readable and writable by its id. Moving it would mean rewriting a thread's
   * subject, which `threads_scope_exactly_one` and both partial uniques are
   * built to make impossible; carrying it over is a decision for ADR-050, not
   * something to improvise here.
   *
   * Session scoped and parameterless. Every property in the answer was resolved
   * from the caller's own rows; there is no id to pass and so nothing to pass
   * somebody else's.
   */
  async myDepartments(userId: string): Promise<MyDepartments> {
    const today = localToday();
    const [stays, bookings] = await Promise.all([
      this.messaging.openStaysForGuest(userId),
      this.messaging.liveBookingsForGuest(userId, today),
    ]);

    const places: Array<GuestPlaceRow & { context: 'stay' | 'booking' }> = [
      ...stays.map((row) => ({ ...row, context: 'stay' as const })),
      ...bookings.map((row) => ({ ...row, context: 'booking' as const })),
    ];

    // One row per property. Stays are first in the list above, so a guest who
    // is in house at a property they also hold a future booking with is
    // answered with the stay — and a person holding two live bookings at one
    // property gets the soonest, which is the order the repository read them in.
    const byProperty = new Map<string, (typeof places)[number]>();
    for (const place of places) {
      if (!byProperty.has(place.propertyId)) byProperty.set(place.propertyId, place);
    }
    const chosen = [...byProperty.values()];

    const desks = await this.desksFor(
      userId,
      chosen.map((place) => ({
        propertyId: place.propertyId,
        on:
          place.context === 'stay'
            ? ({ kind: 'stay', guestStayId: place.subjectId } as const)
            : ({ kind: 'booking', bookingId: place.subjectId } as const),
      })),
    );

    return {
      places: chosen.map((place) => ({
        propertyId: place.propertyId,
        propertyName: place.propertyName,
        context: place.context,
        subjectId: place.subjectId,
        bookingReference: place.bookingReference,
        checkIn: place.checkIn,
        inHouse: place.context === 'stay',
        departments: desks.get(place.subjectId) ?? [],
      })),
    };
  }

  /**
   * The desks at each place, with the conversation that already exists there.
   *
   * ONE implementation for the stay route and the inbox route. They answer the
   * same question about the same table and a second copy would drift on the
   * detail that matters least and breaks most: whether an archived department
   * still counts, whether unread means what it means everywhere else.
   *
   * Two reads however many places a person has — the desks by property, the
   * conversations by subject — because the alternative is a query per place,
   * and a guest with four bookings is not a rare shape.
   */
  private async desksFor(
    userId: string,
    places: ReadonlyArray<{ propertyId: string; on: DeskSubject }>,
  ): Promise<Map<string, StayDepartment[]>> {
    const bySubject = new Map<string, StayDepartment[]>();
    if (places.length === 0) return bySubject;

    const [rows, threads] = await Promise.all([
      this.messaging.requestableDepartments([
        ...new Set(places.map((p) => p.propertyId)),
      ]),
      this.messaging.deskThreadsFor(places.map((p) => p.on)),
    ]);
    const unread = await this.messaging.unreadCounts(
      threads.map((t) => t.threadId),
      userId,
    );

    const threadFor = (
      on: DeskSubject,
      departmentId: string,
    ): DeskThreadRow | null =>
      threads.find(
        (t) =>
          t.departmentId === departmentId &&
          (on.kind === 'stay'
            ? t.guestStayId === on.guestStayId
            : t.bookingId === on.bookingId),
      ) ?? null;

    for (const place of places) {
      const subjectId =
        place.on.kind === 'stay' ? place.on.guestStayId : place.on.bookingId;
      bySubject.set(
        subjectId,
        rows
          .filter((row) => row.propertyId === place.propertyId)
          .map((row) => {
            const thread = threadFor(place.on, row.id);
            return {
              id: row.id,
              name: row.name,
              departmentCategory: row.departmentCategory as DepartmentCategory,
              phone: row.phone,
              threadId: thread?.threadId ?? null,
              unreadCount: thread ? (unread.get(thread.threadId) ?? 0) : 0,
              lastMessageAt: thread?.updatedAt.toISOString() ?? null,
            };
          }),
      );
    }
    return bySubject;
  }

  /**
   * Say something to one desk, opening the conversation if it is the first
   * time (§6.8).
   *
   * ## What is refused, and why each one
   *
   * - **A stay that has closed.** A guest who left yesterday messaging
   *   housekeeping is not a request anybody can act on; the record of the stay
   *   stays readable and a complaint about it goes through the refund request,
   *   which is built to be answered after the fact.
   * - **A department this property did not open to guests.** The
   *   `guest_requestable` flag is the property's control, and a body naming a
   *   department id is exactly the way round a list that simply did not show it.
   * - **A department belonging to another property.** Checked against the
   *   stay's own property, not against the workspace: a chain running two hotels
   *   holds one workspace, and "the caller's workspace owns this department"
   *   would let a guest in the Kigali hotel message the Musanze kitchen.
   */
  async openDepartmentRequest(
    userId: string,
    stay: MyStayRow,
    body: OpenDepartmentRequest,
  ): Promise<OpenDepartmentResult> {
    if (stay.lifecycle === 'closed') {
      throw new ConflictException(
        'This stay has ended, so its desks are closed. If something went wrong, ask for a refund and the property will answer in writing.',
      );
    }
    if (!stay.propertyId) {
      throw new NotFoundException('That desk is not at this property.');
    }

    const department = await this.messaging.findGuestRequestableDepartment(
      body.departmentId,
    );
    // Matched against the STAY's property, not against the workspace: a chain
    // running two hotels holds one workspace, and "the caller's workspace owns
    // this department" would let a guest in the Kigali hotel message the
    // Musanze kitchen. Same 404 either way — a department that does not take
    // guest messages is not a department this guest has, and saying "exists but
    // refuses you" maps the property's internal structure for anybody who asks.
    if (!department || department.propertyId !== stay.propertyId) {
      throw new NotFoundException('That desk is not taking messages here.');
    }

    return this.writeToDesk(userId, department, body, {
      workspaceId: stay.workspaceId,
      on: { kind: 'stay', guestStayId: stay.id },
    });
  }

  /**
   * SAY SOMETHING TO ONE DESK, named by the department alone (ADR-050 D-q).
   *
   * `POST /api/v1/me/threads`. The route the stay-scoped one above could not
   * be: a guest who has booked and not yet arrived holds no stay, so every path
   * into a department was closed to them and the property's desks did not exist
   * as far as their account was concerned.
   *
   * ## The server resolves which record this hangs off, not the client
   *
   * In house first, then a live booking at the same property. The guest tapped
   * "Housekeeping" and has no idea their conversation is filed against a stay
   * or against a booking; a request that named one would be a request that
   * could name somebody else's.
   *
   * ## What is refused, and why each one
   *
   * - **A department that does not take guest messages, or does not exist:**
   *   404, never 403. "Exists but refuses you" maps the property's internal
   *   structure for anybody who asks, which is the reasoning the stay route
   *   already records.
   * - **A caller with neither a stay nor a live booking there:** 403. They are
   *   not being told the department is unreal — it plainly is, they were given
   *   its id — only that it is not theirs to write to. The refusal names what
   *   would fix it, because for most people reading it the answer is "book".
   */
  async openThreadWithDepartment(
    userId: string,
    body: OpenThreadRequest,
  ): Promise<OpenDepartmentResult> {
    const department = await this.messaging.findGuestRequestableDepartment(
      body.departmentId,
    );
    if (!department?.propertyId) {
      throw new NotFoundException('That desk is not taking messages here.');
    }

    // In house wins: a guest who is HERE is talking to the desk about the stay
    // being worked, not about a booking for next month.
    const stay = (await this.messaging.openStaysForGuest(userId)).find(
      (row) => row.propertyId === department.propertyId,
    );
    if (stay) {
      return this.writeToDesk(userId, department, body, {
        workspaceId: stay.workspaceId,
        on: { kind: 'stay', guestStayId: stay.subjectId },
      });
    }

    const booking = (
      await this.messaging.liveBookingsForGuest(userId, localToday())
    ).find((row) => row.propertyId === department.propertyId);
    if (!booking) {
      throw new ForbiddenException(
        "You can message this property's desks while you have a booking with " +
          'them or are staying there. If your stay has ended and something went ' +
          'wrong, ask for a refund and they will answer in writing.',
      );
    }
    return this.writeToDesk(userId, department, body, {
      workspaceId: booking.workspaceId,
      on: { kind: 'booking', bookingId: booking.subjectId },
    });
  }

  /**
   * The write itself, once, for both routes.
   *
   * Everything above this line decides WHICH record the conversation hangs off;
   * this is what happens next, and it is identical either way — including the
   * one answer that is easy to get wrong in a second copy: a conversation the
   * property archived is not reopened by a guest writing into it.
   */
  private async writeToDesk(
    userId: string,
    department: { id: string; name: string },
    body: OpenDepartmentRequest | OpenThreadRequest,
    at: { workspaceId: string; on: DeskSubject },
  ): Promise<OpenDepartmentResult> {
    const opened = await this.messaging.openDepartmentThread({
      workspaceId: at.workspaceId,
      on: at.on,
      departmentId: department.id,
      subject: body.subject ?? null,
      body: body.body,
      senderUserId: userId,
    });
    if (!opened) {
      throw new ConflictException(
        'That conversation is closed. Ask the front desk to reopen it.',
      );
    }

    return {
      threadId: opened.threadId,
      departmentId: department.id,
      departmentName: department.name,
      created: opened.created,
    };
  }

  /**
   * The guest's whole authorization, in one place.
   *
   * **404 and never 403.** A 403 would confirm that the id names a real thread,
   * which is a fact worth nothing to its owner and worth something to somebody
   * enumerating ids. "Not found" is also true from the caller's side: a thread
   * that is not theirs is not among the threads they have.
   */
  private async assertMine(
    threadId: string,
    userId: string,
  ): Promise<GuestThreadRow> {
    const thread = await this.messaging.findThreadForGuest(threadId, userId);
    if (!thread) {
      throw new NotFoundException('That conversation is not on your account.');
    }
    return thread;
  }

  /**
   * The conversation an order is being placed from (ADR-050 D-s): the caller's
   * own, still active, and at the property the order is for. 404 for a thread
   * that is not theirs, as everywhere on this side.
   */
  async assertOrderableThread(
    userId: string,
    threadId: string,
    propertyId: string,
  ): Promise<void> {
    const thread = await this.assertMine(threadId, userId);
    assertWritable(thread.status);
    if (thread.propertyId !== propertyId) {
      throw new BadRequestException(
        'That conversation is with a different property from this menu.',
      );
    }
  }

  /**
   * A message as a GUEST reads it. In a department conversation a staff reply
   * is signed with the DEPARTMENT's name and never the staffer's (ADR-050 D-r):
   * the guest is talking to Housekeeping, whoever is on shift, and a handover
   * should not read as a stranger taking over.
   */
  private presentToGuest(
    row: MessageRow,
    viewerUserId: string,
    departmentName: string | null,
  ): GuestMessage {
    const message = this.presentMessage(row, viewerUserId);
    if (departmentName && message.senderUserId !== null && !message.fromUs) {
      return { ...message, senderName: departmentName };
    }
    return message;
  }

  private presentThread(
    row: Omit<ThreadRow, 'branchPropertyId'>,
  ): Omit<
    OperatorThread,
    | 'counterpartName'
    | 'departmentName'
    | 'lastMessageAt'
    | 'lastMessagePreview'
    | 'messageCount'
  > {
    // `threads_scope_exactly_one` makes exactly one of the three non null, so
    // this cannot fall through — but it is written to throw rather than to
    // guess, because a thread about nothing is a bug worth seeing.
    if (row.bookingId) {
      return { id: row.id, scope: 'booking', subjectId: row.bookingId, status: row.status };
    }
    if (row.guestStayId) {
      return { id: row.id, scope: 'stay', subjectId: row.guestStayId, status: row.status };
    }
    if (row.leaseId) {
      return { id: row.id, scope: 'lease', subjectId: row.leaseId, status: row.status };
    }
    throw new BadRequestException(
      'A conversation on this desk is not attached to anything. Report this.',
    );
  }

  /**
   * `fromUs` is what lets a screen side the bubble.
   *
   * Worked out from the SENDER against the person READING, not from the thread:
   * an operator and a guest both write into the same thread, so the thread
   * cannot say who spoke. `WorkspaceAccess` carries no user id, so the viewer
   * is passed in rather than dug out of it. A message with no sender (a system
   * note) is nobody's.
   */
  private presentMessage(row: MessageRow, viewerUserId: string): OperatorMessage {
    return {
      id: row.id,
      threadId: row.threadId,
      senderUserId: row.senderUserId,
      senderName: row.senderName,
      fromUs: row.senderUserId !== null && row.senderUserId === viewerUserId,
      bodyType: row.bodyType,
      // Redaction is on read, never on write: the stored row is verbatim.
      body: scrubPhoneNumbers(row.body),
      serviceOrderId: row.serviceOrderId,
      voiceDurationS: row.voiceDurationS,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * A message as the DESK reads it (demo-comms, 2026-09-14).
   *
   * The desk is a team, so "ours" is every line not written by the person on
   * the other side of the thread. Sided from the reader instead, Denise's reply
   * sat on the guest's side of Solange's screen, as if the guest had written it.
   *
   * When the counterpart has no account (a walk-in, a tenant typed in by name)
   * nobody in the thread can be them, so the reader rule is the fallback rather
   * than calling every line the property's.
   */
  private presentDeskMessage(
    row: MessageRow,
    counterpartUserId: string | null,
    viewerUserId: string,
  ): OperatorMessage {
    const presented = this.presentMessage(row, viewerUserId);
    if (counterpartUserId === null || row.senderUserId === null) return presented;
    return { ...presented, fromUs: row.senderUserId !== counterpartUserId };
  }
}
