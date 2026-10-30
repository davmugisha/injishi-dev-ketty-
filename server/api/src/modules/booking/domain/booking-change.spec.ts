import { describe, expect, it } from 'vitest';

import { type ChangeSubject, type ChangeTarget, changeProblems, paidRoomOf, priceChange } from './booking-change';

/** Gisele's hotel: a Single room, priced per room at 60,000 a night, 50,000 for one guest. */
const SINGLE: ChangeTarget = {
  id: 'rt-single',
  nightlyRateRwf: 60_000,
  singleGuestPriceRwf: 50_000,
  priceBasis: 'per_unit',
  capacity: 2,
  maxAdults: 2,
  maxChildren: 1,
  minStay: 1,
};
const DOUBLE: ChangeTarget = { ...SINGLE, id: 'rt-double', nightlyRateRwf: 90_000, singleGuestPriceRwf: null, capacity: 3 };

/** BK-VU99-JGY8: two adults, 1 to 3 November, prepaid 120,000. */
const BOOKING: ChangeSubject = {
  checkIn: '2026-11-01',
  checkOut: '2026-11-03',
  roomTypeId: 'rt-single',
  adults: 2,
  children: 0,
  lockedNightlyRwf: 60_000,
  priceBasis: 'per_unit',
  paidRoomRwf: null,
  refundRwf: null,
};
const ask = (over: Partial<{ checkIn: string; checkOut: string; roomTypeId: string; adults: number; children: number }>) => ({
  checkIn: BOOKING.checkIn,
  checkOut: BOOKING.checkOut,
  roomTypeId: BOOKING.roomTypeId,
  adults: BOOKING.adults,
  children: BOOKING.children,
  ...over,
});

describe('a reservation change, priced (2026-10-30)', () => {
  it('what was paid is the locked charge times the nights, less refunds, until a change records it', () => {
    expect(paidRoomOf(BOOKING)).toBe(120_000);
    expect(paidRoomOf({ ...BOOKING, refundRwf: 20_000 })).toBe(100_000);
    expect(paidRoomOf({ ...BOOKING, paidRoomRwf: 90_000 })).toBe(90_000);
  });

  it('a night longer keeps the price it was sold at, and owes one more night', () => {
    const p = priceChange(BOOKING, SINGLE, ask({ checkOut: '2026-11-04' }));
    expect(p).toMatchObject({ nights: 3, toNightlyRwf: 60_000, newRoomRwf: 180_000, differenceRwf: 60_000 });
  });

  it('a night shorter leaves credit', () => {
    const p = priceChange(BOOKING, SINGLE, ask({ checkOut: '2026-11-02' }));
    expect(p.differenceRwf).toBe(-60_000);
  });

  it('moving the same nights costs nothing either way', () => {
    expect(priceChange(BOOKING, SINGLE, ask({ checkIn: '2026-11-10', checkOut: '2026-11-12' })).differenceRwf).toBe(0);
  });

  it('a per-room price changes only when the party crosses one guest', () => {
    expect(priceChange(BOOKING, SINGLE, ask({ adults: 1 })).toNightlyRwf).toBe(50_000);
    const one = { ...BOOKING, adults: 1, lockedNightlyRwf: 50_000 };
    expect(priceChange(one, SINGLE, ask({ adults: 2 })).toNightlyRwf).toBe(60_000);
    expect(priceChange(BOOKING, SINGLE, ask({ adults: 1, children: 1 })).toNightlyRwf).toBe(60_000);
  });

  it('a per-guest price keeps the booking’s own rate per guest', () => {
    const perGuest = { ...BOOKING, priceBasis: 'per_person', lockedNightlyRwf: 40_000 };
    const target = { ...SINGLE, priceBasis: 'per_person', nightlyRateRwf: 25_000 };
    expect(priceChange(perGuest, target, ask({ adults: 3 })).toNightlyRwf).toBe(60_000);
  });

  it('another room type is priced as a new booking of it would be', () => {
    const p = priceChange(BOOKING, DOUBLE, ask({ roomTypeId: 'rt-double' }));
    expect(p).toMatchObject({ toNightlyRwf: 90_000, newRoomRwf: 180_000, differenceRwf: 60_000 });
  });
});

describe('a reservation change, checked', () => {
  const today = '2026-10-30';

  it('refuses a change that changes nothing', () => {
    expect(changeProblems(BOOKING, SINGLE, ask({}), today)).toContain(
      'Nothing is changed yet: pick new dates, another room type or a different party.',
    );
  });

  it('refuses dates in the past, backwards, or under the minimum stay', () => {
    expect(changeProblems(BOOKING, SINGLE, ask({ checkIn: '2026-10-20' }), today)).toContain('Arrival cannot be in the past.');
    expect(changeProblems(BOOKING, SINGLE, ask({ checkOut: '2026-11-01' }), today)).toContain('Departure must be after arrival.');
    expect(changeProblems(BOOKING, { ...SINGLE, minStay: 3 }, ask({ checkOut: '2026-11-02' }), today)).toContain(
      'That room type needs at least 3 nights.',
    );
  });

  it('refuses a party the room type does not take', () => {
    expect(changeProblems(BOOKING, SINGLE, ask({ adults: 3 }), today)).toEqual(
      expect.arrayContaining(['That room type sleeps at most 2.', 'That room type takes at most 2 adults.']),
    );
    expect(changeProblems(BOOKING, { ...SINGLE, maxChildren: 0 }, ask({ adults: 1, children: 1 }), today)).toContain(
      'That room type takes no children.',
    );
  });

  it('lets a real change through', () => {
    expect(changeProblems(BOOKING, SINGLE, ask({ checkOut: '2026-11-04' }), today)).toEqual([]);
  });
});
