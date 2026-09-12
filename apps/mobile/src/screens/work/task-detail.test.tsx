/**
 * Task detail, in both schemes — frame W3.
 *
 * The assertion that matters most is the primary's four labels: the button IS
 * the state on this screen, so a state that draws the wrong label is a person
 * pressing the wrong thing in a corridor. The rest is the anatomy the frame
 * draws — the room hero, the chips, the rail, the desk's note — and the two
 * escapes, which must never disappear when the primary goes inert.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TaskDetail } from './task-detail';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { SEED_TASKS, WORK_PROFILE, type TaskStatus } from './work-fixtures';
import { TASKS_KEY, resetWorkSession } from './work-store';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, navigate: jest.fn(), replace: jest.fn() }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

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
  resetFixtures();
  resetWorkSession();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
});

describe.each(SCHEMES)('Task detail in the %s scheme', (scheme) => {
  it('leads with the room number, the chips and the desk’s note', async () => {
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() => expect(screen.getByText('205')).toBeTruthy());
    expect(screen.getByText(fill('work.kind.checkoutClean'))).toBeTruthy();
    expect(screen.getByText(fill('work.queue.metaHighPriority'))).toBeTruthy();
    expect(
      screen.getByText(fill('work.queue.metaGuest').replace('{time}', '16:00')),
    ).toBeTruthy();
    expect(screen.getByText(fill('work.task.notesTitle'))).toBeTruthy();
    expect(screen.getByText(/Balcony door sticks/)).toBeTruthy();
    expect(screen.getByText('Denise L. · Front desk · 14:58')).toBeTruthy();
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

  it('sends a check to the supervisor named in the fixture', async () => {
    seedAs('205', 'in_progress');
    renderInScheme(work(<TaskDetail taskId="205" />), scheme);

    await waitFor(() =>
      expect(screen.getByLabelText(fill('work.task.requestCheck'))).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText(fill('work.task.requestCheck')));

    await waitFor(() =>
      expect(
        screen.getByText(
          fill('work.task.checkToast').replace('{name}', WORK_PROFILE.signsOff),
        ),
      ).toBeTruthy(),
    );
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
});
