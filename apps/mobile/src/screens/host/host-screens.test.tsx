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
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { readFixture, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { readQueue, resetQueue } from '@/data/write-queue';
import { TASKS_KEY } from '@/screens/work/work-store';
import { HOST_BOOKINGS, type HostBooking } from './host-fixtures';
import {
  HOST_BOOKINGS_KEY,
  HOST_CAPTURES_KEY,
  HOST_PAYOUTS_KEY,
  rowStateOf,
  useHostActions,
  type HostActions,
} from './host-store';
import { todayIso } from '@/components';
import { HostToday } from './today';
import { HostBookingsScreen } from './bookings';
import { HostBookingDetail, lastFour } from './booking-detail';
import { HostCheckInCapture, captureDraftKey, type CaptureDraft } from './check-in-capture';

const pushed: unknown[] = [];

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: (href: unknown) => pushed.push(href),
    replace: (href: unknown) => pushed.push(href),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

/** Mutable, so a test can take the desk offline. Read at call time, not at mock time. */
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({
  useNetworkState: () => mockNetwork,
}));

/**
 * Forces the next fixture writes to fail (mobile audit 2026-10-05, HO-20).
 *
 * The fixture store cannot fail on its own, which is exactly how the §0.3
 * defect survived: no test could make a write come back `error`, so none saw
 * a failed check-in toast its success. This wraps the real hook and swaps its
 * `mutate` for one that answers `error` while `fail` is set.
 */
const mockWrites = { fail: false };
jest.mock('@/data/use-fixture-mutation', () => {
  const actual = jest.requireActual('@/data/use-fixture-mutation');
  return {
    ...actual,
    useFixtureMutation: (...args: unknown[]) => {
      const real = actual.useFixtureMutation(...args);
      return {
        ...real,
        mutate: async (input: unknown) => (mockWrites.fail ? 'error' : real.mutate(input)),
      };
    },
  };
});

/**
 * Forces a fixture READ to fail, by key, until its retry is pressed (HO-19).
 * The real hook always runs, so the hooks a screen calls never change order.
 */
const mockFailedReads = new Set<string>();
jest.mock('@/data/use-fixture', () => {
  const actual = jest.requireActual('@/data/use-fixture');
  return {
    ...actual,
    useFixture: (key: string, read: () => unknown) => {
      const real = actual.useFixture(key, read);
      if (!mockFailedReads.has(key)) return real;
      return {
        ...real,
        status: 'error',
        data: undefined,
        error: new Error('read failed'),
        retry: () => {
          mockFailedReads.delete(key);
          real.retry();
        },
      };
    },
  };
});

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
afterEach(() => {
  resetFixtures();
  resetQueue();
  mockWrites.fail = false;
  mockFailedReads.clear();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
});

/** No signal, as `useOffline()` reads it. */
function goOffline() {
  mockNetwork.isConnected = false;
  mockNetwork.isInternetReachable = false;
}

/** A booking as the store holds it now, after whatever the test wrote. */
function stored(id: string): HostBooking | undefined {
  return readFixture<HostBooking[]>(HOST_BOOKINGS_KEY, [...HOST_BOOKINGS]).find((b) => b.id === id);
}

/** A capture on its last step with everything filled in, ready to commit. */
function readyToCheckIn(booking: HostBooking) {
  writeFixture<CaptureDraft>(captureDraftKey(booking.id), {
    step: 2,
    fullName: booking.guest.name,
    documentType: 'national_id',
    documentNumber: '1199780012345678',
    photos: [{ uri: 'file:///id-front.jpg', width: 1200, height: 800 }],
    room: '301',
  });
}

/** The toast's own words, with the guest put in. */
const said = (key: keyof typeof en, values: Record<string, string>) =>
  Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, v), en[key] as string);

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

/**
 * The wait after a press: a 300ms fixture write and the renders around it.
 * Above the 1000ms default, which a loaded machine can lose, and low enough
 * that a test with two cold waits and two of these stays under the 60s
 * `testTimeout` (see `jest.config.js` before raising either).
 */
