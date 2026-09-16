/**
 * The booking draft, and the write that turns it into a Trip.
 *
 * **Why the draft is in the fixture store and not in the screen.** The prompt's
 * requirement is that every step keeps its draft when you go back, and there
 * are two ways to go back that a `useState` in the stepper survives neither of:
 * step 2 sends the guest to `listing/[id]/policy`, which is a different ROUTE
 * and unmounts nothing but takes the focus, and the hardware back button leaves
 * the stepper entirely. A draft in the store outlives both, and it is keyed per
 * Room type, so backing out of one room and into another keeps both drafts
 * rather than pouring one into the other.
 *
 * **What is NOT here.** The non-refundable switch is not a field of this draft.
 * It lives on Session 3's per-property `booking-draft.ts`, which the policy
 * sheet writes, and the two would drift the moment the guest flipped it in the
 * sheet — so this reads that one. One fact, one owner, the corpus's own rule,
 * applied to a fixture key.
 *
 * **The attempt token is the client half of ADR-020 D-c**, and its two rules
 * are the ones that make the idempotency work at all:
 *
 *   - **One press of confirm mints one token and reuses it on every retry of
 *     that press** (AC-12). A retry after a timeout is the same intent, and a
 *     second token would be a second charge.
 *   - **A changed quote mints a NEW one** (build task 7). Different dates, a
 *     different party or the non-refundable switch is a different booking, and
 *     reusing the token would have the server answer with the booking the guest
 *     has just changed their mind about — while AC-14 needs two DIFFERENT
 *     tokens for the same room and nights to both succeed, which is the family
 *     booking two rooms of one type.
 *
 * The token is minted here rather than at the press so the rule is testable
 * without a button: `tokenFor` is pure given a draft and a signature.
 */
import { useCallback, useRef } from 'react';
import type { BookingMode } from '@injishi/contracts';
import type { DateRange } from '@/components';
import { nightsBetween } from '@/components';
import {
  readFixture,
  useFixtureMutation,
  useFixtureValue,
  writeFixture,
} from '@/data/use-fixture-mutation';
import { DEFAULT_PARTY, billableGuests, type GuestParty } from '@/data/search';
import { getStayDetail, type RoomCard, type StayDetail } from '@/data/property-detail';
import { TRIPS, TRIPS_KEY, type ArrivalGuide, type Trip } from '@/data/trips';
import { confirmationFor, initialsOf, mintReference, quote, uuidV4, type PayMethod } from './book-format';

/* --------------------------------------------------------------- the draft */

export interface BookDraft {
  /** Zero-based, so it indexes `STEP_GATES` without an off-by-one. */
  step: number;
  dates: DateRange;
  party: GuestParty;
  /** FL07 §4 step 3: the policy is shown, and acknowledged, before payment. */
  acceptedRules: boolean;
  method: PayMethod;
  handset: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  /** ADR-020 D-c. Null until the first press of confirm. */
  attemptToken: string | null;
  /** The quote that token was minted against. A change re-mints it. */
  tokenFor: string | null;
  /** The Trip this draft became. Set once, and it is what makes confirm final. */
  bookingId: string | null;
}

export const EMPTY_BOOK_DRAFT: BookDraft = {
  step: 0,
  dates: { start: null, end: null },
  party: DEFAULT_PARTY,
  acceptedRules: false,
  method: 'momo',
  handset: '',
  cardNumber: '',
  cardExpiry: '',
  cardCvv: '',
  attemptToken: null,
  tokenFor: null,
  bookingId: null,
};

/** One draft per Room type. The route only ever carries that id. */
export function bookDraftKey(roomTypeId: string): string {
  return `book.draft:${roomTypeId}`;
}

/**
 * Everything that changes what the guest is agreeing to buy.
 *
 * The room is in it even though the key already names the room, because the
 * signature is also what a test compares across two rooms without building two
 * stores. The payment fields are NOT in it: paying for the same stay with a
 * different handset is the same booking, and re-minting there would be a second
 * charge for a corrected typo.
 */
