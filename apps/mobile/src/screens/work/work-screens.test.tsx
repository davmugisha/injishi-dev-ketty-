/**
 * The rest of the Work surface, in both schemes — frames W5, W6, W7 and the
 * Tickets tab.
 *
 * Four screens in one file because each has one claim worth holding:
 *
 *   - **Tickets** — the empty state is a result, not an absence, and it carries
 *     the action that fills it.
 *   - **Report a fault** — the primary is inert until a fault AND a severity are
 *     chosen, and it says which is missing rather than sitting there greyed.
 *   - **Inspection** — pass and fail both exist, fail asks why, and the footnote
 *     explains why a supervisor's own rooms are not on the list.
 *   - **Shift summary** — three numbers, and the sentence that says nobody is
 *     being ranked.
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
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, resetFixtures, writeFixture } from '@/data/use-fixture-mutation';
import { SEED_TASKS, WORK_PROFILE, type WorkTicket } from './work-fixtures';
import { TASKS_KEY, TICKETS_KEY, resetWorkSession } from './work-store';

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

const work = (ui: ReactElement) => (
  <DomainProvider initial="hospitality" initialSurface="work">
    <ToastProvider>{ui}</ToastProvider>
  </DomainProvider>
);

const fill = (key: string) => en[key as keyof typeof en] as string;

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockNavigate.mockClear();
  resetFixtures();
  resetWorkSession();
  mockNetwork.isConnected = true;
  mockNetwork.isInternetReachable = true;
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
});

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

  it('shows a filed ticket with what it did to the room', async () => {
    const ticket: WorkTicket = {
      ref: 'T-118',
      room: '305',
      category: 'electrical',
      severity: 'high',
      line: 'Bedside lamp does not switch on',
      status: 'open',
      photos: 1,
      at: Date.now(),
    };
    writeFixture(TICKETS_KEY, [ticket]);
    renderInScheme(work(<TicketsBoard />), scheme);

    await waitFor(() => expect(screen.getByText('T-118')).toBeTruthy());
    expect(screen.getByText('Bedside lamp does not switch on')).toBeTruthy();
    expect(screen.getByText(fill('work.fault.electrical'))).toBeTruthy();
    expect(screen.getByText(fill('work.severity.high'))).toBeTruthy();
    expect(screen.getByText(fill('work.tickets.blocks'))).toBeTruthy();
  });
});

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

  it('files the ticket, blocks the room, and lands on the board it went to', async () => {
    writeFixture(TASKS_KEY, [...SEED_TASKS, { ...SEED_TASKS[0], id: '305', floor: 3 }]);
    renderInScheme(work(<ReportFault presetRoom="305" />), scheme);
    await waitFor(() => expect(screen.getByLabelText(fill('work.report.needBoth'))).toBeTruthy());

    fireEvent.press(screen.getByLabelText(fill('work.fault.electrical')));
    fireEvent.press(screen.getByLabelText(fill('work.severity.high')));
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
});

describe.each(SCHEMES)('Inspection in the %s scheme', (scheme) => {
  it('lists the rooms waiting on the supervisor, with who cleaned each', async () => {
    renderInScheme(work(<Inspection />), scheme);

    await waitFor(() => expect(screen.getByText('201')).toBeTruthy());
    expect(
      screen.getByText(fill('work.inspection.lead').replace('{count}', '3')),
    ).toBeTruthy();
    expect(
      screen.getByText(`${fill('work.kind.checkoutClean')} · Beatha M.`),
    ).toBeTruthy();
    expect(
      screen.getByText(
        fill('work.inspection.doneAt').replace('{time}', '15:04').replace('{minutes}', '19'),
      ),
    ).toBeTruthy();
  });

  it('says what the desk cannot do until each room passes', async () => {
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() =>
      expect(
        screen.getByText(fill('work.inspection.blockNote').replace('{room}', '201')),
      ).toBeTruthy(),
    );
    expect(screen.getByText(fill('work.inspection.footnote'))).toBeTruthy();
  });

  it('passes a room and says the desk can sell it', async () => {
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
  });

  it('will not send a room back without saying what was wrong', async () => {
    renderInScheme(work(<Inspection />), scheme);
    await waitFor(() =>
      expect(screen.getByLabelText(`${fill('work.inspection.fail')} 201`)).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText(`${fill('work.inspection.fail')} 201`));

    await waitFor(() =>
      expect(screen.getByText(fill('work.inspection.failLegend'))).toBeTruthy(),
    );
    const returnTo = fill('work.inspection.failReturn').replace('{name}', 'Beatha M.');
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
            .replace('{name}', 'Beatha M.'),
        ),
      ).toBeTruthy(),
    );
  });
});

describe.each(SCHEMES)('The shift summary in the %s scheme', (scheme) => {
  it('is a ledger, and says it is not a ranking', async () => {
    renderInScheme(work(<WorkShiftSummary />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.shift.title'))).toBeTruthy());
    expect(
      screen.getByLabelText(`${fill('work.shift.cleaned')}, ${WORK_PROFILE.cleanedBefore}`),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        `${fill('work.shift.average')}, ${WORK_PROFILE.averageMinutes} ${fill('work.shift.minutes')}`,
      ),
    ).toBeTruthy();
    expect(screen.getByText(fill('work.shift.footnote'))).toBeTruthy();
    // The rooms are one node, not eleven inert chips a reader has to cross.
    expect(
      screen.getByLabelText(
        `${fill('work.shift.finishedTitle')}: ${WORK_PROFILE.roomsFinished.join(', ')}`,
      ),
    ).toBeTruthy();
  });
});

describe.each(SCHEMES)('The connection switch in the %s scheme', (scheme) => {
  it('drops the phone off the network and says the work is safe', async () => {
    renderInScheme(work(<WorkConnection />), scheme);

    await waitFor(() =>
      expect(screen.getByLabelText(fill('work.offline.simulateLabel'))).toBeTruthy(),
    );
    expect(screen.getByText(fill('work.offline.connected'))).toBeTruthy();

    fireEvent.press(screen.getByLabelText(fill('work.offline.simulateLabel')));

    await waitFor(() => expect(screen.getByText(fill('work.offline.lostToast'))).toBeTruthy());
  });

  it('admits when the outage is real and not the switch', async () => {
    mockNetwork.isConnected = false;
    mockNetwork.isInternetReachable = false;
    renderInScheme(work(<WorkConnection />), scheme);

    await waitFor(() => expect(screen.getByText(fill('work.offline.realOffline'))).toBeTruthy());
  });
});
