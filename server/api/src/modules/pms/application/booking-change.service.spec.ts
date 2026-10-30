import { describe, expect, it, type Mock, vi } from 'vitest';

import { ConflictException, UnprocessableEntityException } from '@nestjs/common';
import type { ReservationChangeAsk } from '@injishi/contracts';

import { everyBranch } from '../../../shared/auth/branch-scope.fixture';
import type { ChangeableBooking } from '../infrastructure/booking-change.repository';
import { BookingChangeService } from './booking-change.service';

type Mocks = Record<string, Mock>;

/** A Kigali day this many days from today, so the dates stay bookable whenever the test runs. */
const day = (n: number): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(new Date(Date.now() + n * 86_400_000));

const WS = { workspaceId: 'ws-1', branchScope: everyBranch('prop-1') } as never;
const SINGLE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** BK-VU99-JGY8 at Gisele's hotel: a Single room, two adults, 1 to 3 November, prepaid 120,000. */
const booking = (over: Record<string, unknown> = {}): ChangeableBooking => ({
  id: 'bk-1',
  reference: 'BK-VU99-JGY8',
  workspaceId: 'ws-1',
  propertyId: 'prop-1',
  guestUserId: 'guest-1',
  status: 'confirmed',
  paymentStatus: 'captured',
  completed: false,
  stays: 0,
  checkIn: day(10),
  checkOut: day(12),
  roomTypeId: SINGLE,
  adults: 2,
  children: 0,
  lockedNightlyRwf: 60_000,
  priceBasis: 'per_unit',
  paidRoomRwf: null,
  refundRwf: null,
  ...over,
});

function build(
  over: { booking?: Record<string, unknown>; available?: boolean; momoOff?: boolean } = {},
): { service: BookingChangeService; changes: Mocks; attempts: Mocks; notifications: Mocks } {
  const changes = {
    find: vi.fn().mockResolvedValue(booking(over.booking)),
    available: vi.fn().mockResolvedValue(over.available ?? true),
    apply: vi.fn().mockResolvedValue({ kind: 'applied', changeId: 'change-1' }),
    createAwaiting: vi.fn().mockResolvedValue('change-2'),
    findChange: vi.fn().mockResolvedValue({ id: 'change-2', status: 'awaiting_payment' }),
  };
  const listings = {
    findBookableRoomType: vi.fn().mockResolvedValue({
      id: SINGLE,
      workspaceId: 'ws-1',
      propertyId: 'prop-1',
      domain: 'hospitality',
      nightlyRateRwf: 60_000,
      singleGuestPriceRwf: 50_000,
      priceBasis: 'per_unit',
      capacity: 2,
      maxAdults: 2,
      maxChildren: 1,
      minStay: 1,
    }),
  };
  const attempts = {
    beginForBookingChange: vi.fn().mockResolvedValue({ attemptToken: 'tok-1', state: 'prompting' }),
  };
  const seam = { isOffFor: vi.fn().mockReturnValue(over.momoOff ?? false), ruleProblem: vi.fn().mockReturnValue(null) };
  const notifications = { notifyChange: vi.fn().mockResolvedValue(undefined) };
  const service = new BookingChangeService(
    changes as never,
    listings as never,
    attempts as never,
    seam as never,
    notifications as never,
  );
  return { service, changes, attempts, notifications };
}

const ask = (over: Record<string, unknown> = {}): ReservationChangeAsk => ({
  checkIn: day(10),
  checkOut: day(12),
  roomTypeId: SINGLE,
  adults: 2,
  children: 0,
  ...over,
});

describe('BookingChangeService (0120)', () => {
  it('quotes a night longer: 60,000 more, on the bill or by MoMo', async () => {
    const { service } = build();
    const q = await service.quote(WS, 'bk-1', ask({ checkOut: day(13) }));
    expect(q).toMatchObject({ newRoomRwf: 180_000, differenceRwf: 60_000, settlements: ['bill', 'momo'], available: true, problems: [] });
  });

  it('offers only the bill when mobile money is switched off', async () => {
    const { service } = build({ momoOff: true });
    expect((await service.quote(WS, 'bk-1', ask({ checkOut: day(13) }))).settlements).toEqual(['bill']);
  });

  it('says when the new dates are not free', async () => {
    const { service } = build({ available: false });
    const q = await service.quote(WS, 'bk-1', ask({ checkOut: day(13) }));
    expect(q.available).toBe(false);
    expect(q.problems[0]).toMatch(/no room free/);
  });

  it('puts the difference on the bill when the desk chooses it, and tells the guest', async () => {
    const { service, changes, notifications } = build();
    const result = await service.change(WS, 'bk-1', { ...ask({ checkOut: day(13) }), settlement: 'bill' }, 'desk-1');
    expect(changes.apply).toHaveBeenCalledWith(expect.objectContaining({ settlement: 'bill', actorUserId: 'desk-1' }));
    expect(result).toMatchObject({ status: 'applied', settlement: 'bill', differenceRwf: 60_000 });
    expect(notifications.notifyChange).toHaveBeenCalledWith('bk-1', 'change-1');
  });

  it('refuses a change that costs more until the desk says how it is paid', async () => {
    const { service, changes } = build();
    await expect(service.change(WS, 'bk-1', ask({ checkOut: day(13) }), 'desk-1')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(changes.apply).not.toHaveBeenCalled();
  });

  it('keeps a cheaper stay’s difference as credit', async () => {
    const { service, changes } = build();
    const result = await service.change(WS, 'bk-1', ask({ checkOut: day(11) }), 'desk-1');
    expect(changes.apply).toHaveBeenCalledWith(expect.objectContaining({ settlement: 'credit' }));
    expect(result.differenceRwf).toBe(-60_000);
  });

  it('asks the guest by MoMo for the difference, and changes nothing until it lands', async () => {
    const { service, changes, attempts } = build();
    const result = await service.change(
      WS,
      'bk-1',
      {
        ...ask({ checkOut: day(13) }),
        settlement: 'momo',
        instrument: { kind: 'mobile_money', network: 'mtn_momo', msisdn: '788123456' },
        attemptToken: 'tok-123456',
      },
      'desk-1',
    );
    expect(changes.createAwaiting).toHaveBeenCalled();
    expect(changes.apply).not.toHaveBeenCalled();
    expect(attempts.beginForBookingChange).toHaveBeenCalledWith(
      expect.objectContaining({ changeId: 'change-2', amountRwf: 60_000, payerUserId: 'guest-1' }),
    );
    expect(result).toMatchObject({ status: 'awaiting_payment', settlement: 'momo' });
  });

  it('refuses a booking the guest has already checked in to', async () => {
    const { service } = build({ booking: { stays: 1 } });
    await expect(service.change(WS, 'bk-1', { ...ask({ checkOut: day(13) }), settlement: 'bill' }, 'desk-1')).rejects.toThrow(
      /checked in/,
    );
  });

  it('refuses a request, which is approved or declined, not changed', async () => {
    const { service } = build({ booking: { status: 'pending_approval' } });
    await expect(service.quote(WS, 'bk-1', ask({ checkOut: day(13) }))).rejects.toBeInstanceOf(ConflictException);
  });

  it('answers a stale or sold-out apply as a conflict', async () => {
    const { service, changes } = build();
    changes.apply.mockResolvedValueOnce({ kind: 'sold_out' });
    await expect(service.change(WS, 'bk-1', { ...ask({ checkOut: day(13) }), settlement: 'bill' }, 'desk-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
