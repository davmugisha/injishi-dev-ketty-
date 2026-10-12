/**
 * StatusBarStyle — the colour of the status bar's icons, and nothing else.
 *
 * **On Android it is set, never mounted.** React Native's `<StatusBar>`, which
 * `expo-status-bar` renders, flushes its defaults on its first render:
 * `hidden: false` and `translucent: false`, every time, whatever was asked
 * for. Where React Native's edge-to-edge flag is on — every build this repo
 * compiles — the native module ignores both. Expo Go never turns that flag on,
 * so there they run: `setDecorFitsSystemWindows(true)` and a cleared insets
 * listener on the window. On Android 11 to 14 that takes Expo Go out of edge to
 * edge. The window then reserves the gesture bar (the pale `#EEF7F9` strip
 * under the tab bar) and swallows the insets the native Android sheet waits
 * for, which is how Appearance and Sign out froze the app on the owner's phone
 * on 2026-10-11. Android 15 enforces edge to edge and ignores the call, which
 * is why the emulator never showed it.
 *
 * `StatusBar.setStyle` reaches only the icon colour, so the window stays what
 * the host made it, and Expo Go lays out like the builds it stands in for.
 *
 * This is the only file allowed to import a `StatusBar` (`eslint.config.mjs`),
 * so a second mount cannot quietly bring the strip, and the freeze, back.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export interface StatusBarStyleProps {
  /** The ICONS' colour: `light` over a dark app, `dark` over a light one. */
  style: 'light' | 'dark';
  /** The platform to behave as. A test asks for Android from an iOS runtime; the app never passes it. */
  os?: string;
}

export function StatusBarStyle({ style, os = Platform.OS }: StatusBarStyleProps) {
  const android = os === 'android';

  useEffect(() => {
    if (android) StatusBar.setStyle(style);
  }, [android, style]);

  return android ? null : <StatusBar style={style} />;
}
