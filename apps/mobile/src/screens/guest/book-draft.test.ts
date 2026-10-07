/**
 * The draft, the attempt token and the Trip a confirmed draft becomes.
 *
 * The token rules are ADR-020's client half and they are the ones worth
 * asserting without a screen: AC-12 (one press, one token, held across retries),
 * AC-14 (two different tokens for the same room and nights both succeed) and
 * build task 7 (a changed quote mints a new one). Get them wrong and the guest
 * is either charged twice or told they already booked something they just
 * changed their mind about.
 */
import { getStayDetail } from '@/data/property-detail';
import { resetFixtures } from '@/data/use-fixture-mutation';
import { DEFAULT_PARTY } from '@/data/search';
import { TRIPS } from '@/data/trips';
import { computeBreakdown } from '@injishi/contracts';
import {
  EMPTY_BOOK_DRAFT,
  arrivalFor,
  bookDraftKey,
  mintTrip,
  quoteSignature,
  stateForMode,
} from './book-draft';

beforeEach(() => resetFixtures());
afterEach(() => resetFixtures());

/** Umurage's Garden Suite: instant-book, flexible, the canvas's own booking. */
const GARDEN = getStayDetail('umurage-guesthouse')!.rooms.find(
  (r) => r.summary.bookingMode === 'instant_book',
)!;
/** A request-to-book room at the same property. */
const REQUEST = getStayDetail('umurage-guesthouse')!.rooms.find(
  (r) => r.summary.bookingMode === 'request_to_book',
)!;
const UMURAGE = getStayDetail('umurage-guesthouse')!;

const DATES = { start: '2026-09-04', end: '2026-09-07' };

describe('bookDraftKey', () => {
  it('is per room type, so two rooms at one property keep two drafts', () => {
    expect(bookDraftKey('a')).not.toBe(bookDraftKey('b'));
  });
});

describe('quoteSignature', () => {
  const base = {
    roomTypeId: GARDEN.summary.id,
    dates: DATES,
    party: DEFAULT_PARTY,
    nonRefundable: false,
  };

  it('is stable for the same quote', () => {
    expect(quoteSignature(base)).toBe(quoteSignature({ ...base }));
  });

  it.each([
    ['the dates', { dates: { start: '2026-09-05', end: '2026-09-07' } }],
    ['the party', { party: { adults: 3, children: 0, infants: 0 } }],
    ['the non-refundable rate', { nonRefundable: true }],
    ['the room', { roomTypeId: REQUEST.summary.id }],
  ])('moves when %s changes', (_what, patch) => {
    expect(quoteSignature({ ...base, ...patch })).not.toBe(quoteSignature(base));
  });

  it('does not move when only an infant is added', () => {
    // An infant does not occupy a bed, so it does not change what is bought.
    expect(quoteSignature({ ...base, party: { adults: 2, children: 0, infants: 2 } })).toBe(
      quoteSignature(base),
    );
  });
});

describe('stateForMode', () => {
  it('confirms an instant book and holds anything else for the host', () => {
    expect(stateForMode('instant_book')).toBe('confirmed');
    expect(stateForMode('request_to_book')).toBe('pending_approval');
    // A room with no mode set is not an implicit instant book. Guessing the
    // permissive answer here would confirm a booking no host agreed to.
    expect(stateForMode(null)).toBe('pending_approval');
  });
});

describe('arrivalFor', () => {
  it('copies the guide from an existing trip at the same property', () => {
    const sibling = TRIPS[0];
    expect(arrivalFor(sibling.stayId)).toEqual(sibling.arrival);
  });

  it('invents nothing for a property it has never hosted', () => {
    const guide = arrivalFor('a-property-with-no-trip');
    expect(guide.accessCode).toBe('');
    expect(guide.wifiPassword).toBe('');
  });
});