const SETTLE = { timeout: 8000 };

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

  it('carries the no-real-money line wherever money is', async () => {
    await open(<HostToday />, scheme);
    await waitFor(() => expect(screen.getAllByText(en['host.mockAdapter']).length).toBeGreaterThan(0));
    // Plain words, not a "mock adapter" this desk never reaches.
    expect(screen.queryByText(/mock adapter/i)).toBeNull();
  });

  it('prints the date alone and no checkout time it never read (HO-16)', async () => {
    await open(<HostToday />, scheme);
    await waitFor(() => expect(screen.getByText(en['host.groupDeparting'])).toBeTruthy(), COLD);
    expect(screen.queryByText(/Africa\/Kigali/)).toBeNull();
    expect(screen.queryByText(/Checkout by/)).toBeNull();
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

/* ------------------------------------------- writes that fail, queue or are refused */

/**
 * Every Host write, forced to fail, queued or refused offline (mobile audit
 * 2026-10-05, HO-06, HO-10, HO-20). Light scheme only: what is under test is
 * which branch each outcome takes, and no colour changes that.
 */
describe('a decision that does not land', () => {
  it('says an approval did not save, and offers no undo', async () => {
    mockWrites.fail = true;
    await open(<HostToday />, 'light');
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy(), COLD);

    await act(async () => {
      fireEvent.press(screen.getAllByLabelText(en['host.approve'])[0]);
    });

    await waitFor(
      () =>
        expect(screen.getByText(said('host.approveFailed', { guest: PENDING.guest.name }))).toBeTruthy(),
      SETTLE,
    );
    expect(screen.queryByText(said('host.approvedToast', { guest: PENDING.guest.name }))).toBeNull();
    expect(screen.queryByLabelText(en['host.undo'])).toBeNull();
    expect(stored(PENDING.id)?.status).toBe('pending_approval');
  });

  it('says a decline did not save, and does not claim the refund', async () => {
    mockWrites.fail = true;
    await open(<HostToday />, 'light');
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy(), COLD);

    fireEvent.press(screen.getAllByLabelText(en['host.decline'])[0]);
    await waitFor(() => expect(screen.getByLabelText(en['host.declineConfirm'])).toBeTruthy(), SETTLE);
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['host.declineConfirm']));
    });

    await waitFor(
      () =>
        expect(screen.getByText(said('host.declineFailed', { guest: PENDING.guest.name }))).toBeTruthy(),
      SETTLE,
    );
    expect(screen.queryByText(said('host.declinedToast', { guest: PENDING.guest.name }))).toBeNull();
    expect(stored(PENDING.id)?.status).toBe('pending_approval');
  });

  it('refuses approve and decline offline, and says why above the rows', async () => {
    goOffline();
    await open(<HostToday />, 'light');
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy(), COLD);

    expect(screen.getByText(en['host.offlineNote'])).toBeTruthy();
    for (const button of [
      ...screen.getAllByLabelText(en['host.approve']),
      ...screen.getAllByLabelText(en['host.decline']),
    ]) {
      expect(button).toBeDisabled();
    }
    // Check-in is the one write that queues, so it stays live.
    expect(screen.getAllByLabelText(en['host.checkIn'])[0]).not.toBeDisabled();
  });

  it('carries no offline note on a working connection', async () => {
    await open(<HostToday />, 'light');
    await waitFor(() => expect(screen.getByText(PENDING.guest.name)).toBeTruthy(), COLD);
    expect(screen.queryByText(en['host.offlineNote'])).toBeNull();
  });

  it('refuses all three in the store too, so a connection lost mid tap moves nothing', async () => {
    goOffline();
    let actions: HostActions | undefined;
    function Probe() {
      actions = useHostActions();
      return <RNText>ready</RNText>;
    }
    render(host(<Probe />));

    await expect(actions!.approve(PENDING.id)).resolves.toBe('offline');
    await expect(actions!.decline(PENDING.id, 'Those dates are not free')).resolves.toBe('offline');
    await expect(actions!.checkOut(IN_HOUSE.id)).resolves.toBe('offline');
    expect(stored(PENDING.id)?.status).toBe('pending_approval');
    expect(stored(IN_HOUSE.id)?.checkedOutAt).toBeNull();
    // Refused, not queued: nothing waits to fire later.
    expect(readQueue()).toHaveLength(0);
  });
});

describe('checking out', () => {
  async function confirmCheckOut() {
    await open(<HostBookingDetail id={IN_HOUSE.id} />, 'light');
    await waitFor(() => expect(screen.getByLabelText(en['host.checkOut'])).toBeTruthy(), COLD);
    fireEvent.press(screen.getByLabelText(en['host.checkOut']));
    await waitFor(() => expect(screen.getByLabelText(en['host.checkOutConfirm'])).toBeTruthy(), SETTLE);
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['host.checkOutConfirm']));
    });
  }

  const doneToast = () =>
    IN_HOUSE.room
      ? said('host.checkedOutToast', { guest: IN_HOUSE.guest.name, room: IN_HOUSE.room })
      : said('host.checkedOutNoRoom', { guest: IN_HOUSE.guest.name });

  it('closes the stay with no invoice number and no payout (HO-04)', async () => {
    await confirmCheckOut();

    await waitFor(() => expect(screen.getByText(doneToast())).toBeTruthy(), SETTLE);
    // No `EBM-2026-…` was minted, and the bill says so rather than "issued".
    expect(screen.queryByText(/EBM-/)).toBeNull();
    expect(screen.getByText(en['host.invoiceNotIssued'])).toBeTruthy();
    expect(stored(IN_HOUSE.id)?.checkedOutAt).not.toBeNull();
    expect(stored(IN_HOUSE.id)?.invoice).toBeNull();
    // And no payout row written for a checkout that never left the phone.
    expect(readFixture(HOST_PAYOUTS_KEY, 'untouched')).toBe('untouched');
  });

  it('keeps the sheet open with a retry when it does not save, and hands no room over', async () => {
    mockWrites.fail = true;
    await confirmCheckOut();

    await waitFor(() => expect(screen.getByText(en['host.checkOutFailedTitle'])).toBeTruthy(), SETTLE);
    expect(screen.queryByText(doneToast())).toBeNull();
    expect(stored(IN_HOUSE.id)?.checkedOutAt).toBeNull();
    // A failed checkout used to hand the room to housekeeping anyway.
    expect(readFixture(TASKS_KEY, 'untouched')).toBe('untouched');
  });

  it('refuses checkout offline, with the reason beside the button', async () => {
    goOffline();
    await open(<HostBookingDetail id={IN_HOUSE.id} />, 'light');
    await waitFor(() => expect(screen.getByLabelText(en['host.checkOut'])).toBeTruthy(), COLD);

    expect(screen.getByLabelText(en['host.checkOut'])).toBeDisabled();
    expect(screen.getByText(en['host.needsConnectionCheckOut'])).toBeTruthy();
  });
});

