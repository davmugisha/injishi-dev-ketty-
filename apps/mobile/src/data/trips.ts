/**
 * Trips — the Guest's bookings, and the one store every trip screen reads.
 *
 * Lifted out of `./stays` in Session 5. A trip now joins to the property for
 * its check-in time, its street line and whether it offers self check-in, and
 * `./property-detail` already imports `Stay` from `./stays`; keeping the trips
 * there would have been a cycle. This file is allowed to import both.
 *
 * ## Three things this file decides
 *
 * **The dates are relative to today, not written down.** A prototype whose
 * arriving stay was booked for 14 August is a prototype whose countdown reads
 * zero and whose "Start check-in" never lights up — the four dated fixtures
 * this replaced had all fallen into the past. Each seed carries an OFFSET in
 * days from today and the calendar days are computed at import, so the hero
 * card has a live countdown on any morning anyone opens the app. It is the one
 * kind of fixture that has to be a function of the clock.
 *
 * **`nights` is derived, not written.** It was a third copy of a fact the two
 * dates already carry, and `nightsBetween` is the kit's own arithmetic.
 *
 * **The arrival guide is gated in the DATA, not in the screen** (F-B18).
 * `arrivalGuideFor` returns `undefined` until the stay is open, which is where
 * `GET /me/trips/:id` will put the same rule. A screen that hid a code it had
 * already been handed would be one careless render away from printing it.
 *
 * The money still comes from `computeBreakdown` in `@injishi/contracts` and
 * nowhere else — see `withMoney` below, and the note that moved with it.
 */
import { computeBreakdown, type MoneyBreakdown } from '@injishi/contracts';
import { nightsBetween, todayIso, type IsoDay } from '@/components';
import { getStay, type Coords } from './stays';
import { getStayDetail } from './property-detail';
import {
  readFixture,
  useFixtureMutation,
  useFixtureValue,
  type MutationOutcome,
  type MutationStatus,
} from './use-fixture-mutation';
import { useFixture, type FixtureResult } from './use-fixture';

/* ------------------------------------------------------------ the shapes --- */

export type BookingState =
  | 'pending_approval'
  | 'confirmed'
  | 'arriving'
  | 'checked_in'
  | 'completed'
  | 'cancelled';

/** Trips still ahead of the guest vs. history. */
export const UPCOMING_STATES: BookingState[] = [
  'pending_approval',
  'confirmed',
  'arriving',
  'checked_in',
];

/**
 * The property side of the conversation, and the thread it hangs off.
 *
 * ADR-032 writes exactly one thread per booking, in the same transaction as
 * the booking and at any status including `pending_approval`, so every trip
 * has one and the contact row is never dead. The id shape is Session 5's
 * invention and Session 6 should key its thread fixtures on it: `TH-` plus the
 * booking's own number, so the two read side by side in a stack trace.
 */
export interface TripHost {
  name: string;
  initials: string;
  threadId: string;
}

/**
 * What unlocks once the stay is open (F-B18). Split into fields rather than the
 * three prose lines it used to be, because the access code is copyable on its
 * own and a sentence with a code inside it is not.
 */
export interface ArrivalGuide {
  wifiNetwork: string;
  wifiPassword: string;
  accessCode: string;
  /** What to do when the code fails. Every guide owes one. */
  accessNote: string;
  /** The written directions, beside the address and the map link. */
  directions: string;
}

export interface Trip {
  id: string;
  stayId: string;
  property: string;
  /**
   * The Room type booked, by name. Optional because the seeded trips never
   * recorded one; a booking made in the app does, so its confirmation can name
   * the room rather than printing the property under "Room type" (mobile audit
   * 2026-10-05, GK-15).
   */
  roomName?: string;
  location: string;
  /**
   * `YYYY-MM-DD`. A check-in is a calendar DAY, never an instant — see
   * `calendar-range.tsx`, which learned it the same way.
   */
  checkInDay: IsoDay;
  checkOutDay: IsoDay;
  /** `14:00`, the property's own, copied so a row renders without a join. */
  checkInTime: string;
  checkOutTime: string;
  /** Derived from the two days. Never written. */
  nights: number;
  guests: number;
  nightly: number;
  /** Every line the guest was charged, from the shared contract. */
  breakdown: MoneyBreakdown;
  /** `breakdown.serviceFeeRwf`, flattened for the rows that print one number. */
  fees: number;
  /** `breakdown.grossRwf`, flattened the same way. */
  total: number;
  state: BookingState;
  confirmation: string;
  /** The stay's cover, copied so a trip row never joins back through `stayId`. */
  photo: string;
  host: TripHost;
  /** Street line and pin, copied for the same reason: directions need no join. */
  address: string;
  coords: Coords;
  /** Whether the property lets a guest check themselves in (F-B09). */
  selfCheckIn: boolean;
  /**
   * Held on the trip but NOT readable from it. Go through `arrivalGuideFor`,
   * which is where the check-in gate lives.
   */
  arrival: ArrivalGuide;
}

