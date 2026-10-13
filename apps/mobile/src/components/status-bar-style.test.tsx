/**
 * StatusBarStyle — the guard under the 2026-10-11 strip and freeze.
 *
 * A mounted React Native `<StatusBar>` takes Expo Go out of edge to edge on
 * Android 11 to 14 (`status-bar-style.tsx` says how), so on Android this must
 * set the icon colour and mount nothing. Elsewhere the component is harmless
 * and stays. The lint rule in `eslint.config.mjs` keeps every other file from
 * importing a `StatusBar` at all.
 */
import { render, screen } from '@testing-library/react-native';
import { StatusBar as NativeStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { StatusBarStyle } from './status-bar-style';

describe('StatusBarStyle', () => {
  let setStyle: jest.SpyInstance;
  beforeEach(() => {
    setStyle = jest.spyOn(StatusBar, 'setStyle').mockImplementation(() => {});
  });
  afterEach(() => setStyle.mockRestore());

  it('on Android sets the icon colour and mounts no StatusBar', () => {
    render(<StatusBarStyle style="light" os="android" />);
    expect(setStyle).toHaveBeenCalledWith('light');
    expect(screen.UNSAFE_queryByType(NativeStatusBar)).toBeNull();
  });

  it('on Android follows the scheme when it changes', () => {
    const { rerender } = render(<StatusBarStyle style="light" os="android" />);
    rerender(<StatusBarStyle style="dark" os="android" />);
    expect(setStyle).toHaveBeenLastCalledWith('dark');
    expect(screen.UNSAFE_queryByType(NativeStatusBar)).toBeNull();
  });

  it('keeps the component on iOS, where it cannot touch the window', () => {
    render(<StatusBarStyle style="dark" os="ios" />);
    expect(screen.UNSAFE_queryByType(NativeStatusBar)).not.toBeNull();
    expect(setStyle).not.toHaveBeenCalled();
  });
});