export function quoteSignature(args: {
  roomTypeId: string;
  dates: DateRange;
  party: GuestParty;
  nonRefundable: boolean;
}): string {
  const { roomTypeId, dates, party, nonRefundable } = args;
  return [
    roomTypeId,
    dates.start ?? '-',
    dates.end ?? '-',
    billableGuests(party),
    nonRefundable ? 'nr' : 'std',
  ].join('|');
}

export interface BookDraftHandle {
  draft: BookDraft;
  patch: (next: Partial<BookDraft>) => void;
  /**
   * The token for THIS press, minted if the quote has moved since the last one.
   * Returns it and stores it, so a retry of the same press gets the same value.
   */
  tokenForPress: (signature: string) => string;
}

export function useBookDraft(roomTypeId: string, seed: () => BookDraft): BookDraftHandle {
  const key = bookDraftKey(roomTypeId);
  const draft = useFixtureValue<BookDraft>(key, seed);

  // `seed` is written inline at the call site and is therefore new on every
  // render. Holding it on a ref keeps both callbacks stable, so a screen can
  // put them in a dependency array without re-running an effect every render.
  // This is the pattern `useFixture` and `useFixtureMutation` already use.
  const seedRef = useRef(seed);
  seedRef.current = seed;

  const patch = useCallback(
    (next: Partial<BookDraft>) => {
      // Read back rather than closing over `draft`: the policy sheet is another
      // writer on a neighbouring key and a step can patch twice in one tick.
      const current = readFixture<BookDraft>(key, seedRef.current());
      writeFixture<BookDraft>(key, { ...current, ...next });
    },
    [key],
  );

  const tokenForPress = useCallback(
    (signature: string) => {
      const current = readFixture<BookDraft>(key, seedRef.current());
      if (current.attemptToken && current.tokenFor === signature) return current.attemptToken;
      const token = uuidV4();
      writeFixture<BookDraft>(key, { ...current, attemptToken: token, tokenFor: signature });
      return token;
    },
    [key],
  );

  return { draft, patch, tokenForPress };
}

/* ------------------------------------------------------------- the booking */

/**
 * How long the paying state is held.
 *
 * 1.2 seconds, from the prompt, and it stands for the round trip a mobile money
 * push actually takes — the prompt reaching the handset, not a spinner for its
 * own sake. It is deliberately NOT `MUTATION_LATENCY_MS`: that 300ms models the
 * local write, and this models the provider call ADR-020 D-a puts OUTSIDE the
 * transaction. The two run together, so the guest waits 1.2s and not 1.5s.
 */
export const PAYING_MS = 1200;

/**
 * The state a new Booking lands in (F-B03, FL07 §4 step 6).
 *
 * Read off the ROOM TYPE, never the property and never a constant — AC-18 is
 * explicit that no booking mode is hardcoded on a checkout.
 */
export function stateForMode(mode: BookingMode | null): Trip['state'] {
  return mode === 'instant_book' ? 'confirmed' : 'pending_approval';
}

/**
 * The arrival guide a brand-new Booking carries.
 *
 * **Nothing here is invented.** Wifi passwords and door codes are issued by the
 * host, and a fixture that made some up would be a screen showing a guest a
 * code that opens nothing. Where the catalogue already holds a Trip at the same
 * property the guide is that property's own and is copied; where it does not,
 * the fields are empty — which is honest, and unreachable in the bargain:
 * `arrivalGuideFor` only returns a guide once the Booking is `checked_in`, and
 * a Booking one second old is `confirmed` or `pending_approval`.
 */
export function arrivalFor(stayId: string): ArrivalGuide {
  const sibling = TRIPS.find((trip) => trip.stayId === stayId);
  if (sibling) return sibling.arrival;
  return {
    wifiNetwork: '',
    wifiPassword: '',
    accessCode: '',
    accessNote: '',
    directions: '',
  };
}

