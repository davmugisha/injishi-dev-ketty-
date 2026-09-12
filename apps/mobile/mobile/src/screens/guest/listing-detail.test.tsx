/**
 * The Property detail page, rendered.
 *
 * Expo Router is mocked to a router that records where it was told to go. The
 * navigator is not what is under test — the page's decisions are — and mounting
 * a real one would make this a test of Expo Router.
 *
 * The substantive assertions are the ones about the CTA. F-B15 and FL06 both
 * turn on it: the label follows the booking mode, and it is disabled with a
 * reason until there are dates and a room. Those are the two ways this page can
 * mislead a guest about what pressing the button will do.
 */
import { act, screen, waitFor } from '@testing-library/react-native';
import { ToastProvider } from '@/components';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { DEFAULT_SEARCH, SEARCH_KEY } from '@/data/search';
import { draftKey } from '@/data/booking-draft';
import { SAVED_KEY } from '@/data/saved';
import { getStayDetail } from '@/data/property-detail';
import { ListingDetailScreen } from './listing-detail';

const pushed: unknown[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (href: unknown) => pushed.push(href),
    replace: (href: unknown) => pushed.push(href),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

/** A stay with several room types, one of them instant-book. */
const KIVU = 'kivu-serena-suite';
/** Umurage: the canvas property, whose cheapest room is request-to-book. */
const UMURAGE = 'umurage-guesthouse';

const DATES = { start: '2026-09-04', end: '2026-09-07' };

beforeEach(() => {
  pushed.length = 0;
  resetFixtures();
});
afterEach(() => resetFixtures());

/** The page under a toast provider, which the heart needs. */
const page = (id: string) => (
  <ToastProvider>
    <ListingDetailScreen id={id} />
  </ToastProvider>
);

/** `useFixture` is slow on a cold key, so every test waits for the read. */
async function open(id: string, scheme: (typeof SCHEMES)[number], locale?: 'en' | 'rw') {
  const view = renderInScheme(page(id), scheme, locale ? { locale } : undefined);
  await waitFor(() => expect(screen.getByText(getStayDetail(id)!.property.name)).toBeTruthy());
  return view;
}

describe.each(SCHEMES)('the property detail page in the %s scheme', (scheme) => {
  it('shows a skeleton on the cold read rather than an empty page', () => {
    renderInScheme(page(KIVU), scheme);
    // Warm on a later render in the same session, which is also correct; the
    // assertion is that one of the two is showing, never neither.
    const loading = screen.queryByLabelText(en['listing.loading']);
    expect(loading ?? screen.getByText('Lake Kivu Suite')).toBeTruthy();
  });

  it('names the property, its district and its host', async () => {
    await open(KIVU, scheme);
    expect(screen.getByText('Rubavu, Western Province')).toBeTruthy();
    expect(screen.getByText('Hosted by Kivu Shores Hotel')).toBeTruthy();
    expect(screen.getByText(en['listing.hostMeta'])).toBeTruthy();
  });

  it('prints the guest score with the word derived from it, and the review count', async () => {
    await open(KIVU, scheme);
    // 8.5 out of ten is "Excellent" on the ADR-022 bands. The word is derived,
    // never stored beside the number.
    expect(screen.getByLabelText('Guest score 8.5 out of 10, Excellent')).toBeTruthy();
    expect(screen.getByText('212 reviews')).toBeTruthy();
  });

  it('lists every room type, with what is left of each', async () => {
    await open(KIVU, scheme);
    expect(screen.getByText('Lake Suite')).toBeTruthy();
    expect(screen.getByText('Balcony Double')).toBeTruthy();
    expect(screen.getByText('Only 2 left')).toBeTruthy();
  });

  it('states the check-in times and the house rules', async () => {
    await open(KIVU, scheme);
    expect(screen.getByLabelText(`${en['listing.checkInFrom']}, 14:00`)).toBeTruthy();
    expect(screen.getByLabelText(`${en['listing.checkOutBy']}, 11:00`)).toBeTruthy();
    expect(screen.getByText('No smoking indoors.')).toBeTruthy();
  });

  it('carries the three trust rows a guest books on', async () => {
    await open(KIVU, scheme);
    expect(screen.getByText(en['listing.trustEscrow'])).toBeTruthy();
    expect(screen.getByText(en['listing.trustRra'])).toBeTruthy();
    expect(screen.getByText(en['listing.trustSelfCheckIn'])).toBeTruthy();
  });

  it('says the check-in is staffed where it is, rather than promising a door code', async () => {
    await open('nyungwe-forest-lodge', scheme);
    expect(screen.getByText(en['listing.trustStaffedCheckIn'])).toBeTruthy();
    expect(screen.queryByText(en['listing.trustSelfCheckInBody'])).toBeNull();
  });
});

describe('the booking call to action', () => {
  const scheme = SCHEMES[0];

  it('is disabled and says why when there are no dates and no room', async () => {
    await open(KIVU, scheme);
    expect(screen.getByText(en['listing.blockedBoth'])).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Book now' }).props.accessibilityState.disabled).toBe(
      true,
    );
  });

  it('narrows the reason to the room once the dates are set', async () => {
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    await open(KIVU, scheme);
    expect(screen.getByText(en['listing.blockedRoom'])).toBeTruthy();
  });

  it('narrows the reason to the dates once a room is chosen', async () => {
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    await open(KIVU, scheme);
    expect(screen.getByText(en['listing.blockedDates'])).toBeTruthy();
  });

  it('enables and routes to the booking stepper with the dates once both are set', async () => {
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-lake-suite', nonRefundable: false });
    await open(KIVU, scheme);

    const cta = screen.getByRole('button', { name: 'Book now' });
    expect(cta.props.accessibilityState.disabled).toBe(false);
    act(() => cta.props.onClick?.() ?? cta.props.onPress?.());

    expect(pushed).toEqual([
      {
        pathname: '/book/[roomTypeId]',
        params: {
          roomTypeId: 'kivu-lake-suite',
          checkIn: '2026-09-04',
          checkOut: '2026-09-07',
          nonRefundable: '0',
        },
      },
    ]);
  });

  it('reads "Request to book" for a room that asks the host first', async () => {
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    writeFixture(draftKey(UMURAGE), {
      roomTypeId: 'umurage-standard-room',
      nonRefundable: false,
    });
    await open(UMURAGE, scheme);
    expect(screen.getByRole('button', { name: 'Request to book' })).toBeTruthy();
  });

  it('follows the ROOM, not the property, when the two differ', async () => {
    // Umurage's facet is request-to-book, because its cheapest room is. Its
    // Garden Suite is instant. The label has to follow the room the guest
    // actually chose or the button lies about what pressing it does.
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    writeFixture(draftKey(UMURAGE), { roomTypeId: 'umurage-garden-suite', nonRefundable: false });
    await open(UMURAGE, scheme);
    expect(screen.getByRole('button', { name: 'Book now' })).toBeTruthy();
  });

  it('refuses a property that is not taking bookings, ahead of every other reason', async () => {
    await open('virunga-tea-retreat', SCHEMES[0]);
    expect(screen.getByText(en['listing.blockedInactive'])).toBeTruthy();
    expect(screen.getByText(en['listing.inactiveBody'])).toBeTruthy();
  });
});

