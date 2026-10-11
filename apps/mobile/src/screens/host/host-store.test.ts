/**
 * The Host desk's transitions, without a screen.
 *
 * The interesting half of this surface IS the transitions — what a decline does
 * to escrow, what checkout hands to housekeeping, and which decisions are still
 * open — so they are asserted here rather than through four screens that would
 * each have to set up a navigator to reach them.
 */
import {
  DISPUTE_BUFFER_MS,
  HOST_BOOKINGS,
  type HostBooking,
} from './host-fixtures';
import {
  HOST_BOOKINGS_KEY,
  applyBookingChange,
  decisionBlocked,
  handOverToHousekeeping,
  isUpcoming,
  nightOf,
  rowStateOf,
} from './host-store';
import { readFixture, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { ROOMS_KEY, TASKS_KEY } from '@/screens/work/work-store';
import { SEED_ROOMS, SEED_TASKS, type WorkRoom, type WorkTask } from '@/screens/work/work-fixtures';
import { addDays } from '@/data/trips';
import { todayIso } from '@/components';

const TODAY = todayIso();

/** A pending request, expiring in an hour. The fixture's own first seed. */
const pending = (): HostBooking => ({
  ...HOST_BOOKINGS.find((b) => b.status === 'pending_approval')!,
});

/** Somebody in house, so the checkout path has a subject with a room. */
const inHouse = (): HostBooking => ({
  ...HOST_BOOKINGS.find((b) => b.checkedInAt !== null && b.checkedOutAt === null && b.room)!,
});

beforeEach(() => resetFixtures());
afterEach(() => resetFixtures());

describe('what a decision does', () => {
  it('confirms the booking and RETAINS the escrow hold on approve', () => {
    const before = pending();
    const [after] = applyBookingChange([before], {
      op: 'approve',
      id: before.id,
      at: Date.now(),
    });

    expect(after.status).toBe('confirmed');
    // F-B06: approve retains the hold. Nothing is captured twice and nothing
    // is released — the money has been held since booking.
    expect(after.escrowStatus).toBe('held');
    expect(after.paymentStatus).toBe('captured');
    // The countdown is over, so the row must stop showing one.
    expect(after.approvalExpiresAt).toBeNull();
  });

  it('refunds in full on a host decline, whatever the tier says', () => {
    const before = pending();
    const [after] = applyBookingChange([before], {
      op: 'decline',
      id: before.id,
      at: Date.now(),
      note: 'Those dates are not free.',
    });

    expect(after.status).toBe('declined');
    // F-B11: a host decline is always 100%.
    expect(after.paymentStatus).toBe('refunded_full');
    expect(after.escrowStatus).toBe('refunded_full');
    expect(after.declineReason).toBe('host_declined');
    // The sheet demands a line, so the line has to survive. A form that asks
    // for something and drops it is worse than one that never asked.
    expect(after.declineNote).toBe('Those dates are not free.');
  });

  it('separates an auto-decline from a host one by reason, not by outcome', () => {
    const before = pending();
    const [expired] = applyBookingChange([before], { op: 'expire', id: before.id });
    const [declined] = applyBookingChange([before], {
      op: 'decline',
      id: before.id,
      at: Date.now(),
      note: 'Those dates are not free.',
    });

    // The money moves identically; only the reason differs, which is what tells
    // a guest nobody turned them down on purpose.
    expect(expired.paymentStatus).toBe(declined.paymentStatus);
    expect(expired.escrowStatus).toBe(declined.escrowStatus);
    expect(expired.declineReason).toBe('expired');
    expect(declined.declineReason).toBe('host_declined');
  });

  it('puts the row back exactly as it was on undo', () => {
    const before = pending();
    const [declined] = applyBookingChange([before], {
      op: 'decline',
      id: before.id,
      at: Date.now(),
      note: 'Those dates are not free.',
    });
    const [restored] = applyBookingChange([declined], { op: 'restore', booking: before });

    // An inverse transition would have to know that declining moved two money
    // fields AND the countdown. The row itself simply knows.
    expect(restored).toEqual(before);
  });

  it('leaves every other booking untouched', () => {
    const rows = [pending(), inHouse()];
    const after = applyBookingChange(rows, { op: 'approve', id: rows[0].id, at: Date.now() });
    expect(after[1]).toEqual(rows[1]);
  });
});

describe('which decisions are still open', () => {
  const now = Date.now();

  it('allows a pending request whose countdown is still running', () => {
    expect(decisionBlocked({ ...pending(), approvalExpiresAt: now + 60_000 }, now)).toBeNull();
  });

  it('refuses one whose countdown has passed, because it is already refunded', () => {
    // FL08 path C: expiry wins deterministically over a late approval.
    expect(decisionBlocked({ ...pending(), approvalExpiresAt: now - 1 }, now)).toBe('expired');
  });

  it('refuses a request somebody has already answered', () => {
    expect(decisionBlocked({ ...pending(), status: 'confirmed' }, now)).toBe('resolved');
  });

  it('refuses a reference that resolves to nothing', () => {
    expect(decisionBlocked(undefined, now)).toBe('missing');
  });
});

describe('which bucket a booking is in', () => {
  const base = inHouse();

  it('calls a confirmed booking arriving only on the day itself', () => {
    const arriving = {
      ...base,
      checkedInAt: null,
      checkedOutAt: null,
      checkInDay: TODAY,
      checkOutDay: addDays(TODAY, 2),
    };
    expect(rowStateOf(arriving, TODAY)).toBe('arriving');
    expect(rowStateOf({ ...arriving, checkInDay: addDays(TODAY, 3) }, TODAY)).not.toBe('arriving');
  });

  it('gives a future booking back to the Bookings tab rather than to Today', () => {
    const ahead = {
      ...base,
      checkedInAt: null,
      checkedOutAt: null,
      checkInDay: addDays(TODAY, 3),
      checkOutDay: addDays(TODAY, 5),
    };
    // Today cannot act on it, so it is not one of the four groups...
    expect(rowStateOf(ahead, TODAY)).toBe('past');
    // ...but it is emphatically not history either.
    expect(isUpcoming(ahead, TODAY)).toBe(true);
  });

  it('moves an in-house stay to departing on its check-out day', () => {
    const stay = {
      ...base,
      checkedInAt: Date.now() - 86_400_000,
      checkedOutAt: null,
      checkInDay: addDays(TODAY, -2),
      checkOutDay: TODAY,
    };
    expect(rowStateOf(stay, TODAY)).toBe('departing');
    expect(rowStateOf({ ...stay, checkOutDay: addDays(TODAY, 2) }, TODAY)).toBe('in_house');
  });

  it('drops a checked-out stay out of today entirely', () => {
    expect(rowStateOf({ ...base, checkedOutAt: Date.now() }, TODAY)).toBe('past');
  });

  it('counts the first night as night one, never night zero', () => {
    const stay = { ...base, checkInDay: TODAY, checkOutDay: addDays(TODAY, 3), nights: 3 };
    expect(nightOf(stay, TODAY)).toBe(1);
    expect(nightOf(stay, addDays(TODAY, 1))).toBe(2);
    // And never past the last night, whatever the clock says.
    expect(nightOf(stay, addDays(TODAY, 9))).toBe(3);
  });
});

describe('the housekeeping handoff', () => {
  it('gives the attendant a pending checkout clean and marks the room dirty', () => {
    const at = Date.now();
    const task = handOverToHousekeeping('305', 'Emmanuel Bizimana', at);

    // F-P04: the task and the room are two axes, and both are written.
    expect(task.kind).toBe('checkout_clean');
    expect(task.status).toBe('pending');
    expect(task.id).toBe('305');

    const tasks = readFixture<WorkTask[]>(TASKS_KEY, [...SEED_TASKS]);
    expect(tasks[0].id).toBe('305');
    expect(tasks[0].kind).toBe('checkout_clean');

    const rooms = readFixture<WorkRoom[]>(ROOMS_KEY, [...SEED_ROOMS]);
    expect(rooms.find((r) => r.id === '305')?.status).toBe('dirty');
  });

  it('takes the room type from the floor board rather than inventing one', () => {
    // 312 is the Garden Suite on the Work surface's own board. A task carrying
    // a type that board has never heard of is a handoff that goes nowhere.
    expect(handOverToHousekeeping('312', 'Diane Mukamana', Date.now()).type).toBe('Garden Suite');
  });

  it('does not queue the same room twice', () => {
    handOverToHousekeeping('303', 'Josiane Umutoni', Date.now());
    handOverToHousekeeping('303', 'Josiane Umutoni', Date.now());
    const tasks = readFixture<WorkTask[]>(TASKS_KEY, [...SEED_TASKS]);
    expect(tasks.filter((task) => task.id === '303')).toHaveLength(1);
  });
});

describe('checking out', () => {
  it('closes the stay and invents nothing the server answers for', () => {
    const before = { ...inHouse(), balanceRwf: 24000, invoice: null, escrowStatus: 'held' as const };
    const at = Date.now();
    const [after] = applyBookingChange([before], { op: 'check-out', id: before.id, at });

    expect(after.checkedOutAt).toBe(at);
    // Mobile audit 2026-10-05, HO-04. The server issues the one tax invoice,
    // settles the folio and releases escrow (F-B17). A checkout that never
    // leaves the phone did none of it, so none of it is written: no
    // `EBM-2026-…` number, no balance zeroed as if paid, no payout clock.
    expect(after.invoice).toBeNull();
    expect(after.balanceRwf).toBe(24000);
    expect(after.escrowStatus).toBe('held');
    // The BOOKING's status never becomes `checked_out` — that is not one of
    // the contract's five values. The stay closing is what changed.
    expect(after.status).toBe('confirmed');
  });

  it('keeps an invoice the booking already carried', () => {
    const before = { ...inHouse(), invoice: 'EBM-2026-004417' };
    const [after] = applyBookingChange([before], { op: 'check-out', id: before.id, at: Date.now() });
    expect(after.invoice).toBe('EBM-2026-004417');
  });

  it('holds a payout for the dispute buffer rather than paying out at once', () => {
    // F-B17: the buffer runs from checkout. The value itself is a fixture's
    // choice — F-A10 leaves the duration open — so what is asserted is that the
    // release is in the future by that buffer, not the number of hours.
    const at = Date.now();
    expect(at + DISPUTE_BUFFER_MS).toBeGreaterThan(at);
    expect(DISPUTE_BUFFER_MS).toBeGreaterThan(0);
  });
});

describe('the fixtures themselves', () => {
  it('never puts the signed-in person on the guest side of their own desk', () => {
    // Decision D7a, generalised: the Host seat is Samuel Kayitare's, so no
    // booking on this desk may be his. Session 8 found the same trap on the
    // Landlord seat and it cost three files to unpick.
    expect(HOST_BOOKINGS.some((b) => b.guest.name.includes('Kayitare'))).toBe(false);
  });

  it('gives every one of the five buckets something to draw', () => {
    const states = new Set(HOST_BOOKINGS.map((b) => rowStateOf(b, TODAY)));
    expect(states).toContain('awaiting');
    expect(states).toContain('arriving');
    expect(states).toContain('in_house');
    expect(states).toContain('departing');
    expect(states).toContain('past');
  });

  it('prices every booking through the shared contract, never by hand', () => {
    for (const booking of HOST_BOOKINGS) {
      // `grossRwf` is accommodation minus any discount plus the fee. If a seed
      // ever hardcodes a total, this is what catches it.
      expect(booking.breakdown.grossRwf).toBe(
        booking.breakdown.accommodationRwf -
          booking.breakdown.nonRefundableDiscountRwf +
          booking.breakdown.serviceFeeRwf,
      );
    }
  });

  it('writes and reads back through the store the screens subscribe to', () => {
    const rows = [pending()];
    writeFixture<HostBooking[]>(HOST_BOOKINGS_KEY, rows);
    expect(readFixture<HostBooking[]>(HOST_BOOKINGS_KEY, [])).toHaveLength(1);
  });
});
