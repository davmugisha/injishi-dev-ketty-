/**
 * The trip screens, rendered.
 *
 * Every screen is mounted in both schemes, which is the floor. Above that,
 * three things are asserted that the pure tests cannot reach:
 *
 *   - **The gate reaches the screen.** `checkInGate` is tested on its own, but
 *     a screen that read it and then drew the wrong branch would still pass
 *     that test. So each of the six answers is rendered and the sentence it
 *     puts on screen is asserted.
 *   - **The empty states are real.** They are unreachable by navigation because
 *     the fixtures fill both segments, so they are exercised here instead, by
 *     emptying the store. Without this they would be branches nobody had run.
 *   - **The arrival guide does not leak.** The screen is rendered on a booking
 *     that is not checked in, and the access code is asserted absent.
 *
 * The router is mocked because these are screens, not routes: `expo-router`'s
 * real hooks need a navigator, and mounting one to assert a sentence would be
 * testing the router.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { computeBreakdown } from '@injishi/contracts';
import { renderInScheme, SCHEMES } from '@/test-utils';
import { DomainProvider } from '@/domain';
import { ToastProvider } from '@/components';
import { resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import * as tripsData from '@/data/trips';
import { TRIPS_KEY, TRIPS, arrivalAt, checkInOpensAt, type Trip } from '@/data/trips';
import { REVIEWS_KEY, TRIP_REVIEW_SEEDS } from '@/data/trip-reviews';
import { en, rw } from '@/i18n/messages';
import { Trips } from './trips';
import { TripDetail } from './trip-detail';
import { TripArrivalGuide } from './trip-arrival-guide';

// `mock`-prefixed, because a `jest.mock` factory may not close over anything else.
const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));

/** Network state is a native module; the screens read two booleans off it. */
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

const ARRIVING = 'BK-4821';
const STAFFED = 'BK-4703';
const EARLY = 'BK-4790';
const AWAITING = 'BK-4655';
const COMPLETED = 'BK-4402';
const REVIEWED = 'BK-4310';
const CANCELLED = 'BK-4266';

function fixture(id: string): Trip {
  const trip = TRIPS.find((t) => t.id === id);
  if (!trip) throw new Error(`no fixture ${id}`);
  return trip;
}

/** Puts one trip, shaped as the caller wants it, in front of the screens. */
function only(trip: Trip): void {
  writeFixture<Trip[]>(TRIPS_KEY, [trip]);
}

/**
 * Trips reads the active workspace for its chip, and the trip screens toast on
 * a copy and on a failed maps hand-off, so both providers are real here rather
 * than mocked — a toast that never mounts is an assertion that silently passes.
 */
