/**
 * Tell TanStack Query when the app is in front and when the phone is online.
 *
 * In a browser the library learns both from `window` events on its own. React
 * Native has neither, so without this nothing ever refetched: a cold start in a
 * dead zone left `/me/workspaces` failed until the app was killed, and a screen
 * left open over a reconnect kept showing its error (mobile audit 2026-10-05,
 * SA-09 and XC-14). This is the wiring the library's React Native guide asks
 * for, on the two signals this app already has: `AppState`, and `expo-network`,
 * which drives the offline banner too.
 *
 * Offline, queries now PAUSE rather than fail into error states, and resume by
 * themselves when the network is back. Writes are unaffected: mutations are
 * never retried by the library (`query-client.ts`), and the offline queue owns
 * replay.
 *
 * Called once, from the shell. Returns the teardown, for tests.
 */
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager, onlineManager } from '@tanstack/react-query';
import * as Network from 'expo-network';

export function wireQueryLifecycle(): () => void {
  const teardown: (() => void)[] = [];

  // The web build keeps the library's own window listeners, which are right
  // there and would be overridden by AppState for no gain.
  if (Platform.OS !== 'web') {
    focusManager.setEventListener((setFocused) => {
      const onChange = (state: AppStateStatus) => setFocused(state === 'active');
      const subscription = AppState.addEventListener('change', onChange);
      return () => subscription.remove();
    });
    teardown.push(() => focusManager.setEventListener(() => () => {}));
  }

  // Tests mock `expo-network` per file and not every mock carries the listener,
  // so its absence means "no signal to wire", never a crash at boot.
  if (typeof Network.addNetworkStateListener === 'function') {
    onlineManager.setEventListener((setOnline) => {
      const subscription = Network.addNetworkStateListener((state) => {
        // `isInternetReachable` can be null while the OS is still probing. Only
        // a definite "no" counts as offline, so a slow probe never pauses reads.
        setOnline(state.isConnected !== false && state.isInternetReachable !== false);
      });
      return () => subscription.remove();
    });
    teardown.push(() => onlineManager.setEventListener(() => () => {}));
  }

  return () => {
    for (const undo of teardown) undo();
  };
}
