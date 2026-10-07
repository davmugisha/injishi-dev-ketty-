/**
 * Task detail, in both schemes — frame W3.
 *
 * The assertion that matters most is the primary's four labels: the button IS
 * the state on this screen, so a state that draws the wrong label is a person
 * pressing the wrong thing in a corridor. The rest is the anatomy the frame
 * draws — the room hero, the chips, the rail, the desk's note — and the two
 * escapes, which must never disappear when the primary goes inert.
 *
 * **Every write is also made to fail, and the read too** (mobile audit
 * 2026-10-05, WK-32). No Work test forced a failure, so "Mark done" toasting
 * that a room was clean when nothing had saved passed every suite.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TaskDetail } from './task-detail';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { SEED_TASKS, type TaskStatus } from './work-fixtures';
import { TASKS_KEY, TIMERS_KEY, resetWorkSession } from './work-store';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, navigate: jest.fn(), replace: jest.fn() }),
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

/**
 * The read, held in flight or failed. A failed read's retry clears the
 * failure and reads again, the way a real one recovers when the network does.
 */
let mockRead: 'real' | 'loading' | 'error' = 'real';
jest.mock('@/data/use-fixture', () => {
  const actual = jest.requireActual<typeof import('@/data/use-fixture')>('@/data/use-fixture');
  function useFixture<T>(key: string, read: () => T) {
    const real = actual.useFixture<T>(key, read);
    if (mockRead === 'loading') {
      return { status: 'loading' as const, data: undefined, error: undefined, retry: real.retry };
    }
    if (mockRead === 'error') {
      return {
        status: 'error' as const,
        data: undefined,
        error: new Error('Forced read failure'),
        retry: () => {
          mockRead = 'real';
          real.retry();
        },
      };
    }
    return real;
  }
  return { ...actual, useFixture };
});

const work = (ui: ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="work">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

const fill = (key: string) => en[key as keyof typeof en] as string;

/** Puts one task into the store in a given state, and clears the rest. */
const seedAs = (id: string, status: TaskStatus, extra: Record<string, unknown> = {}) =>
  writeFixture(
    TASKS_KEY,
    SEED_TASKS.map((task) => (task.id === id ? { ...task, status, ...extra } : task)),
  );

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockFailWrites = false;
  mockRead = 'real';
  resetFixtures();
  resetWorkSession();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
});

afterEach(async () => {
  mockFailWrites = false;
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
});

