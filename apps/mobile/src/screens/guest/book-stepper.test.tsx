/**
 * The booking stepper, rendered.
 *
 * Expo Router is mocked to a router that records where it was told to go. The
 * navigator is not what is under test — the stepper's decisions are.
 *
 * The substantive assertions are the three things this screen can mislead a
 * guest about: whether the primary action is available and why not, whether the
 * draft survives going back a step, and whether the money on the bar is the
 * money the contract computed.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import { MAX_NIGHTS } from '@injishi/contracts';
import { ToastProvider } from '@/components';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { resetFixtures, readFixture, writeFixture } from '@/data/use-fixture-mutation';
import { DEFAULT_SEARCH, SEARCH_KEY } from '@/data/search';
import { draftKey } from '@/data/booking-draft';
import { getStayDetail } from '@/data/property-detail';
import { TRIPS, TRIPS_KEY, type Trip } from '@/data/trips';
import { bookDraftKey, quoteSignature, type BookDraft } from './book-draft';
// The attempt journal is module-level and outlives a test on purpose — that is
// what "survives backgrounding and app kill" means — so a test file clears it,
// or the second press on the same quote finds the first test's settled attempt.
import { resetAttempts } from '@/data/payment-attempt';
import { BookStepperScreen } from './book-stepper';

const pushed: unknown[] = [];
const replaced: unknown[] = [];
const backs = { count: 0 };

/**
 * The network, controllable.
 *
 * `expo-network`'s own `useNetworkState` cannot be rendered under the test
 * renderer: its cleanup calls `listener.remove()` on a subscription the native
 * stub does not return, and every unmount throws. Mocking it is also what lets
 * the offline gate be asserted rather than assumed — see the last block.
 */
const network: { isConnected: boolean | undefined; isInternetReachable: boolean | undefined } = {
  isConnected: true,
  isInternetReachable: true,
};

jest.mock('expo-network', () => ({
  useNetworkState: () => network,
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (href: unknown) => pushed.push(href),
    replace: (href: unknown) => replaced.push(href),
    back: () => {
      backs.count += 1;
    },
  }),
  useLocalSearchParams: () => ({}),
}));

const UMURAGE = getStayDetail('umurage-guesthouse')!;
const GARDEN = UMURAGE.rooms.find((r) => r.summary.bookingMode === 'instant_book')!;
const REQUEST = UMURAGE.rooms.find((r) => r.summary.bookingMode === 'request_to_book')!;

const DATES = { checkIn: '2026-09-04', checkOut: '2026-09-07' };

/**
 * Trips this test booked, never the seeded ones. The seeds are dated relative
 * to today (`offsetDays`), so matching on `DATES.checkIn` found a seed on the
 * one day its offset landed there: on 2026-09-13, `BK-4402` at minus nine days
 * read as a second booking. Excluding seeds by id holds on every date.
 */
const SEEDED_TRIP_IDS = new Set(TRIPS.map((trip) => trip.id));
const bookedTrips = () =>
  readFixture<Trip[]>(TRIPS_KEY, []).filter((trip) => !SEEDED_TRIP_IDS.has(trip.id));

beforeEach(() => {
  pushed.length = 0;
  replaced.length = 0;
  backs.count = 0;
  network.isConnected = true;
  network.isInternetReachable = true;
  resetFixtures();
  resetAttempts();
  writeFixture(SEARCH_KEY, DEFAULT_SEARCH);
});
afterEach(() => resetFixtures());

const page = (props: Parameters<typeof BookStepperScreen>[0]) => (
  <ToastProvider>
    <BookStepperScreen {...props} />
  </ToastProvider>
);

/** `useFixture` is slow on a cold key, so every test waits for the read. */
async function open(
  props: Parameters<typeof BookStepperScreen>[0],
  scheme: (typeof SCHEMES)[number] = 'light',
  locale?: 'en' | 'rw',
) {
  const view = renderInScheme(page(props), scheme, locale ? { locale } : undefined);
  await waitFor(() => expect(screen.getByTestId('book-primary')).toBeTruthy());
  return view;
}

function draftOf(roomTypeId: string): BookDraft {
  return readFixture<BookDraft>(bookDraftKey(roomTypeId), {} as BookDraft);
}

