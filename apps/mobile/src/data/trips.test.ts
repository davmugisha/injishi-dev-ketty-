/**
 * The trip fixtures and the check-in gate.
 *
 * Two things are worth a test that a reader might not expect. The dates are a
 * function of the clock, so "the arriving trip is arriving" is an assertion
 * about the seeds and the derivation agreeing rather than about a constant. And
 * the gate has six answers, five of which are the reasons a guest CANNOT check
 * in — those five are the ones a screen gets wrong, so each has a case.
 */
import {
  CHECK_IN_WINDOW_MS,
  REVIEW_WINDOW_MS,
  TRIPS,
  UPCOMING_STATES,
  addDays,
  arrivalAt,
  arrivalGuideFor,
  checkInGate,
  checkInOpensAt,
  departureAt,
  getTrip,
  instantAt,
  nextTrip,
  pastTrips,
  reviewWindowOpen,
  upcomingTrips,
  type Trip,
} from './trips';
import { todayIso } from '@/components';
import { getStayDetail } from './property-detail';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A trip with one field changed, for the gate cases the fixtures do not hold. */
function trip(overrides: Partial<Trip> = {}): Trip {
  const base = TRIPS[0];
  if (!base) throw new Error('no trip fixtures');
  return { ...base, ...overrides };
}

describe('the trip fixtures', () => {
  it('prices every trip through the shared contract, never by hand', () => {
    for (const t of TRIPS) {
      expect(t.total).toBe(t.breakdown.grossRwf);
      expect(t.fees).toBe(t.breakdown.serviceFeeRwf);
      expect(t.breakdown.accommodationRwf).toBe(t.nightly * t.nights);
    }
  });

  it('derives nights from the two days rather than writing them down', () => {
    for (const t of TRIPS) {
      expect(addDays(t.checkInDay, t.nights)).toBe(t.checkOutDay);
    }
  });

  it('anchors the dates to today, so the countdown is never spent', () => {
    // The whole reason the seeds carry an offset: a fixture dated 14 August is
    // a hero card whose countdown reads zero on every morning after it.
    const arriving = getTrip('BK-4821');
    expect(arriving?.checkInDay).toBe(todayIso());
    expect(arriving?.state).toBe('arriving');
  });

  it('agrees with the property about self check-in and the check-in hour', () => {
    for (const t of TRIPS) {
      const detail = getStayDetail(t.stayId);
      expect(detail).toBeDefined();
      expect(t.selfCheckIn).toBe(detail?.selfCheckIn);
      expect(t.address).toBe(detail?.address);
    }
  });

  it('gives every booking a thread, at any status (ADR-032)', () => {
    for (const t of TRIPS) {
      expect(t.host.threadId).toBe(`TH-${t.id.replace('BK-', '')}`);
    }
  });

  it('carries both past states, so the review row has two branches to draw', () => {
    const past = pastTrips(TRIPS);
    expect(past.some((t) => t.state === 'completed')).toBe(true);
    expect(past.some((t) => t.state === 'cancelled')).toBe(true);
  });

  it('splits upcoming from past on the state, not on the date', () => {
    for (const t of upcomingTrips(TRIPS)) expect(UPCOMING_STATES).toContain(t.state);
    for (const t of pastTrips(TRIPS)) expect(UPCOMING_STATES).not.toContain(t.state);
  });

  it('sorts upcoming soonest first, so the hero is the next stay', () => {
    const upcoming = upcomingTrips(TRIPS);
    for (let i = 1; i < upcoming.length; i += 1) {
      expect(upcoming[i - 1]!.checkInDay <= upcoming[i]!.checkInDay).toBe(true);
    }
    expect(nextTrip(TRIPS)?.id).toBe(upcoming[0]?.id);
  });

  it('sorts past newest first: the stay you just left is the one you look for', () => {
    const past = pastTrips(TRIPS);
    for (let i = 1; i < past.length; i += 1) {
      expect(past[i - 1]!.checkInDay >= past[i]!.checkInDay).toBe(true);
    }
  });
});

