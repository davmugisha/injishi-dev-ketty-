import type {
  DepartmentCategory,
  GuestMessage,
  GuestMessagePage,
  GuestThread,
  OperatorMessage,
  OpenDepartmentRequest,
  OpenDepartmentResult,
  OperatorThread,
  SendGuestMessageInput,
  SendMessageRequest,
  StayDepartment,
  StayDepartments,
  WorkspaceAccess,
} from '@injishi/contracts';
import { GUEST_MESSAGE_PAGE, GUEST_MESSAGE_PAGE_MAX } from '@injishi/contracts';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { assertOwned } from '../../../shared/auth/assert-owned';
import { scrubPhoneNumbers } from './scrub';
import {
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

  async listThreads(ws: WorkspaceAccess): Promise<OperatorThread[]> {
    const rows = await this.messaging.listThreads(ws.workspaceId);
    const summaries = await this.messaging.summarise(rows.map((r) => r.id));
    const counterparts = await this.messaging.counterparts(rows);

    return rows.map((row) => {
      const summary = summaries.get(row.id);
      return {
        ...this.presentThread(row),
        counterpartName: counterparts.get(row.id) ?? null,
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
    ws: WorkspaceAccess,
    threadId: string,
    viewerUserId: string,
  ): Promise<OperatorMessage[]> {
    const thread = assertOwned(await this.messaging.findThread(threadId), ws);
    const rows = await this.messaging.listMessages(thread.id);
    return rows.map((row) => this.presentMessage(row, viewerUserId));
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
    ws: WorkspaceAccess,
    threadId: string,
    body: SendMessageRequest,
    senderUserId: string,
  ): Promise<OperatorMessage> {
    const thread = assertOwned(await this.messaging.findThread(threadId), ws);
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
    return this.presentMessage(created, senderUserId);
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
    await this.assertMine(threadId, userId);

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
      messages: window.map((row) => this.presentMessage(row, userId)),
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

    const rows = await this.messaging.requestableDepartments(
      stay.propertyId,
      stay.id,
    );
    const threadIds = rows
      .map((r) => r.threadId)
      .filter((id): id is string => id !== null);
    const unread = await this.messaging.unreadCounts(threadIds, userId);

    const departments: StayDepartment[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      departmentCategory: row.departmentCategory as DepartmentCategory,
      phone: row.phone,
      threadId: row.threadId,
      unreadCount: row.threadId ? (unread.get(row.threadId) ?? 0) : 0,
      lastMessageAt: row.threadId
        ? (row.lastMessageAt?.toISOString() ?? null)
        : null,
    }));
    return { stayId: stay.id, departments };
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

    const department = await this.messaging.findRequestableDepartment(
      body.departmentId,
      stay.propertyId,
    );
    if (!department) {
      // 404 rather than 403: a department that does not take guest messages is
      // not a department this guest has, and saying "exists but refuses you"
      // maps the property's internal structure for anybody who asks.
      throw new NotFoundException('That desk is not taking messages here.');
    }

    const opened = await this.messaging.openDepartmentThread({
      workspaceId: stay.workspaceId,
      guestStayId: stay.id,
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

  private presentThread(
    row: ThreadRow,
  ): Omit<
    OperatorThread,
    'counterpartName' | 'lastMessageAt' | 'lastMessagePreview' | 'messageCount'
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
      voiceDurationS: row.voiceDurationS,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