/* -------------------------------------------------------------- the seeds --- */

interface TripSeed {
  id: string;
  stayId: string;
  /** Days from today to check-in. Negative is in the past. */
  offsetDays: number;
  nights: number;
  guests: number;
  nightly: number;
  state: BookingState;
  confirmation: string;
  host: Omit<TripHost, 'threadId'>;
  arrival: ArrivalGuide;
}

/**
 * Seven bookings, and each one is a state the trip screens have to draw.
 *
 * Four is what this held before and four could not carry the surface: there
 * was no stay in the check-in window with a countdown to run, no property that
 * checks guests in at a desk (FL09 path B), no completed stay that had already
 * been reviewed, and nothing cancelled — so "past" and "completed" looked like
 * one word and the review row would have offered a review of a stay nobody
 * stayed in.
 *
 * The order below is the order they happen in.
 */
const TRIP_SEEDS: TripSeed[] = [
  {
    // The hero. Arrives today, self check-in, inside the window: this is the
    // trip the walkthrough runs and the only one with a live countdown.
    id: 'BK-4821',
    stayId: 'kivu-sunbird-suite',
    offsetDays: 0,
    nights: 3,
    guests: 2,
    nightly: 145000,
    state: 'arriving',
    confirmation: 'INJ-4821-KV',
    host: { name: 'Kivu Shores Hotel', initials: 'KS' },
    arrival: {
      wifiNetwork: 'KivuShores-Guest',
      wifiPassword: 'shores2026',
      accessCode: '4821',
      accessNote: 'Reception can open the door if the keypad refuses it.',
      directions: 'KN 3 Rd, lakeside gate. Parking behind block B; the path to the suites is lit.',
    },
  },
  {
    // FL09 path B: a property with no self check-in. The guide stays locked and
    // the screen says who opens it instead of offering a dead button.
    id: 'BK-4703',
    stayId: 'akagera-tented-camp',
    offsetDays: 5,
    nights: 2,
    guests: 2,
    nightly: 265000,
    state: 'confirmed',
    confirmation: 'INJ-4703-AK',
    host: { name: 'Akagera Plains Camp', initials: 'AP' },
    arrival: {
      wifiNetwork: 'AkageraPlains',
      wifiPassword: 'plains2026',
      accessCode: 'Tent 6',
      accessNote: 'A guide walks you to the tent after the gate briefing.',
      directions: 'Kiyonza gate, then 8km inside the park boundary. Radio ahead after 18:00.',
    },
  },
  {
    // Confirmed but outside the window: the countdown runs in days and the CTA
    // carries the reason it is not live yet.
    id: 'BK-4790',
    stayId: 'lavender-hill-apartment',
    offsetDays: 12,
    nights: 3,
    guests: 1,
    nightly: 92000,
    state: 'confirmed',
    confirmation: 'INJ-4790-KH',
    host: { name: 'Heights Serviced Stays', initials: 'HS' },
    arrival: {
      wifiNetwork: 'Heights-Guest',
      wifiPassword: 'kimihurura01',
      accessCode: '5502',
      accessNote: 'The 24h reception desk holds a spare fob.',
      directions: 'KG 7 Ave, tower B. The lift needs the fob after 21:00.',
    },
  },
  {
    // Still with the host (F-B06). No check-in of any kind until it is answered.
    id: 'BK-4655',
    stayId: 'musanze-volcano-cabin',
    offsetDays: 26,
    nights: 2,
    guests: 4,
    nightly: 128000,
    state: 'pending_approval',
    confirmation: 'INJ-4655-MV',
    host: { name: 'Virunga Cabins', initials: 'VC' },
    arrival: {
      wifiNetwork: 'VirungaCabins',
      wifiPassword: 'kinigi2026',
      accessCode: '1103',
      accessNote: 'The caretaker lives in the first cabin on the left.',
      directions: 'Kinigi road, 3km past the park office. The last stretch is murram.',
    },
  },
  {
    // Completed, unreviewed, inside the 14-day window: the review row (F-B14).
    id: 'BK-4402',
    stayId: 'nyungwe-forest-lodge',
    offsetDays: -9,
    nights: 3,
    guests: 2,
    nightly: 310000,
    state: 'completed',
    confirmation: 'INJ-4402-NF',
    host: { name: 'Nyungwe Collection', initials: 'NC' },
    arrival: {
      wifiNetwork: 'Nyungwe-Lodge',
      wifiPassword: 'canopy2026',
      accessCode: 'Room 12',
      accessNote: 'Keys are held at the desk; the lodge is staffed overnight.',
      directions: 'Gisakura sector, signposted from the main road at the tea factory.',
    },
  },
  {
    // Completed and already reviewed: the row is gone and the score stands in
    // its place. `TRIP_REVIEW_SEEDS` in `./trip-reviews` writes this one.
    id: 'BK-4310',
    stayId: 'gisenyi-beach-motel',
    offsetDays: -140,
    nights: 2,
    guests: 2,
    nightly: 38000,
    state: 'completed',
    confirmation: 'INJ-4310-GB',
    host: { name: 'Gisenyi Beach Motel', initials: 'GB' },
    arrival: {
      wifiNetwork: 'BeachMotel',
      wifiPassword: 'gisenyi123',
      accessCode: 'Room 4',
      accessNote: 'The night watchman opens the gate after 22:00.',
      directions: 'Avenue de la Coopération, two minutes from the public beach.',
    },
  },
  {
    // Cancelled. Past, but never stayed in — so no review row, and the thread
    // is archived (ADR-032: archived on a terminal booking).
    id: 'BK-4266',
    stayId: 'rusizi-river-lodge',
    offsetDays: -160,
    nights: 1,
    guests: 2,
    nightly: 96000,
    state: 'cancelled',
    confirmation: 'INJ-4266-RR',
    host: { name: 'Rusizi Collection', initials: 'RC' },
    arrival: {
      wifiNetwork: 'RusiziLodge',
      wifiPassword: 'kamembe01',
      accessCode: 'Room 7',
      accessNote: 'The desk is staffed until 22:00.',
      directions: 'Kamembe road, twenty minutes from the Nyungwe southern gate.',
    },
  },
];

