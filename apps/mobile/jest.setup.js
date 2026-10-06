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

/** The web origin of the same stack, for the flows that live on the web. Same rule: not a real address. */
process.env.EXPO_PUBLIC_WEB_URL ??= 'http://web.test.invalid';

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

/**
 * `expo-secure-store`, mocked for the reason `expo-network` above is: it is a
 * NATIVE module, and there is no native side in jest.
 *
 * Unmocked it does not fail a test, it fails an IMPORT. `src/lib/auth.ts` reads
 * the bearer token from it and `src/lib/api.ts` imports that, so the throw
 * (`Cannot find native module 'ExpoSecureStore'`) propagates to every suite
 * that reaches the data layer or the theme — 59 of 81, all reporting "Test
 * suite failed to run" rather than an assertion. Nothing in those suites is
 * about the keychain; they simply could not load.
 *
 * `jest.fn()` rather than a hand-rolled in-memory map, because the suites that
 * DO care about storage already treat these as mocks — `theme.test.tsx` calls
 * `.mockReset()` and `.mockResolvedValue()` on `setItemAsync`, and
 * `bootstrap.test.tsx` types `getItemAsync` as a `MockedFunction`. Those tests
 * were written against exactly this shape, which is the evidence that the mock
 * belonged here and was lost rather than never existing.
 *
 * `getItemAsync` resolves NULL by default: nothing stored, which is a fresh
 * install and the state most suites should start from. A default of some token
 * would silently sign every test in. `getItem` is the synchronous read the crash
 * reporter's switch uses at launch (ADR-063), NULL for the same reason.
 */
jest.mock('expo-secure-store', () => ({
  getItem: jest.fn(() => null),
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

/**
 * `@sentry/react-native` (ADR-063), mocked because it is native code with no
 * native side here, and because no test may ever send a report. Only
 * `src/lib/crash-reporter.ts` imports it; its tests read these mocks through
 * `jest.requireMock`. The integration factories return plain named objects, so
 * the options test can assert the integration list by name.
 */
jest.mock('@sentry/react-native', () => {
  const client = { getOptions: jest.fn() };
  return {
    init: jest.fn(),
    close: jest.fn(async () => true),
    getClient: jest.fn(() => client),
    captureException: jest.fn(() => '0123456789abcdef0123456789abcdef'),
    addBreadcrumb: jest.fn(),
    setTag: jest.fn(),
    appLoaded: jest.fn(),
    nativeCrash: jest.fn(),
    reactNavigationIntegration: jest.fn(() => ({
      name: 'ReactNavigation',
      registerNavigationContainer: jest.fn(),
    })),
    reactNativeTracingIntegration: jest.fn((options) => ({ name: 'ReactNativeTracing', options })),
  };
});

/**
 * NATIVE VIEWS, for the packages jest-expo does not carry a mock for.
 *
 * jest-expo already mocks `expo-modules-core`, and its `requireNativeViewManager`
 * looks the module name up in its own `moduleMocks` directory. When the lookup
 * misses it re-throws the real implementation's `UnavailabilityError`, because a
 * host component only exists on a device. Two packages this app never imports
 * hit that miss at MODULE SCOPE, so the throw takes the importing suite down
 * before a single test runs:
 *
 *   - `ExpoGlassEffect`, reached from `expo-router`'s native stack;
 *   - `ExpoRouterToolbarModule`, reached from `expo-router`'s own toolbar.
 *
 * That was 59 of 81 suites reporting "Test suite failed to run".
 *
 * ## Why this PATCHES jest-expo's mock instead of replacing it
 *
 * The obvious `jest.mock('expo-modules-core', ...)` is wrong and was measured to
 * be wrong: jest-expo's factory also installs `EventEmitter`, `NativeModule`,
 * `SharedObject` and the mocked `NativeModulesProxy`, so replacing it wholesale
 * broke `expo` itself and took the suite from 41 passing down to 26. The
 * property on its returned object is writable, so the fallback is wrapped and
 * everything else it built is left exactly as it was.
 *
 * A plain `View` is the honest stand-in, and it is what these packages
 * themselves fall back to off-device: upstream's cross-platform `GlassView.tsx`
 * is literally `<View {...props} />`. Wrapping the LOOKUP rather than naming the
 * two packages means the next SDK adding a third native view does not break the
 * suite again.
 */
{
  const core = require('expo-modules-core');
  const { View } = require('react-native');
  const lookUp = core.requireNativeViewManager;
  core.requireNativeViewManager = (name, viewName) => {
    try {
      // jest-expo's own mock first: a package it HAS a mock for keeps it.
      return lookUp(name, viewName);
    } catch {
      return View;
    }
  };
}

/**
 * `expo-glass-effect`, mocked as a PACKAGE, because the seam above is not
 * enough for it.
 *
 * It reaches native twice and only one of those is a view:
 * `GlassView.ios` builds a host component (covered above), and
 * `isLiquidGlassAvailable.ios` calls `requireNativeModule('ExpoGlassEffect')`
 * and reads a flag off it. `expo-router`'s native stack calls that second one
 * at module scope, so the suite still died on import.
 *
 * Wrapping `requireNativeModule` the way `requireNativeViewManager` is wrapped
 * would be the symmetric move and is deliberately NOT made: handing back an
 * empty object for every native module jest-expo does not know would turn a
 * missing mock into a silently wrong value, everywhere, forever. A view has one
 * sane stand-in; a module does not.
 *
 * The values below are upstream's OWN cross-platform fallbacks, not invented:
 * `GlassView.tsx` is `<View {...props} />` and both predicates return `false`
 * off iOS. A test therefore renders what a device without Liquid Glass renders.
 */
jest.mock('expo-glass-effect', () => {
  const { View } = require('react-native');
  return {
    GlassView: View,
    GlassContainer: View,
    isLiquidGlassAvailable: () => false,
    isGlassEffectAPIAvailable: () => false,
  };
});

/**
 * `expo-image`, mocked to React Native's own `Image`.
 *
 * jest-expo ships mocks for the expo modules it knows about and `ExpoImage` is
 * not one of them, so `requireNativeModule('ExpoImage')` throws at import. This
 * app imports `Image` from it in a dozen components — cards, headers, the photo
 * picker — so the throw reached 78 suites, which is every remaining failure.
 *
 * React Native's `Image` rather than a `View`, because it IS the thing
 * `expo-image` replaces: it takes the same `source`, renders a real host
 * component, and passes `testID` and the accessibility props through, so a test
 * that queries for an image still finds one. The extra props expo-image adds
 * (`contentFit`, `transition`, `placeholder`) are inert here, which is correct:
 * none of them is behaviour a test in this suite is about.
 */
jest.mock('expo-image', () => {
  const { Image } = require('react-native');
  return { __esModule: true, Image, default: Image };
});

/**
 * `expo-image-picker`, the last native module jest-expo carries no mock for.
 *
 * `photo-picker.tsx` imports it, `src/components/index.ts` re-exports that, and
 * the data layer pulls the barrel in — so `Cannot find native module
 * 'ExponentImagePicker'` reached 72 suites that have nothing to do with photos.
 *
 * The shape is LIFTED from the two suites that already mock it themselves
 * (`work-screens.test.tsx`, `work-rw.test.tsx`), so the default here and the
 * local overrides cannot disagree about what the module looks like.
 *
 * Permissions granted, and every picker CANCELLED. Granted because a permission
 * prompt is not what these tests are about and a denial would send every one of
 * them down the refusal branch; cancelled because "the user picked nothing" is
 * the state a screen opens in, and a default that returned an asset would have
 * suites uploading a photo nobody chose.
 */
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));
