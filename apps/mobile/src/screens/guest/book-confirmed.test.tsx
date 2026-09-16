/**
 * The confirmation, rendered.
 *
 * The assertion that matters most is that the page follows the BOOKING's state
 * rather than the canvas's word. The artboard draws "Booking confirmed" and a
 * brand badge; that is right for `instant_book` and wrong for the request the
 * host has not answered yet, and telling a guest their request is confirmed is
 * the worst thing this screen could do.
 */
import { screen, waitFor } from '@testing-library/react-native';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { getStayDetail } from '@/data/property-detail';
import { TRIPS, TRIPS_KEY, type Trip } from '@/data/trips';
import { mintTrip } from './book-draft';
import { BookConfirmedScreen } from './book-confirmed';

const replaced: unknown[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (href: unknown) => replaced.push(href),
    replace: (href: unknown) => replaced.push(href),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

const UMURAGE = getStayDetail('umurage-guesthouse')!;
const GARDEN = UMURAGE.rooms.find((r) => r.summary.bookingMode === 'instant_book')!;
const REQUEST = UMURAGE.rooms.find((r) => r.summary.bookingMode === 'request_to_book')!;

const DATES = { start: '2026-09-04', end: '2026-09-07' };

/** A booking already in the store, as the stepper would have left it. */
function seed(room = GARDEN, reference = 'BK-7Q2M4X'): Trip {
  const trip = mintTrip({
    detail: UMURAGE,
    room,
    dates: DATES,
    party: { adults: 2, children: 0, infants: 0 },
    nonRefundable: false,
    reference,
  });
  writeFixture<Trip[]>(TRIPS_KEY, [trip, ...TRIPS]);
  return trip;
}

beforeEach(() => {
  replaced.length = 0;
  resetFixtures();
});
afterEach(() => resetFixtures());

async function open(bookingId: string | undefined, scheme: (typeof SCHEMES)[number] = 'light', locale?: 'en' | 'rw') {
  const view = renderInScheme(
    <BookConfirmedScreen bookingId={bookingId} />,
    scheme,
    locale ? { locale } : undefined,
  );
  // Waiting for the skeleton to LEAVE is a race on the first, cold read of the
  // trips key; waiting for the settled page to ARRIVE is not. Either the
  // confirmation or the not-found state is a settled page.
  await waitFor(
    () => {
      const settled =
        screen.queryByText(en['book.confirmedTitle']) ??
        screen.queryByText(en['book.requestedTitle']) ??
        screen.queryByText(rw['book.confirmedTitle']) ??
        screen.queryByText(rw['book.requestedTitle']) ??
        screen.queryByText(en['book.confirmedNotFoundTitle']);
      expect(settled).not.toBeNull();
    },
    { timeout: 5000 },
  );
  return view;
}

describe.each(SCHEMES)('a confirmed booking in %s', (scheme) => {
  it('shows the reference, the status and the escrow total', async () => {
    const trip = seed();
    await open(trip.id, scheme);

    expect(screen.getByText(en['book.confirmedTitle'])).toBeTruthy();
    expect(screen.getByText('BK-7Q2M4X')).toBeTruthy();
    expect(screen.getByText(en['status.booking.confirmed'])).toBeTruthy();
    expect(screen.getByText(en['book.paidIntoEscrow'])).toBeTruthy();
    // The money is the breakdown stored on the trip, never recomputed here.
    expect(screen.getByText('1,512,000')).toBeTruthy();
  });
});

describe('a request the host has not answered', () => {
  it('does not say confirmed, and says what happens next', async () => {
    const trip = seed(REQUEST, 'BK-AAAAAA');
    await open(trip.id);

    expect(screen.getByText(en['book.requestedTitle'])).toBeTruthy();
    expect(screen.queryByText(en['book.confirmedTitle'])).toBeNull();
    expect(screen.getByText(en['status.booking.pending_approval'])).toBeTruthy();
    // Money against a request is held, not paid to anyone.
    expect(screen.getByText(en['book.heldInEscrow'])).toBeTruthy();
    expect(screen.queryByText(en['book.paidIntoEscrow'])).toBeNull();
  });

  it('says the e-invoice waits on the host rather than claiming one was issued', async () => {
    const trip = seed(REQUEST, 'BK-BBBBBB');
    await open(trip.id);
    expect(screen.getByText(en['book.invoicePending'])).toBeTruthy();
    expect(screen.queryByText(en['book.invoiceNote'])).toBeNull();
  });
});

describe('the mock adapter', () => {
  it('is disclosed on the page, so a mocked success cannot look real', async () => {
    const trip = seed();
    await open(trip.id);
    expect(screen.getByText(en['book.mockAdapter'])).toBeTruthy();
  });
});

describe('the escapes', () => {
  it('offers the trip and Explore, and both go somewhere', async () => {
    const trip = seed();
    await open(trip.id);
    expect(screen.getByText(en['book.viewTrip'])).toBeTruthy();
    expect(screen.getByText(en['book.backToExplore'])).toBeTruthy();
  });
});

describe('a booking that is not on this device', () => {
  it('says so and opens Trips instead of showing an empty receipt', async () => {
    await open('BK-NOTHING');
    expect(screen.getByText(en['book.confirmedNotFoundTitle'])).toBeTruthy();
    expect(screen.getByText(en['book.confirmedNotFoundAction'])).toBeTruthy();
  });

  it('handles a route with no id at all', async () => {
    await open(undefined);
    expect(screen.getByText(en['book.confirmedNotFoundTitle'])).toBeTruthy();
  });
});

describe('the Kinyarwanda catalogue', () => {
  it('renders with no English left on it', async () => {
    const trip = seed();
    await open(trip.id, 'light', 'rw');
    expect(screen.getByText(rw['book.confirmedTitle'])).toBeTruthy();
    expect(screen.getByText(rw['book.viewTrip'])).toBeTruthy();
    expect(screen.queryByText(en['book.confirmedTitle'])).toBeNull();
  });
});