describe.each(SCHEMES)('the booking stepper in %s', (scheme) => {
  it('opens on step 1 with the room, the property and the rate', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES }, scheme);

    expect(screen.getByText(en['book.step1'])).toBeTruthy();
    expect(screen.getByText(UMURAGE.stay.title)).toBeTruthy();
    // The room and place line, and the three party steppers.
    expect(screen.getByText(en['search.adults'])).toBeTruthy();
    expect(screen.getByText(en['search.infants'])).toBeTruthy();
  });
});

describe('the gate on each step', () => {
  it('lets step 1 through once the route hands it dates', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    // The reason line is absent, so the CTA is live.
    expect(screen.queryByText(en['book.blockedDates'])).toBeNull();
    expect(screen.getByText(en['book.continue'])).toBeTruthy();
  });

  it('asks for dates, in a sentence, when the guest arrives without any', async () => {
    await open({ roomTypeId: GARDEN.summary.id });
    expect(screen.getByText(en['book.blockedDates'])).toBeTruthy();
  });

  it('holds step 2 until the house rules are ticked, then releases it', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });

    fireEvent.press(screen.getByTestId('book-primary'));
    await waitFor(() => expect(screen.getByText(en['book.step2'])).toBeTruthy());

    expect(screen.getByText(en['book.blockedRules'])).toBeTruthy();

    fireEvent.press(screen.getByTestId('book-accept-rules'));
    await waitFor(() => expect(screen.queryByText(en['book.blockedRules'])).toBeNull());
    expect(screen.getByText(en['book.continueToPay'])).toBeTruthy();
  });

  it('asks for the handset on step 3 and takes an MTN number', async () => {
    writeFixture<BookDraft>(bookDraftKey(GARDEN.summary.id), {
      ...(draftOf(GARDEN.summary.id) as BookDraft),
      step: 2,
      dates: { start: DATES.checkIn, end: DATES.checkOut },
      party: { adults: 2, children: 0, infants: 0 },
      acceptedRules: true,
      method: 'momo',
      handset: '',
      attemptToken: null,
      tokenFor: null,
      bookingId: null,
    });

    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    // The step title and the CTA carry the same words on this step, as the
    // canvas draws them, so both match.
    expect(screen.getAllByText(en['book.step3']).length).toBeGreaterThan(0);
    expect(screen.getByText(en['book.blockedHandset'])).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('book-handset-momo'), '0788431209');
    await waitFor(() => expect(screen.queryByText(en['book.blockedHandset'])).toBeNull());
  });
});

describe('the draft', () => {
  it('survives going back a step', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });

    // Forward to step 2, tick the rules, then back to step 1 and forward again.
    fireEvent.press(screen.getByTestId('book-primary'));
    await waitFor(() => expect(screen.getByText(en['book.step2'])).toBeTruthy());
    fireEvent.press(screen.getByTestId('book-accept-rules'));
    await waitFor(() => expect(draftOf(GARDEN.summary.id).acceptedRules).toBe(true));

    fireEvent.press(screen.getByTestId('book-back'));
    await waitFor(() => expect(screen.getByText(en['book.step1'])).toBeTruthy());

    fireEvent.press(screen.getByTestId('book-primary'));
    await waitFor(() => expect(screen.getByText(en['book.step2'])).toBeTruthy());

    // The tick is still there, and so are the dates.
    expect(screen.queryByText(en['book.blockedRules'])).toBeNull();
    expect(draftOf(GARDEN.summary.id).dates).toEqual({
      start: DATES.checkIn,
      end: DATES.checkOut,
    });
  });

  it('leaves the screen only from step 1', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    fireEvent.press(screen.getByTestId('book-back'));
    expect(backs.count).toBe(1);
  });
});

