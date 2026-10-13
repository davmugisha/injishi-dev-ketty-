/**
 * Sheet routes — the net under the 2026-10-11 freeze.
 *
 * Appearance and Sign out froze the app in Expo Go on Android because both were
 * native `formSheet` routes (`sheet-route.tsx` says why). Three things keep it
 * from coming back, and each has a test here:
 *
 *   1. **Android never gets `formSheet`**, and iOS and the web export get
 *      exactly the options the route table always gave them.
 *   2. **No file names a sheet presentation by hand**, so a new route cannot
 *      reach the native Android sheet around the helper. The scanner is shown a
 *      planted declaration first, so a scan that finds nothing means nothing is
 *      there rather than a scanner that cannot see.
 *   3. **Android's frame always has a way out**: the scrim, the back button, the
 *      close button and a pull each dismiss it, exactly once, and a dismissal
 *      that does not end in a pop gives the reader the sheet back.
 */
import { type ReactElement } from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { BackHandler, ScrollView, Text } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { motionMs } from '@injishi/design-tokens';
import { Sheet } from './sheet';
import { ModalSheet } from './modal-sheet';
import {
  SHEET_POP_GRACE_MS,
  makeSheetScreenLayout,
  sheetRouteOptions,
  type SheetSize,
} from './sheet-route';
import { SCHEMES, flattenStyle, paletteFor, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import { scrim, space } from '@/theme/tokens';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}));

const SIZES: SheetSize[] = ['confirm', 'form', 'tall'];

/**
 * The detents the route table registered before 2026-10-11, written out rather
 * than read from `SHEET_DETENTS`, so moving them could not also move the test.
 */
const IOS_DETENTS: Record<SheetSize, number[]> = {
  confirm: [0.34],
  form: [0.55, 0.95],
  tall: [0.92],
};

/* ───────────────────────────────────────────────── 1. the options ── */

describe.each(['ios', 'web'])('a sheet route on %s', (os) => {
  it.each(SIZES)('keeps the platform sheet for a %s sheet, at the detents it always had', (size) => {
    expect(sheetRouteOptions(size, os)).toEqual({
      presentation: 'formSheet',
      sheetAllowedDetents: IOS_DETENTS[size],
      sheetGrabberVisible: true,
    });
  });
});

describe('a sheet route on android', () => {
  it.each(SIZES)('never asks react-native-screens for its bottom sheet (%s)', (size) => {
    const options = sheetRouteOptions(size, 'android');
    expect(options.presentation).toBe('transparentModal');
    expect(options).not.toHaveProperty('sheetAllowedDetents');
    // The Stack paints every screen `bgApp`; a sheet that inherited it would
    // hide the page it is meant to sit on.
    expect(options.contentStyle).toEqual({ backgroundColor: 'transparent' });
  });

  it('hands out a fresh object, so one route cannot change another', () => {
    const first = sheetRouteOptions('confirm', 'android');
    first.animation = 'none';
    expect(sheetRouteOptions('confirm', 'android').animation).toBe('fade');
  });
});

/* ────────────────────────────────────────────── 2. nothing else asks ── */

// The app's tsconfig carries no Node types, and this is the one test that
// reads source files, so it names exactly the four calls it makes. CI enforces
// the same rule through lint (`eslint.config.mjs`); this is its local twin,
// with the control lint cannot show.
declare const __dirname: string;
const fs = require('fs') as {
  readFileSync(file: string, encoding: 'utf8'): string;
  readdirSync(
    dir: string,
    options: { withFileTypes: true },
  ): { name: string; isDirectory(): boolean }[];
};
const path = require('path') as {
  resolve(...parts: string[]): string;
  join(...parts: string[]): string;
  relative(from: string, to: string): string;
};

const MOBILE = path.resolve(__dirname, '../..');
const HELPER = path.join(MOBILE, 'src', 'components', 'sheet-route.tsx');