/* ---------------------------------------------------------- the derivation --- */

/**
 * What a property's check-in and check-out times fall back to.
 *
 * `PropertyDetail.checkInTime` is nullable on the contract, because a property
 * may not have set one. Every seed in the catalogue does, so this is resolved
 * once here rather than made a nullable field that five screens would each have
 * to branch on — and the two values are the catalogue's own most common pair,
 * not an invention.
 */
const DEFAULT_CHECK_IN_TIME = '14:00';
const DEFAULT_CHECK_OUT_TIME = '11:00';

/** `2026-09-06` plus `n` days, as a calendar day. Local, never UTC. */
export function addDays(day: IsoDay, n: number): IsoDay {
  const d = new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  d.setDate(d.getDate() + n);
  return todayIso(d);
}

/**
 * Prices a seed through the shared contract, and joins the property in.
 *
 * `computeBreakdown` is the ONE implementation of the service fee and its
 * rounding. It used to exist twice, once in the API's pricing module and once
 * in the web checkout, and two copies of a rounding rule is a quote that
 * eventually disagrees with the charge; the mobile fixtures were about to
 * become a third, and one of them already disagreed by 6,400.
 *
 * `nonRefundable: false` for every fixture: none of them is drawn as a
 * non-refundable rate, and inventing one would put a discount on a screen no
 * frame draws.
 */
