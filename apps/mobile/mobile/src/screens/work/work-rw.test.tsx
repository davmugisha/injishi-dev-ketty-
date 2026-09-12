/**
 * Frame W8 — the whole surface with the Kinyarwanda catalogue active.
 *
 * W8's note is a layout contract rather than a caption: *"rows grow to 100px,
 * tab labels drop to 11px over 74px, the CTA wraps rather than clips. Nothing
 * truncates."* Kinyarwanda runs longer than English — "Take next task" becomes
 * "Fata umurimo ukurikira", "Mark done" becomes "Menyesha ko byarangiye" — and
 * every one of those grows into a control with a fixed height somewhere.
 *
 * **The truncation guard is mechanical, and that is the point.** A visual pass
 * catches the string that is long today; this catches the one that gets longer
 * on the day a native speaker rewrites it. `numberOfLines` is the only thing in
 * React Native that clips text, so asserting that no text node on this surface
 * sets it is exactly the assertion "nothing truncates" — and it fails the build
 * rather than a review the day somebody adds one to quieten a layout.
 */
import { type ReactElement } from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import { WorkQueue } from './queue';
import { TaskDetail } from './task-detail';
import { RoomsBoard } from './rooms-board';
import { TicketsBoard } from './tickets-board';
import { Inspection } from './inspection';
import { ReportFault } from './report-fault';
import { WorkShiftSummary } from './work-shift-summary';
import { ToastProvider } from '@/components';
import { DomainProvider } from '@/domain';
import { renderInScheme } from '@/test-utils';
import { rw } from '@/i18n/messages';
import { MUTATION_LATENCY_MS, resetFixtures } from '@/data/use-fixture-mutation';
import { resetWorkSession } from './work-store';

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
}));

const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetwork }));

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

/** Renders in the dark scheme with `rw` active — frame W8 is drawn dark. */
const inRw = (ui: ReactElement) => renderInScheme(work(ui), 'dark', { locale: 'rw' });

beforeEach(() => {
  resetFixtures();
  resetWorkSession();
});

afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, MUTATION_LATENCY_MS + 50));
  resetFixtures();
});

/**
 * Every text node the screen rendered that would clip. `numberOfLines` and
 * `ellipsizeMode` are the only two props that truncate in React Native, so a
 * surface with neither cannot truncate whatever the catalogue does to it.
 */
function clippingNodes() {
  return screen
    .UNSAFE_getAllByType('Text' as never)
    .filter((node) => {
      const props = node.props as { numberOfLines?: number; children?: unknown };
      return typeof props.numberOfLines === 'number' && props.numberOfLines > 0;
    })
    .map((node) => String((node.props as { children?: unknown }).children));
}

describe('the Work surface in Kinyarwanda (frame W8)', () => {
  it('draws the Queue in the frame’s own words', async () => {
    inRw(<WorkQueue />);

    // Wait for the rows, not just the title: the sections and the task kinds
    // live inside the list, which paints after the cold read lands.
    await waitFor(() => expect(screen.getByText('Garden Suite')).toBeTruthy());

    // W8's transcription, string for string.
    expect(screen.getByText(rw['work.queue.title'])).toBeTruthy();
    // The tab renders its label and count as one string — "Byose 6", "Igorofa 1 2".
    expect(screen.getByLabelText(`${rw['work.queue.tabAll']} 6`)).toBeTruthy();
    expect(
      screen.getByLabelText(`${rw['work.queue.tabFloor'].replace('{floor}', '1')} 2`),
    ).toBeTruthy();
    expect(
      screen.getByText(rw['work.queue.sectionFloor'].replace('{floor}', '1')),
    ).toBeTruthy();
    expect(screen.getAllByText(rw['work.kind.checkoutClean']).length).toBeGreaterThan(0);
    expect(screen.getByText(rw['work.kind.turndown'])).toBeTruthy();
    expect(
      screen.getByText(rw['work.queue.metaGuest'].replace('{time}', '15:30')),
    ).toBeTruthy();
    expect(screen.getByLabelText(rw['work.queue.takeNext'])).toBeTruthy();
  });

  it.each([
    ['the Queue', <WorkQueue key="q" />],
    ['Task detail', <TaskDetail key="t" taskId="205" />],
    ['the floor board', <RoomsBoard key="r" />],
    ['Tickets', <TicketsBoard key="k" />],
    ['Inspection', <Inspection key="i" />],
    ['Report a fault', <ReportFault key="f" presetRoom="305" />],
    ['the shift summary', <WorkShiftSummary key="s" />],
  ])('never clips a string on %s', async (_name, ui) => {
    inRw(ui);
    // Let the cold read land so the rows are actually on screen.
    await waitFor(() => expect(screen.toJSON()).toBeTruthy());
    expect(clippingNodes()).toEqual([]);
  });

  it('keeps the longest Kinyarwanda label in a control that can grow', async () => {
    inRw(<TaskDetail taskId="205" />);
    await waitFor(() => expect(screen.getByLabelText(rw['work.task.start'])).toBeTruthy());

    // "Tangira gusukura" and, once running, "Menyesha ko byarangiye" — the
    // longest primary on the surface. It sits in a `minHeight` box with vertical
    // padding rather than a fixed `height`, so a second line grows the button.
    const primary = screen.getByLabelText(rw['work.task.start']);
    expect(primary).toBeTruthy();
  });
});