/** A sheet presentation written as a string, in either quote. */
const DECLARATION = /(['"])(formSheet|transparentModal)\1/g;

/** Comments name these presentations all the time; only code can ask for one. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function sheetPresentationsIn(source: string): string[] {
  return [...stripComments(source).matchAll(DECLARATION)].map((match) => match[2]);
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('the scan for a hand written sheet presentation', () => {
  it('finds a planted one in either quote, and none in a comment', () => {
    expect(
      sheetPresentationsIn(`<Stack.Screen name="x" options={{ presentation: 'formSheet' }} />`),
    ).toEqual(['formSheet']);
    expect(sheetPresentationsIn(`const o = { presentation: "transparentModal" };`)).toEqual([
      'transparentModal',
    ]);
    expect(
      sheetPresentationsIn(`// presentation: 'formSheet'\n/* "transparentModal" */ const url = 'http://x';`),
    ).toEqual([]);
  });

  it('sees both presentations in the one file allowed to write them', () => {
    const found = new Set(sheetPresentationsIn(fs.readFileSync(HELPER, 'utf8')));
    expect(found).toEqual(new Set(['formSheet', 'transparentModal']));
  });

  it('finds no route or screen that asks for either around the helper', () => {
    const files = [...sourceFiles(path.join(MOBILE, 'app')), ...sourceFiles(path.join(MOBILE, 'src'))];
    // A scan of an empty list would pass too; the route table alone is dozens.
    expect(files.length).toBeGreaterThan(100);
    const offenders = files
      .filter((file) => file !== HELPER)
      .flatMap((file) =>
        sheetPresentationsIn(fs.readFileSync(file, 'utf8')).map(
          (found) => `${path.relative(MOBILE, file)}: ${found}`,
        ),
      );
    expect(offenders).toEqual([]);
  });

  it('gives the Stack the Android frame and every sheet shape from the helper', () => {
    const table = stripComments(fs.readFileSync(path.join(MOBILE, 'app', '_layout.tsx'), 'utf8'));
    expect(table).toMatch(/screenLayout=\{sheetScreenLayout\}/);
    for (const size of SIZES) expect(table).toContain(`sheetRouteOptions('${size}')`);
  });
});

/* ──────────────────────────────────────── 3. the frame Android draws ── */

type Layout = ReturnType<typeof makeSheetScreenLayout>;
type LayoutArgs = Parameters<Layout>[0];

function fakeNavigation({ focused = true } = {}) {
  const listeners = new Map<string, () => void>();
  return {
    goBack: jest.fn(),
    isFocused: jest.fn(() => focused),
    addListener: jest.fn((event: string, run: () => void) => {
      listeners.set(event, run);
      return () => listeners.delete(event);
    }),
    emit: (event: string) => listeners.get(event)?.(),
  };
}

/** What a sheet route's screen renders, through the layout the Stack is given. */
function renderRoute({
  os = 'android',
  options = sheetRouteOptions('confirm', os),
  navigation = fakeNavigation(),
  scheme = 'dark' as const,
  sheet = (
    <Sheet title="Appearance" subtitle="How the app is drawn on this phone.">
      <Text>Always dark, whatever the phone is set to.</Text>
    </Sheet>
  ),
}: {
  os?: string;
  options?: ReturnType<typeof sheetRouteOptions>;
  navigation?: ReturnType<typeof fakeNavigation>;
  scheme?: 'light' | 'dark';
  sheet?: ReactElement;
} = {}) {
  const layout = makeSheetScreenLayout(os);
  const element = layout({
    options,
    navigation,
    route: { key: 'appearance-1', name: 'appearance' },
    theme: {},
    children: sheet,
  } as unknown as LayoutArgs);
  renderInScheme(element, scheme);
  return navigation;
}

/** The listener the frame gave Android's back button. */
function backListener(spy: jest.SpyInstance): () => boolean | null | undefined {
  const call = spy.mock.calls.at(-1) as [string, () => boolean | null | undefined];
  return call[1];
}

/** The sheet's own close button. The scrim carries the same label, by design. */
const closeButton = () =>
  screen.getAllByLabelText(en['sheet.close']).find((node) => node.props.testID !== 'sheet-scrim')!;

/** What the panel's first layout reports on a phone: here, a 300pt panel. */
const layOutPanel = () =>
  fireEvent(screen.getByTestId('sheet-panel'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 300 } },
  });

const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms));

describe('the frame around an Android sheet route', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockBack.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('leaves every other route alone', () => {
    renderRoute({ options: { presentation: 'card' } });
    expect(screen.getByText('Always dark, whatever the phone is set to.')).toBeTruthy();
    expect(screen.queryByTestId('sheet-scrim')).toBeNull();
  });

  it('is never drawn on iOS, where the platform draws the sheet', () => {
    renderRoute({ os: 'ios' });
    expect(screen.getByText('Always dark, whatever the phone is set to.')).toBeTruthy();
    expect(screen.queryByTestId('sheet-scrim')).toBeNull();
  });

  it.each(SCHEMES)('draws a scrim and a panel holding the sheet, in %s', (scheme) => {
    renderRoute({ scheme });
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Always dark, whatever the phone is set to.')).toBeTruthy();
    expect(flattenStyle(screen.getByTestId('sheet-scrim').props.style).backgroundColor).toBe(
      scrim.backdrop,
    );
    expect(flattenStyle(screen.getByTestId('sheet-panel').props.style).backgroundColor).toBe(
      paletteFor(scheme).surface1,
    );
  });

  it('lets the content decide the height, and keeps the last row clear of the gesture bar', () => {
    renderRoute();
    const scroller = screen.UNSAFE_getByType(ScrollView);
    expect(flattenStyle(scroller.props.style).flexGrow).toBe(0);
    // `renderInScheme` reports a 34pt bottom inset; a sheet with no footer
    // pads its body by it, because the panel reaches the bottom edge.
    expect(scroller.props.contentContainerStyle.paddingBottom).toBe(space[4] + 34);
  });

  it('keeps the platform-sized layout everywhere else', () => {
    renderRoute({ os: 'ios' });
    const scroller = screen.UNSAFE_getByType(ScrollView);
    expect(scroller.props.style).toBeUndefined();
    expect(scroller.props.contentContainerStyle.paddingBottom).toBe(space[4]);
  });

  it('closes on a tap on the dimmed page, once however many taps arrive', () => {
    const navigation = renderRoute();
    fireEvent.press(screen.getByTestId('sheet-scrim'));
    fireEvent.press(screen.getByTestId('sheet-scrim'));
    advance(motionMs.settle);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("closes on Android's back, and leaves back to a route opened over it", () => {
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    const navigation = renderRoute();
    const onBack = backListener(spy);

    expect(onBack()).toBe(true);
    advance(motionMs.settle);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);

    navigation.isFocused.mockReturnValue(false);
    expect(onBack()).toBe(false);
    spy.mockRestore();
  });

  it("runs the sheet's own close after the panel has gone, not instead of it", () => {
    const onClose = jest.fn();
    const navigation = renderRoute({
      sheet: (
        <Sheet title="Appearance" onClose={onClose}>
          <Text>body</Text>
        </Sheet>
      ),
    });
    fireEvent.press(closeButton());
    expect(onClose).not.toHaveBeenCalled();
    advance(motionMs.settle);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('closes with the default close when the sheet names none', () => {
    renderRoute();
    fireEvent.press(closeButton());
    advance(motionMs.settle);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('draws its own grabber whether or not the sheet asked for one', () => {
    renderRoute();
    // The grabber is decorative and hidden from assistive tech; the header
    // carrying the pull is what a test can reach.
    expect(getByGestureTestId('sheet-drag')).toBeTruthy();
  });

  it('closes on a long pull down, and settles back from a short one', () => {
    const navigation = renderRoute();
    layOutPanel();
    const pull = (distance: number) =>
      act(() =>
        fireGestureHandler(getByGestureTestId('sheet-drag'), [
          { state: State.BEGAN, translationY: 0 },
          { state: State.ACTIVE, translationY: distance / 2 },
          { state: State.ACTIVE, translationY: distance },
          { state: State.END, translationY: distance, velocityY: 0 },
        ]),
      );

    pull(20);
    advance(motionMs.settle);
    expect(navigation.goBack).not.toHaveBeenCalled();

    pull(400);
    advance(motionMs.settle);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('gives the sheet back when a dismissal did not end in a pop', () => {
    const navigation = renderRoute();
    fireEvent.press(screen.getByTestId('sheet-scrim'));
    advance(motionMs.settle);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);

    // The fake navigation never pops, so the route is still here: after the
    // grace period the frame must accept a close again rather than ignore it.
    advance(SHEET_POP_GRACE_MS);
    fireEvent.press(screen.getByTestId('sheet-scrim'));
    advance(motionMs.settle);
    expect(navigation.goBack).toHaveBeenCalledTimes(2);
  });

  it('leaves a ModalSheet opened inside it to close itself, not the route behind it', () => {
    const onModalClose = jest.fn();
    const navigation = renderRoute({
      sheet: (
        <ModalSheet visible title="Decline" onClose={onModalClose}>
          <Text>Why are you declining?</Text>
        </ModalSheet>
      ),
    });
    // The modal's own sheet keeps the platform-sized layout, not the frame's.
    expect(screen.UNSAFE_getByType(ScrollView).props.style).toBeUndefined();
    // Its close button is the last of the three "close" controls on screen:
    // the frame's scrim, the modal's scrim, then the modal sheet's own X.
    const closes = screen.getAllByLabelText(en['sheet.close']);
    fireEvent.press(closes[closes.length - 1]);
    expect(onModalClose).toHaveBeenCalledTimes(1);
    advance(motionMs.settle);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('gives the sheet back when it is focused again after a route opened over it mid close', () => {
    const navigation = renderRoute();
    navigation.isFocused.mockReturnValue(false);
    fireEvent.press(screen.getByTestId('sheet-scrim'));
    advance(motionMs.settle);
    expect(navigation.goBack).not.toHaveBeenCalled();

    navigation.isFocused.mockReturnValue(true);
    act(() => navigation.emit('focus'));
    fireEvent.press(screen.getByTestId('sheet-scrim'));
    advance(motionMs.settle);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});
