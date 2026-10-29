import type { HotelGuestFilingService } from '../../guests/application/hotel-guest-filing.service';
import { describe, expect, it } from 'vitest';

import type { WalkInRequest } from '@injishi/contracts';
import { BadRequestException, ConflictException } from '@nestjs/common';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { FolioRepository } from '../infrastructure/folio.repository';
import type {
  FrontDeskRepository,
  RoomRow,
  StayRow,
  CheckInSubject,
} from '../infrastructure/front-desk.repository';
import type { FolioService } from './folio.service';
import { FrontDeskService, ESCROW_RECEIVABLE, prepaidRoomRwf } from './front-desk.service';
import type { RoomAssignmentService } from './room-assignment.service';
import type { StayClaimService } from './stay-claim.service';
import type { SelfCheckInService } from './self-check-in.service';

const ws = {
  workspaceId: 'ws-1',
  branchScope: {
    coverage: 'all',
    selectedPropertyId: null,
    propertyIds: ['prop-1'],
    includesUnbranched: true,
  },
} as unknown as ScopedWorkspace;

const ROOM_ID = '00000000-0000-4000-8000-000000000101';

const room: RoomRow = {
  id: ROOM_ID,
  workspaceId: 'ws-1',
  propertyId: 'prop-1',
  label: '101',
  roomTypeId: 'type-1',
  roomTypeName: 'Standard Double',
  roomTypeActive: true,
  status: 'available',
  housekeeping: 'clean',
};

type OpenStayInput = Parameters<FrontDeskRepository['openStay']>[0];

/**
 * The walk in's rules, against stand ins for the database.
 *
 * What these prove is the service's DECISIONS: which rate lands on the stay,
 * when a room is refused, and that the registration card the desk filled in
 * reaches onboarding. The night audit's read is SQL and is proven against
 * Postgres by `scripts/verify-walk-in.mjs`, not here.
 */
function build(opts: {
  defaultRate?: number | null;
  hold?: { from: string } | null;
  /** The room the command names, when it is not the standard one. */
  room?: RoomRow;
  /** The booking a check in is against. */
  booking?: CheckInSubject;
}): {
  service: FrontDeskService;
  posted: { drafts: { chargeType: string; amountRwf: number; accountCode: string; idempotencyKey: string | null }[] }[];
  opened: OpenStayInput[];
  holdQueries: { from: string; to: string }[];
  folios: unknown[];
  cards: unknown[];
  filed: { stayId: string; deskUserId: string }[];
} {
  const opened: OpenStayInput[] = [];
  const holdQueries: { from: string; to: string }[] = [];
  const folios: unknown[] = [];
  const cards: unknown[] = [];

  const repo = {
    findRoom: async () => opts.room ?? room,
    findCheckInSubject: async () => opts.booking ?? null,
    openStayForBooking: async () => null,
    defaultNightlyRate: async () => opts.defaultRate ?? null,
    openStay: async (input: OpenStayInput) => {
      opened.push(input);
      return 'stay-1';
    },
    findStay: async (): Promise<StayRow> => {
      const input = opened[opened.length - 1];
      return {
        id: 'stay-1',
        workspaceId: 'ws-1',
        bookingId: null,
        guestUserId: null,
        roomId: ROOM_ID,
        propertyId: 'prop-1',
        roomLabel: '101',
        guestName: input.guestName,
        lifecycle: 'open',
        entryAt: new Date(),
        plannedExitAt: input.plannedExitAt,
        actualExitAt: null,
      };
    },
  } as unknown as FrontDeskRepository;

  const assignments = {
    roomAssignedToday: async () => null,
    firstHoldOnRoom: async (_roomId: string, from: string, to: string) => {
      holdQueries.push({ from, to });
      return opts.hold ?? null;
    },
  } as unknown as RoomAssignmentService;

  const posted: { drafts: { chargeType: string; amountRwf: number; accountCode: string; idempotencyKey: string | null }[] }[] = [];
  const keys = new Set<string>();
  const folioRepo = {
    openForStay: async (input: unknown) => {
      folios.push(input);
      return 'folio-1';
    },
    openForBooking: async () => 'folio-1',
    bindToStay: async () => undefined,
    findChargeByIdempotencyKey: async (key: string) => (keys.has(key) ? { id: 'charge-1' } : null),
    postCharges: async (input: (typeof posted)[number]) => {
      posted.push(input);
      for (const d of input.drafts) if (d.idempotencyKey) keys.add(d.idempotencyKey);
      return {};
    },
  } as unknown as FolioRepository;

  const onboarding = {
    registerAndInvite: async (_stayId: string, card: unknown) => {
      cards.push(card);
      return null;
    },
  } as unknown as StayClaimService;

  // The stays filed for local government (0114), and by whom.
  const filed: { stayId: string; deskUserId: string }[] = [];
  const hotelGuests = {
    fileStay: async (stayId: string, deskUserId: string) => {
      filed.push({ stayId, deskUserId });
      return null;
    },
  };

  const service = new FrontDeskService(
    repo,
    assignments,
    folioRepo,
    {} as FolioService,
    onboarding,
    // A walk-in has no booking, so nothing pre-arrival is carried onto the stay.
    { carryToStay: async () => undefined } as unknown as SelfCheckInService,
    hotelGuests as unknown as HotelGuestFilingService,
  );
  return { service, opened, holdQueries, folios, cards, posted, filed };
}