describe('the money', () => {
  it('puts the contract total on the bar at step 2', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    fireEvent.press(screen.getByTestId('book-primary'));
    await waitFor(() => expect(screen.getByText(en['book.step2'])).toBeTruthy());

    // Garden Suite, 240,000 per guest per night x 2 guests x 3 nights, plus the
    // 5% guest service fee.
    expect(screen.getAllByText('1,512,000').length).toBeGreaterThan(0);
    expect(screen.getByText(en['book.fee'])).toBeTruthy();
  });

  it('shows the running accommodation on step 1 and labels it as not the total', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    expect(screen.getByText(en['book.runningTotal'])).toBeTruthy();
    expect(screen.getByText(en['book.beforeFees'])).toBeTruthy();
  });

  /**
   * Per guest per night (GK-14). Step 1's card printed `rate × nights` while
   * the bar under it carried the per-person gross, about 2.1 times apart for
   * the default two. Both are now the contract's accommodation figure.
   */
  it('prices step 1 as rate × guests × nights, and the bar says the same', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    // Garden Suite: 240,000 per guest per night, 2 guests, 3 nights.
    expect(screen.getByText('RWF 240,000 × 2 guests × 3 nights')).toBeTruthy();
    expect(screen.getAllByText('1,440,000').length).toBe(2);
    expect(screen.queryByText('1,512,000')).toBeNull();
  });

  it('names the guests on step 2’s accommodation line', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    fireEvent.press(screen.getByTestId('book-primary'));
    await waitFor(() => expect(screen.getByText(en['book.step2'])).toBeTruthy());
    expect(screen.getByText('RWF 240,000 × 2 guests × 3 nights')).toBeTruthy();
  });

  /**
   * The bar is one accessible element, so its label is all a screen-reader
   * user hears. "Total" alone hid the price right up to the payment (GK-18).
   */
  it('speaks the amount on the bar, not just its label', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    // Read off the bar itself: the breakdown's own total row may carry the
    // same words, and it is the BAR this is about.
    expect(screen.getByTestId('book-bar-total').props.accessibilityLabel).toBe(
      `${en['book.runningTotal']}, RWF 1,440,000`,
    );

    fireEvent.press(screen.getByTestId('book-primary'));
    await waitFor(() => expect(screen.getByText(en['book.step2'])).toBeTruthy());
    expect(screen.getByTestId('book-bar-total').props.accessibilityLabel).toBe(
      `${en['book.totalLabel']}, RWF 1,512,000`,
    );
  });

  it('refuses a stay longer than MAX_NIGHTS, and says so with the number (GK-30)', async () => {
    await open({ roomTypeId: GARDEN.summary.id, checkIn: '2026-11-01', checkOut: '2027-02-15' });
    expect(
      screen.getByText(en['book.blockedTooLong'].replace('{count}', String(MAX_NIGHTS))),
    ).toBeTruthy();
  });
});

describe('the booking mode', () => {
  it('says "Confirm and pay" for an instant-book room', async () => {
    writeFixture<BookDraft>(bookDraftKey(GARDEN.summary.id), {
      ...draftOf(GARDEN.summary.id),
      step: 2,
      dates: { start: DATES.checkIn, end: DATES.checkOut },
      party: { adults: 2, children: 0, infants: 0 },
      acceptedRules: true,
      method: 'momo',
      handset: '0788431209',
      attemptToken: null,
      tokenFor: null,
      bookingId: null,
    });
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    // Two nodes: the step heading and the button, which the canvas gives the
    // same words. The button is the one carrying the test id.
    expect(screen.getAllByText(en['book.confirmAndPay'])).toHaveLength(2);
  });

  it('says "Request and pay" for a request-to-book room, and warns about the hold', async () => {
    writeFixture<BookDraft>(bookDraftKey(REQUEST.summary.id), {
      ...draftOf(REQUEST.summary.id),
      step: 2,
      dates: { start: DATES.checkIn, end: DATES.checkOut },
      party: { adults: 2, children: 0, infants: 0 },
      acceptedRules: true,
      method: 'momo',
      handset: '0788431209',
      attemptToken: null,
      tokenFor: null,
      bookingId: null,
    });
    await open({ roomTypeId: REQUEST.summary.id, ...DATES });
    expect(screen.getByText(en['book.requestAndPay'])).toBeTruthy();
    expect(screen.getByText(en['book.requestNote'])).toBeTruthy();
  });
});

/**
 * Confirming, since gaps.md B1.
 *
 * The checkout no longer waits 1.2 seconds and routes to a confirmation. Both
 * Rwandan rails answer OUT OF THE APP, so a press starts an attempt and the
 * Trip is minted only when the rail confirms - a booking written before the
 * money settled is a reservation nobody paid for.
 *
 * ## Why these tests pin the token
 *
 * `settle()` seeds its outcome from the attempt token, deliberately: one press
 * always settles the same way, so a re-check of that press cannot roll a
 * different answer. That makes the OUTCOME a function of the token, and a test
 * that let the app mint a random one would be a test whose result depends on a
 * UUID. So each test names the token it wants, and therefore the branch it is
 * about - the same property the design exists for, used from the other side.
 */
