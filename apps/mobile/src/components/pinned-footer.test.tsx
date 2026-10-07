/**
 * A toast rises above whatever the screen pins to its foot.
 *
 * Toasts sat at one fixed offset chosen to clear a tab bar, so on Work a toast
 * slid in behind "Take next" (device rig 2026-10-01; mobile audit 2026-10-05,
 * WK-14 and XC-05), and the toast is often the only line that says a write
 * failed.
 */
import { act, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { renderInScheme } from '@/test-utils';
import {
  ToastProvider,
  useToast,
  usePinnedFooter,
  usePinnedFooterHeight,
  resetPinnedFooters,
} from '@/components';

afterEach(() => resetPinnedFooters());

function Footer({ height }: { height: number }) {
  usePinnedFooter(height);
  return null;
}

function Reading() {
  const tallest = usePinnedFooterHeight();
  return <View testID="reading" accessibilityLabel={String(tallest)} />;
}

let fire: (text: string) => void = () => {};
function Trigger() {
  const toast = useToast();
  fire = (text) => toast.show(text, 'neutral');
  return null;
}

/** The toast's distance from the bottom edge, read off its outer view. */
function toastBottom(text: string): number {
  let node = screen.getByText(text, { includeHiddenElements: true }).parent;
  while (node) {
    const style = [node.props.style].flat(Infinity).filter(Boolean) as { bottom?: number }[];
    const bottom = style.find((s) => typeof s.bottom === 'number')?.bottom;
    if (bottom !== undefined) return bottom;
    node = node.parent;
  }
  throw new Error('no positioned ancestor');
}

describe('pinned footers', () => {
  it('reports the tallest one mounted, and forgets one that unmounts', () => {
    const { rerender } = renderInScheme(
      <>
        <Footer height={120} />
        <Footer height={180} />
        <Reading />
      </>,
      'light',
    );
    expect(screen.getByTestId('reading').props.accessibilityLabel).toBe('180');

    rerender(
      <>
        <Footer height={120} />
        <Reading />
      </>,
    );
    expect(screen.getByTestId('reading').props.accessibilityLabel).toBe('120');
  });

  it('keeps a toast clear of the tab bar when nothing is pinned', () => {
    renderInScheme(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
      'light',
    );
    act(() => fire('Saved'));
    // The test safe-area inset is 34; the tab bar clearance is 78 above it.
    expect(toastBottom('Saved')).toBe(34 + 78);
  });

  it('lifts a toast above a taller pinned bar', () => {
    renderInScheme(
      <ToastProvider>
        <Footer height={200} />
        <Trigger />
      </ToastProvider>,
      'dark',
    );
    act(() => fire('That did not save'));
    expect(toastBottom('That did not save')).toBe(200 + 12);
  });
});
