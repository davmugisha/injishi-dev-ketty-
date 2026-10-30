import { describe, expect, it } from 'vitest';

import { ENDED_BOOKING_STATUSES, isLiveBooking } from './live-booking';

/**
 * The one rule that decides whether a guest who has not arrived may reach the
 * property's desks (ADR-050 D-q).
 *
 * Worth pinning rather than reading, because both halves are off-by-one prone
 * in opposite directions: an over-generous rule offers Housekeeping to somebody
 * whose booking was cancelled, and a mean one closes the desks on the morning a
 * guest is still in the room.
 */
describe('isLiveBooking', () => {
  const TODAY = '2026-09-16';

  it('is live while the checkout is still ahead', () => {
    expect(isLiveBooking({ status: 'confirmed', checkOut: '2026-09-18' }, TODAY)).toBe(
      true,
    );
  });

  it('counts checkout DAY itself', () => {
    // A guest leaving this morning has not finished their stay, which is the
    // same boundary `tripStage` draws between in_progress and past.
    expect(isLiveBooking({ status: 'confirmed', checkOut: TODAY }, TODAY)).toBe(true);
  });

  it('is over the day after checkout', () => {
    expect(isLiveBooking({ status: 'confirmed', checkOut: '2026-09-15' }, TODAY)).toBe(
      false,
    );
  });

  it('counts a request to book nobody has answered yet', () => {
    // The moment a guest most wants to ask a question. Whether they may is the
    // property's own `guest_requestable` flag, not the state of the booking.
    expect(
      isLiveBooking({ status: 'pending_approval', checkOut: '2026-09-21' }, TODAY),
    ).toBe(true);
  });

  it('refuses a booking that ended, whatever its dates still say', () => {
    for (const status of ENDED_BOOKING_STATUSES) {
      expect(isLiveBooking({ status, checkOut: '2026-12-31' }, TODAY)).toBe(false);
    }
  });

  it('names cancelled and declined, and only those', () => {
    // `no_show` is deliberately absent: it is a stay that happened, and its
    // checkout has passed by definition, so the date rule already refuses it.
    expect([...ENDED_BOOKING_STATUSES].sort()).toEqual(['cancelled', 'declined']);
    expect(isLiveBooking({ status: 'no_show', checkOut: '2026-09-15' }, TODAY)).toBe(
      false,
    );
  });
});
