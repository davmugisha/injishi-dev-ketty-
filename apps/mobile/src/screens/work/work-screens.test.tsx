/**
 * The rest of the Work surface, in both schemes — frames W5, W6, W7 and the
 * Tickets tab.
 *
 * Five screens in one file because each has one claim worth holding:
 *
 *   - **Tickets** — the empty state is a result, not an absence, and a card
 *     says what a ticket did to its room only when it did it.
 *   - **Report a fault** — the primary is inert until a room, a fault AND a
 *     severity are chosen, it says which is missing, and it files once.
 *   - **Inspection** — pass and fail both exist, fail asks why, and neither
 *     says it worked unless it did.
 *   - **Shift summary** — what the queue knows, and nothing invented.
 *   - **Connection** — the simulated outage is the demo's alone, and
 *     Reconnect never turns it on.
 *
 * **Every write is made to fail as well** (mobile audit 2026-10-05, WK-32),
 * and no assertion pins a fixture person: the rows a test needs are written
 * into the store by the test.
 */
import { type ReactElement } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TicketsBoard } from './tickets-board';
import { ReportFault } from './report-fault';
import { Inspection } from './inspection';
import { WorkShiftSummary } from './work-shift-summary';
import { WorkConnection } from './work-connection';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { SCHEMES, enclosingFill, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { palettes } from '@/theme/palette';
import {
  MUTATION_LATENCY_MS,
  hasFixture,
  readFixture,
  resetFixtures,
  writeFixture,
} from '@/data/use-fixture-mutation';
import {
  SEED_ROOMS,
  SEED_TASKS,
  type InspectionRow,
  type WorkTicket,
} from './work-fixtures';
import {
  CONNECTION_KEY,
  INSPECTIONS_KEY,
  ROOMS_KEY,
  TASKS_KEY,
  TICKETS_KEY,
  resetWorkSession,
  type Connection,
} from './work-store';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, navigate: mockNavigate, replace: jest.fn() }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

// The picker asks for permission on TAP, never on mount, so nothing here
// touches it — but the module still has to resolve for the form to render.
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));

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

/** The read failed; its retry recovers. */
let mockReadError = false;
jest.mock('@/data/use-fixture', () => {
  const actual = jest.requireActual<typeof import('@/data/use-fixture')>('@/data/use-fixture');
  function useFixture<T>(key: string, read: () => T) {
    const real = actual.useFixture<T>(key, read);
    if (!mockReadError) return real;
    return {
      status: 'error' as const,
      data: undefined,
      error: new Error('Forced read failure'),
      retry: () => {
        mockReadError = false;
        real.retry();
      },
    };
  }
  return { ...actual, useFixture };
});

/** The person holding the phone, as `GET /me/profile` answers it. */
let mockIdentity = { name: '', initials: '', phone: '', fromServer: false, pending: false };
jest.mock('@/queries/profile', () => ({
  ...jest.requireActual('@/queries/profile'),
  useMyIdentity: () => mockIdentity,
}));

/** The one demo gate (`usePlatform().isDemo`). Closed unless a test opens it. */
let mockIsDemo = false;
jest.mock('@/queries/platform', () => ({
  ...jest.requireActual('@/queries/platform'),
  usePlatform: () => ({ platform: null, isDemo: mockIsDemo, seededAt: null }),
}));

