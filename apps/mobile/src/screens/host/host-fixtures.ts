/**
 * The Host desk's fixtures — the bookings Umurage Guesthouse is holding, and
 * the payouts behind them.
 *
 * Optional Session A. The canvas draws no Host frame (decision D5), so the
 * shapes come from the operator web app the phone is a compact view of
 * (`apps/app/src/pms/screens/{today,reservations,reservation,stay}.tsx`) and
 * the vocabulary from F-B06, F-B07, F-B08, F-B17 and FL08, FL09, FL12.
 *
 * ## Four decisions worth reading before editing
 *
 * **1. Typed to `@injishi/contracts` wherever a contract exists** (decision D9).
 * `BookingStatus`, `PaymentStatus`, `EscrowStatus`, `DeclineReason` and
 * `MoneyBreakdown` are the wire's own, and `computeBreakdown` prices every seed,
 * so a host's total and the guest's total cannot disagree by a rounding rule.
 * The row states a desk actually sorts by — arriving, in house, departing — are
 * NOT stored: F-B07 is explicit that they are derived from dates and status,
 * and a stored `arriving` is a row that is still arriving tomorrow.
 *
 * **2. The guests are counterparties, and this file is where D7a is honoured.**
 * Decision D7 puts one person in every seat, so the viewer here is Samuel
 * Kayitare wearing the Host hat. Every guest below is therefore somebody else.
 * That matters more than it looks: Session 8 found the Landlord seat named as
 * a business three other files already used as a counterparty, which put one
 * account on both sides of a lease. The same trap is open here and is written
 * up in this session's report — `personas.ts` names the Host seat **Umurage
 * Guesthouse**, and `stays.ts` sells Umurage Guesthouse on Explore with
 * `agent: 'Umurage Hospitality Ltd'`. So a guest booking Umurage from Explore
 * is Samuel booking his own guesthouse. This file refuses to make that worse:
 * no seed here is Samuel, and the Host desk reads its OWN store rather than the
 * guest's trips, so a booking made in the Guest flow never appears on this desk.
 *
 * **3. Dates are offsets from today, never written down.** The same rule
 * `./../../data/trips.ts` learned: a desk whose "arriving today" is empty on
 * every morning but one is a desk nobody can demo. Arrivals, departures and the
 * in-house night count are all computed at import from `todayIso()`.
 *
 * **4. Room numbers are the Work surface's own.** 301 to 312, with the types
 * `work-fixtures.ts` gives them, because checkout hands a `checkout_clean` task
 * to that queue (F-P04) and a task for a room the floor board has never heard
 * of is a handoff that goes nowhere. The two surfaces sit in different
 * workspaces in `personas.ts` — Kivu Crest Hotel holds the Work seat — which is
 * the second half of the same naming problem, and is also in the report.
 */
import {
  computeBreakdown,
  type BookingMode,
  type BookingStatus,
  type DeclineReason,
  type EscrowStatus,
  type MoneyBreakdown,
  type PaymentStatus,
} from '@injishi/contracts';
import { nightsBetween, todayIso, type IsoDay } from '@/components';
import { addDays } from '@/data/trips';
import { getStayDetail } from '@/data/property-detail';

/** The property this seat runs. `personas.ts` names the seat after it. */
export const HOST_STAY_ID = 'umurage-guesthouse';

/* -------------------------------------------------------------- the shapes */

export interface HostGuest {
  name: string;
  initials: string;
  phone: string;
  /**
   * Stays this guest has completed here before. The operator row calls it
   * reputation; a returning guest is the one fact a desk acts on differently,
   * and it is the only part of "reputation" a phone has room for.
   */
  priorStays: number;
}

/**
 * How the booking reached the desk. FL09 path B walks in without one, and the
 * capture is different: there is no request to approve and no dates to honour.
 */
export type BookingSource = 'booked_ahead' | 'walk_in';

/** F-B08. A self check-in is the guest's own; a staffed one is the desk's. */
export type CheckInMode = 'staffed' | 'self';