const guest = (ui: ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="guest">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

/**
 * Switches to the Past segment. The screen opens on Upcoming, so a past-trip
 * assertion that skipped this would be asserting against rows that are not on
 * screen — and would pass or fail for the wrong reason.
 */
async function showPast(count: number): Promise<void> {
  const tab = await screen.findByLabelText(`${en['trips.tabPast']}, ${count}`);
  fireEvent.press(tab);
}

beforeEach(() => {
  resetFixtures();
  mockPush.mockClear();
  mockReplace.mockClear();
});

/**
 * The cold read, and it has to run FIRST.
 *
 * `useFixture` keeps its warm-key set at module scope, exactly as a query cache
 * does — the first read of a key in a session skeletons and every read after it
 * is instant. That is the behaviour worth having, and it means the skeleton is
 * observable once per module registry, which is once per test file. So this
 * describe sits at the top rather than beside the other list states.
 */
describe('the cold read', () => {
  it('skeletons before any row exists, and counts nothing on the tabs yet', async () => {
    renderInScheme(guest(<Trips />), 'light');
    expect(
      screen.getByLabelText(en['state.loadingList'].replace('{label}', en['trips.listLabel'])),
    ).toBeTruthy();
    // "Upcoming 0" and "Past 0" while the read is in flight are misleading
    // zeros (mobile audit 2026-10-05, GK-23): the tabs carry no count yet.
    expect(screen.getByLabelText(en['trips.tabUpcoming'])).toBeTruthy();
    expect(screen.getByLabelText(en['trips.tabPast'])).toBeTruthy();
    expect(screen.queryByLabelText(`${en['trips.tabUpcoming']}, 0`)).toBeNull();

    // Once it lands, they count.
    await screen.findByLabelText(`${en['trips.tabPast']}, ${tripsData.pastTrips(TRIPS).length}`);
  });
});

describe.each(SCHEMES)('Trips in the %s scheme', (scheme) => {
  it('draws the next stay as the hero, with its countdown and its CTA', async () => {
    renderInScheme(guest(<Trips />), scheme);

    await waitFor(() => expect(screen.getByText(en['trips.heroLabel'])).toBeTruthy());
    expect(screen.getByText(fixture(ARRIVING).property)).toBeTruthy();
    // Arriving today, inside the 24h window: the CTA is the live one.
    expect(screen.getByText(en['trip.startCheckIn'])).toBeTruthy();
  });

  it('lists the rest under the hero rather than repeating it', async () => {
    renderInScheme(guest(<Trips />), scheme);

    await waitFor(() => expect(screen.getByText(en['trips.sectionUpcoming'])).toBeTruthy());
    // The hero's own property appears once, not twice.
    expect(screen.getAllByText(fixture(ARRIVING).property)).toHaveLength(1);
    expect(screen.getByText(fixture(EARLY).property)).toBeTruthy();
  });
});

describe('the Trips list states', () => {
  it('says nothing is booked, with a way out, when upcoming is empty', async () => {
    writeFixture<Trip[]>(TRIPS_KEY, [fixture(COMPLETED)]);
    renderInScheme(guest(<Trips />), 'light');

    await waitFor(() => expect(screen.getByText(en['trips.emptyUpcomingTitle'])).toBeTruthy());
    // An empty upcoming list is a person with nothing booked, not a person who
    // filtered too hard — so the empty state routes to Explore.
    expect(screen.getByText(en['trips.emptyUpcomingAction'])).toBeTruthy();
  });

  it('says something different when the past is empty', async () => {
    writeFixture<Trip[]>(TRIPS_KEY, [fixture(ARRIVING)]);
    const { getByText } = renderInScheme(guest(<Trips />), 'light');

    await waitFor(() => expect(getByText(en['trips.tabPast'])).toBeTruthy());
    // Two facts, two messages: `ui-screens.md` §6 rules out one covering both.
    expect(en['trips.emptyPastTitle']).not.toBe(en['trips.emptyUpcomingTitle']);
  });
});

/**
 * No way into reviews (mobile audit 2026-10-05, GK-11). They are hidden in the
 * v1.0 cut and `trip/[id]/review` is closed for everyone, so a row that pushed
 * it bounced the guest home.
 */
describe('reviews, hidden in v1', () => {
  it('offers no review on a completed stay, even inside the window', async () => {
    only(fixture(COMPLETED));
    renderInScheme(guest(<Trips />), 'light');
    await showPast(1);

    await waitFor(() => expect(screen.getByText(fixture(COMPLETED).property)).toBeTruthy());
    expect(screen.queryByText(en['trips.leaveReview'])).toBeNull();
    expect(screen.queryByText(en['trips.reviewClosed'])).toBeNull();
  });

  it('shows no rating line on a stay that was reviewed', async () => {
    writeFixture<Trip[]>(TRIPS_KEY, [fixture(REVIEWED)]);
    writeFixture(REVIEWS_KEY, TRIP_REVIEW_SEEDS);
    renderInScheme(guest(<Trips />), 'light');
    await showPast(1);

    await waitFor(() => expect(screen.getByText(fixture(REVIEWED).property)).toBeTruthy());
    expect(screen.queryByText(/You rated this stay/)).toBeNull();
  });

  it('still says a cancelled stay was cancelled', async () => {
    only(fixture(CANCELLED));
    renderInScheme(guest(<Trips />), 'light');
    await showPast(1);

    await waitFor(() => expect(screen.getByText(en['trip.cancelledNote'])).toBeTruthy());
    expect(screen.queryByText(en['trips.leaveReview'])).toBeNull();
  });

  it('has no review link on trip detail either', async () => {
    only(fixture(COMPLETED));
    renderInScheme(guest(<TripDetail id={COMPLETED} />), 'light');
    await waitFor(() => expect(screen.getByText(en['trip.arrivalClosed'])).toBeTruthy());
    expect(screen.queryByText(en['trips.leaveReview'])).toBeNull();
  });
});

describe.each(SCHEMES)('Trip detail in the %s scheme', (scheme) => {
  it('draws the facts, the money and the host row', async () => {
    const trip = fixture(ARRIVING);
    renderInScheme(guest(<TripDetail id={trip.id} />), scheme);

    await waitFor(() => expect(screen.getByText(trip.property)).toBeTruthy());
    expect(screen.getByText(trip.confirmation)).toBeTruthy();
    expect(screen.getByText(trip.host.name)).toBeTruthy();
    expect(screen.getByText(en['trip.getDirections'])).toBeTruthy();
    // The adapter mode is printed where the money is, not discovered later.
    expect(screen.getByText(en['trip.mockAdapter'])).toBeTruthy();
  });
});

/** Mobile audit 2026-10-05: the money lines say what they are (GK-15). */
describe('the price on trip detail', () => {
  it('labels the lines as the booking did, not "Nightly rate" or "Service and taxes"', async () => {
    renderInScheme(guest(<TripDetail id={ARRIVING} />), 'light');
    await waitFor(() => expect(screen.getByText(en['book.accommodation'])).toBeTruthy());
    expect(screen.getByText(en['book.fee'])).toBeTruthy();
    expect(screen.queryByText('Nightly rate')).toBeNull();
    expect(screen.queryByText('Service and taxes')).toBeNull();
  });

  it('prints the non-refundable discount, so the lines add up to the total', async () => {
    const base = fixture(ARRIVING);
    const breakdown = computeBreakdown({
      nightlyRateRwf: 145000,
      nights: 3,
      nonRefundable: true,
      guests: 2,
    });
    only({
      ...base,
      breakdown,
      fees: breakdown.serviceFeeRwf,
      total: breakdown.grossRwf,
    });
    renderInScheme(guest(<TripDetail id={ARRIVING} />), 'light');

    await waitFor(() => expect(screen.getByText(en['book.discount'])).toBeTruthy());
    expect(
      breakdown.accommodationRwf - breakdown.nonRefundableDiscountRwf + breakdown.serviceFeeRwf,
    ).toBe(breakdown.grossRwf);
    expect(screen.getByText(breakdown.grossRwf.toLocaleString('en-US'))).toBeTruthy();
  });

  it('promises no reply time under the host (GK-26)', async () => {
    renderInScheme(guest(<TripDetail id={ARRIVING} />), 'light');
    await waitFor(() => expect(screen.getByText(fixture(ARRIVING).host.name)).toBeTruthy());
    expect(screen.queryByText(/answers within an hour/i)).toBeNull();
  });
});

/**
 * A failed read is an error with a retry, never "not found" or "locked", and
 * never the server's raw text (mobile audit 2026-10-05, GK-17 and GB-27).
 */
describe('a trip read that failed', () => {
  const failed = () =>
    jest.spyOn(tripsData, 'useTrip').mockReturnValue({
      trip: undefined,
      status: 'error',
      error: new Error('Not Found'),
      retry: jest.fn(),
    });

  it('on trip detail', async () => {
    const spy = failed();
    try {
      renderInScheme(guest(<TripDetail id={ARRIVING} />), 'light');
      await waitFor(() => expect(screen.getByText(en['state.errorTitle'])).toBeTruthy());
      expect(screen.queryByText('Not Found')).toBeNull();
      expect(screen.getByText(en['state.retry'])).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });

  it('on the arrival guide', async () => {
    const spy = failed();
    try {
      renderInScheme(guest(<TripArrivalGuide id={ARRIVING} />), 'light');
      await waitFor(() => expect(screen.getByText(en['state.errorTitle'])).toBeTruthy());
      expect(screen.queryByText(en['trip.notFound'])).toBeNull();
      expect(screen.getByText(en['state.retry'])).toBeTruthy();
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the arrival-guide gate on trip detail', () => {
  const cases: [string, string, string][] = [
    ['ready', ARRIVING, en['trip.arrivalLocked']],
    ['staffed', STAFFED, en['trip.arrivalStaffed']],
    ['early', EARLY, en['trip.arrivalEarly']],
    ['awaiting', AWAITING, en['trip.arrivalAwaiting']],
    ['closed', COMPLETED, en['trip.arrivalClosed']],
  ];

  it.each(cases)('says the %s sentence', async (_kind, id, sentence) => {
    renderInScheme(guest(<TripDetail id={id} />), 'light');
    await waitFor(() => expect(screen.getByText(sentence)).toBeTruthy());
  });

  it('unlocks once the booking is checked in', async () => {
    only({ ...fixture(ARRIVING), state: 'checked_in' });
    renderInScheme(guest(<TripDetail id={ARRIVING} />), 'light');

    await waitFor(() => expect(screen.getByText(en['trip.arrivalUnlocked'])).toBeTruthy());
    expect(screen.getByText(en['trip.openArrivalGuide'])).toBeTruthy();
  });

  it('offers the check-in CTA only where it can be pressed', async () => {
    renderInScheme(guest(<TripDetail id={STAFFED} />), 'light');
    await waitFor(() => expect(screen.getByText(en['trip.arrivalStaffed'])).toBeTruthy());
    // Staffed: no button at all rather than a disabled one with no way out.
    expect(screen.queryByText(en['trip.startCheckIn'])).toBeNull();
  });
});

describe.each(SCHEMES)('The arrival guide in the %s scheme', (scheme) => {
  it('shows the code, the wifi and the house rules once the stay is open', async () => {
    const trip = { ...fixture(ARRIVING), state: 'checked_in' as const };
    only(trip);
    renderInScheme(guest(<TripArrivalGuide id={trip.id} />), scheme);

    await waitFor(() => expect(screen.getByText(trip.arrival.accessCode)).toBeTruthy());
    expect(screen.getByText(trip.arrival.wifiNetwork)).toBeTruthy();
    expect(screen.getByText(trip.arrival.wifiPassword)).toBeTruthy();
    expect(screen.getByText(en['checkin.guideRules'])).toBeTruthy();
  });
});

describe('the arrival guide as a gate', () => {
  it('refuses to print the code on a booking that is not checked in', async () => {
    // F-B18. This route is only linked from an unlocked trip, but a deep link
    // or a stale back-stack lands here too — so it asks the gate itself.
    const trip = fixture(ARRIVING);
    renderInScheme(guest(<TripArrivalGuide id={trip.id} />), 'light');

    await waitFor(() => expect(screen.getByText(en['checkin.guideLockedTitle'])).toBeTruthy());
    expect(screen.queryByText(trip.arrival.accessCode)).toBeNull();
    expect(screen.queryByText(trip.arrival.wifiPassword)).toBeNull();
  });
});

describe('the check-in window', () => {
  it('opens exactly 24 hours before arrival and not a moment sooner', () => {
    const trip = fixture(ARRIVING);
    expect(arrivalAt(trip) - checkInOpensAt(trip)).toBe(24 * 60 * 60 * 1000);
  });
});

/**
 * The Kinyarwanda pass.
 *
 * Not a translation review — the RW column is a working translation and needs a
 * Kinyarwanda speaker before it ships. What this catches is the two failures a
 * reviewer switching language is actually looking for: a screen that renders
 * English anyway because a key was interpolated by hand, and a string long
 * enough to break the layout. RW runs longer than EN and `ui-rules.md` says
 * nothing may truncate, so the second is the one that bites.
 */
describe('the Kinyarwanda catalogue', () => {
  it('renders the trip screens in RW, not in English', async () => {
    renderInScheme(guest(<Trips />), 'light', { locale: 'rw' });

    await waitFor(() => expect(screen.getByText(rw['trips.heroLabel'])).toBeTruthy());
    expect(screen.getByText(rw['trips.title'])).toBeTruthy();
    expect(screen.getByText(rw['trip.startCheckIn'])).toBeTruthy();
    // The English of the same key must not be on screen beside it.
    expect(screen.queryByText(en['trips.heroLabel'])).toBeNull();
  });

  it('renders trip detail and the arrival guide in RW', async () => {
    const trip = { ...fixture(ARRIVING), state: 'checked_in' as const };
    only(trip);

    const detail = renderInScheme(guest(<TripDetail id={trip.id} />), 'light', { locale: 'rw' });
    await waitFor(() => expect(screen.getByText(rw['trip.arrivalUnlocked'])).toBeTruthy());
    expect(screen.getByText(rw['trip.getDirections'])).toBeTruthy();
    detail.unmount();

    renderInScheme(guest(<TripArrivalGuide id={trip.id} />), 'light', { locale: 'rw' });
    await waitFor(() => expect(screen.getByText(rw['checkin.guideTitle'])).toBeTruthy());
    expect(screen.getByText(rw['checkin.guideRules'])).toBeTruthy();
  });

  it('leaves no key untranslated on the trip screens', () => {
    // A string ending in " (RW)" is one no session had Kinyarwanda for. It is
    // allowed elsewhere and is the audit's work list; these namespaces are
    // Session 5's, so they carry none.
    const mine = Object.keys(en).filter(
      (key) => key.startsWith('trips.') || key.startsWith('trip.') ||
        key.startsWith('checkin.') || key.startsWith('review.'),
    ) as (keyof typeof en)[];

    expect(mine.length).toBeGreaterThan(80);
    for (const key of mine) {
      expect(rw[key]).toBeTruthy();
      expect(rw[key].endsWith(' (RW)')).toBe(false);
    }
  });
});
