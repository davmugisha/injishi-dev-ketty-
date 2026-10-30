import { describe, expect, it, type Mock, vi } from 'vitest';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { orderLineText } from '../../outlets/infrastructure/order-thread-lines';

import {
  type GuestPlaceRow,
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
    propertyId: '88888888-8888-4888-8888-888888888888',
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
    serviceOrderId: null,
    voiceDurationS: null,
    createdAt: new Date('2026-09-12T09:00:00.000Z'),
    ...over,
  });

  interface Harness {
    service: MessagingService;
    repo: {
      listThreadsForGuest: Mock;
      findThreadForGuest: Mock;
      summarise: Mock;
      unreadCounts: Mock;
      messagePage: Mock;
      sendMessage: Mock;
      findMessage: Mock;
      markRead: Mock;
      openStaysForGuest: Mock;
      liveBookingsForGuest: Mock;
      requestableDepartments: Mock;
      deskThreadsFor: Mock;
      findGuestRequestableDepartment: Mock;
      openDepartmentThread: Mock;
    };
  }

  function harness(over: Partial<Harness['repo']> = {}): Harness {
    const repo = {
      listThreadsForGuest: vi.fn().mockResolvedValue([thread()]),
      findThreadForGuest: vi.fn().mockResolvedValue(thread()),
      summarise: vi.fn().mockResolvedValue(new Map()),
      unreadCounts: vi.fn().mockResolvedValue(new Map()),
      messagePage: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(message().id),
      findMessage: vi.fn().mockResolvedValue(message()),
      markRead: vi.fn().mockResolvedValue(undefined),
      openStaysForGuest: vi.fn().mockResolvedValue([]),
      liveBookingsForGuest: vi.fn().mockResolvedValue([]),
      requestableDepartments: vi.fn().mockResolvedValue([]),
      deskThreadsFor: vi.fn().mockResolvedValue([]),
      findGuestRequestableDepartment: vi.fn().mockResolvedValue(null),
      openDepartmentThread: vi
        .fn()
        .mockResolvedValue({ threadId: THREAD, created: true }),
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
        findThreadForGuest: vi.fn().mockResolvedValue(null),
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
      const messagePage = vi.fn().mockResolvedValue([]);
      const { service } = harness({
        findThreadForGuest: vi.fn().mockResolvedValue(null),
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
        listThreadsForGuest: vi
          .fn()
          .mockResolvedValue([
            thread({ kind: 'department_request', departmentName: 'Housekeeping' }),
          ]),
        unreadCounts: vi.fn().mockResolvedValue(new Map([[THREAD, 3]])),
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
        summarise: vi.fn().mockResolvedValue(
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
        messagePage: vi
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
        messagePage: vi
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
      const { service } = harness({ messagePage: vi.fn().mockResolvedValue(page) });

      const first = await service.listGuestMessages(GUEST, THREAD);

      // Asked for 30; the repository returned 31, which is how we know.
      expect(first.messages).toHaveLength(30);
      expect(first.nextCursor).not.toBeNull();

      const { service: short } = harness({
        messagePage: vi.fn().mockResolvedValue(page.slice(0, 5)),
      });
      const last = await short.listGuestMessages(GUEST, THREAD);
      expect(last.nextCursor).toBeNull();
    });

    it('round-trips its own cursor, and ignores one it did not mint', async () => {
      const messagePage = vi
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
      const messagePage = vi.fn().mockResolvedValue([]);
      const { service } = harness({ messagePage });

      await service.listGuestMessages(GUEST, THREAD, { limit: 5000 });

      expect(messagePage).toHaveBeenCalledWith(THREAD, 100, undefined);
    });
  });

  describe('sendGuestMessage', () => {
    it('refuses an archived thread with 409, not 403', async () => {
      // The caller may well be allowed to write here; the conversation is closed.
      const { service } = harness({
        findThreadForGuest: vi.fn().mockResolvedValue(thread({ status: 'archived' })),
      });

      await expect(
        service.sendGuestMessage(GUEST, THREAD, { body: 'hello' }),
      ).rejects.toThrow(ConflictException);
    });

    it('sends as the session user and returns it sided as ours', async () => {
      const { service, repo } = harness({
        findMessage: vi.fn().mockResolvedValue(message({ senderUserId: GUEST })),
      });

      const sent = await service.sendGuestMessage(GUEST, THREAD, { body: 'hello' });

      expect(repo.sendMessage).toHaveBeenCalledWith(THREAD, GUEST, 'hello');
      expect(sent.fromUs).toBe(true);
    });
  });

  describe('department conversations and orders (ADR-050 D-r, D-s)', () => {
    const PROPERTY = '88888888-8888-4888-8888-888888888888';

    it('signs a staff reply with the department, never the staffer', async () => {
      const { service } = harness({
        findThreadForGuest: vi
          .fn()
          .mockResolvedValue(thread({ kind: 'department_request', departmentName: 'Housekeeping' })),
        messagePage: vi.fn().mockResolvedValue([
          message({ id: 'a', senderUserId: OPERATOR, senderName: 'Solange Uwera' }),
          message({ id: 'b', senderUserId: GUEST, senderName: 'Samuel' }),
          message({ id: 'c', senderUserId: null, senderName: null, bodyType: 'system', body: 'Order A1 is ready.', serviceOrderId: '99999999-9999-4999-8999-999999999999' }),
        ]),
      });
      const { messages } = await service.listGuestMessages(GUEST, THREAD);
      expect(messages.map((m) => m.senderName)).toEqual(['Housekeeping', 'Samuel', null]);
      expect(messages[2]).toMatchObject({ bodyType: 'system', serviceOrderId: '99999999-9999-4999-8999-999999999999', fromUs: false });
    });

    it('keeps the staffer name on a reservation thread with no department', async () => {
      const { service } = harness({
        messagePage: vi.fn().mockResolvedValue([message({ senderName: 'Solange Uwera' })]),
      });
      const { messages } = await service.listGuestMessages(GUEST, THREAD);
      expect(messages[0]?.senderName).toBe('Solange Uwera');
    });

    it('lets an order be placed from the guest\'s own active thread at that property', async () => {
      const { service } = harness();
      await expect(service.assertOrderableThread(GUEST, THREAD, PROPERTY)).resolves.toBeUndefined();
    });

    it('refuses a thread at another property, a closed one, and a stranger\'s', async () => {
      await expect(
        harness().service.assertOrderableThread(GUEST, THREAD, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        harness({ findThreadForGuest: vi.fn().mockResolvedValue(thread({ status: 'archived' })) }).service.assertOrderableThread(GUEST, THREAD, PROPERTY),
      ).rejects.toThrow(ConflictException);
      await expect(
        harness({ findThreadForGuest: vi.fn().mockResolvedValue(null) }).service.assertOrderableThread(GUEST, THREAD, PROPERTY),
      ).rejects.toThrow(NotFoundException);
    });

    it('writes order lines that keep the order number as written', () => {
      const order = { orderNumber: 'A12B', placeName: 'In-Room Dining', departmentName: 'Food and Beverage' };
      expect(orderLineText('submitted', order)).toBe('Order A12B was sent to In-Room Dining.');
      expect(orderLineText('acknowledged', order)).toBe('Food and Beverage has your order A12B and is on it.');
      expect(orderLineText('cancelled', order)).toBe('Order A12B was cancelled.');
    });
  });

  /**
   * The post-booking half (ADR-050 D-q): a guest who has not arrived yet.
   *
   * The SQL that finds a live booking is the repository's; what is proved here
   * is everything the service decides on top of it, and the two that matter are
   * the resolution order (in house beats a booking) and the two refusals, which
   * are deliberately different answers — 404 for a desk that takes no guest
   * messages, 403 for a desk that is simply not this person's.
   */
  describe('opening a conversation by department (ADR-050 D-q)', () => {
    const PROPERTY = '88888888-8888-4888-8888-888888888888';
    const OTHER_PROPERTY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const DEPARTMENT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const STAY = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const BOOKING = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

    const desk = {
      id: DEPARTMENT,
      name: 'Housekeeping',
      propertyId: PROPERTY,
      workspaceId: '55555555-5555-5555-5555-555555555555',
    };
    const place = (over: Record<string, unknown> = {}): GuestPlaceRow => ({
      propertyId: PROPERTY,
      propertyName: 'Amahoro Boutique Hotel',
      workspaceId: '55555555-5555-5555-5555-555555555555',
      subjectId: BOOKING,
      bookingReference: 'BK-DEMO-001',
      checkIn: '2026-09-18',
      ...over,
    });
    const ask = { departmentId: DEPARTMENT, body: 'Could you hold a cot?' };

    function opening(over: Partial<Harness['repo']> = {}): Harness {
      return harness({
        findGuestRequestableDepartment: vi.fn().mockResolvedValue(desk),
        ...over,
      });
    }

    it('hangs the conversation off a live booking when the guest is not in house', async () => {
      const { service, repo } = opening({
        liveBookingsForGuest: vi.fn().mockResolvedValue([place()]),
      });

      const opened = await service.openThreadWithDepartment(GUEST, ask);

      expect(opened).toMatchObject({ departmentId: DEPARTMENT, departmentName: 'Housekeeping' });
      expect(repo.openDepartmentThread).toHaveBeenCalledWith(
        expect.objectContaining({ on: { kind: 'booking', bookingId: BOOKING } }),
      );
    });

    it('prefers the stay when the guest is in house at that property', async () => {
      // They are HERE. The desk is working the stay, not a booking for next month.
      const { service, repo } = opening({
        openStaysForGuest: vi
          .fn()
          .mockResolvedValue([place({ subjectId: STAY, bookingReference: null })]),
        liveBookingsForGuest: vi.fn().mockResolvedValue([place()]),
      });

      await service.openThreadWithDepartment(GUEST, ask);

      expect(repo.openDepartmentThread).toHaveBeenCalledWith(
        expect.objectContaining({ on: { kind: 'stay', guestStayId: STAY } }),
      );
    });

    it('answers 404 for a desk that takes no guest messages, and never 403', async () => {
      // "Exists but refuses you" maps the property's internal structure for
      // anybody who asks.
      const { service, repo } = harness({
        findGuestRequestableDepartment: vi.fn().mockResolvedValue(null),
      });

      await expect(service.openThreadWithDepartment(GUEST, ask)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.openDepartmentThread).not.toHaveBeenCalled();
    });

    it('answers 403 when the caller holds nothing at that property', async () => {
      const { service, repo } = opening({
        openStaysForGuest: vi.fn().mockResolvedValue([place({ propertyId: OTHER_PROPERTY })]),
        liveBookingsForGuest: vi.fn().mockResolvedValue([place({ propertyId: OTHER_PROPERTY })]),
      });

      await expect(service.openThreadWithDepartment(GUEST, ask)).rejects.toThrow(
        ForbiddenException,
      );
      expect(repo.openDepartmentThread).not.toHaveBeenCalled();
    });

    it('refuses to write into a conversation the property archived', async () => {
      const { service } = opening({
        liveBookingsForGuest: vi.fn().mockResolvedValue([place()]),
        openDepartmentThread: vi.fn().mockResolvedValue(null),
      });

      await expect(service.openThreadWithDepartment(GUEST, ask)).rejects.toThrow(
        ConflictException,
      );
    });

    it('lists one place per property, in house first, with its desks', async () => {
      const { service } = opening({
        openStaysForGuest: vi.fn().mockResolvedValue([place({ subjectId: STAY })]),
        // The same property again as a booking, plus one the guest only booked.
        liveBookingsForGuest: vi
          .fn()
          .mockResolvedValue([place(), place({ propertyId: OTHER_PROPERTY, subjectId: 'ffffffff-ffff-4fff-8fff-ffffffffffff' })]),
        requestableDepartments: vi.fn().mockResolvedValue([
          { id: DEPARTMENT, propertyId: PROPERTY, name: 'Housekeeping', departmentCategory: 'rooms', phone: null },
          { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', propertyId: OTHER_PROPERTY, name: 'Front Office', departmentCategory: 'rooms', phone: '0788000000' },
        ]),
        deskThreadsFor: vi.fn().mockResolvedValue([
          { threadId: THREAD, departmentId: DEPARTMENT, guestStayId: STAY, bookingId: null, updatedAt: new Date('2026-09-16T08:00:00.000Z') },
        ]),
        unreadCounts: vi.fn().mockResolvedValue(new Map([[THREAD, 2]])),
      });

      const { places } = await service.myDepartments(GUEST);

      expect(places).toHaveLength(2);
      expect(places[0]).toMatchObject({ context: 'stay', inHouse: true, subjectId: STAY });
      // Each place is answered with ITS OWN property's desks, never the pooled list.
      expect(places[0]?.departments.map((d) => d.name)).toEqual(['Housekeeping']);
      expect(places[0]?.departments[0]).toMatchObject({ threadId: THREAD, unreadCount: 2 });
      expect(places[1]).toMatchObject({ context: 'booking', inHouse: false });
      expect(places[1]?.departments.map((d) => d.name)).toEqual(['Front Office']);
      // A desk with no conversation yet carries no thread and no unread.
      expect(places[1]?.departments[0]).toMatchObject({ threadId: null, unreadCount: 0 });
    });

    it('answers a person staying and booked nowhere with an empty list, not a refusal', async () => {
      const { service, repo } = harness();

      await expect(service.myDepartments(GUEST)).resolves.toEqual({ places: [] });
      // Nothing to look desks up for, so nothing is asked.
      expect(repo.requestableDepartments).not.toHaveBeenCalled();
    });

    it("never lets one place's conversation show on another's desk", async () => {
      // Two bookings, same department id impossible — but the same PROPERTY is
      // the shape that catches a stitch keyed on the department alone.
      const { service } = opening({
        liveBookingsForGuest: vi.fn().mockResolvedValue([place({ subjectId: BOOKING })]),
        openStaysForGuest: vi.fn().mockResolvedValue([place({ propertyId: OTHER_PROPERTY, subjectId: STAY })]),
        requestableDepartments: vi.fn().mockResolvedValue([
          { id: DEPARTMENT, propertyId: PROPERTY, name: 'Housekeeping', departmentCategory: 'rooms', phone: null },
        ]),
        deskThreadsFor: vi.fn().mockResolvedValue([
          { threadId: THREAD, departmentId: DEPARTMENT, guestStayId: null, bookingId: BOOKING, updatedAt: new Date('2026-09-16T08:00:00.000Z') },
        ]),
      });

      const { places } = await service.myDepartments(GUEST);
      const stayPlace = places.find((p) => p.context === 'stay');
      const bookingPlace = places.find((p) => p.context === 'booking');

      expect(stayPlace?.departments).toEqual([]);
      expect(bookingPlace?.departments[0]?.threadId).toBe(THREAD);
    });
  });

  describe('the desk inbox filter (ADR-050 D-q)', () => {
    it('passes the department to the query rather than filtering the answer', async () => {
      const DEPARTMENT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const listThreads = vi.fn().mockResolvedValue([]);
      const repo = {
        listThreads,
        summarise: vi.fn().mockResolvedValue(new Map()),
        counterparts: vi.fn().mockResolvedValue(new Map()),
      };
      const service = new MessagingService(repo as unknown as MessagingRepository);
      const ws = {
        workspaceId: '55555555-5555-5555-5555-555555555555',
        branchScope: { coverage: 'all', selectedPropertyId: null, propertyIds: [], includesUnbranched: true },
      } as unknown as ScopedWorkspace;

      await service.listThreads(ws, DEPARTMENT);
      expect(listThreads).toHaveBeenCalledWith(ws.workspaceId, ws.branchScope, DEPARTMENT);

      await service.listThreads(ws);
      expect(listThreads).toHaveBeenLastCalledWith(ws.workspaceId, ws.branchScope, undefined);
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
    serviceOrderId: null,
    voiceDurationS: null,
    createdAt: new Date('2026-09-14T08:00:00.000Z'),
  });

  function desk(
    counterpart: string | null,
    rows: MessageRow[],
  ): { service: MessagingService; repo: Record<string, Mock> } {
    const repo = {
      findThread: vi.fn().mockResolvedValue({
        id: THREAD,
        workspaceId: WORKSPACE,
        bookingId: '66666666-6666-6666-6666-666666666666',
        guestStayId: null,
        leaseId: null,
        branchPropertyId: BRANCH,
        status: 'active',
      }),
      listMessages: vi.fn().mockResolvedValue(rows),
      counterpartUserId: vi.fn().mockResolvedValue(counterpart),
      sendMessage: vi.fn().mockResolvedValue(rows[0]?.id),
      findMessage: vi.fn().mockResolvedValue(rows[0]),
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