const walkIn = (over: Partial<WalkInRequest> = {}): WalkInRequest => ({
  roomId: ROOM_ID,
  guestName: '  Aline Uwase ',
  ...over,
});

describe('FrontDeskService.walkIn', () => {
  it('bills the rate agreed at the counter, opens a bill, and registers the guest', async () => {
    const { service, opened, folios, cards } = build({ defaultRate: 40_000 });
    const card = {
      documentType: 'national_id' as const,
      idNumber: '1199780012345678',
      phone: '+250 788 123 456',
      email: 'aline@example.com',
    };

    await service.walkIn(ws, walkIn({ nightlyRateRwf: 35_000, guest: card }));

    expect(opened[0]).toMatchObject({
      bookingId: null,
      guestName: 'Aline Uwase',
      priceRwf: 35_000,
    });
    expect(folios).toHaveLength(1);
    expect(cards).toEqual([card]);
  });

  it('files the walk in for local government, as the desk user who checked them in (0114)', async () => {
    const { service, filed } = build({ defaultRate: 40_000 });

    const stay = await service.walkIn(ws, walkIn(), 'desk-user-1');

    expect(filed).toEqual([{ stayId: stay.id, deskUserId: 'desk-user-1' }]);
  });

  it("falls back to the room type's default rate when none was typed", async () => {
    const { service, opened } = build({ defaultRate: 40_000 });

    await service.walkIn(ws, walkIn());

    expect(opened[0].priceRwf).toBe(40_000);
  });

  it('refuses a walk in with no rate at all, because nothing would ever bill the room', async () => {
    const { service, opened } = build({ defaultRate: null });

    await expect(service.walkIn(ws, walkIn())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(opened).toHaveLength(0);
  });

  it('refuses a room held for a reservation arriving during the stay', async () => {
    const { service, opened } = build({
      defaultRate: 40_000,
      hold: { from: '2026-09-16' },
    });

    const attempt = service.walkIn(ws, walkIn());
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow(
      'Room 101 is held for a reservation arriving 2026-09-16. Choose another room, or move that reservation first.',
    );
    expect(opened).toHaveLength(0);
  });

  it('asks about every night of a planned stay, and about tonight for an open ended one', async () => {
    const { service, holdQueries } = build({ defaultRate: 40_000 });
    const inThreeDays = new Date(Date.now() + 3 * 86_400_000);
    inThreeDays.setUTCHours(11, 0, 0, 0);

    await service.walkIn(ws, walkIn({ plannedExitAt: inThreeDays.toISOString() }));
    await service.walkIn(ws, walkIn());

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(`${today}T00:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(holdQueries[0]).toEqual({
      from: today,
      to: inThreeDays.toISOString().slice(0, 10),
    });
    expect(holdQueries[1]).toEqual({
      from: today,
      to: tomorrow.toISOString().slice(0, 10),
    });
  });

  it('refuses a departure that is already in the past', async () => {
    const { service, opened } = build({ defaultRate: 40_000 });

    await expect(
      service.walkIn(ws, walkIn({ plannedExitAt: '2020-01-01T11:00:00Z' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(opened).toHaveLength(0);
  });
});

/**
 * Which room a guest may be put in (found walking the booking end to end).
 *
 * The desk's room list offered every room of every branch, and the server only
 * checked that the caller owned the room: a guest who booked one branch could
 * be checked into another's room, and an archived room type's rooms still took
 * guests. Both are refused here, before any stay is opened.
 */
describe('FrontDeskService room rules', () => {
  const booking: CheckInSubject = {
    id: 'booking-1',
    workspaceId: 'ws-1',
    propertyId: 'prop-1',
    status: 'confirmed',
    guestUserId: 'guest-1',
    reference: 'BK-TEST-0001',
    checkIn: '2026-10-08',
    checkOut: '2026-10-09',
    lockedNightlyRateRwf: 60_000,
    paymentStatus: 'captured',
    refundRwf: null,
  };
  const twoBranches = {
    ...ws,
    branchScope: { ...ws.branchScope, propertyIds: ['prop-1', 'prop-2'] },
  } as unknown as ScopedWorkspace;

  it('refuses to check a guest into a room at another branch', async () => {
    const { service, opened } = build({
      booking,
      room: { ...room, propertyId: 'prop-2', label: 'Garden Suite 1' },
    });

    const attempt = service.checkIn(twoBranches, booking.id, { roomId: ROOM_ID });
    await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(attempt).rejects.toThrow('is at another branch');
    expect(opened).toHaveLength(0);
  });

  it('refuses a check in to a room whose type is archived', async () => {
    const { service, opened } = build({
      booking,
      room: { ...room, roomTypeActive: false, roomTypeName: 'Family Suite' },
    });

    const attempt = service.checkIn(ws, booking.id, { roomId: ROOM_ID });
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow('Family Suite, which is archived');
    expect(opened).toHaveLength(0);
  });

  it('refuses a walk in to a room whose type is archived', async () => {
    const { service, opened } = build({
      defaultRate: 40_000,
      room: { ...room, roomTypeActive: false },
    });

    await expect(service.walkIn(ws, walkIn())).rejects.toBeInstanceOf(ConflictException);
    expect(opened).toHaveLength(0);
  });
});

/**
 * Option A (2026-10-08): the online prepayment goes on the bill at check in.
 *
 * Walking the booking end to end showed a guest who paid 126,000 online with a
 * bill reading 120,000 owed after the night audit: nothing on the bill said
 * the room was paid, so the desk was prompted to collect it again.
 */
describe('FrontDeskService prepayment on the bill', () => {
  const paid: CheckInSubject = {
    id: 'booking-2',
    workspaceId: 'ws-1',
    propertyId: 'prop-1',
    status: 'confirmed',
    guestUserId: 'guest-1',
    reference: 'BK-PAID-0001',
    checkIn: '2026-10-08',
    checkOut: '2026-10-10',
    lockedNightlyRateRwf: 120_000,
    paymentStatus: 'captured',
    refundRwf: null,
  };

  it('is the room the guest paid for: the locked rate times the nights', () => {
    expect(prepaidRoomRwf(paid)).toBe(240_000);
  });

  it('nets off what was already refunded', () => {
    expect(prepaidRoomRwf({ ...paid, paymentStatus: 'refunded_partial', refundRwf: 40_000 })).toBe(200_000);
  });

  it('is nothing when the money went back or was never taken', () => {
    expect(prepaidRoomRwf({ ...paid, paymentStatus: 'refunded_full' })).toBe(0);
    expect(prepaidRoomRwf({ ...paid, paymentStatus: 'forfeited' })).toBe(0);
    expect(prepaidRoomRwf({ ...paid, paymentStatus: null })).toBe(0);
    expect(prepaidRoomRwf({ ...paid, lockedNightlyRateRwf: null })).toBe(0);
  });

  it('posts one "paid online" deposit against escrow when the guest checks in', async () => {
    const { service, posted } = build({ booking: paid });

    await service.checkIn(ws, paid.id, { roomId: ROOM_ID });

    expect(posted).toHaveLength(1);
    const [line] = posted[0]!.drafts;
    expect(line).toMatchObject({
      chargeType: 'deposit',
      amountRwf: -240_000,
      accountCode: ESCROW_RECEIVABLE,
      idempotencyKey: `escrow-prepaid:${paid.id}`,
    });
  });

  it('never posts it twice for one booking', async () => {
    const { service, posted } = build({ booking: paid });

    await service.checkIn(ws, paid.id, { roomId: ROOM_ID });
    await service.checkIn(ws, paid.id, { roomId: ROOM_ID });

    expect(posted).toHaveLength(1);
  });
});
