/**
 * The four Host screens, rendered in both schemes and in both catalogues.
 *
 * Expo Router is mocked to a router that records where it was told to go. The
 * navigator is not what is under test — the screens' decisions are — and
 * mounting a real one would make this a test of Expo Router.
 *
 * `expo-network` is mocked because the Work surface's store, which the check-in
 * step reads its floor board from, imports it. Its cleanup calls `remove()` on
 * a subscription the native stub never returns, so an unmount throws and the
 * symptom is a pile of unrelated "unmounted component" errors somewhere else
 * entirely. Session 11 should lift this into `jest.setup.js` once every branch
 * has merged; doing it now would change what everyone else's failures mean.
 */
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { resetFixtures } from '@/data/use-fixture-mutation';
import { HOST_BOOKINGS } from './host-fixtures';
import { rowStateOf } from './host-store';
import { todayIso } from '@/components';
import { HostToday } from './today';
import { HostBookingsScreen } from './bookings';
import { HostBookingDetail } from './booking-detail';
import { HostCheckInCapture } from './check-in-capture';

const pushed: unknown[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (href: unknown) => pushed.push(href),
    replace: (href: unknown) => pushed.push(href),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('expo-network', () => ({
  useNetworkState: () => ({ isConnected: true, isInternetReachable: true }),
}));

/**
 * The active seat, as the server answers it.
 *
 * ADR-038 child 0 task 8 moved the workspace off `data/personas.ts`, so the
 * eyebrow this suite asserts is drawn from a server answer now. `@/test-seats`
 * holds the one roster every surface suite shares.
 *
 * Both accessors are supplied on purpose: `DomainProvider` reads the optional
 * form and the screens read the throwing one.
 */
const mockSeatSurface = 'host';

jest.mock('@/workspace', () => {
  const { workspaceStateFor } = jest.requireActual('@/test-seats');
  const state = () => workspaceStateFor(mockSeatSurface);
  return { useWorkspace: state, useOptionalWorkspace: state };
});

const TODAY = todayIso();

/** Every screen on this surface runs inside the host workspace. */
const host = (node: React.ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="host">
    <ToastProvider>{node}</ToastProvider>
  </DomainProvider>
);

const PENDING = HOST_BOOKINGS.find((b) => b.status === 'pending_approval')!;
const ARRIVING = HOST_BOOKINGS.find((b) => rowStateOf(b, TODAY) === 'arriving')!;
const IN_HOUSE = HOST_BOOKINGS.find((b) => rowStateOf(b, TODAY) === 'in_house')!;

beforeEach(() => {
  pushed.length = 0;
  resetFixtures();
});
afterEach(() => resetFixtures());

/**
 * `useFixture` is slow on a cold key, so every test waits for the read.
 *
 * The budget is the full-parallel-suite one, not the quiet-machine one: 4000
 * held in isolation and lost under load, on the first cold mount of the run.
 * See `testTimeout` in `jest.config.js` for why RN 0.86 on React 19.2 renders
 * slowly enough that this is a race and not slack.
 */
/**
 * A hang bound, not a speed assertion. Session 11 raised it from 5s: under a
 * full parallel run this suite was failing HERE rather than on anything it
 * asserts, which made a memory problem look like a screen problem. Jest's own
 * per-test ceiling is 20s and is what should catch a real hang.
 */
const COLD = { timeout: 15000 };

async function open(node: React.ReactElement, scheme: (typeof SCHEMES)[number], locale?: 'rw') {
  const view = renderInScheme(host(node), scheme, locale ? { locale } : undefined);
  await waitFor(() => expect(screen.queryByLabelText(/loading/i)).toBeNull(), COLD);
  return view;
}

describe.each(SCHEMES)('Today in the %s scheme', (scheme) => {
  /**
   * `getAllByText` rather than `getByText`, and that is a fact about the design
   * rather than a loosened assertion: `status.booking.arriving` is also the
   * words "Arriving today", because a booking that reads one way to the guest
   * must read the same way to the host. So the section heading and every badge
   * under it say the same thing, and the heading is not unique text.
   */
  it('groups the day into the four things a desk works', async () => {
    await open(<HostToday />, scheme);
    // The first group heading lands a render after the loading label clears,
    // so this is a second cold wait and takes the same budget, not the 1000ms
    // default — which is the one that lost under the full run.
    await waitFor(() => expect(screen.getByText(en['host.groupRequests'])).toBeTruthy(), COLD);
    expect(screen.getAllByText(en['host.groupArriving']).length).toBeGreaterThan(0);
    expect(screen.getByText(en['host.groupDeparting'])).toBeTruthy();
    expect(screen.getAllByText(en['host.groupInHouse']).length).toBeGreaterThan(0);
  });

  it('names the property the desk belongs to, from the workspace and not a constant', async () => {
    await open(<HostToday />, scheme);
    await waitFor(() =>
      expect(
        screen.getByText(en['host.desk'].replace('{property}', 'Umurage Guesthouse')),
      ).toBeTruthy(),
    );
  });

  it('offers a decision on a request and nothing to decide on a stay in progress', async () => {
    await open(<HostToday />, scheme);
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy());
    // One Approve and one Decline per pending row, and there are two requests.
    expect(screen.getAllByLabelText(en['host.approve'])).toHaveLength(2);
    expect(screen.getAllByLabelText(en['host.decline'])).toHaveLength(2);
  });

  it('approves a request and offers the undo, rather than asking to confirm first', async () => {
    await open(<HostToday />, scheme);
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getAllByLabelText(en['host.approve'])[0]);
    });

    await waitFor(() =>
      expect(
        screen.getByText(en['host.approvedToast'].replace('{guest}', PENDING.guest.name)),
      ).toBeTruthy(),
    );
    // The undo is a control, not a sentence: it has to be reachable.
    expect(screen.getByLabelText(en['host.undo'])).toBeTruthy();
  });

  it('says where a payout is in its dispute buffer', async () => {
    await open(<HostToday />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.payouts'])).toBeTruthy());
    expect(screen.getByText(en['host.payoutsSubtitle'])).toBeTruthy();
  });

  it('names what a phone does not carry rather than leaving a blank', async () => {
    await open(<HostToday />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.tapeChartTitle'])).toBeTruthy());
    expect(screen.getByText(en['host.walkInTitle'])).toBeTruthy();
  });

  it('carries the mock adapter line wherever money is', async () => {
    await open(<HostToday />, scheme);
    await waitFor(() => expect(screen.getAllByText(en['host.mockAdapter']).length).toBeGreaterThan(0));
  });
});