export interface MintArgs {
  detail: StayDetail;
  room: RoomCard;
  dates: DateRange;
  party: GuestParty;
  nonRefundable: boolean;
  /** Injected so a test can assert a reference instead of matching a shape. */
  reference?: string;
}

/**
 * The draft, as a Trip.
 *
 * Pure, and exported, because this is the whole of what confirming DOES and it
 * deserves a test that does not press a button. Three things it refuses:
 *
 *   - **It prices through `computeBreakdown`** and stores the result on the
 *     Trip. Design brief §8.6: a price is locked at booking time and never
 *     recomputed on a screen. Every later screen reads `trip.breakdown`.
 *   - **It does NOT lock the cancellation tier, and that is a known gap.**
 *     F-B05 §9 and F-B11 §10 both require the tier to be locked on the Booking
 *     at booking time, and `BookingResult` in the contract carries exactly that
 *     field, `lockedCancellationTier`. Session 5's `Trip` has nowhere to put it,
 *     and `Trip` is not this session's file to widen. Until it gains the field,
 *     a fixture booking reads its tier back off the room type, which is wrong
 *     the moment a host edits the policy. Reported, and Session 11 or the
 *     Phase 3 wiring should close it by adding the field to `Trip`.
 *   - **It throws rather than guessing** when the room has no rate or the dates
 *     are incomplete. A Trip with a zero total is worse than no Trip.
 */
export function mintTrip(args: MintArgs): Trip {
  const { detail, room, dates, party, nonRefundable } = args;
  const money = quote({
    nightlyRateRwf: room.summary.nightlyRateRwf,
    dates,
    nonRefundable,
    guests: billableGuests(party),
  });
  if (!money || !dates.start || !dates.end) {
    throw new Error('a booking needs a rate, a check-in and a check-out');
  }

  const reference = args.reference ?? mintReference();
  const host = detail.stay.agent;

  return {
    id: reference,
    stayId: detail.property.id,
    property: detail.stay.title,
    location: detail.stay.location,
    checkInDay: dates.start,
    checkOutDay: dates.end,
    checkInTime: detail.property.checkInTime ?? '14:00',
    checkOutTime: detail.property.checkOutTime ?? '11:00',
    nights: nightsBetween(dates.start, dates.end),
    guests: billableGuests(party),
    nightly: room.summary.nightlyRateRwf ?? 0,
    breakdown: money,
    fees: money.serviceFeeRwf,
    total: money.grossRwf,
    state: stateForMode(room.summary.bookingMode),
    confirmation: confirmationFor(reference, host),
    photo: detail.stay.photos.cover,
    host: {
      name: host,
      initials: initialsOf(host),
      // ADR-032 writes one thread per Booking, in the same transaction and at
      // any status, so the contact row on the trip is never dead. Session 5's
      // id shape: `TH-` plus the Booking's own number.
      threadId: `TH-${reference.replace('BK-', '')}`,
    },
    address: detail.address,
    coords: detail.stay.coords,
    selfCheckIn: detail.selfCheckIn,
    arrival: arrivalFor(detail.property.id),
  };
}

/**
 * The write. Prepends, because Trips reads newest-first within its two groups
 * and a guest who has just booked expects to see it at the top.
 */
export function useCreateBooking(): ReturnType<typeof useFixtureMutation<Trip[], Trip>> {
  return useFixtureMutation<Trip[], Trip>(
    TRIPS_KEY,
    (current, trip) => [trip, ...current.filter((t) => t.id !== trip.id)],
    () => TRIPS,
  );
}

/** The Trip a confirmed draft produced, read back out of the store. */
export function readBooking(bookingId: string): Trip | undefined {
  return readFixture<Trip[]>(TRIPS_KEY, TRIPS).find((trip) => trip.id === bookingId);
}

/** The stay behind a Room type, for a route that only carries the room's id. */
export function stayForRoom(room: RoomCard): StayDetail | undefined {
  return getStayDetail(room.stayId);
}