describe('mintTrip', () => {
  const args = {
    detail: UMURAGE,
    room: GARDEN,
    dates: DATES,
    party: { adults: 2, children: 0, infants: 0 },
    nonRefundable: false,
  };

  it('prices through the contract and stores the breakdown on the trip', () => {
    const trip = mintTrip({ ...args, reference: 'BK-7Q2M4X' });
    const expected = computeBreakdown({
      nightlyRateRwf: GARDEN.summary.nightlyRateRwf!,
      nights: 3,
      nonRefundable: false,
      // The party, because a stay is priced per person (owner ruling,
      // 2026-09-15). `mintTrip` passes the billable guests; a caller that
      // omits them prices one guest and disagrees with the screen.
      guests: 2,
    });
    expect(trip.breakdown).toEqual(expected);
    expect(trip.total).toBe(expected.grossRwf);
    expect(trip.fees).toBe(expected.serviceFeeRwf);
  });

  it('carries the canvas worked example', () => {
    // Garden Suite at 240,000 per guest per night, two guests, three nights:
    // 1,440,000 + 72,000 = 1,512,000. The canvas quoted 756,000, which was the
    // same stay priced for one; per-person pricing doubled it.
    const trip = mintTrip({ ...args, reference: 'BK-7Q2M4X' });
    expect(trip.breakdown.accommodationRwf).toBe(1_440_000);
    expect(trip.total).toBe(1_512_000);
  });

  it('takes the state from the room, not the property', () => {
    expect(mintTrip({ ...args, reference: 'BK-AAAAAA' }).state).toBe('confirmed');
    expect(mintTrip({ ...args, room: REQUEST, reference: 'BK-BBBBBB' }).state).toBe(
      'pending_approval',
    );
  });

  it('uses the reference as the id and derives the confirmation and thread from it', () => {
    const trip = mintTrip({ ...args, reference: 'BK-7Q2M4X' });
    expect(trip.id).toBe('BK-7Q2M4X');
    expect(trip.confirmation).toBe('INJ-7Q2M4X-UH');
    expect(trip.host.threadId).toBe('TH-7Q2M4X');
  });

  it('counts billable guests only', () => {
    const trip = mintTrip({
      ...args,
      party: { adults: 2, children: 1, infants: 2 },
      reference: 'BK-CCCCCC',
    });
    expect(trip.guests).toBe(3);
  });

  it('applies the non-refundable discount when it is taken', () => {
    const trip = mintTrip({ ...args, nonRefundable: true, reference: 'BK-DDDDDD' });
    expect(trip.breakdown.nonRefundableDiscountRwf).toBe(144_000);
    expect(trip.total).toBe(1_360_800);
  });

  it('throws rather than minting a trip with a zero total', () => {
    // A booking whose money is wrong is worse than no booking at all.
    expect(() => mintTrip({ ...args, dates: { start: '2026-09-04', end: null } })).toThrow();
    expect(() => mintTrip({ ...args, dates: { start: '2026-09-04', end: '2026-09-04' } })).toThrow();
  });

  it('copies the property fields a trip row needs so it never joins back', () => {
    const trip = mintTrip({ ...args, reference: 'BK-EEEEEE' });
    expect(trip.property).toBe(UMURAGE.stay.title);
    // The room booked, by name, so the confirmation's "Room type" row names
    // the room rather than the property (mobile audit 2026-10-05, GK-15).
    expect(trip.roomName).toBe(GARDEN.summary.name);
    expect(trip.address).toBe(UMURAGE.address);
    expect(trip.selfCheckIn).toBe(UMURAGE.selfCheckIn);
    expect(trip.checkInTime).toBe(UMURAGE.property.checkInTime);
    expect(trip.nights).toBe(3);
  });
});

describe('EMPTY_BOOK_DRAFT', () => {
  it('opens on step one with MoMo chosen and no token', () => {
    expect(EMPTY_BOOK_DRAFT.step).toBe(0);
    expect(EMPTY_BOOK_DRAFT.method).toBe('momo');
    expect(EMPTY_BOOK_DRAFT.attemptToken).toBeNull();
    expect(EMPTY_BOOK_DRAFT.bookingId).toBeNull();
  });
});