describe.each(SCHEMES)('Bookings in the %s scheme', (scheme) => {
  it('lists every booking under All, including the declined one', async () => {
    await open(<HostBookingsScreen />, scheme);
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy());
    const declined = HOST_BOOKINGS.find((b) => b.status === 'declined')!;
    expect(screen.getByText(declined.guest.name)).toBeTruthy();
  });

  it('narrows to a guest by name', async () => {
    await open(<HostBookingsScreen />, scheme);
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('host-search'), PENDING.guest.name);

    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy());
    const other = HOST_BOOKINGS.find((b) => b.id !== PENDING.id)!;
    expect(screen.queryByText(other.guest.name)).toBeNull();
  });

  it('says what it searched when nothing matches, and offers the way back', async () => {
    await open(<HostBookingsScreen />, scheme);
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('host-search'), 'zzzzz');

    await waitFor(() =>
      expect(screen.getByText(en['host.emptySearch'].replace('{query}', 'zzzzz'))).toBeTruthy(),
    );
    expect(screen.getByText(en['host.emptySearchBody'])).toBeTruthy();
    // Two ways out, both named the same thing on purpose: the clear control
    // inside the field, and the button in the empty state for a reader who
    // never looked back up at the field.
    expect(screen.getAllByLabelText(en['host.clearSearch']).length).toBeGreaterThan(0);
  });
});