function withMoney(seed: TripSeed, today: IsoDay): Trip {
  const stay = getStay(seed.stayId);
  const detail = getStayDetail(seed.stayId);
  if (!stay || !detail) throw new Error(`trip ${seed.id} is booked against an unknown stay`);

  const checkInDay = addDays(today, seed.offsetDays);
  const checkOutDay = addDays(checkInDay, seed.nights);
  const breakdown = computeBreakdown({
    nightlyRateRwf: seed.nightly,
    nights: seed.nights,
    nonRefundable: false,
  });

  return {
    id: seed.id,
    stayId: seed.stayId,
    property: stay.title,
    location: stay.location,
    checkInDay,
    checkOutDay,
    checkInTime: detail.property.checkInTime ?? DEFAULT_CHECK_IN_TIME,
    checkOutTime: detail.property.checkOutTime ?? DEFAULT_CHECK_OUT_TIME,
    nights: nightsBetween(checkInDay, checkOutDay),
    guests: seed.guests,
    nightly: seed.nightly,
    breakdown,
    fees: breakdown.serviceFeeRwf,
    total: breakdown.grossRwf,
    state: seed.state,
    confirmation: seed.confirmation,
    photo: stay.photos.cover,
    host: { ...seed.host, threadId: `TH-${seed.id.replace('BK-', '')}` },
    address: detail.address,
    coords: stay.coords,
    selfCheckIn: detail.selfCheckIn,
    arrival: seed.arrival,
  };
}

/** The file fixtures. `useTrips` reads the store on top of these. */
export const TRIPS: Trip[] = TRIP_SEEDS.map((seed) => withMoney(seed, todayIso()));

export function getTrip(id: string): Trip | undefined {
  return TRIPS.find((t) => t.id === id);
}

/* --------------------------------------------------------------- the gate --- */

/**
 * How long before arrival self check-in opens.
 *
 * F-B09 calls the window "configurable"; the Lake Kivu fixture's own
 * description says 24 hours, and the canvas says "Self check-in opens on the
 * day of arrival". 24h satisfies both and is the number the API will carry.
 */
export const CHECK_IN_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The 14-day double-blind review window (F-B14, FL15), measured from check-out. */
export const REVIEW_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * A calendar day plus a wall-clock time, as an instant.
 *
 * Local, deliberately: "check-in from 14:00" is 14:00 where the property is,
 * and every property in the catalogue is in Rwanda, which is the device's own
 * zone for the reader this is built for. `new Date('2026-08-14T14:00')` with no
 * zone is implementation-defined; this is not.
 */
export function instantAt(day: IsoDay, time: string): number {
  const [hh, mm] = time.split(':');
  return new Date(
    Number(day.slice(0, 4)),
    Number(day.slice(5, 7)) - 1,
    Number(day.slice(8, 10)),
    Number(hh ?? 0),
    Number(mm ?? 0),
  ).getTime();
}

/** When the guest may walk in. */
export function arrivalAt(trip: Trip): number {
  return instantAt(trip.checkInDay, trip.checkInTime);
}

/** When self check-in opens: `CHECK_IN_WINDOW_MS` before arrival. */
export function checkInOpensAt(trip: Trip): number {
  return arrivalAt(trip) - CHECK_IN_WINDOW_MS;
}

/** When the stay ends. */
export function departureAt(trip: Trip): number {
  return instantAt(trip.checkOutDay, trip.checkOutTime);
}

/**
 * The one gate the hero card, the trip detail and the arrival guide all read.
 *
 * Six answers rather than a boolean, because the five ways a guest CANNOT check
 * in are five different sentences, and a screen holding one `canCheckIn` flag
 * would have to re-derive which of them applies — which is how a trip card and
 * a detail screen start disagreeing about the same booking.
 */
export type CheckInGate =
  /** The stay is open. The arrival guide is unlocked. */
  | { kind: 'open' }
  /** In the window, self check-in offered: the CTA is live. */
  | { kind: 'ready' }
  /** Self check-in offered, window not open yet. */
  | { kind: 'early'; opensAt: number }
  /** The property checks guests in at a desk (FL09 path B). */
  | { kind: 'staffed' }
  /** The host has not answered the request yet (F-B06). */
  | { kind: 'awaiting' }
  /** Completed, cancelled: there is nothing left to check into. */
  | { kind: 'closed' };

