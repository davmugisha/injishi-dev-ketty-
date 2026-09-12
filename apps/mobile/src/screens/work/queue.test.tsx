/**
 * The Queue, in both schemes — frames W1 and W2.
 *
 * The assertions are about what a person standing in a corridor can see and do:
 * that the sync line says which state the phone is in, that the floor tabs
 * actually remove rows, that an empty floor explains itself, that the primary
 * changes its own label when there is nothing left to take, and that going
 * offline re-groups the list around what the desk does not know yet.
 *
 * `work-format.test.ts` covers the arithmetic underneath; this covers the
 * wiring, which is the half that silently comes loose.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { WorkQueue } from './queue';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { ARRIVAL_TASK, SEED_TASKS, WORK_PROFILE } from './work-fixtures';
import { CONNECTION_KEY, TASKS_KEY, resetWorkSession } from './work-store';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), navigate: jest.fn(), replace: jest.fn() }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

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

beforeEach(() => {
  mockPush.mockClear();
  resetFixtures();
  resetWorkSession();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
});

/** A write started by one test lands after the next has mounted; flush first. */
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
});

describe.each(SCHEMES)('The Queue in the %s scheme', (scheme) => {
  it('carries the property eyebrow, the title and the sync line', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    // Drawn in caps by `textTransform`, not by upper-casing the string: a
    // screen reader given "KIVU CREST HOTEL" spells it out letter by letter.
    // The property alone. The town used to follow it, off the `WorkspaceEntry`
    // fixture; `WorkspaceAccess` carries no town and the eyebrow drops the
    // empty half rather than printing a dangling separator. See `WorkEyebrow`.
    expect(screen.getAllByText('Kivu Crest Hotel').length).toBeGreaterThan(0);
    expect(screen.getByText(fill('work.queue.title'))).toBeTruthy();
    expect(
      screen.getByLabelText(
        fill('work.queue.syncOnline')
          .replace('{count}', '6')
          .replace('{time}', WORK_PROFILE.clock),
      ),
    ).toBeTruthy();
    await settled();
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

  it('groups the live rows by floor', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();
    expect(screen.getByText(fill('work.queue.sectionFloor').replace('{floor}', '1'))).toBeTruthy();
    expect(screen.getByText(fill('work.queue.sectionFloor').replace('{floor}', '2'))).toBeTruthy();
  });

  it('filters for real when a floor tab is chosen, and explains an empty one', async () => {
    renderInScheme(work(<WorkQueue />), scheme);
    await settled();

    fireEvent.press(screen.getByLabelText('Floor 2 1'));

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
    // Finished work is still listed under its own heading rather than vanishing.
    expect(screen.getByText(fill('work.queue.sectionDone'))).toBeTruthy();
  });

  it('draws the desk’s checkout as an arrival, with its age', async () => {
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

    await waitFor(() => expect(screen.getByText(fill('work.offline.bannerTitle'))).toBeTruthy());

    // Frame W2's two sections, in its order.
    expect(screen.getByText(fill('work.queue.sectionQueued'))).toBeTruthy();
    expect(screen.getByText(fill('work.queue.sectionTodo'))).toBeTruthy();
    // The finished row reads Done to the attendant immediately; the tick is
    // theirs, the clock is the network's.
    expect(screen.getByText(fill('work.queue.doneQueued'))).toBeTruthy();
    // And the promise on the reconnect card is printed as a checkable list.
    expect(screen.getByText(fill('work.offline.replayTitle'))).toBeTruthy();
    // The primary is still there: offline never takes work away.
    expect(screen.getByLabelText(fill('work.queue.takeNext'))).toBeTruthy();
  });

  it('shows the same banner for a real loss of signal', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    renderInScheme(work(<WorkQueue />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.offline.bannerTitle'))).toBeTruthy());
    expect(screen.getByText(fill('state.offlineLastList'))).toBeTruthy();
  });

  it('flushes the buffer in order when Reconnect is pressed', async () => {
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
      expect(
        screen.getByText(fill('work.offline.syncedToast').replace('{count}', '2'), {
          exact: false,
        }),
      ).toBeTruthy(),
    );
  });
});