describe('instantAt', () => {
  it('reads a day plus a wall clock as a LOCAL instant, never UTC', () => {
    const at = new Date(instantAt('2026-08-14', '14:00'));
    expect(at.getFullYear()).toBe(2026);
    expect(at.getMonth()).toBe(7);
    expect(at.getDate()).toBe(14);
    expect(at.getHours()).toBe(14);
  });

  it('opens the window exactly 24 hours before arrival', () => {
    const t = trip();
    expect(arrivalAt(t) - checkInOpensAt(t)).toBe(CHECK_IN_WINDOW_MS);
  });
});

describe('checkInGate', () => {
  it('is `open` once the stay is, whatever the clock says', () => {
    expect(checkInGate(trip({ state: 'checked_in' }), 0).kind).toBe('open');
  });

  it('is `ready` inside the window at a property that offers self check-in', () => {
    const t = trip({ state: 'arriving', selfCheckIn: true });
    expect(checkInGate(t, checkInOpensAt(t)).kind).toBe('ready');
    expect(checkInGate(t, arrivalAt(t)).kind).toBe('ready');
  });

  it('is `early` before the window opens, and says when it will', () => {
    const t = trip({ state: 'confirmed', selfCheckIn: true });
    const gate = checkInGate(t, checkInOpensAt(t) - 1);
    expect(gate.kind).toBe('early');
    expect(gate.kind === 'early' && gate.opensAt).toBe(checkInOpensAt(t));
  });

  it('is `staffed` where the property checks guests in itself (FL09 path B)', () => {
    const t = trip({ state: 'arriving', selfCheckIn: false });
    // Inside the window and still staffed: the window is not what decides it.
    expect(checkInGate(t, arrivalAt(t)).kind).toBe('staffed');
  });

  it('is `awaiting` while the host has not answered, whatever the property offers', () => {
    const t = trip({ state: 'pending_approval', selfCheckIn: true });
    expect(checkInGate(t, arrivalAt(t)).kind).toBe('awaiting');
  });

  it('is `closed` on a completed or a cancelled booking', () => {
    expect(checkInGate(trip({ state: 'completed' }), 0).kind).toBe('closed');
    expect(checkInGate(trip({ state: 'cancelled' }), 0).kind).toBe('closed');
  });
});

describe('arrivalGuideFor', () => {
  it('withholds the guide until the stay is open — the gate is in the data', () => {
    // F-B18's whole rule: an access code is not revealed before check-in, and
    // the screen never gets the chance to leak one it was handed.
    const ready = trip({ state: 'arriving', selfCheckIn: true });
    expect(arrivalGuideFor(ready, arrivalAt(ready))).toBeUndefined();
    expect(arrivalGuideFor(trip({ state: 'confirmed' }), 0)).toBeUndefined();
    expect(arrivalGuideFor(trip({ state: 'completed' }), 0)).toBeUndefined();
  });

  it('hands it over once the booking is checked in', () => {
    const open = trip({ state: 'checked_in' });
    expect(arrivalGuideFor(open, Date.now())?.accessCode).toBe(open.arrival.accessCode);
  });
});

describe('reviewWindowOpen', () => {
  it('is open for 14 days after check-out on a completed stay', () => {
    const t = trip({ state: 'completed' });
    const left = departureAt(t);
    expect(reviewWindowOpen(t, left + DAY)).toBe(true);
    expect(reviewWindowOpen(t, left + REVIEW_WINDOW_MS - 1)).toBe(true);
    expect(reviewWindowOpen(t, left + REVIEW_WINDOW_MS)).toBe(false);
  });

  it('never opens on a cancelled stay: nobody stayed in it (F-B14)', () => {
    const t = trip({ state: 'cancelled' });
    expect(reviewWindowOpen(t, departureAt(t) + DAY)).toBe(false);
  });

  it('leaves exactly one seeded stay inside the window, so the row is reachable', () => {
    const now = Date.now();
    const inWindow = TRIPS.filter((t) => reviewWindowOpen(t, now));
    expect(inWindow.map((t) => t.id)).toEqual(['BK-4402']);
  });
});