export interface HostBooking {
  /** The `BK-` reference, which is what a guest reads out over the phone. */
  id: string;
  guest: HostGuest;
  roomTypeId: string;
  /** The property's own name for the room type. Data, not chrome. */
  roomType: string;
  /** Assigned room number, or null while nothing is assigned. */
  room: string | null;
  checkInDay: IsoDay;
  checkOutDay: IsoDay;
  /** `16:30`, where the guest gave one. F-B07's "Arrives {time}". */
  arrivalTime: string | null;
  /** Derived from the two days. Never written. */
  nights: number;
  guests: number;
  status: BookingStatus;
  bookingMode: BookingMode;
  /**
   * When a `request_to_book` auto-declines, as epoch ms.
   *
   * FL08: 24 hours from the request OR check-in, whichever comes first, and
   * expiry wins deterministically over a late approval. Null on anything that
   * is not an open request.
   */
  approvalExpiresAt: number | null;
  paymentStatus: PaymentStatus | null;
  escrowStatus: EscrowStatus | null;
  declineReason: DeclineReason | null;
  /**
   * What the host actually wrote when declining.
   *
   * Separate from `declineReason` because the two answer different questions.
   * The contract's reason has exactly two values and is what the RECORD keeps;
   * this is the sentence the GUEST is owed, and it is kept because a sheet that
   * demands a line and then discards it is a form that lies about why it asked.
   * `null` on everything that was not declined by a person.
   */
  declineNote: string | null;
  /** Locked at booking time. Design brief §8.6: never repriced on a screen. */
  breakdown: MoneyBreakdown;
  source: BookingSource;
  checkInMode: CheckInMode | null;
  /** Epoch ms, set when the desk or the guest opens the stay. */
  checkedInAt: number | null;
  checkedOutAt: number | null;
  /** Exactly one tax invoice per stay, issued at checkout (F-B17). */
  invoice: string | null;
  /** What is still owed on the folio. Zero once the stay settles. */
  balanceRwf: number;
}

/**
 * The five buckets a desk sorts by, derived per F-B07 and never stored.
 *
 * `past` covers everything terminal — checked out, declined, cancelled, no
 * show — because a desk does not act on any of them and one bucket for "not
 * my problem today" is honest about that.
 */
export type HostRowState = 'awaiting' | 'arriving' | 'in_house' | 'departing' | 'past';

/* ------------------------------------------------------------- the payouts */

/** `payouts.status` from the schema, verbatim. */
export type PayoutStatus = 'scheduled' | 'queued' | 'paid' | 'held';

export interface HostPayout {
  id: string;
  bookingId: string;
  guest: string;
  /** The FULL booking amount. F-B12: no commission is deducted. */
  amountRwf: number;
  status: PayoutStatus;
  /** Epoch ms the dispute buffer ends and the money is released. */
  releasesAt: number;
  destination: 'momo' | 'bank';
}

/**
 * How long a payout is held after checkout before it is released.
 *
 * F-B12 puts the dispute buffer in `config_entries` and F-A10 leaves the
 * DURATION an open question, so this is a fixture's choice rather than a
 * transcription, and it is named here rather than inlined so the day the
 * config answers, one constant moves. 48 hours is the shortest buffer that
 * still spans a checkout on a Friday.
 */
export const DISPUTE_BUFFER_MS = 48 * 60 * 60 * 1000;

/* --------------------------------------------------------------- the seeds */

interface Seed {
  id: string;
  guest: Omit<HostGuest, 'initials'>;
  roomTypeId: string;
  /** Days from today to check-in. Negative is in the past. */
  offsetDays: number;
  nights: number;
  guests: number;
  status: BookingStatus;
  room?: string;
  arrivalTime?: string;
  /** Hours from now until the request auto-declines. Requests only. */
  expiresInHours?: number;
  source?: BookingSource;
  checkInMode?: CheckInMode;
  /** Hours from now the stay opened. Negative is in the past. */
  checkedInHoursAgo?: number;
  checkedOutHoursAgo?: number;
  invoice?: string;
  balanceRwf?: number;
  declineReason?: DeclineReason;
}

/**
 * Eleven bookings, and every one of them is a state the desk has to draw.
 *
 * The set is chosen so that each of the five buckets has at least one row AND
 * each row's decision is reachable by walking the app: two live requests with
 * very different countdowns, an arrival with a room and an arrival without one,
 * an in-house stay mid-way, two departures that differ on whether the folio is
 * settled, a self check-in that the desk did not perform, and three terminal
 * rows so "past" is not an empty word.
 */
