import { describe, expect, it, vi } from 'vitest';

import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import type { ListingService } from '../../listing/application/listing.service';
import { localToday } from '../domain/pricing';
import { NoAvailabilityError } from '../infrastructure/booking.repository';
import type { DeskReservationRepository } from '../infrastructure/desk-reservation.repository';
import type { FolioRepository } from '../infrastructure/folio.repository';
import { DeskReservationService } from './desk-reservation.service';
import type { FolioService } from './folio.service';
import type { RoomAssignmentService } from './room-assignment.service';

const ws = {
  workspaceId: 'ws-1',
  branchScope: { propertyIds: ['prop-1'], includesUnbranched: true },
} as unknown as ScopedWorkspace;

const addDays = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const today = localToday();

const ROOM_TYPE = {
  id: 'rt-1',
  name: 'Deluxe double room',
  workspaceId: 'ws-1',
  propertyId: 'prop-1',
  domain: 'hospitality',
  priceBasis: 'per_unit',
  nightlyRateRwf: 85_000,
  singleGuestPriceRwf: 75_000,
  capacity: 2,
  maxAdults: 2,
  maxChildren: 1,
  bookingMode: 'instant_book',
  cancellationTier: 'flexible',
  minStay: null,
};

type Mock = ReturnType<typeof vi.fn>;
interface Built {
  service: DeskReservationService;
  desk: { create: Mock };
  assignments: { assign: Mock };
  bills: { takePayment: Mock };
}

function build(over: { available?: boolean; createError?: Error } = {}): Built {
  const desk = {
    available: vi.fn().mockResolvedValue(over.available ?? true),
    freeRooms: vi.fn().mockResolvedValue([{ id: 'room-101', label: '101' }]),
    create: over.createError
      ? vi.fn().mockRejectedValue(over.createError)
      : vi.fn().mockResolvedValue({ id: 'bk-1', reference: 'BK-TEST-0001' }),
  } as unknown as DeskReservationRepository & { create: ReturnType<typeof vi.fn> };
  const listings = {
    findBookableRoomType: vi.fn().mockResolvedValue(ROOM_TYPE),
    stayRate: vi.fn().mockResolvedValue({ nightlyRateRwf: 85_000, discountPct: 0, closedOn: null, minNights: 1, maxNights: 90 }),
  } as unknown as ListingService;
  const assignments = {
    assign: vi.fn().mockResolvedValue({ roomLabel: '101' }),
    releaseForBooking: vi.fn(),
  } as unknown as RoomAssignmentService & { assign: ReturnType<typeof vi.fn> };
  const folios = { openForBooking: vi.fn().mockResolvedValue('folio-1') } as unknown as FolioRepository;
  const bills = { takePayment: vi.fn().mockResolvedValue({}) } as unknown as FolioService & {
    takePayment: ReturnType<typeof vi.fn>;
  };
  return {
    service: new DeskReservationService(desk, listings, assignments, folios, bills),
    desk,
    assignments,
    bills,
  };
}

interface Ask {
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  adults: number;
  children: number;
  nightlyRateRwf?: number;
}

const ask = (over: Partial<Ask> = {}): Ask => ({
  checkIn: addDays(today, 7),
  checkOut: addDays(today, 10),
  roomTypeId: 'rt-1',
  adults: 2,
  children: 0,
  ...over,
});

describe('DeskReservationService.quote', () => {
  it('prices a future stay per room, lists the free rooms, and finds nothing wrong', async () => {
    const { service } = build();
    const q = await service.quote(ws, ask());
    expect(q).toMatchObject({ nights: 3, nightlyRateRwf: 85_000, chargedNightlyRwf: 85_000, totalRwf: 255_000, available: true });
    expect(q.freeRooms).toEqual([{ id: 'room-101', label: '101' }]);
    expect(q.problems).toEqual([]);
  });

  it('charges one guest the one-guest price, and the desk price when it sets one', async () => {
    const { service } = build();
    expect((await service.quote(ws, ask({ adults: 1 }))).chargedNightlyRwf).toBe(75_000);
    expect((await service.quote(ws, ask({ nightlyRateRwf: 60_000 }))).totalRwf).toBe(180_000);
  });

  it('says why it cannot be booked: a day gone, too many guests, sold out', async () => {
    const { service } = build();
    expect((await service.quote(ws, ask({ checkIn: addDays(today, -1) }))).problems).toContain('Arrival cannot be in the past.');
    expect((await service.quote(ws, ask({ adults: 2, children: 1 }))).problems).toContain('Deluxe double room sleeps at most 2.');
    const sold = build({ available: false });
    const q = await sold.service.quote(ws, ask());
    expect(q.available).toBe(false);
    expect(q.problems[0]).toMatch(/no room free/);
  });
});

describe('DeskReservationService.create', () => {
  it('writes the booking with the guest, holds the room and puts the deposit on the bill', async () => {
    const { service, desk, assignments, bills } = build();
    const result = await service.create(
      ws,
      {
        ...ask(),
        roomId: 'room-101',
        guest: { fullName: 'Aline Uwase', phone: '+250788000111' },
        channel: 'phone',
        deposit: { method: 'cash', amountRwf: 50_000 },
      },
      'user-1',
      'key-1',
    );
    expect(desk.create).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'phone',
        lockedNightlyRateRwf: 85_000,
        grossRwf: 255_000,
        guest: expect.objectContaining({ fullName: 'Aline Uwase', phone: '+250788000111' }),
        createdByUserId: 'user-1',
      }),
    );
    expect(assignments.assign).toHaveBeenCalledWith(ws, 'bk-1', { roomId: 'room-101' }, 'user-1');
    expect(bills.takePayment).toHaveBeenCalledWith(
      ws,
      'folio-1',
      { amountRwf: 50_000, method: 'cash', reference: undefined },
      'user-1',
      'desk-deposit:key-1',
    );
    expect(result).toMatchObject({ reference: 'BK-TEST-0001', totalRwf: 255_000, roomLabel: '101', roomProblem: null, folioId: 'folio-1' });
  });

  it('keeps the booking when the room was just taken, and says so', async () => {
    const { service, assignments } = build();
    assignments.assign.mockRejectedValueOnce(new Error('Room 101 is held for another guest.'));
    const result = await service.create(
      ws,
      { ...ask(), roomId: 'room-101', guest: { fullName: 'Aline Uwase' }, channel: 'phone' },
      'user-1',
      'key-2',
    );
    expect(result).toMatchObject({ roomLabel: null, roomProblem: 'Room 101 is held for another guest.', folioId: null });
  });

  it('answers a sold out room type as a conflict', async () => {
    const { service } = build({ createError: new NoAvailabilityError() });
    await expect(
      service.create(ws, { ...ask(), guest: { fullName: 'Aline Uwase' }, channel: 'phone' }, 'user-1', 'key-3'),
    ).rejects.toThrow(/no room free/);
  });
});