const work = (ui: ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="work">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

const fill = (key: string) => en[key as keyof typeof en] as string;

/** Two rooms waiting on a check, cleaned by people this test names. */
const WAITING: InspectionRow[] = [
  { room: '201', type: 'Std Twin', kind: 'checkout_clean', by: 'Attendant A', doneAt: '15:04', minutes: 19 },
  { room: '203', type: 'Deluxe King', kind: 'stayover_clean', by: 'Attendant B', doneAt: '14:48', minutes: 24 },
];

const T118: WorkTicket = {
  ref: 'T-118',
  room: '305',
  category: 'electrical',
  severity: 'high',
  line: 'Bedside lamp does not switch on',
  status: 'open',
  photos: 1,
  at: Date.now(),
};

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockNavigate.mockClear();
  mockFailWrites = false;
  mockReadError = false;
  mockIsDemo = false;
  mockIdentity = { name: '', initials: '', phone: '', fromServer: false, pending: false };
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

/* ------------------------------------------------------------------ tickets */

describe.each(SCHEMES)('Tickets in the %s scheme', (scheme) => {
  it('reads an empty board as a result, with the action that fills it', async () => {
    renderInScheme(work(<TicketsBoard />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.tickets.emptyTitle'))).toBeTruthy());
    expect(screen.getByText(fill('work.tickets.emptyBody'))).toBeTruthy();
    // The explanation of what filing does is above it, so the tab is a surface
    // rather than a blank page on the day it is most likely to be opened.
    expect(screen.getByText(fill('work.tickets.explainTitle'))).toBeTruthy();
    expect(screen.getByLabelText(fill('work.tickets.report'))).toBeTruthy();
  });

  it('opens the fault form without assuming a room', async () => {
    renderInScheme(work(<TicketsBoard />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.tickets.report'))).toBeTruthy());

    fireEvent.press(screen.getByLabelText(fill('work.tickets.report')));
    expect(mockPush).toHaveBeenCalledWith('/report-fault');
  });

  it('shows a filed ticket, and what it did to the room when it did it', async () => {
    writeFixture(TICKETS_KEY, [T118]);
    writeFixture(ROOMS_KEY, [
      ...SEED_ROOMS.filter((room) => room.id !== '305'),
      { id: '305', type: 'Std Twin', floor: 3, status: 'out_of_order', ticket: 'T-118' },
    ]);
    writeFixture(TASKS_KEY, [
      ...SEED_TASKS,
      { ...SEED_TASKS[0], id: '305', floor: 3, status: 'blocked', blockedBy: 'T-118' },
    ]);
    renderInScheme(work(<TicketsBoard />), scheme);

    await waitFor(() => expect(screen.getByText('T-118')).toBeTruthy());
    expect(screen.getByText('Bedside lamp does not switch on')).toBeTruthy();
    expect(screen.getByText(fill('work.fault.electrical'))).toBeTruthy();
    expect(screen.getByText(fill('work.severity.high'))).toBeTruthy();
    expect(screen.getByText(fill('work.tickets.blocks'))).toBeTruthy();
    // The filter tab says its count with its noun (WK-12).
    expect(
      screen.getByLabelText(
        fill('work.tabs.ticketsOne').replace('{label}', fill('work.rooms.filterAll')),
      ),
    ).toBeTruthy();
  });

  /**
   * WK-29: every unresolved card said "Room out of order · task blocked",
   * whether or not either was true.
   */
  it('claims nothing about a room that is not out of order', async () => {
    writeFixture(TICKETS_KEY, [T118]);
    renderInScheme(work(<TicketsBoard />), scheme);

    await waitFor(() => expect(screen.getByText('T-118')).toBeTruthy());
    expect(screen.queryByText(fill('work.tickets.blocks'))).toBeNull();
    expect(screen.queryByText(fill('work.tickets.outOfOrder'))).toBeNull();
  });

  it('says out of order alone when no task is blocked on the ticket', async () => {
    writeFixture(TICKETS_KEY, [T118]);
    writeFixture(ROOMS_KEY, [
      { id: '305', type: 'Std Twin', floor: 3, status: 'out_of_order', ticket: 'T-118' },
    ]);
    renderInScheme(work(<TicketsBoard />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.tickets.outOfOrder'))).toBeTruthy());
    expect(screen.queryByText(fill('work.tickets.blocks'))).toBeNull();
  });
});

/* ----------------------------------------------------------- report a fault */

/** Picks a fault and a severity, which with a room is everything a ticket needs. */
function pickFaultAndSeverity() {
  fireEvent.press(screen.getByLabelText(fill('work.fault.electrical')));
  fireEvent.press(screen.getByLabelText(fill('work.severity.high')));
}

describe.each(SCHEMES)('Report a fault in the %s scheme', (scheme) => {
  it('puts the photograph first and names where the ticket goes', async () => {
    renderInScheme(work(<ReportFault presetRoom="305" />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.report.title'))).toBeTruthy());
    expect(screen.getByText(fill('work.report.eyebrow'))).toBeTruthy();
    expect(screen.getByText(fill('work.report.photoLegend'))).toBeTruthy();
    expect(screen.getByLabelText(fill('picker.addPhoto'))).toBeTruthy();
  });

  it('holds the primary shut until a fault AND a severity are chosen', async () => {
    renderInScheme(work(<ReportFault presetRoom="305" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.needBoth'))).toBeTruthy());

    fireEvent.press(screen.getByLabelText(fill('work.fault.electrical')));
    // One of two: still not ready, and the label still says which.
    expect(screen.getByLabelText(fill('work.report.needBoth'))).toBeTruthy();

    fireEvent.press(screen.getByLabelText(fill('work.severity.high')));
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.send'))).toBeTruthy());
  });

  it('prints the consequence under the button rather than after it', async () => {
    writeFixture(TASKS_KEY, [...SEED_TASKS, { ...SEED_TASKS[0], id: '305', floor: 3 }]);
    renderInScheme(work(<ReportFault presetRoom="305" />), scheme);

    await waitFor(() =>
      expect(
        screen.getByText(fill('work.report.consequence').replace('{room}', '305')),
      ).toBeTruthy(),
    );
  });

  it('says the room is the one you are standing in only when it came from there', async () => {
    renderInScheme(work(<ReportFault presetRoom="305" />), scheme);
    await waitFor(() =>
      expect(screen.getByText(`Std Twin · ${fill('work.report.roomHint')}`)).toBeTruthy(),
    );
  });

  /**
   * WK-07: opened from Tickets, it used to choose the first room in the list
   * and call it "the room you are standing in". Filing then took THAT room out
   * of order. Nothing is chosen now, and the primary asks for a room.
   */
  it('chooses no room it was not given, and asks for one', async () => {
    renderInScheme(work(<ReportFault />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.needRoom'))).toBeTruthy());

    for (const id of ['104', '301', '305']) {
      const chip = screen.getByLabelText(fill('work.report.roomOption').replace('{room}', id));
      expect(chip.props.accessibilityState?.selected).toBe(false);
    }
    expect(screen.queryByText(new RegExp(fill('work.report.roomHint')))).toBeNull();

    // Ready on everything else, still not ready without a room.
    pickFaultAndSeverity();
    fireEvent.press(screen.getByLabelText(fill('work.report.needRoom')));
    await waitFor(() => expect(screen.getAllByText(fill('work.report.needRoom')).length).toBeGreaterThan(1));
    expect(hasFixture(TICKETS_KEY)).toBe(false);

    // Picked by hand: the type, and no claim about where the reader stands.
    fireEvent.press(screen.getByLabelText(fill('work.report.roomOption').replace('{room}', '305')));
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.send'))).toBeTruthy());
    expect(screen.getByText('Std Twin')).toBeTruthy();
    expect(screen.queryByText(new RegExp(fill('work.report.roomHint')))).toBeNull();
  });

  it('files the ticket, blocks the room, and lands on the board it went to', async () => {
    writeFixture(TASKS_KEY, [...SEED_TASKS, { ...SEED_TASKS[0], id: '305', floor: 3 }]);
    renderInScheme(work(<ReportFault presetRoom="305" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.needBoth'))).toBeTruthy());

    pickFaultAndSeverity();
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.send'))).toBeTruthy());
    fireEvent.press(screen.getByLabelText(fill('work.report.send')));

    await waitFor(() =>
      expect(
        screen.getByText(
          fill('work.report.filedToast').replace('{ref}', 'T-118').replace('{room}', '305'),
        ),
      ).toBeTruthy(),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/tickets');
  });

  /** WK-08: two taps filed two "T-118" tickets. */
  it('files once, however fast the primary is pressed', async () => {
    renderInScheme(work(<ReportFault presetRoom="305" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.needBoth'))).toBeTruthy());
    pickFaultAndSeverity();
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.send'))).toBeTruthy());

    const send = screen.getByLabelText(fill('work.report.send'));
    fireEvent.press(send);
    fireEvent.press(send);
    fireEvent.press(screen.getByLabelText(fill('work.report.send')));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/tickets'));
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(readFixture<WorkTicket[]>(TICKETS_KEY, [])).toHaveLength(1);
  });

  /** WK-04: a fault that was not filed used to say it was, and leave. */
  it('neither says it filed nor leaves when the ticket did not save', async () => {
    renderInScheme(work(<ReportFault presetRoom="305" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.needBoth'))).toBeTruthy());
    pickFaultAndSeverity();
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.send'))).toBeTruthy());
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(fill('work.report.send')));

    await waitFor(() => expect(screen.getByText(fill('work.faultFailedTitle'))).toBeTruthy());
    expect(
      screen.queryByText(
        fill('work.report.filedToast').replace('{ref}', 'T-118').replace('{room}', '305'),
      ),
    ).toBeNull();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    // And the room was not taken out of order on the strength of no ticket.
    expect(hasFixture(ROOMS_KEY)).toBe(false);

    mockFailWrites = false;
    fireEvent.press(screen.getByLabelText(fill('write.retry')));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/tickets'));
  });

  /** WK-06: the room list had no read states at all. */
  it('says the room list did not load, and loads it again', async () => {
    mockReadError = true;
    renderInScheme(work(<ReportFault />), scheme);

    await waitFor(() => expect(screen.getByText(en['state.errorTitle'])).toBeTruthy());
    expect(
      screen.queryByLabelText(fill('work.report.roomOption').replace('{room}', '305')),
    ).toBeNull();

    fireEvent.press(screen.getByLabelText(en['state.retry']));
    await waitFor(() =>
      expect(
        screen.getByLabelText(fill('work.report.roomOption').replace('{room}', '305')),
      ).toBeTruthy(),
    );
  });
});

/* --------------------------------------------------------------- inspection */

describe.each(SCHEMES)('Inspection in the %s scheme', (scheme) => {
  it('lists the rooms waiting on a check, with who cleaned each', async () => {
    writeFixture(INSPECTIONS_KEY, WAITING);
    renderInScheme(work(<Inspection />), scheme);

    await waitFor(() => expect(screen.getByText('201')).toBeTruthy());
    expect(
      screen.getByText(fill('work.inspection.lead').replace('{count}', '2')),
    ).toBeTruthy();
    expect(screen.getByText(`${fill('work.kind.checkoutClean')} · Attendant A`)).toBeTruthy();
    expect(
      screen.getByText(
        fill('work.inspection.doneAt').replace('{time}', '15:04').replace('{minutes}', '19'),
      ),
    ).toBeTruthy();
  });

  it('says what the desk cannot do until each room passes', async () => {
    writeFixture(INSPECTIONS_KEY, WAITING);
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() =>
      expect(
        screen.getByText(fill('work.inspection.blockNote').replace('{room}', '201')),
      ).toBeTruthy(),
    );
    expect(screen.getByText(fill('work.inspection.footnote'))).toBeTruthy();
  });

  /**
   * WK-02: the eyebrow printed the personas fixture, "Samuel Kayitare ·
   * Housekeeping supervisor", to every real seat. It is the server's name for
   * this person, and claims no title.
   */
  it('names the person signing as the server knows them, and nobody else', async () => {
    mockIdentity = { name: 'Amina Uwase', initials: 'AU', phone: '', fromServer: true, pending: false };
    renderInScheme(work(<Inspection />), scheme);

    await waitFor(() => expect(screen.getByText('Amina Uwase')).toBeTruthy());
    expect(screen.queryByText(/Samuel|Kayitare/)).toBeNull();
    expect(screen.queryByText(/Housekeeping supervisor/i)).toBeNull();
  });

  it('says the name is not added yet rather than borrow one', async () => {
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() => expect(screen.getByText(en['identity.unnamed'])).toBeTruthy());
    expect(screen.queryByText(/Samuel|Kayitare/)).toBeNull();
  });

  it('passes a room, and says only that it passed', async () => {
    writeFixture(INSPECTIONS_KEY, WAITING);
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(`${fill('work.inspection.pass')} 201`)).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText(`${fill('work.inspection.pass')} 201`));

    await waitFor(() =>
      expect(
        screen.getByText(fill('work.inspection.passToast').replace('{room}', '201')),
      ).toBeTruthy(),
    );
    // It used to add "the front desk can sell it": no desk was told.
    expect(screen.queryByText(/can sell it/)).toBeNull();
  });

  /** WK-04 and WK-05: Pass never checked, and the screen had no failure state. */
  it('says nothing about a Pass that did not save, and Try again passes it', async () => {
    writeFixture(INSPECTIONS_KEY, WAITING);
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(`${fill('work.inspection.pass')} 201`)).toBeTruthy(),
    );
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(`${fill('work.inspection.pass')} 201`));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    const said = fill('work.inspection.passToast').replace('{room}', '201');
    expect(screen.queryByText(said)).toBeNull();

    mockFailWrites = false;
    fireEvent.press(screen.getByLabelText(fill('write.retry')));
    await waitFor(() => expect(screen.getByText(said)).toBeTruthy());
  });

  it('will not send a room back without saying what was wrong', async () => {
    writeFixture(INSPECTIONS_KEY, WAITING);
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(`${fill('work.inspection.fail')} 201`)).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText(`${fill('work.inspection.fail')} 201`));

    await waitFor(() =>
      expect(screen.getByText(fill('work.inspection.failLegend'))).toBeTruthy(),
    );
    const returnTo = fill('work.inspection.failReturn').replace('{name}', 'Attendant A');
    // Inert until a reason is ticked: the sheet exists so the attendant is told
    // what to redo.
    expect(screen.getByLabelText(returnTo)).toBeDisabled();

    fireEvent.press(screen.getByLabelText(fill('work.reason.bathroom')));
    await waitFor(() => expect(screen.getByLabelText(returnTo)).not.toBeDisabled());

    fireEvent.press(screen.getByLabelText(returnTo));
    await waitFor(() =>
      expect(
        screen.getByText(
          fill('work.inspection.failToast')
            .replace('{room}', '201')
            .replace('{name}', 'Attendant A'),
        ),
      ).toBeTruthy(),
    );
  });

  it('says nothing about a Fail that did not save', async () => {
    writeFixture(INSPECTIONS_KEY, WAITING);
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(`${fill('work.inspection.fail')} 201`)).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText(`${fill('work.inspection.fail')} 201`));
    await waitFor(() => expect(screen.getByText(fill('work.inspection.failLegend'))).toBeTruthy());
    fireEvent.press(screen.getByLabelText(fill('work.reason.linen')));
    const returnTo = fill('work.inspection.failReturn').replace('{name}', 'Attendant A');
    await waitFor(() => expect(screen.getByLabelText(returnTo)).not.toBeDisabled());
    mockFailWrites = true;

    fireEvent.press(screen.getByLabelText(returnTo));

    await waitFor(() => expect(screen.getByText(fill('work.writeFailedTitle'))).toBeTruthy());
    expect(
      screen.queryByText(
        fill('work.inspection.failToast').replace('{room}', '201').replace('{name}', 'Attendant A'),
      ),
    ).toBeNull();
  });

  /**
   * WK-16: Pass painted white on `success500`, about 2.2:1 in light against a
   * 4.5 floor. It paints the fill's designed ink now, the pair the swipe Start
   * panel paints too.
   */
  it('paints Pass in the success fill’s own ink', async () => {
    writeFixture(INSPECTIONS_KEY, WAITING);
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() => expect(screen.getAllByText(fill('work.inspection.pass')).length).toBe(2));

    const label = screen.getAllByText(fill('work.inspection.pass'))[0];
    const p = paletteFor(scheme);
    expect(flattenStyle(label.props.style).color).toBe(p.textOnSuccess);
    expect(enclosingFill(label)).toBe(p.success500);
  });
});

/** WCAG 2.1 contrast, for the pair Pass and the swipe Start panel paint. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [l1, l2] = [lum(a), lum(b)];
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

describe('the success pair Work paints (WK-16)', () => {
  it.each(SCHEMES)('clears 4.5:1 for text in the %s scheme', (scheme) => {
    const p = palettes[scheme];
    expect(contrast(p.textOnSuccess, p.success500)).toBeGreaterThanOrEqual(4.5);
  });

  it('is why Pass stopped painting `surface1`: that white on the fill fails in light', () => {
    expect(contrast(palettes.light.surface1, palettes.light.success500)).toBeLessThan(4.5);
  });
});

/* ------------------------------------------------------------ shift summary */

describe.each(SCHEMES)('The shift summary in the %s scheme', (scheme) => {
  /**
   * WK-02: this claimed eleven rooms cleaned, a 22 minute average and a fixed
   * list of rooms, none of which anybody did. It says what the queue knows.
   */
  it('says what is left, invents nothing, and says it is not a ranking', async () => {
    renderInScheme(work(<WorkShiftSummary />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.shift.title'))).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText(`${fill('work.shift.left')}, 6`)).toBeTruthy());
    expect(screen.queryByText(/Rooms cleaned|Average per room/)).toBeNull();
    expect(screen.queryByText(/06:00|14:00/)).toBeNull();
    expect(screen.getByText(fill('work.shift.noneYet'))).toBeTruthy();
    expect(screen.getByText(fill('work.shift.footnote'))).toBeTruthy();
  });

  it('lists only the rooms finished on this queue', async () => {
    writeFixture(
      TASKS_KEY,
      SEED_TASKS.map((task) => (task.id === '104' ? { ...task, status: 'done' as const } : task)),
    );
    renderInScheme(work(<WorkShiftSummary />), scheme);

    // One node, one sentence, rather than inert chips a reader has to cross.
    await waitFor(() =>
      expect(screen.getByLabelText(`${fill('work.shift.finishedTitle')}: 104`)).toBeTruthy(),
    );
  });

  /** WK-02 and WK-31: the server's name, drawn in caps by style and not by the string. */
  it('names the person as the server knows them, never upper-cased in the string', async () => {
    mockIdentity = { name: 'Amina Uwase', initials: 'AU', phone: '', fromServer: true, pending: false };
    renderInScheme(work(<WorkShiftSummary />), scheme);

    await waitFor(() => expect(screen.getByText('Amina Uwase')).toBeTruthy());
    expect(screen.queryByText('AMINA UWASE')).toBeNull();
    expect(screen.queryByText(/Samuel|Kayitare/)).toBeNull();
  });

  it('draws no name while the profile is being read, and no placeholder name', async () => {
    mockIdentity = { name: '', initials: '', phone: '', fromServer: false, pending: true };
    renderInScheme(work(<WorkShiftSummary />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.shift.title'))).toBeTruthy());
    expect(screen.queryByText(en['identity.unnamed'])).toBeNull();
    expect(screen.queryByText(/Samuel|Kayitare/)).toBeNull();
  });
});

/* --------------------------------------------------------------- connection */

describe.each(SCHEMES)('The connection block in the %s scheme', (scheme) => {
  it('on the demo, simulates an outage and says the work is saved', async () => {
    mockIsDemo = true;
    renderInScheme(work(<WorkConnection />), scheme);

    await waitFor(() =>
      expect(screen.getByLabelText(fill('work.offline.simulateLabel'))).toBeTruthy(),
    );
    expect(screen.getByText(fill('work.offline.connected'))).toBeTruthy();

    fireEvent.press(screen.getByLabelText(fill('work.offline.simulateLabel')));

    await waitFor(() => expect(screen.getByText(fill('work.offline.lostToast'))).toBeTruthy());
  });

  /** WK-10: the switch shipped to every Work seat. AC-W10 allows it on the demo only. */
  it('offers no simulated outage outside the demo', async () => {
    renderInScheme(work(<WorkConnection />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.offline.title'))).toBeTruthy());
    expect(screen.getByText(fill('work.offline.connected'))).toBeTruthy();
    expect(screen.queryByLabelText(fill('work.offline.simulateLabel'))).toBeNull();
    expect(screen.queryByText(fill('work.offline.simulateHint'))).toBeNull();
  });

  /**
   * WK-11: after a real outage, with changes left waiting and the switch off,
   * Reconnect turned the simulated outage ON and toasted "Signal lost". It
   * empties the list now and does nothing else.
   */
  it('ends a real outage’s leftovers on Reconnect, and never starts a simulated one', async () => {
    writeFixture(CONNECTION_KEY, {
      simulateOffline: false,
      buffer: [{ key: 'k1', room: '303', kind: 'clean' as const, at: 10 }],
    });
    renderInScheme(work(<WorkConnection />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.offline.reconnect'))).toBeTruthy());

    fireEvent.press(screen.getByLabelText(fill('work.offline.reconnect')));

    await waitFor(() =>
      expect(screen.getByText(fill('work.offline.backOnlineToast'))).toBeTruthy(),
    );
    expect(screen.queryByText(fill('work.offline.lostToast'))).toBeNull();
    expect(readFixture<Connection>(CONNECTION_KEY, { simulateOffline: true, buffer: [] })).toEqual({
      simulateOffline: false,
      buffer: [],
    });
  });

  it('offers no Reconnect while the phone is really offline', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    writeFixture(CONNECTION_KEY, {
      simulateOffline: false,
      buffer: [{ key: 'k1', room: '303', kind: 'clean' as const, at: 10 }],
    });
    renderInScheme(work(<WorkConnection />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.offline.realOffline'))).toBeTruthy());
    expect(screen.queryByLabelText(fill('work.offline.reconnect'))).toBeNull();
  });

  it('admits when the outage is real and not the switch', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    renderInScheme(work(<WorkConnection />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.offline.realOffline'))).toBeTruthy());
  });

  it('keeps the changes waiting when the switch goes off under a real outage', async () => {
    mockIsDemo = true;
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    const waiting = [{ key: 'k1', room: '303', kind: 'clean' as const, at: 10 }];
    writeFixture(CONNECTION_KEY, { simulateOffline: true, buffer: waiting });
    renderInScheme(work(<WorkConnection />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(fill('work.offline.simulateLabel'))).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText(fill('work.offline.simulateLabel')));

    await waitFor(() =>
      expect(readFixture<Connection>(CONNECTION_KEY, { simulateOffline: true, buffer: [] }).simulateOffline).toBe(false),
    );
    // Still really offline, so not "Back online", and the changes still wait.
    expect(screen.queryByText(fill('work.offline.backOnlineToast'))).toBeNull();
    expect(readFixture<Connection>(CONNECTION_KEY, { simulateOffline: true, buffer: [] }).buffer).toEqual(waiting);
  });
});