const SEEDS: readonly Seed[] = [
  {
    // The urgent request: under an hour left, which is what makes the
    // countdown on the row worth drawing at all.
    id: 'BK-7Q2M4X',
    guest: { name: 'Claudine Uwase', phone: '+250 788 302 114', priorStays: 0 },
    roomTypeId: 'umurage-deluxe-room',
    offsetDays: 2,
    nights: 2,
    guests: 2,
    status: 'pending_approval',
    expiresInHours: 0.7,
  },
  {
    // The unhurried one, so the two countdowns read differently at a glance.
    id: 'BK-6H4N8P',
    guest: { name: 'Patrick Nsengiyumva', phone: '+250 788 664 902', priorStays: 2 },
    roomTypeId: 'umurage-standard-room',
    offsetDays: 9,
    nights: 4,
    guests: 2,
    status: 'pending_approval',
    expiresInHours: 19,
  },
  {
    // Arriving today, room assigned, a time given: the ordinary good case.
    id: 'BK-5T9K3D',
    guest: { name: 'Diane Mukamana', phone: '+250 788 471 330', priorStays: 1 },
    roomTypeId: 'umurage-garden-suite',
    offsetDays: 0,
    nights: 3,
    guests: 4,
    status: 'confirmed',
    room: '312',
    arrivalTime: '16:30',
  },
  {
    // Arriving today with NO room. The desk assigns one at check-in, which is
    // the branch the capture stepper exists for.
    id: 'BK-9F2R7C',
    guest: { name: 'Olivier Habiyaremye', phone: '+250 789 118 245', priorStays: 0 },
    roomTypeId: 'umurage-standard-room',
    offsetDays: 0,
    nights: 1,
    guests: 1,
    status: 'confirmed',
  },
  {
    // Confirmed but not today: no check-in action, and the row says why.
    id: 'BK-3M8V6L',
    guest: { name: 'Sandrine Ingabire', phone: '+250 788 927 601', priorStays: 3 },
    roomTypeId: 'umurage-deluxe-room',
    offsetDays: 4,
    nights: 2,
    guests: 3,
    status: 'confirmed',
    room: '307',
  },
  {
    // In house, night 2 of 4.
    id: 'BK-4C7B2Z',
    guest: { name: 'Fabrice Rwigema', phone: '+250 788 550 187', priorStays: 0 },
    roomTypeId: 'umurage-deluxe-room',
    offsetDays: -1,
    nights: 4,
    guests: 2,
    status: 'confirmed',
    room: '308',
    checkInMode: 'staffed',
    checkedInHoursAgo: 20,
  },
  {
    // Departing today with money still on the folio: the departure that needs
    // a decision rather than a tap.
    id: 'BK-8W5J4Q',
    guest: { name: 'Josiane Umutoni', phone: '+250 788 213 774', priorStays: 5 },
    roomTypeId: 'umurage-standard-room',
    offsetDays: -2,
    nights: 2,
    guests: 2,
    status: 'confirmed',
    room: '303',
    checkInMode: 'staffed',
    checkedInHoursAgo: 44,
    balanceRwf: 24000,
  },
  {
    // Departing today, settled. Checkout is one tap and a confirm.
    id: 'BK-2P6X9N',
    guest: { name: 'Emmanuel Bizimana', phone: '+250 788 806 443', priorStays: 1 },
    roomTypeId: 'umurage-garden-suite',
    offsetDays: -3,
    nights: 3,
    guests: 4,
    status: 'confirmed',
    room: '305',
    checkInMode: 'staffed',
    checkedInHoursAgo: 68,
  },
  {
    // Checked themselves in (F-B09). The desk did not do it, and the stay
    // screen says so rather than implying a receptionist saw a document.
    id: 'BK-7L3G5S',
    guest: { name: 'Aimee Nyiraneza', phone: '+250 789 442 018', priorStays: 0 },
    roomTypeId: 'umurage-standard-room',
    offsetDays: -1,
    nights: 3,
    guests: 2,
    status: 'confirmed',
    room: '301',
    checkInMode: 'self',
    checkedInHoursAgo: 18,
  },
  {
    // Checked out yesterday: the payout below hangs off this one.
    id: 'BK-6D4H2T',
    guest: { name: 'Yvonne Mukandayisenga', phone: '+250 788 375 269', priorStays: 2 },
    roomTypeId: 'umurage-deluxe-room',
    offsetDays: -4,
    nights: 3,
    guests: 2,
    status: 'confirmed',
    room: '309',
    checkInMode: 'staffed',
    checkedInHoursAgo: 92,
    checkedOutHoursAgo: 26,
    invoice: 'EBM-2026-004417',
  },
  {
    // Declined last week, refunded in full (F-B11). Kept rather than dropped —
    // see the note on `HOST_BOOKINGS` below.
    id: 'BK-1K9Y3R',
    guest: { name: 'Thierry Munyaneza', phone: '+250 788 190 552', priorStays: 0 },
    roomTypeId: 'umurage-garden-suite',
    offsetDays: -6,
    nights: 2,
    guests: 3,
    status: 'declined',
    declineReason: 'host_declined',
  },
];

/* ---------------------------------------------------------- the derivation */

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  return `${words[0]?.[0] ?? '?'}${words[1]?.[0] ?? ''}`.toUpperCase();
}

const HOURS = 60 * 60 * 1000;

/**
 * Prices a seed through the shared contract and joins the Room type in.
 *
 * The rate and the room-type NAME both come from `property-detail.ts`, so the
 * desk cannot quote a price the Property detail page does not sell, and a room
 * type renamed there is renamed here for free.
 */
