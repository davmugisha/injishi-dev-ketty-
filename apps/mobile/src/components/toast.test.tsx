/**
 * Toast — one at a time, for 3.2 seconds, announced without stealing focus.
 *
 * The behaviour worth pinning is the replacement rule. The interactive twin
 * toasts on every commit, and several of those sentences are the only place the
 * prototype admits a write was mocked ("Recorded as paid — stamped mock, not
 * settled"). Stacking them would mean the one that matters scrolls past behind
 * two that do not; replacing means the most recent is always the one on screen.
 */
import { act, screen, fireEvent } from '@testing-library/react-native';
import { Text as RNText } from 'react-native';
import { ToastProvider, useToast, TOAST_MS } from './toast';
import { SCHEMES, renderInScheme } from '@/test-utils';
import { en } from '@/i18n/messages';

function Caller() {
  const toast = useToast();
  return (
    <>
      <RNText testID="first" onPress={() => toast.show('Room 205 started', 'success')}>
        first
      </RNText>
      <RNText testID="second" onPress={() => toast.show('Room 205 is clean', 'success')}>
        second
      </RNText>
      <RNText testID="dismiss" onPress={() => toast.dismiss()}>
        dismiss
      </RNText>
    </>
  );
}

const withProvider = (
  <ToastProvider>
    <Caller />
  </ToastProvider>
);

describe.each(SCHEMES)('Toast in the %s scheme', (scheme) => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows nothing until something is said', () => {
    renderInScheme(withProvider, scheme);
    expect(screen.queryByText('Room 205 started')).toBeNull();
  });

  it('shows what a screen said', () => {
    renderInScheme(withProvider, scheme);
    act(() => fireEvent.press(screen.getByTestId('first')));
    expect(screen.getByText('Room 205 started')).toBeTruthy();
  });

  it('replaces rather than stacks, so the newest is the one on screen', () => {
    renderInScheme(withProvider, scheme);
    act(() => fireEvent.press(screen.getByTestId('first')));
    act(() => fireEvent.press(screen.getByTestId('second')));
    expect(screen.queryByText('Room 205 started')).toBeNull();
    expect(screen.getByText('Room 205 is clean')).toBeTruthy();
  });

  it('clears itself after the twin dwell time', () => {
    renderInScheme(withProvider, scheme);
    act(() => fireEvent.press(screen.getByTestId('first')));
    act(() => jest.advanceTimersByTime(TOAST_MS - 1));
    expect(screen.getByText('Room 205 started')).toBeTruthy();
    act(() => jest.advanceTimersByTime(2));
    expect(screen.queryByText('Room 205 started')).toBeNull();
  });

  it('restarts the clock on a replacement rather than inheriting it', () => {
    renderInScheme(withProvider, scheme);
    act(() => fireEvent.press(screen.getByTestId('first')));
    act(() => jest.advanceTimersByTime(TOAST_MS - 100));
    act(() => fireEvent.press(screen.getByTestId('second')));
    // The second toast must get its full read, not the 100ms the first left.
    act(() => jest.advanceTimersByTime(TOAST_MS - 100));
    expect(screen.getByText('Room 205 is clean')).toBeTruthy();
  });

  it('announces politely, so it never interrupts a reader mid-sentence', () => {
    renderInScheme(withProvider, scheme);
    act(() => fireEvent.press(screen.getByTestId('first')));
    const region = screen.getByLabelText(`${en['state.toastRegion']}: Room 205 started`);
    expect(region.props.accessibilityLiveRegion).toBe('polite');
  });

  it('can be dismissed before its time', () => {
    renderInScheme(withProvider, scheme);
    act(() => fireEvent.press(screen.getByTestId('first')));
    act(() => fireEvent.press(screen.getByTestId('dismiss')));
    expect(screen.queryByText('Room 205 started')).toBeNull();
  });
});

describe('useToast outside a provider', () => {
  it('is a no-op rather than a throw', () => {
    // A component rendered in isolation should still render, not crash on the
    // way to saying "saved".
    expect(() => renderInScheme(<Caller />, 'light')).not.toThrow();
    expect(() => fireEvent.press(screen.getByTestId('first'))).not.toThrow();
  });
});