const TOKENS = {
  // Computed from `settle()`'s own hash, in `data/payment-attempt.ts`.
  confirmed: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000000',
  refused: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000020',
  unknown: 'aaaaaaaa-bbbb-4ccc-8ddd-000000000030',
};

describe('confirming', () => {
  /** Step 3, complete, ready to press. `token` picks the rail's answer. */
  function ready(roomTypeId: string, token: string | null = null) {
    const signature = quoteSignature({
      roomTypeId,
      dates: { start: DATES.checkIn, end: DATES.checkOut },
      party: { adults: 2, children: 0, infants: 0 },
      nonRefundable: false,
    });
    writeFixture<BookDraft>(bookDraftKey(roomTypeId), {
      step: 2,
      dates: { start: DATES.checkIn, end: DATES.checkOut },
      party: { adults: 2, children: 0, infants: 0 },
      acceptedRules: true,
      method: 'momo',
      handset: '0788431209',
      attemptToken: token,
      tokenFor: token ? signature : null,
      bookingId: null,
    });
  }

  it('sends a prompt and writes NOTHING until the rail answers', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.confirmed);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // Never a bare spinner. The state names the handset the prompt went to
      // and says the PIN is entered there, not here (benchmarks.md section 4).
      expect(screen.getByText(en['pay.checkYourPhone'])).toBeTruthy();
      // And no Trip yet: a booking written before the money settled is a
      // reservation nobody paid for.
      expect(bookedTrips()).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('writes the trip and shows the reference once the rail confirms', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.confirmed);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.press(screen.getByTestId('book-primary'));
      // The rail answers at RAIL_MS, and only THEN does the local write start
      // its own MUTATION_LATENCY_MS. Two waits, not one sum: the booking is
      // minted after the confirmation rather than beside it.
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const draft = draftOf(GARDEN.summary.id);
      expect(draft.attemptToken).toBe(TOKENS.confirmed);
      expect(draft.bookingId).toMatch(/^BK-/);

      const trips = readFixture<Trip[]>(TRIPS_KEY, []);
      const made = trips.find((trip) => trip.id === draft.bookingId);
      expect(made).toBeDefined();
      expect(made?.state).toBe('confirmed');
      expect(made?.total).toBe(1_512_000);

      // The reference is the deliverable on an async rail: it is the only thing
      // a guest can act on afterwards.
      expect(screen.getByText(en['pay.reference'].toUpperCase())).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('names the refusal and its next action rather than only reporting failure', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.refused);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });

      expect(screen.getByText(en['pay.refusedTitle'])).toBeTruthy();
      // ui-rules.md bans a raw error, and a state that only describes itself
      // is one. Every terminal state carries its next action as a button.
      expect(screen.getByText(en['pay.tryAgain'])).toBeTruthy();
      // And nothing was booked.
      expect(bookedTrips()).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('never claims either outcome while the rail has not answered', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.unknown);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });

      // data-seam.md section 4: unknown is the default, not an error. It offers
      // to check again, tells the guest not to pay twice, and claims nothing.
      expect(screen.getByText(en['pay.stillConfirming'])).toBeTruthy();
      expect(screen.getByText(en['pay.checkAgain'])).toBeTruthy();
      expect(screen.queryByText(en['pay.confirmedTitle'])).toBeNull();
      expect(screen.queryByText(en['pay.refusedTitle'])).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  /**
   * While the prompt is out, back and the pay step's edits are locked, so the
   * quote cannot move under a live payment and hide it (GK-13).
   */
  it('locks back and the payment fields while a prompt is out', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.unknown);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      expect(screen.getByText(en['pay.checkYourPhone'])).toBeTruthy();

      const back = screen.getByTestId('book-back');
      expect(back.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(back);
      expect(draftOf(GARDEN.summary.id).step).toBe(2);
      expect(screen.getByTestId('book-handset-momo').props.editable).toBe(false);

      // Still out with the rail after it answers "unknown": still locked.
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      expect(screen.getByText(en['pay.stillConfirming'])).toBeTruthy();
      expect(screen.getByTestId('book-back').props.accessibilityState.disabled).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps an open prompt on screen when the quote moves under it', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.unknown);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(100);
      });

      // The non-refundable switch flipped from the policy sheet, another route.
      act(() => {
        writeFixture(draftKey(UMURAGE.property.id), {
          roomTypeId: GARDEN.summary.id,
          nonRefundable: true,
        });
      });
      // The attempt is still drawn: a payment in flight never vanishes.
      expect(screen.getByText(en['pay.checkYourPhone'])).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('names only *182# for MTN, as text, and no Airtel code (GK-19)', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.unknown);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      expect(screen.getByText(/Dial \*182# on/)).toBeTruthy();
      expect(screen.queryByText(/\*182\*7\*1#/)).toBeNull();
      expect(en['pay.ussdAirtel']).not.toMatch(/[*#]/);
    } finally {
      jest.useRealTimers();
    }
  });

  it('announces a change of payment state on iOS, where the live region is silent (GK-18)', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const realPlatform = Platform.OS;
    Platform.OS = 'ios';
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.refused);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      expect(announce).toHaveBeenCalledWith(
        en['pay.a11yState'].replace('{state}', en['pay.checkYourPhone']),
      );

      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      expect(announce).toHaveBeenCalledWith(
        en['pay.a11yState'].replace('{state}', en['pay.refusedTitle']),
      );
    } finally {
      jest.useRealTimers();
      Platform.OS = realPlatform;
      announce.mockRestore();
    }
  });

  /**
   * GK-12. A draft that outlived its booking reopened the next booking of the
   * same room at "Confirm and pay" with the old dates. Continuing past the
   * reference clears it, so the next open starts from its own params.
   */
  it('clears the draft once booked, so the next booking of the room starts fresh', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.confirmed);
      const first = renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      const bookingId = draftOf(GARDEN.summary.id).bookingId;
      expect(bookingId).toMatch(/^BK-/);
      fireEvent.press(screen.getByText(en['book.continue']));

      expect(replaced).toContainEqual({
        pathname: '/book/[roomTypeId]/confirmed',
        params: { roomTypeId: GARDEN.summary.id, bookingId },
      });
      expect(readFixture(bookDraftKey(GARDEN.summary.id), 'untouched')).toBeNull();
      first.unmount();

      // The same room, booked again for other nights: step 1, the new dates.
      renderInScheme(
        page({ roomTypeId: GARDEN.summary.id, checkIn: '2026-11-10', checkOut: '2026-11-12' }),
        'light',
      );
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(screen.getByText(en['book.step1'])).toBeTruthy();
      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(50);
      });
      expect(draftOf(GARDEN.summary.id).dates).toEqual({ start: '2026-11-10', end: '2026-11-12' });
      expect(draftOf(GARDEN.summary.id).bookingId).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  /**
   * Brief item 1. The Trip is written after the rail confirms; a write that
   * did not land must not route to a confirmation of a booking that does not
   * exist. It says so, keeps the reference in view, and retries.
   */
  it('says the booking did not save when the write fails, and retries it', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.confirmed);
      // A store the booking write cannot apply to: the write ends in `error`.
      writeFixture<Trip[] | null>(TRIPS_KEY, null);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      fireEvent.press(screen.getByTestId('book-primary'));
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      expect(screen.getByText(en['book.saveFailedTitle'])).toBeTruthy();
      expect(draftOf(GARDEN.summary.id).bookingId).toBeNull();
      // No way on to a confirmation of nothing.
      expect(screen.queryByText(en['book.continue'])).toBeNull();

      // The store recovers, and the retry writes the booking.
      writeFixture<Trip[]>(TRIPS_KEY, TRIPS);
      fireEvent.press(screen.getByText(en['write.retry']));
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      expect(draftOf(GARDEN.summary.id).bookingId).toMatch(/^BK-/);
      expect(screen.queryByText(en['book.saveFailedTitle'])).toBeNull();
      expect(bookedTrips()).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('holds one token across two presses of the same quote', async () => {
    jest.useFakeTimers();
    try {
      ready(GARDEN.summary.id, TOKENS.confirmed);
      renderInScheme(page({ roomTypeId: GARDEN.summary.id, ...DATES }), 'light');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });

      // Two presses in the same tick: the second must not start a second
      // attempt, which is what would become a second charge.
      fireEvent.press(screen.getByTestId('book-primary'));
      fireEvent.press(screen.getByTestId('book-primary'));
      // The rail answers at RAIL_MS, and only THEN does the local write start
      // its own MUTATION_LATENCY_MS. Two waits, not one sum: the booking is
      // minted after the confirmation rather than beside it.
      await act(async () => {
        jest.advanceTimersByTime(1500);
      });
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });

      // One token, therefore one attempt, therefore one Trip. Two tokens here
      // would be two charges, which is what ADR-020 D-c exists to prevent.
      expect(draftOf(GARDEN.summary.id).attemptToken).toBe(TOKENS.confirmed);
      expect(bookedTrips()).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('a room that is not there', () => {
  it('offers the way back to Explore rather than a dead end', async () => {
    renderInScheme(page({ roomTypeId: 'no-such-room' }), 'light');
    await waitFor(() => expect(screen.getByText(en['book.notFoundTitle'])).toBeTruthy());
    expect(screen.getByText(en['book.notFoundAction'])).toBeTruthy();
  });
});

