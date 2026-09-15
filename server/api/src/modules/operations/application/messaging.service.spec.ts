import { ConflictException, NotFoundException } from '@nestjs/common';

import {
  type GuestThreadRow,
  type MessageRow,
  MessagingRepository,
} from '../infrastructure/messaging.repository';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { MessagingService } from './messaging.service';

/**
 * Unit scope: the GUEST half of messaging (ADR-032).
 *
 * The SQL that proves ownership is the repository's and needs a DB-backed test
 * (no test-DB harness yet). What is proved here is everything the service
 * decides on top of it, and the first of them is the one that matters most: a
 * thread that is not yours is 404, never 403, so a probe cannot learn that an id
 * exists.
 *
 * The operator half is already covered where it is used; these tests are added
 * for the surface that had none.
 */
describe('MessagingService (guest)', () => {
  const GUEST = '22222222-2222-2222-2222-222222222222';
  const THREAD = '33333333-3333-3333-3333-333333333333';
  const OPERATOR = '44444444-4444-4444-4444-444444444444';

  const thread = (over: Partial<GuestThreadRow> = {}): GuestThreadRow => ({
    id: THREAD,
    workspaceId: '55555555-5555-5555-5555-555555555555',
    bookingId: '66666666-6666-6666-6666-666666666666',
    guestStayId: null,
    leaseId: null,
    status: 'active',
    kind: 'reservation',
    propertyName: 'Amahoro Boutique Hotel',
    departmentName: null,
    updatedAt: new Date('2026-09-12T08:00:00.000Z'),
    ...over,
  });

  const message = (over: Partial<MessageRow> = {}): MessageRow => ({
    id: '77777777-7777-7777-7777-777777777777',
    threadId: THREAD,
    senderUserId: OPERATOR,
    senderName: 'Front desk',
    bodyType: 'text',
    body: 'Your room is ready.',
    voiceDurationS: null,
    createdAt: new Date('2026-09-12T09:00:00.000Z'),
    ...over,
  });

  interface Harness {
    service: MessagingService;
    repo: {
      listThreadsForGuest: jest.Mock;
      findThreadForGuest: jest.Mock;
      summarise: jest.Mock;
      unreadCounts: jest.Mock;
      messagePage: jest.Mock;
      sendMessage: jest.Mock;
      findMessage: jest.Mock;
      markRead: jest.Mock;
    };
  }

  function harness(over: Partial<Harness['repo']> = {}): Harness {
    const repo = {
      listThreadsForGuest: jest.fn().mockResolvedValue([thread()]),
      findThreadForGuest: jest.fn().mockResolvedValue(thread()),
      summarise: jest.fn().mockResolvedValue(new Map()),
      unreadCounts: jest.fn().mockResolvedValue(new Map()),
      messagePage: jest.fn().mockResolvedValue([]),
      sendMessage: jest.fn().mockResolvedValue(message().id),
      findMessage: jest.fn().mockResolvedValue(message()),
      markRead: jest.fn().mockResolvedValue(undefined),
      ...over,
    };
    return {
      service: new MessagingService(repo as unknown as MessagingRepository),
      repo,
    };
  }

  describe('ownership', () => {
    /** The security property of the whole surface. */
    it("answers 404, not 403, for a thread that is not the caller's", async () => {
      const { service } = harness({
        findThreadForGuest: jest.fn().mockResolvedValue(null),
      });

      await expect(service.listGuestMessages(GUEST, THREAD)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        service.sendGuestMessage(GUEST, THREAD, { body: 'hello' }),
      ).rejects.toThrow(NotFoundException);
      await expect(service.markGuestRead(GUEST, THREAD)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('proves the thread BEFORE reading a single message', async () => {
      const messagePage = jest.fn().mockResolvedValue([]);
      const { service } = harness({
        findThreadForGuest: jest.fn().mockResolvedValue(null),
        messagePage,
      });

      await expect(service.listGuestMessages(GUEST, THREAD)).rejects.toThrow(
        NotFoundException,
      );
      // Reading first and filtering after would have the rows in memory already,
      // which is the same leak one refactor later.
      expect(messagePage).not.toHaveBeenCalled();
    });

    it('asks the repository for the SESSION user, never a supplied id', async () => {
      const { service, repo } = harness();
      await service.listGuestThreads(GUEST);
      expect(repo.listThreadsForGuest).toHaveBeenCalledWith(GUEST);
    });
  });

  describe('listGuestThreads', () => {
    it('carries the property and the department the conversation is with', async () => {
      const { service } = harness({
        listThreadsForGuest: jest
          .fn()
          .mockResolvedValue([
            thread({ kind: 'department_request', departmentName: 'Housekeeping' }),
          ]),
        unreadCounts: jest.fn().mockResolvedValue(new Map([[THREAD, 3]])),
      });

      const threads = await service.listGuestThreads(GUEST);

      expect(threads[0]).toMatchObject({
        scope: 'booking',
        kind: 'department_request',
        propertyName: 'Amahoro Boutique Hotel',
        departmentName: 'Housekeeping',
        unreadCount: 3,
      });
    });

    it('redacts a phone number in the preview, not only in the thread', async () => {
      // A number in the last line would otherwise show verbatim on the row —
      // F-S06 says a phone number is never exposed, and a preview is a body.
      const { service } = harness({
        summarise: jest.fn().mockResolvedValue(
          new Map([
            [
              THREAD,
              {
                threadId: THREAD,
                lastMessageAt: new Date('2026-09-12T09:00:00.000Z'),
                lastMessagePreview: 'Call me on 0788 123 456',
                messageCount: 4,
              },
            ],
          ]),
        ),
      });

      const [row] = await service.listGuestThreads(GUEST);

      expect(row?.lastMessagePreview).not.toContain('788');
      expect(row?.messageCount).toBe(4);
    });

    it('reports no unread for a thread nobody has written in', async () => {
      const { service } = harness();
      const [row] = await service.listGuestThreads(GUEST);
      expect(row?.unreadCount).toBe(0);
    });
  });

  describe('listGuestMessages', () => {
    it('sides the bubble from the sender against the reader', async () => {
      const { service } = harness({
        messagePage: jest
          .fn()
          .mockResolvedValue([
            message({ id: 'a', senderUserId: OPERATOR }),
            message({ id: 'b', senderUserId: GUEST }),
          ]),
      });

      const { messages } = await service.listGuestMessages(GUEST, THREAD);

      expect(messages.map((m) => m.fromUs)).toEqual([false, true]);
    });

    it('redacts every body on the way out, leaving the stored row alone', async () => {
      const { service } = harness({
        messagePage: jest
          .fn()
          .mockResolvedValue([message({ body: 'ring +250 788 123 456' })]),
      });

      const { messages } = await service.listGuestMessages(GUEST, THREAD);

      expect(messages[0]?.body).not.toContain('788');
    });

    /** The page boundary a keyset cursor exists to get right. */
    it('returns a cursor only when an older page exists', async () => {
      const page = Array.from({ length: 31 }, (_, i) =>
        message({ id: `m${i}`, createdAt: new Date(2026, 8, 12, 9, 0, 31 - i) }),
      );
      const { service } = harness({ messagePage: jest.fn().mockResolvedValue(page) });

      const first = await service.listGuestMessages(GUEST, THREAD);

      // Asked for 30; the repository returned 31, which is how we know.
      expect(first.messages).toHaveLength(30);
      expect(first.nextCursor).not.toBeNull();

      const { service: short } = harness({
        messagePage: jest.fn().mockResolvedValue(page.slice(0, 5)),
      });
      const last = await short.listGuestMessages(GUEST, THREAD);
      expect(last.nextCursor).toBeNull();
    });

    it('round-trips its own cursor, and ignores one it did not mint', async () => {
      const messagePage = jest
        .fn()
        .mockResolvedValue(
          Array.from({ length: 31 }, (_, i) =>
            message({ id: `m${i}`, createdAt: new Date(2026, 8, 12, 9, 0, 31 - i) }),
          ),
        );
      const { service } = harness({ messagePage });

      const { nextCursor } = await service.listGuestMessages(GUEST, THREAD);
      await service.listGuestMessages(GUEST, THREAD, { cursor: nextCursor ?? '' });

      expect(messagePage.mock.calls[1]?.[2]).toMatchObject({ id: 'm29' });

      // A malformed cursor is treated as none: the reader gets the newest page
      // rather than a 400 about a token they never typed.
      await service.listGuestMessages(GUEST, THREAD, { cursor: 'not-a-cursor' });
      expect(messagePage.mock.calls[2]?.[2]).toBeUndefined();
    });

    it('never serves more than the ceiling, whatever is asked for', async () => {
      const messagePage = jest.fn().mockResolvedValue([]);
      const { service } = harness({ messagePage });

      await service.listGuestMessages(GUEST, THREAD, { limit: 5000 });

      expect(messagePage).toHaveBeenCalledWith(THREAD, 100, undefined);
    });
  });

  describe('sendGuestMessage', () => {
    it('refuses an archived thread with 409, not 403', async () => {
      // The caller may well be allowed to write here; the conversation is closed.
      const { service } = harness({
        findThreadForGuest: jest.fn().mockResolvedValue(thread({ status: 'archived' })),
      });

      await expect(
        service.sendGuestMessage(GUEST, THREAD, { body: 'hello' }),
      ).rejects.toThrow(ConflictException);
    });

    it('sends as the session user and returns it sided as ours', async () => {
      const { service, repo } = harness({
        findMessage: jest.fn().mockResolvedValue(message({ senderUserId: GUEST })),
      });

      const sent = await service.sendGuestMessage(GUEST, THREAD, { body: 'hello' });

      expect(repo.sendMessage).toHaveBeenCalledWith(THREAD, GUEST, 'hello');
      expect(sent.fromUs).toBe(true);
    });
  });

  describe('markGuestRead', () => {
    it('records the SERVER clock, not a client time', async () => {
      const { service, repo } = harness();
      const before = Date.now();

      await service.markGuestRead(GUEST, THREAD);

      const [threadId, userId, at] = repo.markRead.mock.calls[0] as [
        string,
        string,
        Date,
      ];
      expect(threadId).toBe(THREAD);
      expect(userId).toBe(GUEST);
      expect(at.getTime()).toBeGreaterThanOrEqual(before);
    });
  });
});

/**
 * The DESK's siding (demo-comms, 2026-09-14).
 *
 * The desk is a team: a line a colleague wrote is the property's, not the
 * guest's. Sided from the reader, Denise's seeded reply sat on the guest's side
 * of Solange's screen.
 */
describe('MessagingService (desk)', () => {
  const WORKSPACE = '55555555-5555-5555-5555-555555555555';
  const THREAD = '33333333-3333-3333-3333-333333333333';
  const GUEST = '22222222-2222-2222-2222-222222222222';
  const MANAGER = '44444444-4444-4444-4444-444444444444';
  const RECEPTIONIST = '88888888-8888-8888-8888-888888888888';
  const BRANCH = '77777777-7777-4777-8777-777777777777';
  const ws = {
    workspaceId: WORKSPACE,
    branchScope: {
      coverage: 'all',
      selectedPropertyId: null,
      propertyIds: [BRANCH],
      includesUnbranched: true,
    },
  } as unknown as ScopedWorkspace;

  const line = (id: string, senderUserId: string | null): MessageRow => ({
    id,
    threadId: THREAD,
    senderUserId,
    senderName: null,
    bodyType: 'text',
    body: 'hello',
    voiceDurationS: null,
    createdAt: new Date('2026-09-14T08:00:00.000Z'),
  });

  function desk(
    counterpart: string | null,
    rows: MessageRow[],
  ): { service: MessagingService; repo: Record<string, jest.Mock> } {
    const repo = {
      findThread: jest.fn().mockResolvedValue({
        id: THREAD,
        workspaceId: WORKSPACE,
        bookingId: '66666666-6666-6666-6666-666666666666',
        guestStayId: null,
        leaseId: null,
        branchPropertyId: BRANCH,
        status: 'active',
      }),
      listMessages: jest.fn().mockResolvedValue(rows),
      counterpartUserId: jest.fn().mockResolvedValue(counterpart),
      sendMessage: jest.fn().mockResolvedValue(rows[0]?.id),
      findMessage: jest.fn().mockResolvedValue(rows[0]),
    };
    return { service: new MessagingService(repo as unknown as MessagingRepository), repo };
  }

  it("sides a colleague's reply as the property's, and the guest's line as theirs", async () => {
    const { service } = desk(GUEST, [
      line('a', GUEST),
      line('b', RECEPTIONIST),
      line('c', MANAGER),
    ]);

    const messages = await service.listMessages(ws, THREAD, MANAGER);

    expect(messages.map((m) => m.fromUs)).toEqual([false, true, true]);
  });

  it('keeps a system note (no sender) nobody’s', async () => {
    const { service } = desk(GUEST, [line('a', null)]);

    const [note] = await service.listMessages(ws, THREAD, MANAGER);

    expect(note?.fromUs).toBe(false);
  });

  it('falls back to the reader when the other side has no account', async () => {
    const { service } = desk(null, [line('a', RECEPTIONIST), line('b', MANAGER)]);

    const messages = await service.listMessages(ws, THREAD, MANAGER);

    expect(messages.map((m) => m.fromUs)).toEqual([false, true]);
  });

  it('returns a sent line sided as ours', async () => {
    const { service } = desk(GUEST, [line('a', RECEPTIONIST)]);

    const sent = await service.sendMessage(ws, THREAD, { body: 'On its way' }, RECEPTIONIST);

    expect(sent.fromUs).toBe(true);
  });

  it('proves the thread belongs to the workspace before reading a line', async () => {
    const { service, repo } = desk(GUEST, [line('a', GUEST)]);
    repo.findThread.mockResolvedValue({ id: THREAD, workspaceId: 'someone-else', bookingId: 'x', guestStayId: null, leaseId: null, status: 'active' });

    await expect(service.listMessages(ws, THREAD, MANAGER)).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.listMessages).not.toHaveBeenCalled();
  });
});