describe.each(SCHEMES)('the booking detail in the %s scheme', (scheme) => {
  it('prints the stay, the money and what the host actually keeps', async () => {
    await open(<HostBookingDetail id={IN_HOUSE.id} />, scheme);
    await waitFor(() => expect(screen.getByText(IN_HOUSE.guest.name)).toBeTruthy());

    expect(screen.getByText(en['host.stay'])).toBeTruthy();
    expect(screen.getByText(en['host.money'])).toBeTruthy();
    // F-B12: the host's share is the accommodation, with nothing deducted, and
    // the screen says so rather than leaving the absence to be inferred.
    expect(screen.getByText(en['host.yourShare'])).toBeTruthy();
    expect(screen.getByText(en['host.noCommission'])).toBeTruthy();
  });

  it('offers checkout for a stay in progress and check-in for one at the door', async () => {
    await open(<HostBookingDetail id={IN_HOUSE.id} />, scheme);
    await waitFor(() => expect(screen.getByLabelText(en['host.checkOut'])).toBeTruthy());

    screen.unmount();

    await open(<HostBookingDetail id={ARRIVING.id} />, scheme);
    await waitFor(() => expect(screen.getByLabelText(en['host.checkIn'])).toBeTruthy());
  });

  it('shows the request countdown and the rule behind it', async () => {
    await open(<HostBookingDetail id={PENDING.id} />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.expiryRule'])).toBeTruthy());
  });

  it('says where the folio is rather than showing an empty one', async () => {
    await open(<HostBookingDetail id={IN_HOUSE.id} />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.folioTitle'])).toBeTruthy());
  });

  it('has a way back when the reference resolves to nothing', async () => {
    await open(<HostBookingDetail id="BK-NOPE" />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.notFoundTitle'])).toBeTruthy());
    expect(screen.getByLabelText(en['host.notFoundAction'])).toBeTruthy();
  });
});

describe.each(SCHEMES)('the check-in capture in the %s scheme', (scheme) => {
  it('opens on the document, prefilled from the booking', async () => {
    await open(<HostCheckInCapture id={ARRIVING.id} />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.identityTitle'])).toBeTruthy());
    expect(screen.getByDisplayValue(ARRIVING.guest.name)).toBeTruthy();
  });

  it('will not leave the first step until the document has a valid number', async () => {
    await open(<HostCheckInCapture id={ARRIVING.id} />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.identityTitle'])).toBeTruthy());

    // A disabled control always carries its reason (design brief §7.5).
    expect(screen.getByText(en['host.blockedNumber'])).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('host-capture-number'), '123');
    await waitFor(() => expect(screen.getByText(en['host.blockedNid'])).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('host-capture-number'), '1199780012345678');
    await waitFor(() => expect(screen.queryByText(en['host.blockedNid'])).toBeNull());
  });

  it('refuses a booking that is not waiting at the door', async () => {
    await open(<HostCheckInCapture id={IN_HOUSE.id} />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.checkInClosedTitle'])).toBeTruthy());
  });
});

describe('the Kinyarwanda catalogue', () => {
  it('renders Today with the rw catalogue active', async () => {
    await open(<HostToday />, 'light', 'rw');
    await waitFor(() => expect(screen.getByText(rw['host.groupRequests'])).toBeTruthy());
    expect(screen.getByText(rw['host.groupArriving'])).toBeTruthy();
    // The counts are the same chips, in the other language.
    expect(screen.getByText(rw['host.countRequests'])).toBeTruthy();
  });

  it('renders Bookings with the rw catalogue active', async () => {
    await open(<HostBookingsScreen />, 'dark', 'rw');
    await waitFor(() => expect(screen.getByText(rw['host.filterPending'])).toBeTruthy());
  });
});
