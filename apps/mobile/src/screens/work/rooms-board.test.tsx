/**
 * The floor board and its status sheet, in both schemes — frame W4.
 *
 * The board's whole claim is that housekeeping status is its own axis, so the
 * assertions are about that: every tile says its state in words as well as in
 * colour, the filter row offers only states that occur, and the sheet offers
 * the four an attendant may set — never `out_of_order`, which is Maintenance's
 * call and arrives through a ticket.
 *
 * gaps.md calls the sheet "the most-used write of the surface", so its failure
 * path is forced here too (mobile audit 2026-10-05, WK-32): a status that did
 * not save must neither toast nor close, and Try again must send THAT status.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { RoomsBoard } from './rooms-board';
import { RoomStatusSheet } from './room-status-sheet';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import {
  MUTATION_LATENCY_MS,
  readFixture,
  resetFixtures,
  writeFixture,
} from '@/data/use-fixture-mutation';
import { SEED_ROOMS, SEED_TASKS, type WorkRoom } from './work-fixtures';
import { CONNECTION_KEY, ROOMS_KEY, TASKS_KEY, resetWorkSession } from './work-store';

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

/** The read, held in flight or failed; a failed read's retry recovers. */
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

/** What a status tab says to a screen reader: "Dirty, 1 room". */
const statusTab = (status: string, count: number) =>
  fill(count === 1 ? 'work.tabs.roomsOne' : 'work.tabs.rooms')
    .replace('{label}', fill(`status.housekeeping.${status}`))
    .replace('{count}', String(count));

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

describe.each(SCHEMES)('The floor board in the %s scheme', (scheme) => {
  it('draws the floor with its room count in the eyebrow', async () => {
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText('301')).toBeTruthy());
    expect(
      screen.getByText(`Kivu Crest Hotel · ${fill('work.rooms.eyebrow').replace('{count}', '12')}`),
    ).toBeTruthy();
  });

  /** WK-24: the eyebrow and the tabs used to count the seed during the skeleton. */
  it('counts nothing until the board has been read', () => {
    mockRead = 'loading';
    renderInScheme(work(<RoomsBoard />), scheme);

    expect(screen.getByText('Kivu Crest Hotel')).toBeTruthy();
    expect(screen.queryByText(/12 rooms/)).toBeNull();
    expect(screen.queryByLabelText(/, \d+ rooms?$/)).toBeNull();
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

    // The count is its own pill, and the tab says it with its noun (WK-12).
    fireEvent.press(screen.getByLabelText(statusTab('dirty', 1)));

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

  /**
   * WK-25: a real outage drew the app-wide banner AND this board's own bar.
   * The app-wide one speaks for it; the note about the board stays.
   */
  it('leaves a real loss of signal to the app-wide banner, and says the board may be old', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText(fill('state.offlineLastList'))).toBeTruthy());
    expect(screen.queryByText(fill('work.offline.bannerTitle'))).toBeNull();
  });

  it('draws its own bar for the simulated outage, which no other banner sees', async () => {
    writeFixture(CONNECTION_KEY, { simulateOffline: true, buffer: [] });
    renderInScheme(work(<RoomsBoard />), scheme);
    await waitFor(() => expect(screen.getByText(fill('work.offline.bannerTitle'))).toBeTruthy());
    // Not "This phone has no connection": in a simulation it has one.
    expect(screen.getByText(fill('work.offline.simulatedDetail'))).toBeTruthy();
    expect(screen.queryByText(fill('work.offline.realOffline'))).toBeNull();
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

  /**
   * WK-04 and WK-05: a status that did not save used to toast and close the
   * sheet, and its Try again only cleared the error. It stays open now, and
   * Try again sends the same status again.
   */
  it('neither says nor closes when the status did not save, and Try again sends it', async () => {
    renderInScheme(work(<RoomStatusSheet roomId="303" />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(fill('status.housekeeping.clean'))).toBeTruthy(),
    );
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(fill('status.housekeeping.clean')));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    const said = fill('work.rooms.setToast')
      .replace('{room}', '303')
      .replace('{status}', fill('status.housekeeping.clean'));
    expect(screen.queryByText(said)).toBeNull();
    expect(mockBack).not.toHaveBeenCalled();

    mockFailWrites = false;
    fireEvent.press(screen.getByLabelText(fill('write.retry')));

    await waitFor(() => expect(screen.getByText(said)).toBeTruthy());
    expect(mockBack).toHaveBeenCalled();
    const room = readFixture<WorkRoom[]>(ROOMS_KEY, []).find((row) => row.id === '303');
    expect(room?.status).toBe('clean');
  });

  /** WK-06: it used to offer four options for a room it could not read. */
  it('offers nothing for a room it could not read, and reads again on request', async () => {
    mockRead = 'error';
    renderInScheme(work(<RoomStatusSheet roomId="303" />), scheme);

    await waitFor(() => expect(screen.getByText(en['state.errorTitle'])).toBeTruthy());
    expect(screen.queryByLabelText(fill('status.housekeeping.clean'))).toBeNull();

    fireEvent.press(screen.getByLabelText(en['state.retry']));
    await waitFor(() =>
      expect(screen.getByLabelText(fill('status.housekeeping.clean'))).toBeTruthy(),
    );
  });

  it('draws a skeleton while the room is being read', () => {
    mockRead = 'loading';
    renderInScheme(work(<RoomStatusSheet roomId="303" />), scheme);

    expect(
      screen.getByLabelText(
        en['state.loadingList'].replace('{label}', fill('work.rooms.sheetListLabel')),
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText(fill('status.housekeeping.clean'))).toBeNull();
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