describe('the Kinyarwanda catalogue', () => {
  it('renders step 1 with no English left on it', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES }, 'light', 'rw');
    expect(screen.getByText(rw['book.step1'])).toBeTruthy();
    expect(screen.getByText(rw['book.runningTotal'])).toBeTruthy();
    expect(screen.queryByText(en['book.step1'])).toBeNull();
  });
});

describe('the policy row', () => {
  it('reopens Session 3 sheet rather than restating the tier', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    fireEvent.press(screen.getByTestId('book-primary'));
    await waitFor(() => expect(screen.getByText(en['book.step2'])).toBeTruthy());

    fireEvent.press(screen.getByTestId('book-policy-row'));
    expect(pushed).toContainEqual({
      pathname: '/listing/[id]/policy',
      params: { id: UMURAGE.property.id },
    });
  });

  it('shares the non-refundable switch with that sheet', async () => {
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    fireEvent.press(screen.getByTestId('book-primary'));
    await waitFor(() => expect(screen.getByText(en['book.step2'])).toBeTruthy());

    fireEvent.press(screen.getByTestId('book-non-refundable'));

    // The write lands on Session 3's per-property draft, not on a copy here,
    // so the sheet and this screen can never disagree about what is on.
    await waitFor(() =>
      expect(readFixture(draftKey(UMURAGE.property.id), { nonRefundable: false })).toMatchObject({
        nonRefundable: true,
      }),
    );
    expect(screen.getByText(en['book.discount'])).toBeTruthy();
  });
});