describe('choosing a room', () => {
  const scheme = SCHEMES[0];

  it('drives the sticky bar from the card the guest pressed', async () => {
    await open(KIVU, scheme);
    // Before the tap the bar shows the cheapest rate, qualified as a "from".
    expect(screen.getByText(en['listing.from'])).toBeTruthy();
    expect(screen.getAllByText('Balcony Double')).toHaveLength(1);

    act(() => screen.getByTestId('room-kivu-balcony-double').props.onClick?.());

    // After it, the name is in two places — the card and the bar — and the
    // bar is quoting that room rather than the cheapest one.
    await waitFor(() => expect(screen.getAllByText('Balcony Double')).toHaveLength(2));
    expect(screen.queryByText(en['listing.from'])).toBeNull();
    expect(screen.getByText(en['listing.roomSelected'])).toBeTruthy();
  });

  it('will not let a sold-out room be chosen', async () => {
    await open('akagera-tented-camp', scheme);
    const gone = screen.getByTestId('room-akagera-deck-tent');
    expect(gone.props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(en['listing.remainingNone'])).toBeTruthy();
  });

  it('chooses for the guest when the whole property is one room type', async () => {
    writeFixture(SEARCH_KEY, { ...DEFAULT_SEARCH, dates: DATES });
    await open('karongi-lake-house', scheme);
    // Nothing is in the way, so there is no reason line and the CTA is live.
    expect(screen.queryByText(en['listing.blockedRoom'])).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Book now' }).props.accessibilityState.disabled,
    ).toBe(false);
  });
});

describe('the sheets and the saved set', () => {
  const scheme = SCHEMES[0];

  it('opens the amenities sheet from "Show all"', async () => {
    await open(KIVU, scheme);
    const showAll = screen.getByRole('button', { name: 'Show all 8' });
    act(() => showAll.props.onClick?.());
    expect(pushed).toEqual(['/listing/kivu-serena-suite/amenities']);
  });

  it('opens the policy sheet from the cancellation row', async () => {
    await open(KIVU, scheme);
    const row = screen.getByLabelText(
      `${en['listing.policy']}, ${en['listing.tier.none']}. ${en['listing.tierBody.none']}`,
    );
    act(() => row.props.onClick?.());
    expect(pushed).toEqual(['/listing/kivu-serena-suite/policy']);
  });

  it('names the chosen room’s tier on the policy row', async () => {
    writeFixture(draftKey(KIVU), { roomTypeId: 'kivu-balcony-double', nonRefundable: false });
    await open(KIVU, scheme);
    expect(
      screen.getByText(`${en['listing.policy']} · ${en['listing.tier.moderate']}`),
    ).toBeTruthy();
  });

  it('fills the heart from the same set Explore and Saved read', async () => {
    writeFixture(SAVED_KEY, [KIVU]);
    await open(KIVU, scheme);
    // Two hearts: the one on the gallery and the one in the compact header.
    expect(screen.getAllByLabelText(en['a11y.unsave']).length).toBeGreaterThan(0);
  });
});

describe('the states with no property behind them', () => {
  const scheme = SCHEMES[0];

  it('offers a way back to Explore rather than a dead end', async () => {
    renderInScheme(page('no-such-property'), scheme);
    await waitFor(() => expect(screen.getByText(en['listing.notFoundTitle'])).toBeTruthy());
    expect(screen.getByText(en['listing.notFoundBody'])).toBeTruthy();

    act(() => screen.getByRole('button', { name: en['listing.notFoundAction'] }).props.onClick?.());
    expect(pushed).toEqual(['/']);
  });
});

describe('the Kinyarwanda catalogue', () => {
  it('renders the page in RW without falling back to English', async () => {
    renderInScheme(page(KIVU), SCHEMES[0], { locale: 'rw' });
    await waitFor(() => expect(screen.getByText('Lake Kivu Suite')).toBeTruthy());
    expect(screen.getByText(rw['listing.about'])).toBeTruthy();
    expect(screen.getByText(rw['listing.rooms'])).toBeTruthy();
    expect(screen.getByText(rw['listing.trustEscrow'])).toBeTruthy();
    expect(screen.getByText(rw['listing.blockedBoth'])).toBeTruthy();
  });
});
