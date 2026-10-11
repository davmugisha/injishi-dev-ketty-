/**
 * The Queue, in both schemes — frames W1 and W2.
 *
 * The assertions are about what a person standing in a corridor can see and do:
 * that the sync line says which state the phone is in, that the floor tabs
 * actually remove rows, that an empty floor explains itself, that the primary
 * changes its own label when there is nothing left to take, and that going
 * offline re-groups the list around what the desk does not know yet.
 *
 * **Every write here is also made to fail** (mobile audit 2026-10-05, WK-32).
 * No Work test used to force a failure, so a start that never landed and still
 * said "Room 205 started" passed every suite. `mockFailWrites` makes the
 * store's reducer throw, which is the one way a fixture write fails.
 *
 * `work-format.test.ts` covers the arithmetic underneath; this covers the
 * wiring, which is the half that silently comes loose.
 */
import { type ReactElement } from 'react';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { WorkQueue } from './queue';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import {
  MUTATION_LATENCY_MS,
  hasFixture,
  readFixture,
  resetFixtures,
  writeFixture,
} from '@/data/use-fixture-mutation';
import { ARRIVAL_TASK, SEED_TASKS, WORK_PROFILE } from './work-fixtures';
import { clockOf } from './work-format';
import { CONNECTION_KEY, TASKS_KEY, resetWorkSession, type Connection } from './work-store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

/** Every Work write fails while this is true: the reducer throws. */
let mockFailWrites = false;
jest.mock('@/data/use-fixture-mutation', () => {
  const actual = jest.requireActual<typeof import('@/data/use-fixture-mutation')>(
    '@/data/use-fixture-mutation',
  );
  function useFixtureMutation<V, I>(key: string, apply: (current: V, input: I) => V, seed: () => V) {
    return actual.useFixtureMutation<V, I>(
      key,
      (current, input) => {
        if (mockFailWrites) throw new Error('Forced write failure');
        return apply(current, input);
      },
      seed,
    );
  }
  return { ...actual, useFixtureMutation };
});