function build(seed: Seed, today: IsoDay, now: number): HostBooking {
  const detail = getStayDetail(HOST_STAY_ID);
  const room = detail?.rooms.find((r) => r.summary.id === seed.roomTypeId);
  if (!room) throw new Error(`host booking ${seed.id} names an unknown room type`);

  const checkInDay = addDays(today, seed.offsetDays);
  const checkOutDay = addDays(checkInDay, seed.nights);
  const breakdown = computeBreakdown({
    nightlyRateRwf: room.summary.nightlyRateRwf ?? 0,
    nights: seed.nights,
    // No seed is drawn as a non-refundable rate, and inventing one would put a
    // discount on a desk screen that no feature asks for.
    nonRefundable: false,
  });

  const declined = seed.status === 'declined';

  return {
    id: seed.id,
    guest: { ...seed.guest, initials: initialsOf(seed.guest.name) },
    roomTypeId: seed.roomTypeId,
    roomType: room.summary.name,
    room: seed.room ?? null,
    checkInDay,
    checkOutDay,
    arrivalTime: seed.arrivalTime ?? null,
    nights: nightsBetween(checkInDay, checkOutDay),
    guests: seed.guests,
    status: seed.status,
    bookingMode: room.summary.bookingMode ?? 'request_to_book',
    approvalExpiresAt:
      seed.expiresInHours === undefined ? null : now + seed.expiresInHours * HOURS,
    // Escrow is captured at booking time on every mode (F-B05), and a decline
    // refunds it in full (F-B11) — so the two fields move together and neither
    // is invented per row.
    paymentStatus: declined ? 'refunded_full' : 'captured',
    escrowStatus: declined ? 'refunded_full' : seed.checkedOutHoursAgo ? 'released' : 'held',
    declineReason: seed.declineReason ?? null,
    // The seeded decline carries the line a host would have written, so the
    // history on the detail screen has something real to show before anybody
    // declines anything in this session.
    declineNote: declined ? 'Those dates are already taken by a group booking.' : null,
    breakdown,
    source: seed.source ?? 'booked_ahead',
    checkInMode: seed.checkInMode ?? null,
    checkedInAt: seed.checkedInHoursAgo === undefined ? null : now - seed.checkedInHoursAgo * HOURS,
    checkedOutAt:
      seed.checkedOutHoursAgo === undefined ? null : now - seed.checkedOutHoursAgo * HOURS,
    invoice: seed.invoice ?? null,
    balanceRwf: seed.balanceRwf ?? 0,
  };
}

/**
 * The file fixtures.
 *
 * **A declined booking is kept, where the operator web app drops it.**
 * `reservations.tsx` filters `declined` out of every bucket, which is right for
 * a desk that has the row in a database it can query. A phone prototype has
 * only what is in this array, and a decline that erased its own evidence would
 * make the decline path untestable by walking the app — the guest would simply
 * vanish. So the row survives under a `Declined` chip, and the deviation is in
 * the report.
 */
export const HOST_BOOKINGS: readonly HostBooking[] = (() => {
  const today = todayIso();
  const now = Date.now();
  return SEEDS.map((seed) => build(seed, today, now));
})();

/**
 * One payout per stay that has ended, which is what starts the timer (F-B17).
 *
 * Three states rather than one, because the row has to be able to say three
 * different things: money on its way, money with nowhere to go, and money
 * stopped by a dispute. `queued` is the case F-B12 is emphatic about — a payout
 * with no destination configured is never dropped, it waits.
 */
export const HOST_PAYOUTS: readonly HostPayout[] = (() => {
  const now = Date.now();
  const paidOut = HOST_BOOKINGS.find((b) => b.id === 'BK-6D4H2T');
  return [
    {
      id: 'PO-2026-0311',
      bookingId: paidOut?.id ?? 'BK-6D4H2T',
      guest: paidOut?.guest.name ?? 'Yvonne Mukandayisenga',
      amountRwf: paidOut?.breakdown.accommodationRwf ?? 525000,
      status: 'scheduled',
      releasesAt: (paidOut?.checkedOutAt ?? now) + DISPUTE_BUFFER_MS,
      destination: 'momo',
    },
    {
      id: 'PO-2026-0304',
      bookingId: 'BK-9J1F8V',
      guest: 'Beatrice Uwimana',
      amountRwf: 310000,
      status: 'queued',
      releasesAt: now - 6 * HOURS,
      destination: 'momo',
    },
    {
      id: 'PO-2026-0288',
      bookingId: 'BK-3N7T5W',
      guest: 'Kevin Gatera',
      amountRwf: 465000,
      status: 'held',
      releasesAt: now - 30 * HOURS,
      destination: 'bank',
    },
  ];
})();

/**
 * The room numbers a desk may assign, taken from the Work surface's floor
 * board so a checkout's `checkout_clean` task lands on a room that queue knows.
 */
export const ASSIGNABLE_ROOMS = ['301', '302', '303', '304', '305', '306', '307', '308', '309', '310', '311', '312'] as const;