describe('checking in', () => {
  async function finish() {
    readyToCheckIn(ARRIVING);
    await open(<HostCheckInCapture id={ARRIVING.id} />, 'light');
    await waitFor(() => expect(screen.getByText(en['host.roomTitle'])).toBeTruthy(), COLD);
    await act(async () => {
      fireEvent.press(screen.getByLabelText(en['host.checkInFinish']));
    });
  }

  const inRoom = () => said('host.checkedInToast', { guest: ARRIVING.guest.name, room: '301' });

  it('checks the guest in and says which room', async () => {
    await finish();

    await waitFor(() => expect(screen.getByText(inRoom())).toBeTruthy(), SETTLE);
    expect(stored(ARRIVING.id)?.checkedInAt).not.toBeNull();
    expect(readFixture<Record<string, unknown>>(HOST_CAPTURES_KEY, {})[ARRIVING.id]).toBeTruthy();
  });

  it('says a failed check-in did not save, keeps the draft and stays on the screen', async () => {
    mockWrites.fail = true;
    await finish();

    await waitFor(() => expect(screen.getByText(en['host.checkInFailedTitle'])).toBeTruthy(), SETTLE);
    expect(screen.queryByText(inRoom())).toBeNull();
    expect(pushed).toHaveLength(0);
    // The photograph is the expensive part, and it is still there.
    expect(readFixture<CaptureDraft | null>(captureDraftKey(ARRIVING.id), null)?.photos).toHaveLength(1);
    expect(stored(ARRIVING.id)?.checkedInAt).toBeNull();
    // No record of a document seen for a guest who is not in.
    expect(readFixture(HOST_CAPTURES_KEY, 'untouched')).toBe('untouched');
  });

  it('says an offline check-in is saved on the phone, never that the guest is in', async () => {
    goOffline();
    await finish();

    await waitFor(
      () =>
        expect(screen.getByText(said('host.checkInQueued', { guest: ARRIVING.guest.name }))).toBeTruthy(),
      SETTLE,
    );
    expect(screen.queryByText(inRoom())).toBeNull();
    // Kept in the queue under the booking's own id, and not written as done.
    expect(readQueue().map((item) => item.id)).toContain(`checkIn-${ARRIVING.id}`);
    expect(stored(ARRIVING.id)?.checkedInAt).toBeNull();
  });

  it('says the booking did not load, and retries it, rather than calling it closed (HO-19)', async () => {
    mockFailedReads.add(HOST_BOOKINGS_KEY);
    await open(<HostCheckInCapture id={ARRIVING.id} />, 'light');

    await waitFor(() => expect(screen.getByText(en['host.checkInReadFailed'])).toBeTruthy(), COLD);
    expect(screen.queryByText(en['host.checkInClosedTitle'])).toBeNull();

    fireEvent.press(screen.getByLabelText(en['state.retry']));
    await waitFor(() => expect(screen.getByText(en['host.identityTitle'])).toBeTruthy(), COLD);
  });
});

describe('what the desk is shown again', () => {
  it('shows a captured document number by its last four only (HO-17)', async () => {
    writeFixture(HOST_CAPTURES_KEY, {
      [IN_HOUSE.id]: {
        bookingId: IN_HOUSE.id,
        fullName: IN_HOUSE.guest.name,
        documentType: 'national_id',
        documentNumber: '1199780012345678',
        photos: [],
        room: '301',
        at: Date.now(),
      },
    });
    await open(<HostBookingDetail id={IN_HOUSE.id} />, 'light');

    await waitFor(
      () => expect(screen.getByText(said('host.documentEnding', { digits: '5678' }))).toBeTruthy(),
      COLD,
    );
    expect(screen.queryByText(/1199780012345678/)).toBeNull();
  });

  it('never shows a number short enough that its last four are all of it', () => {
    expect(lastFour('1199 7800 1234 5678')).toBe('5678');
    expect(lastFour('PA1234')).toBe('1234');
    expect(lastFour('1234')).toBe('');
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