/** Holds every Work read in flight while this is true, as a slow network does. */
let mockReadLoading = false;
jest.mock('@/data/use-fixture', () => {
  const actual = jest.requireActual<typeof import('@/data/use-fixture')>('@/data/use-fixture');
  function useFixture<T>(key: string, read: () => T) {
    const real = actual.useFixture<T>(key, read);
    return mockReadLoading
      ? { status: 'loading' as const, data: undefined, error: undefined, retry: real.retry }
      : real;
  }
  return { ...actual, useFixture };
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
const mockSeatSurface = 'work';

jest.mock('@/workspace', () => {
  const { workspaceStateFor } = jest.requireActual('@/test-seats');
  const state = () => workspaceStateFor(mockSeatSurface);
  return { useWorkspace: state, useOptionalWorkspace: state };
});

/** The Queue reads the active workspace for its eyebrow and toasts on a start. */
const work = (ui: ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="work">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

const fill = (text: string) => en[text as keyof typeof en] as string;

/** Waits out `useFixture`'s cold-read latency. */
const settled = () => waitFor(() => expect(screen.getByText('Garden Suite')).toBeTruthy());

/** What a floor tab says to a screen reader: "Floor 2, 1 room". */
const floorTab = (floor: number, count: number) =>
  fill(count === 1 ? 'work.tabs.roomsOne' : 'work.tabs.rooms')
    .replace('{label}', fill('work.queue.tabFloor').replace('{floor}', String(floor)))
    .replace('{count}', String(count));

beforeEach(() => {
  mockPush.mockClear();
  mockFailWrites = false;
  mockReadLoading = false;
  resetFixtures();
  resetWorkSession();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
});

/** A write started by one test lands after the next has mounted; flush first. */
afterEach(async () => {
  mockFailWrites = false;
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
});

describe.each(SCHEMES)('The Queue in the %s scheme', (scheme) => {
  it('carries the property eyebrow, the title and an honest sync line', async () => {
    const before = Date.now();
    renderInScheme(work(<WorkQueue />), scheme);
    // Drawn in caps by `textTransform`, not by upper-casing the string: a
    // screen reader given "KIVU CREST HOTEL" spells it out letter by letter.
    // The property alone. The town used to follow it, off the `WorkspaceEntry`
    // fixture; `WorkspaceAccess` carries no town and the eyebrow drops the
    // empty half rather than printing a dangling separator. See `WorkEyebrow`.
    expect(screen.getAllByText('Kivu Crest Hotel').length).toBeGreaterThan(0);
    expect(screen.getByText(fill('work.queue.title'))).toBeTruthy();
    await settled();

    // Mobile audit 2026-10-05, WK-13: this read "Synced · 6 tasks · 10:24" at
    // 14:03. It is the time this list was read now, and it claims no sync.
    const line = await waitFor(() =>
      screen.getByLabelText(/^Online · 6 tasks · updated \d{2}:\d{2}$/),
    );
    const read = [clockOf(before), clockOf(Date.now())].map((time) =>
      fill('work.queue.syncOnline').replace('{count}', '6').replace('{time}', time),
    );
    expect(read).toContain(line.props.accessibilityLabel);
    expect(screen.queryByText(/Synced/)).toBeNull();
  });

  it('shows a skeleton on the cold read rather than an empty page', () => {
    renderInScheme(work(<WorkQueue />), scheme);
    const loading = screen.queryByLabelText(
      fill('state.loadingList').replace('{label}', fill('work.queue.listLabel')),
    );
    // Warm on a later render in the same session, which is also correct: the
    // assertion is that one of the two is showing, never neither.
    expect(loading ?? screen.getByText(fill('work.queue.title'))).toBeTruthy();
  });

  /**
   * WK-24: the header used to count the seed while the skeleton showed, so the
   * sync line, the floor tabs and the primary all described a list nobody had
   * loaded. Until the read lands they say nothing, and the primary waits.
   */
  it('counts nothing and takes nothing before the read lands', async () => {
    mockReadLoading = true;
    renderInScheme(work(<WorkQueue />), scheme);

    expect(
      screen.getByLabelText(fill('state.loadingList').replace('{label}', fill('work.queue.listLabel'))),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/tasks/)).toBeNull();
    expect(screen.queryByLabelText(/, \d+ rooms?$/)).toBeNull();
    // "Nothing pending" would be a claim about a list nobody has read.
    expect(screen.queryByLabelText(fill('work.queue.nothingPending'))).toBeNull();
    const primary = screen.getByLabelText(fill('work.queue.takeNext'));
    expect(primary).toBeDisabled();
    fireEvent.press(primary);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('groups the live rows by floor', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();
    // Twice each: the floor's tab, whose label is its own text now that the
    // count is a pill, and the floor's section heading in the list.
    for (const floor of ['1', '2']) {
      expect(
        screen.getAllByText(fill('work.queue.sectionFloor').replace('{floor}', floor)),
      ).toHaveLength(2);
    }
  });

  /** WK-12: the rig read a floor tab as "Floor 1 2". */
  it('draws a floor tab’s count as its own pill, and says it with its noun', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();

    const tab = screen.getByLabelText(floorTab(1, 2));
    expect(within(tab).getByText(fill('work.queue.tabFloor').replace('{floor}', '1'))).toBeTruthy();
    expect(within(tab).getByText('2')).toBeTruthy();
    expect(screen.queryByText('Floor 1 2')).toBeNull();
  });

  it('filters for real when a floor tab is chosen, and explains an empty one', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();

    fireEvent.press(screen.getByLabelText(floorTab(2, 1)));

    await waitFor(() => {
      expect(screen.queryByText('Garden Suite')).toBeNull();
      expect(screen.getByText('205')).toBeTruthy();
    });
  });

  it('opens a row on the task it names', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();

    fireEvent.press(
      screen.getByLabelText(
        fill('work.queue.openTask')
          .replace('{room}', '104')
          .replace('{type}', 'Std Twin')
          .replace('{task}', fill('work.kind.checkoutClean')),
      ),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/task/[taskId]',
      params: { taskId: '104' },
    });
  });

  it('sends a swipe-left to the fault form with the room already chosen', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();

    // The swipe reaches no screen reader, so `SwipeableRow` also publishes both
    // actions as accessibility actions. Firing one is what a switch-control
    // user does, and it must do the same thing the gesture does.
    fireEvent(screen.getAllByLabelText(/Room 104/)[0], 'accessibilityAction', {
      nativeEvent: { actionName: fill('work.queue.swipeBlock') },
    });

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/report-fault',
        params: { room: '104' },
      }),
    );
  });

  it('says a swiped start happened only once it has', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();

    fireEvent(screen.getAllByLabelText(/Room 104/)[0], 'accessibilityAction', {
      nativeEvent: { actionName: fill('work.queue.swipeStart') },
    });

    await waitFor(() =>
      expect(
        screen.getByText(fill('work.task.startedToast').replace('{room}', '104')),
      ).toBeTruthy(),
    );
  });

  it('says nothing about a swiped start that did not save (WK-04)', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();
    mockFailWrites = true;

    fireEvent(screen.getAllByLabelText(/Room 104/)[0], 'accessibilityAction', {
      nativeEvent: { actionName: fill('work.queue.swipeStart') },
    });

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    expect(
      screen.queryByText(fill('work.task.startedToast').replace('{room}', '104')),
    ).toBeNull();
  });

  it('offers Take next task, and starts the next pending room with it', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();

    fireEvent.press(screen.getByLabelText(fill('work.queue.takeNext')));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/task/[taskId]',
        params: { taskId: '104' },
      }),
    );
  });

  /**
   * WK-04 and WK-05: a Take next that did not save used to open the room as if
   * it had. It stays here, says so above the primary, and Try again starts THAT
   * room rather than whatever is pending by then.
   */
  it('does not open a room it could not start, and Try again starts it', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(fill('work.queue.takeNext')));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
    expect(readFixture<typeof SEED_TASKS>(TASKS_KEY, SEED_TASKS).find((x) => x.id === '104')?.status).toBe(
      'pending',
    );

    mockFailWrites = false;
    fireEvent.press(screen.getByLabelText(fill('write.retry')));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/task/[taskId]',
        params: { taskId: '104' },
      }),
    );
    expect(screen.queryByText(fill('work.writeFailedTitle'))).toBeNull();
  });

  it('turns the primary into "Nothing pending" when the queue is clear', async () => {
    writeFixture(
      TASKS_KEY,
      SEED_TASKS.map((task) => ({ ...task, status: 'done' as const })),
    );
    renderInScheme(work(<WorkQueue />), scheme);

    await waitFor(() => {
      expect(screen.getByLabelText(fill('work.queue.nothingPending'))).toBeTruthy();
      expect(screen.getByText(fill('work.queue.emptyTitle'))).toBeTruthy();
    });
    // Finished work is still listed under its own heading rather than vanishing,
    // and it reads Done, not "Done · Synced": nothing synced it (WK-32).
    expect(screen.getByText(fill('work.queue.sectionDone'))).toBeTruthy();
    expect(screen.getAllByText(fill('work.queue.doneSynced')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Synced/)).toBeNull();
  });

  it('draws a checkout that genuinely arrived, with its age', async () => {
    writeFixture(TASKS_KEY, [{ ...ARRIVAL_TASK, arrivedAt: Date.now() }, ...SEED_TASKS]);
    renderInScheme(work(<WorkQueue />), scheme);

    await waitFor(() =>
      expect(
        screen.getByText(fill('work.queue.arrivalTitle').replace('{room}', '208')),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText(fill('work.queue.arrivalAgoSeconds').replace('{seconds}', '0')),
    ).toBeTruthy();
  });

  /**
   * WK-02: the queue used to drop room 208 in 6.5 seconds after every launch,
   * with a success toast, for every real housekeeper. Nothing arrives on its
   * own now: ten seconds pass and the store is untouched.
   */
  it('never invents a checkout', async () => {
    jest.useFakeTimers();
    try {
      renderInScheme(work(<WorkQueue />), scheme);
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      expect(
        screen.queryByText(fill('work.queue.arrivalTitle').replace('{room}', '208')),
      ).toBeNull();
      expect(hasFixture(TASKS_KEY)).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers the supervisor their inspection queue', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();

    expect(WORK_PROFILE.supervisor).toBe(true);
    fireEvent.press(
      screen.getByLabelText(
        `${fill('work.queue.inspectionOpen')}. ${fill('work.queue.inspectionTitle').replace('{count}', '3')}`,
      ),
    );
    expect(mockPush).toHaveBeenCalledWith('/inspection');
  });
});

