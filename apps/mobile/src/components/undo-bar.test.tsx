/**
 * What a screen reader gets from the undo bar.
 *
 * This exists because the bug it guards was invisible to every other test: the
 * bar rendered, the text was on screen, the button was pressable, and VoiceOver
 * said nothing at all for the whole time it was up. A render assertion cannot
 * see that.
 *
 * **Why the platform branch is tested as a function rather than through the
 * component.** `accessibilityLiveRegion` is Android-only, so the two platforms
 * genuinely need different code and both paths deserve an assertion. But the
 * `Platform` this file imports and the one the component imports are different
 * objects under `jest-expo`: redefining `Platform.OS` here changes what the
 * test sees and not what the component sees, so a test written that way passes
 * on iOS and silently fails to exercise Android at all. Rather than assert
 * something untrue, the decision itself is exported and asserted directly, and
 * the component is exercised on the preset's own platform.
 */
import { AccessibilityInfo } from 'react-native';
import { screen } from '@testing-library/react-native';
import { SCHEMES, enclosingFill, paletteFor, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';
import {
  UNDO_MS,
  UNDO_SCREEN_READER_MS,
  UndoBar,
  announcesExplicitly,
} from './undo-bar';

const TEXT = 'Claudine Uwase was declined and refunded in full.';

let announce: jest.SpyInstance;

beforeEach(() => {
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  // `restoreAllMocks` does not reliably detach this spy from React Native's
  // `AccessibilityInfo`, so `spyOn` hands back the SAME mock on the next file
  // and its call list survives. Clearing it here makes every count below a
  // count of THIS test's renders, whatever ran before it — which is what the
  // assertions were always written to mean.
  announce.mockClear();
  jest
    .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
    .mockImplementation(() => Promise.resolve(false));
});

afterEach(() => jest.restoreAllMocks());

const bar = () => <UndoBar state={{ text: TEXT, onUndo: jest.fn() }} onDismiss={jest.fn()} />;

/**
 * **The scheme cover this file was missing.** Every assertion below this block
 * pins `'light'` because the scheme is irrelevant to what it measures — an
 * announcement, a timeout, a node's presence in the accessibility tree — and
 * `renderInScheme` simply requires an argument. That left `UndoBar` as the one
 * component in the kit with no render in the other schemes at all, which F0's
 * sweep found. It matters here more than it looks: the bar is a floating
 * plate, so the relationship between its fill and the page under it has to
 * hold in whichever scheme is drawing.
 */
describe.each(SCHEMES)('the bar on the %s ground', (scheme) => {
  it('draws its plate on the raised surface, not on the page', () => {
    renderInScheme(bar(), scheme);
    const c = paletteFor(scheme);
    expect(enclosingFill(screen.getByText(TEXT))).toBe(c.surface1);
    // The plate has to differ from the page it floats over, in every scheme.
    expect(c.surface1).not.toBe(c.bgApp);
  });

  it('still offers the undo, so the escape survives the scheme', () => {
    renderInScheme(bar(), scheme);
    expect(screen.getByText(en['state.undo'])).toBeTruthy();
  });
});

describe('which platform speaks for itself', () => {
  it('leaves Android to its live region and speaks for iOS', () => {
    // Announcing on Android too would read the sentence twice; announcing on
    // neither is what shipped, and is why this file exists.
    expect(announcesExplicitly('android')).toBe(false);
    expect(announcesExplicitly('ios')).toBe(true);
  });

  it('speaks for web, which has no live-region support either', () => {
    expect(announcesExplicitly('web')).toBe(true);
  });
});

describe('what a screen reader hears', () => {
  it('announces the outcome and names the action', () => {
    renderInScheme(bar(), 'light');

    expect(announce).toHaveBeenCalledTimes(1);
    const said = announce.mock.calls[0][0] as string;
    expect(said).toContain(TEXT);
    // A reader told only that a booking was declined has been given no reason
    // to go looking for a button, so the undo would be reachable and never
    // discovered.
    expect(said).toBe(`${TEXT} ${en['state.undo']}`);
  });

  /**
   * Asserted on the tree rather than on the announcement spy, deliberately.
   * A spy assertion here reads the announcement from the PREVIOUS test: under
   * React 19 the earlier render's effect flushes late enough to land on this
   * test's freshly created spy, so `not.toHaveBeenCalled` fails for a reason
   * that has nothing to do with the null case. Rendering nothing is the real
   * behaviour and it is stable to check.
   */
  it('renders nothing at all when there is nothing to undo', () => {
    renderInScheme(<UndoBar state={null} onDismiss={jest.fn()} />, 'light');
    expect(screen.queryByLabelText(en['state.undo'])).toBeNull();
    expect(screen.queryByText(TEXT)).toBeNull();
  });

  it('keeps the container out of the accessibility tree so the button survives', () => {
    renderInScheme(bar(), 'light');
    // Marking the container `accessible` collapses it into one node and
    // swallows the control inside it, which would announce an undo and then
    // make it unreachable. The button must still be findable by its own label.
    expect(screen.getByLabelText(en['state.undo'])).toBeTruthy();
  });
});

describe('how long it stays', () => {
  it('gives a listener longer than a reader', () => {
    // Hearing a sentence, swiping to the button and double-tapping is a longer
    // span than reading and reaching. The two are not the same number.
    expect(UNDO_SCREEN_READER_MS).toBeGreaterThan(UNDO_MS);
  });

  it('still dismisses when the screen-reader check rejects', async () => {
    jest
      .spyOn(AccessibilityInfo, 'isScreenReaderEnabled')
      .mockImplementation(() => Promise.reject(new Error('unavailable')));

    const onDismiss = jest.fn();
    jest.useFakeTimers();
    renderInScheme(
      <UndoBar state={{ text: TEXT, onUndo: jest.fn() }} onDismiss={onDismiss} />,
      'light',
    );

    // Let the rejected promise settle, then run out the sighted dwell. A bar
    // that never dismisses is worse than one that dismisses early.
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(UNDO_MS + 100);
    jest.useRealTimers();

    expect(onDismiss).toHaveBeenCalled();
  });
});
