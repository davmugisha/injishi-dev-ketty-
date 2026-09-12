/**
 * The API origin, before any module can read it.
 *
 * `src/lib/env.ts` throws at import when `EXPO_PUBLIC_API_URL` is unset, which
 * is the right behaviour in the app: an unset origin sends every request to
 * `undefined/api/v1/...` and surfaces as a generic network failure on whichever
 * screen loaded first. In tests it just means five suites cannot import, so the
 * value is supplied here.
 *
 * It is deliberately not a real address. Nothing in this suite makes a network
 * call, and a value pointing at a machine somebody might actually be running
 * would turn a missing `fetch` mock into a silent live request.
 *
 * This file is a `setupFiles` entry (jest.config.js), which runs BEFORE the
 * module registry is touched — the one place this assignment can happen early
 * enough to matter.
 */
process.env.EXPO_PUBLIC_API_URL ??= 'http://api.test.invalid';

/**
 * Runs before every test file.
 *
 * `useColorScheme` is mocked here rather than in each test because `jest.mock`
 * is hoisted per file, so a component test that forgot the mock would silently
 * render in whatever the environment defaults to — light — and its "dark
 * scheme" case would pass without ever having been in the dark scheme.
 *
 * The mock is on the module React Native's own index re-exports, so both
 * `useColorScheme` from `react-native` and a direct import resolve to it, and
 * `ThemeProvider` picks up the value with no change to production code.
 * `src/test-utils.tsx` is what tests actually use to set it.
 *
 * Gesture Handler ships its own jest setup and needs it: `GestureHandlerRootView`
 * reaches for a native module that does not exist here, and without this the
 * whole root layout fails to mount rather than failing an assertion.
 */
require('react-native-gesture-handler/jestSetup');

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

/**
 * `expo-network`, mocked here for the same reason `useColorScheme` is.
 *
 * `useOffline()` used to be reached only by screens, and a screen suite that
 * forgot the mock failed loudly. Since the offline write queue landed it is
 * reached by the DATA layer too — `useSavedStays`, `useSendMessage`,
 * `useFileTicketOffline` and the rest all consult it before choosing between a
 * write and a queued intent — so a hook test with no screen in it now needs the
 * module as well, and `listener.remove is not a function` is what the
 * unmocked version does there.
 *
 * Online by default, which is the state that exercises the ordinary path. A
 * suite that wants the offline branch overrides this in its own file; nothing
 * here should make the offline case the accidental default, because a test
 * suite that runs offline by mistake would pass the queue and never touch the
 * write it is meant to be about.
 */
jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
  getNetworkStateAsync: jest.fn(async () => ({ isConnected: true, isInternetReachable: true })),
}));