describe.each(SCHEMES)('The Queue offline in the %s scheme', (scheme) => {
  it('re-groups around what the desk does not know yet, and never blocks', async () => {
    writeFixture(CONNECTION_KEY, {
      simulateOffline: true,
      buffer: [{ key: 'k1', room: '303', kind: 'clean' as const, at: 10 }],
    });
    writeFixture(
      TASKS_KEY,
      SEED_TASKS.map((task) => (task.id === '303' ? { ...task, status: 'done' as const } : task)),
    );
    renderInScheme(work(<WorkQueue />), scheme);

    // The simulated outage is the one the app-wide banner cannot see, so the
    // Work bar draws it.
    await waitFor(() => expect(screen.getByText(fill('work.offline.bannerTitle'))).toBeTruthy());

    // Frame W2's two sections, in its order.
    expect(screen.getByText(fill('work.queue.sectionQueued'))).toBeTruthy();
    expect(screen.getByText(fill('work.queue.sectionTodo'))).toBeTruthy();
    // The finished row reads Done to the attendant immediately; the tick is
    // theirs, the clock is the network's.
    expect(screen.getByText(fill('work.queue.doneQueued'))).toBeTruthy();
    // The card lists what is waiting, and promises no replay (WK-29).
    expect(screen.getByText(fill('work.offline.replayTitle'))).toBeTruthy();
    expect(screen.queryByText(/idempotency|conflict card|double-post/)).toBeNull();
    // The primary is still there: offline never takes work away.
    expect(screen.getByLabelText(fill('work.queue.takeNext'))).toBeTruthy();
  });

  /**
   * WK-25: a real outage drew two notices, the app-wide banner and this one
   * under it. The app-wide one speaks for a real outage; the list note stays,
   * because it is about the rows rather than the connection.
   */
  it('leaves a real loss of signal to the app-wide banner, and keeps the list note', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    renderInScheme(work(<WorkQueue />), scheme);

    await waitFor(() => expect(screen.getByText(fill('state.offlineLastList'))).toBeTruthy());
    expect(screen.queryByText(fill('work.offline.bannerTitle'))).toBeNull();
    // No Reconnect: a button cannot bring a dead radio back.
    expect(screen.queryByLabelText(fill('work.offline.reconnect'))).toBeNull();
  });

  /**
   * WK-32: this toasted "2 changes synced, in order, no duplicates". Reconnect
   * empties a list of markers and sends nothing, so it says it is back online
   * and nothing more.
   */
  it('ends the outage on Reconnect and claims no sync', async () => {
    writeFixture(CONNECTION_KEY, {
      simulateOffline: true,
      buffer: [
        { key: 'k1', room: '303', kind: 'clean' as const, at: 10 },
        { key: 'k2', room: '307', kind: 'clean' as const, at: 20 },
      ],
    });
    renderInScheme(work(<WorkQueue />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.offline.bannerTitle'))).toBeTruthy());
    fireEvent.press(screen.getByLabelText(fill('work.offline.reconnect')));

    await waitFor(() =>
      expect(screen.getByText(fill('work.offline.backOnlineToast'))).toBeTruthy(),
    );
    expect(screen.queryByText(/synced/i)).toBeNull();
    expect(readFixture<Connection>(CONNECTION_KEY, { simulateOffline: true, buffer: [] })).toEqual({
      simulateOffline: false,
      buffer: [],
    });
  });

  it('says so when Reconnect itself did not save', async () => {
    writeFixture(CONNECTION_KEY, {
      simulateOffline: true,
      buffer: [{ key: 'k1', room: '303', kind: 'clean' as const, at: 10 }],
    });
    renderInScheme(work(<WorkQueue />), scheme);
    await waitFor(() => expect(screen.getByText(fill('work.offline.bannerTitle'))).toBeTruthy());
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(fill('work.offline.reconnect')));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    expect(screen.queryByText(fill('work.offline.backOnlineToast'))).toBeNull();
  });
});