export function checkInGate(trip: Trip, now: number = Date.now()): CheckInGate {
  if (trip.state === 'checked_in') return { kind: 'open' };
  if (trip.state === 'completed' || trip.state === 'cancelled') return { kind: 'closed' };
  if (trip.state === 'pending_approval') return { kind: 'awaiting' };
  if (!trip.selfCheckIn) return { kind: 'staffed' };
  const opensAt = checkInOpensAt(trip);
  return now >= opensAt ? { kind: 'ready' } : { kind: 'early', opensAt };
}

/**
 * The arrival guide, or `undefined` while it is locked (F-B18).
 *
 * The gate is HERE and not in the screen. `GET /me/trips/:id` will withhold the
 * same fields for the same reason.
 */
export function arrivalGuideFor(trip: Trip, now: number = Date.now()): ArrivalGuide | undefined {
  return checkInGate(trip, now).kind === 'open' ? trip.arrival : undefined;
}

/** Whether the double-blind review window is still open (F-B14: ~14 days). */
export function reviewWindowOpen(trip: Trip, now: number = Date.now()): boolean {
  return trip.state === 'completed' && now - departureAt(trip) < REVIEW_WINDOW_MS;
}

/* -------------------------------------------------------------- the store --- */

/** The fixture key, and the shape of the endpoint that replaces it. */
export const TRIPS_KEY = 'guest.trips';

export function upcomingTrips(trips: readonly Trip[]): Trip[] {
  return trips
    .filter((t) => UPCOMING_STATES.includes(t.state))
    .sort((a, b) => a.checkInDay.localeCompare(b.checkInDay));
}

/** Newest first: a stay you have just come back from is the one you look for. */
export function pastTrips(trips: readonly Trip[]): Trip[] {
  return trips
    .filter((t) => !UPCOMING_STATES.includes(t.state))
    .sort((a, b) => b.checkInDay.localeCompare(a.checkInDay));
}

/** The stay the hero card draws: the soonest one still ahead, or in progress. */
export function nextTrip(trips: readonly Trip[]): Trip | undefined {
  return upcomingTrips(trips)[0];
}

/**
 * The trips list, with the four states AND the writes.
 *
 * `useFixture` owns the status — the cold-read skeleton, the failure branch and
 * `retry` — and `useFixtureValue` owns the value, because it subscribes to the
 * store and a screen that has just checked itself in must not have to navigate
 * away and back to see it. Neither hook does both, and combining them here
 * rather than in each screen is what keeps the Trips tab and the trip detail
 * from disagreeing about a booking one of them just wrote.
 *
 * In Phase 3 this is one `useQuery` and the seam is this function's signature.
 */
export function useTrips(): FixtureResult<Trip[]> {
  const read = useFixture(TRIPS_KEY, () => readFixture<Trip[]>(TRIPS_KEY, TRIPS));
  const live = useFixtureValue<Trip[]>(TRIPS_KEY, () => TRIPS);
  return { ...read, data: read.status === 'ready' ? live : undefined };
}

/** One trip, live. `undefined` once the read has landed means it is not ours. */
export function useTrip(id: string | undefined): {
  trip: Trip | undefined;
  status: FixtureResult<Trip[]>['status'];
  error: Error | undefined;
  retry: () => void;
} {
  const { data, status, error, retry } = useTrips();
  return { trip: data?.find((t) => t.id === id), status, error, retry };
}

function applyCheckIn(current: Trip[], bookingId: string): Trip[] {
  return current.map((trip) =>
    trip.id === bookingId ? { ...trip, state: 'checked_in' as BookingState } : trip,
  );
}

/**
 * Completing self check-in. Creates the Guest stay, in the prototype's terms:
 * the booking moves to `checked_in`, which is what `arrivalGuideFor` gates on.
 *
 * A self check-in is self-attested and the API never marks one verified
 * (F-B09). There is no `verified` field here because no screen shows one; the
 * identity itself is in `./check-in`.
 */
export function useCheckInTrip(): {
  checkIn: (bookingId: string) => Promise<MutationOutcome>;
  status: MutationStatus;
} {
  const { mutate, status } = useFixtureMutation<Trip[], string>(
    TRIPS_KEY,
    applyCheckIn,
    () => TRIPS,
  );
  return { checkIn: mutate, status };
}
