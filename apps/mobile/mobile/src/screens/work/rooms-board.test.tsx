/**
 * The floor board and its status sheet, in both schemes — frame W4.
 *
 * The board's whole claim is that housekeeping status is its own axis, so the
 * assertions are about that: every tile says its state in words as well as in
 * colour, the filter row offers only states that occur, and the sheet offers
 * the four an attendant may set — never `out_of_order`, which is Maintenance's
 * call and arrives through a ticket.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { RoomsBoard } from './rooms-board';
import { RoomStatusSheet } from './room-status-sheet';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { SEED_ROOMS, SEED_TASKS } from './work-fixtures';
import { ROOMS_KEY, TASKS_KEY, resetWorkSession } from './work-store';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, navigate: jest.fn(), replace: jest.fn() }),
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

const work = (ui: ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="work">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

const fill = (key: string) => en[key as keyof typeof en] as string;

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

describe.each(SCHEMES)('The floor board in the %s scheme', (scheme) => {
  it('draws the floor with its room count in the eyebrow', async () => {
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText('301')).toBeTruthy());
    expect(
      screen.getByText(`Kivu Crest Hotel · ${fill('work.rooms.eyebrow').replace('{count}', '12')}`),
    ).toBeTruthy();
  });

  it('says every tile’s state in words, not only in colour', async () => {
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText('303')).toBeTruthy());

    // The canvas rule, on every frame: readable in sunlight, in greyscale and
    // to a colour-blind reader. Each tile is one spoken sentence.
    expect(
      screen.getByLabelText(
        fill('work.rooms.open')
          .replace('{room}', '303')
          .replace('{type}', 'Std Twin')
          .replace('{status}', fill('status.housekeeping.dirty')),
      ),
    ).toBeTruthy();
  });

  it('teaches the distinction the screen exists for', async () => {
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText(fill('work.rooms.infoTitle'))).toBeTruthy());
    expect(screen.getByText(fill('work.rooms.infoBody'))).toBeTruthy();
  });

  it('filters to one state and explains the empty result', async () => {
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText('301')).toBeTruthy());

    fireEvent.press(screen.getByLabelText(`${fill('status.housekeeping.dirty')} 1`));

    await waitFor(() => {
      expect(screen.getByText('303')).toBeTruthy();
      expect(screen.queryByText('301')).toBeNull();
    });
  });

  it('marks the room the reader is currently cleaning as theirs', async () => {
    writeFixture(TASKS_KEY, SEED_TASKS);
    renderInScheme(work(<RoomsBoard />), scheme);
    // 307 is in progress in the twin's seed, on both axes.
    await waitFor(() => expect(screen.getByText(fill('work.rooms.tileYou'))).toBeTruthy());
  });

  it('opens the status sheet on the tile that was tapped', async () => {
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText('303')).toBeTruthy());

    fireEvent.press(
      screen.getByLabelText(
        fill('work.rooms.open')
          .replace('{room}', '303')
          .replace('{type}', 'Std Twin')
          .replace('{status}', fill('status.housekeeping.dirty')),
      ),
    );
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/room-status',
      params: { roomId: '303' },
    });
  });

  it('shows the empty state when a filter matches nothing', async () => {
    writeFixture(ROOMS_KEY, SEED_ROOMS.filter((room) => room.status === 'clean'));
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText('301')).toBeTruthy());
    // Dirty is not offered at all now, which is the stronger behaviour: a tab
    // that is always empty is a tab whose empty state is a dead end.
    expect(screen.queryByLabelText(/Dirty/)).toBeNull();
  });

  it('says it is showing the last board it had when there is no signal', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText(fill('work.offline.bannerTitle'))).toBeTruthy());
    expect(screen.getByText(fill('state.offlineLastList'))).toBeTruthy();
  });
});

describe.each(SCHEMES)('The status sheet in the %s scheme', (scheme) => {
  it('offers the four states an attendant may set, and never out of order', async () => {
    renderInScheme(work(<RoomStatusSheet roomId="303" />), scheme);

    await waitFor(() =>
      expect(screen.getByLabelText(fill('status.housekeeping.dirty'))).toBeTruthy(),
    );
    expect(screen.getByLabelText(fill('status.housekeeping.in_progress'))).toBeTruthy();
    expect(screen.getByLabelText(fill('status.housekeeping.clean'))).toBeTruthy();
    expect(screen.getByLabelText(fill('status.housekeeping.inspected'))).toBeTruthy();
    // Maintenance owns that call, and it arrives through a ticket (F-P05).
    expect(screen.queryByLabelText(fill('status.housekeeping.out_of_order'))).toBeNull();
  });

  it('names the room it is about', async () => {
    renderInScheme(work(<RoomStatusSheet roomId="303" />), scheme);
    await waitFor(() =>
      expect(
        screen.getByText(
          fill('work.rooms.sheetSubtitle')
            .replace('{room}', '303')
            .replace('{type}', 'Std Twin')
            .replace('{floor}', '3'),
        ),
      ).toBeTruthy(),
    );
  });

  it('sets the status, says what it did, and closes', async () => {
    renderInScheme(work(<RoomStatusSheet roomId="303" />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(fill('status.housekeeping.clean'))).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText(fill('status.housekeeping.clean')));

    await waitFor(() =>
      expect(
        screen.getByText(
          fill('work.rooms.setToast')
            .replace('{room}', '303')
            .replace('{status}', fill('status.housekeeping.clean')),
        ),
      ).toBeTruthy(),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('carries the escape to the fault form', async () => {
    renderInScheme(work(<RoomStatusSheet roomId="303" />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(fill('work.rooms.reportIssue'))).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText(fill('work.rooms.reportIssue')));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/report-fault',
      params: { room: '303' },
    });
  });
});