describe('offline', () => {
  /** Step 3, complete but for the connection. */
  function atPayment() {
    writeFixture<BookDraft>(bookDraftKey(GARDEN.summary.id), {
      step: 2,
      dates: { start: DATES.checkIn, end: DATES.checkOut },
      party: { adults: 2, children: 0, infants: 0 },
      acceptedRules: true,
      method: 'momo',
      handset: '0788431209',
      attemptToken: null,
      tokenFor: null,
      bookingId: null,
    });
  }

  it('blocks the payment and says why, keeping the draft', async () => {
    atPayment();
    network.isInternetReachable = false;
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });

    expect(screen.getByText(en['book.blockedOffline'])).toBeTruthy();
    // Pressing does nothing: no trip is written and nothing is routed to.
    fireEvent.press(screen.getByTestId('book-primary'));
    expect(replaced).toHaveLength(0);
  });

  it('never blocks the steps that are purely local', async () => {
    // The canvas rule: offline is a state and does not block work. Choosing
    // dates and reading a price need no connection, so step 1 carries on.
    network.isInternetReachable = false;
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    expect(screen.queryByText(en['book.blockedOffline'])).toBeNull();
    expect(screen.getByText(en['book.continue'])).toBeTruthy();
  });

  it('does not call an unresolved network reading offline', async () => {
    // Both flags are undefined until the first read lands; treating that as
    // offline would block the button on every cold open.
    atPayment();
    network.isConnected = undefined;
    network.isInternetReachable = undefined;
    await open({ roomTypeId: GARDEN.summary.id, ...DATES });
    expect(screen.queryByText(en['book.blockedOffline'])).toBeNull();
  });
});