describe.each(SCHEMES)('Task detail in the %s scheme', (scheme) => {
  it('leads with the room number, the chips and the desk’s note', async () => {
    // The note and its author are whatever the task carries, so the assertion
    // is about the screen and not about a fixture person (WK-32).
    seedAs('205', 'pending', { note: 'Balcony door sticks.', noteBy: 'Front desk · 14:58' });
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() => expect(screen.getByText('205')).toBeTruthy());
    expect(screen.getByText(fill('work.kind.checkoutClean'))).toBeTruthy();
    expect(screen.getByText(fill('work.queue.metaHighPriority'))).toBeTruthy();
    expect(
      screen.getByText(fill('work.queue.metaGuest').replace('{time}', '16:00')),
    ).toBeTruthy();
    expect(screen.getByText(fill('work.task.notesTitle'))).toBeTruthy();
    expect(screen.getByText('Balcony door sticks.')).toBeTruthy();
    expect(screen.getByText('Front desk · 14:58')).toBeTruthy();
  });

  it('names the primary after the state the task is in', async () => {
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.task.start'))).toBeTruthy());
  });

  it('shows Mark done, and its consequence, once the room is being cleaned', async () => {
    seedAs('205', 'in_progress');
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() => expect(screen.getByLabelText(fill('work.task.markDone'))).toBeTruthy());
    // The consequence is printed under the button rather than discovered after.
    expect(
      screen.getByText(fill('work.task.consequenceDone').replace('{room}', '205')),
    ).toBeTruthy();
  });

  it('goes inert with the reason when a ticket is holding the room', async () => {
    seedAs('205', 'blocked', { blockedBy: 'T-118' });
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() => expect(screen.getByLabelText(fill('work.task.blocked'))).toBeTruthy());
    expect(screen.getByText(fill('work.task.blockedTitle'))).toBeTruthy();
    expect(
      screen.getByText(fill('work.task.blockedBody').replace('{ref}', 'T-118')),
    ).toBeTruthy();
    // Report a fault stays reachable; Request check does not, because a blocked
    // room has nothing for a supervisor to sign off.
    expect(screen.getByLabelText(fill('work.task.reportFault'))).toBeTruthy();
    expect(screen.queryByLabelText(fill('work.task.requestCheck'))).toBeNull();
  });

  it('says it is waiting on a sign-off once it is done', async () => {
    seedAs('205', 'done');
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.task.doneWaiting'))).toBeTruthy());
  });

  it('starts the clean and says so', async () => {
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.task.start'))).toBeTruthy());

    fireEvent.press(screen.getByLabelText(fill('work.task.start')));

    await waitFor(() =>
      expect(
        screen.getByText(fill('work.task.startedToast').replace('{room}', '205')),
      ).toBeTruthy(),
    );
  });

  /**
   * WK-04 and WK-05: a start that did not save used to say it had, and Try
   * again only cleared the error. It says nothing now, and Try again starts it.
   */
  it('says nothing about a start that did not save, and Try again starts it', async () => {
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.task.start'))).toBeTruthy());
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(fill('work.task.start')));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    expect(
      screen.queryByText(fill('work.task.startedToast').replace('{room}', '205')),
    ).toBeNull();

    mockFailWrites = false;
    fireEvent.press(screen.getByLabelText(fill('write.retry')));

    await waitFor(() =>
      expect(
        screen.getByText(fill('work.task.startedToast').replace('{room}', '205')),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(fill('work.writeFailedTitle'))).toBeNull();
  });

  it('neither says a room is clean nor leaves when Mark done did not save', async () => {
    seedAs('205', 'in_progress');
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.task.markDone'))).toBeTruthy());
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(fill('work.task.markDone')));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    expect(screen.queryByText(fill('work.task.cleanToast').replace('{room}', '205'))).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();

    // Try again runs Mark done again, not a fresh guess at what was meant.
    mockFailWrites = false;
    fireEvent.press(screen.getByLabelText(fill('write.retry')));
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(screen.getByText(fill('work.task.cleanToast').replace('{room}', '205'))).toBeTruthy();
  });

  it('marks a room clean without claiming the front desk saw it', async () => {
    seedAs('205', 'in_progress');
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.task.markDone'))).toBeTruthy());

    fireEvent.press(screen.getByLabelText(fill('work.task.markDone')));

    await waitFor(() =>
      expect(screen.getByText(fill('work.task.cleanToast').replace('{room}', '205'))).toBeTruthy(),
    );
    expect(screen.queryByText(/sees it live/)).toBeNull();
  });

  it('tells the truth about where a finished room went, offline', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    seedAs('205', 'in_progress');
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() => expect(screen.getByLabelText(fill('work.task.markDone'))).toBeTruthy());
    fireEvent.press(screen.getByLabelText(fill('work.task.markDone')));

    // Not "the front desk sees it live", which would be a lie with no signal.
    await waitFor(() => expect(screen.getByText(fill('work.offline.savedToast'))).toBeTruthy());
  });

  /** WK-02: this toast named "Solange U.", a supervisor from the fixtures. */
  it('marks the room waiting on a check, and names nobody', async () => {
    seedAs('205', 'in_progress');
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() =>
      expect(screen.getByLabelText(fill('work.task.requestCheck'))).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText(fill('work.task.requestCheck')));

    await waitFor(() =>
      expect(
        screen.getByText(fill('work.task.checkToast').replace('{room}', '205')),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/Solange/)).toBeNull();
    expect(mockBack).toHaveBeenCalled();
  });

  it('keeps the attendant here when Request check did not save', async () => {
    seedAs('205', 'in_progress');
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(fill('work.task.requestCheck'))).toBeTruthy(),
    );
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(fill('work.task.requestCheck')));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    expect(
      screen.queryByText(fill('work.task.checkToast').replace('{room}', '205')),
    ).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('says so when the pause did not save', async () => {
    const since = Date.now() - 60_000;
    seedAs('205', 'in_progress');
    writeFixture(TIMERS_KEY, { '205': { startedAt: since, accrued: 0, since } });
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(en['a11y.pauseTimer'])).toBeTruthy());
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(en['a11y.pauseTimer']));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    // Still running: the label still offers to pause it.
    expect(screen.getByLabelText(en['a11y.pauseTimer'])).toBeTruthy();
  });

  /**
   * WK-13: this read "Started 10:24 · your average is 22 min" on every task,
   * a fixture clock and a fixture average. It is the task's own start now.
   */
  it('prints when this task was started, and no average', async () => {
    const since = new Date(2026, 9, 5, 9, 41).getTime();
    seedAs('205', 'in_progress');
    writeFixture(TIMERS_KEY, { '205': { startedAt: since, accrued: 0, since } });
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() =>
      expect(
        screen.getByText(fill('work.task.startedAt').replace('{time}', '09:41')),
      ).toBeTruthy(),
    );
    expect(screen.queryByText(/average/)).toBeNull();
  });

  it('reads Not started on a pending task, with no average', async () => {
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() => expect(screen.getByText(fill('work.task.notStarted'))).toBeTruthy());
    expect(screen.queryByText(/average/)).toBeNull();
  });

  it('opens the fault form with this room already chosen', async () => {
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(fill('work.task.reportFault'))).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText(fill('work.task.reportFault')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/report-fault',
      params: { room: '205' },
    });
  });

  it('is a junction rather than a wall when the task is gone', async () => {
    renderInScheme(work(<TaskDetail taskId="999" />), scheme);
    await waitFor(() =>
      expect(screen.getByText(fill('work.task.notFoundTitle'))).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText(fill('work.task.backToQueue')));
    expect(mockBack).toHaveBeenCalled();
  });

  /**
   * WK-06: a failed read used to land on "This task is not on your queue…
   * it belongs to another attendant", a claim about a task never loaded.
   */
  it('says the read failed, offers to read again, and recovers', async () => {
    mockRead = 'error';
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() => expect(screen.getByText(en['state.errorTitle'])).toBeTruthy());
    expect(screen.queryByText(fill('work.task.notFoundTitle'))).toBeNull();
    expect(screen.queryByLabelText(fill('work.task.start'))).toBeNull();

    fireEvent.press(screen.getByLabelText(en['state.retry']));
    await waitFor(() => expect(screen.getByLabelText(fill('work.task.start'))).toBeTruthy());
  });

  it('draws a skeleton while the read is out, and no verdict', async () => {
    mockRead = 'loading';
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    expect(
      screen.getByLabelText(en['state.loadingList'].replace('{label}', fill('work.task.listLabel'))),
    ).toBeTruthy();
    expect(screen.queryByText(fill('work.task.notFoundTitle'))).toBeNull();
  });
});
