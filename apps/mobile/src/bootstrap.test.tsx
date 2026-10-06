/**
 * The bootstrap — everything that has to be true before the first frame.
 *
 * `app/_layout.tsx` holds the splash until the fonts, the stored domain, the
 * session flag and the stored locale have all resolved. Each of those, resolved
 * late, is a visible flash of the wrong app, and none of them is observable
 * from a screenshot after the fact. So this asserts the sequence: what the
 * three keychain reads restore, that the splash waits for all of them, and that
 * the font fallback still lifts it when the loader never settles.
 *
 * It lives under `src/` rather than beside `_layout.tsx` because everything in
 * `app/` is a route: Expo Router discovers that directory, and a test file
 * sitting in it is a file the router has an opinion about.
 *
 * Expo Router itself is mocked down to a passthrough. The navigator is not what
 * is under test here — the resolution order is — and mounting a real one would
 * make this a test of Expo Router.
 */
import { render, screen, waitFor, act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Text, View } from 'react-native';
import { setColorScheme } from '@/test-utils';
import { en, rw } from '@/i18n/messages';
import { translate } from '@/i18n/i18n';
import { palettes } from '@/theme/palette';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
}));

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

// The real `SafeAreaProvider` withholds its children until a native layout
// event that never arrives in a test renderer, so the whole shell would render
// as nothing. Insets are not what this file is about; the resolution order is.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
  };
});

/**
 * Where the shell sends an anonymous session, and where it thinks it already
 * is. Session 1 replaced the signed-out placeholder with a redirect, so both
 * are now part of what the bootstrap does.
 *
 * `mock`-prefixed, because `jest.mock` is hoisted above every other statement
 * in the file and only that prefix is allowed to cross the hoist.
 */
const mockReplace = jest.fn();
const mockSegments: string[] = [];

// A passthrough navigator. `Stack.Screen` renders nothing: it declares options
// on a real navigator and has no content of its own.
//
// The navigator DOES carry `screenOptions.contentStyle`, and that is the ground
// every pushed screen paints on, so the mock puts it on its own style. It is
// the only readable proof of the resolved scheme in here — a scheme that lands
// late shows up as the wrong colour behind a push, which is exactly the flash
// the bootstrap exists to prevent.
jest.mock('expo-router', () => {
  const { View: RNView } = jest.requireActual('react-native');
  const Stack = ({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode;
    screenOptions?: { contentStyle?: object };
  }) => (
    <RNView testID="navigator" style={screenOptions?.contentStyle}>
      {children}
    </RNView>
  );
  Stack.Screen = () => null;
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
    useSegments: () => mockSegments,
  };
});

import RootLayout from '../app/_layout';

const getItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const hideSplash = SplashScreen.hideAsync as jest.MockedFunction<typeof SplashScreen.hideAsync>;
const fonts = useFonts as unknown as jest.Mock;

/** What the keychain holds on this cold start. */
function stored(values: Record<string, string | null>) {
  getItem.mockImplementation(async (key: string) => values[key] ?? null);
}

/** Every read hangs, so nothing the bootstrap waits on has resolved yet. */
function storedNeverResolves() {
  getItem.mockImplementation(() => new Promise<string | null>(() => {}));
}

beforeEach(() => {
  jest.clearAllMocks();
  setColorScheme('light');
  fonts.mockReturnValue([true, null]);
  stored({});
  // Standing inside the shell, which is what every case but the deep-link one
  // is about.
  mockSegments.splice(0, mockSegments.length, '(tabs)');
});

/**
 * The locale the bootstrap actually resolved.
 *
 * It used to be readable off the signed-out placeholder, which was the one
 * screen that rendered its own copy before any navigator did. Session 1
 * replaced that placeholder with a redirect, so the readable proof is now
 * `translate()`, which answers from the last locale a `LocaleProvider`
 * rendered with — the same value, one layer down.
 */
async function resolvedLocaleCopy(): Promise<string> {
  await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
  return translate('nav.account');
}

/**
 * The ground the shell handed the navigator, which is what paints behind every
 * pushed screen. Which palette it belongs to is what says whether the stored
 * appearance resolved before the first frame or the phone won by default.
 */
async function resolvedGround(): Promise<string> {
  await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
  const style = screen.getByTestId('navigator').props.style as { backgroundColor?: string };
  return style?.backgroundColor as string;
}

describe('the cold start', () => {
  it('restores the domain, the session, the locale and the appearance together', async () => {
    stored({
      'injishi.active-domain': 'hospitality',
      'injishi.auth-token': 'a-stored-bearer-token',
      'injishi.locale': 'rw',
      'injishi.appearance': 'dark',
    });

    render(<RootLayout />);

    // The shell paints only once all three have landed, so seeing it at all is
    // the evidence that they did.
    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    expect(getItem).toHaveBeenCalledWith('injishi.active-domain');
    expect(getItem).toHaveBeenCalledWith('injishi.auth-token');
    expect(getItem).toHaveBeenCalledWith('injishi.locale');
    expect(getItem).toHaveBeenCalledWith('injishi.appearance');
  });

  it('holds the splash until the reads resolve, then lifts it', async () => {
    storedNeverResolves();
    render(<RootLayout />);

    // Nothing painted and the splash is still up: a session that has not
    // resolved is not a signed-out visitor, and must not be drawn as one.
    expect(screen.queryByTestId('navigator')).toBeNull();
    expect(hideSplash).not.toHaveBeenCalled();

    stored({});
    await act(async () => {});
  });

  it('lifts the splash once the shell can paint', async () => {
    render(<RootLayout />);
    await waitFor(() => expect(hideSplash).toHaveBeenCalled());
  });

  it('sends an anonymous session to sign in', async () => {
    stored({});
    render(<RootLayout />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in'));
  });

  it('opens the shell without redirecting when the session is authenticated', async () => {
    stored({ 'injishi.auth-token': 'a-stored-bearer-token' });
    render(<RootLayout />);

    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opens anonymous when the keychain holds nothing', async () => {
    // Session 1 flipped the default. A cold start with no stored flag is a
    // visitor who has not signed in, and the screen to send them to now exists.
    stored({});
    render(<RootLayout />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in'));
  });

  it('leaves an invite link alone rather than bouncing it to sign in', async () => {
    // `(auth)/activate` is reached from an invitation while anonymous. A
    // redirect that did not ask where it already was would lose the invite.
    stored({});
    mockSegments.splice(0, mockSegments.length, '(auth)');

    render(<RootLayout />);
    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('opens in the stored language, not in English', async () => {
    stored({ 'injishi.locale': 'rw' });
    render(<RootLayout />);

    expect(await resolvedLocaleCopy()).toBe(rw['nav.account']);
  });

  it('follows the device language on a first launch with nothing stored', async () => {
    const { getLocales } = jest.requireMock('expo-localization');
    getLocales.mockReturnValue([{ languageCode: 'rw' }]);
    stored({});

    render(<RootLayout />);
    expect(await resolvedLocaleCopy()).toBe(rw['nav.account']);
  });

  it('keeps an explicit stored choice over the device language', async () => {
    const { getLocales } = jest.requireMock('expo-localization');
    getLocales.mockReturnValue([{ languageCode: 'rw' }]);
    stored({ 'injishi.locale': 'en' });

    render(<RootLayout />);
    expect(await resolvedLocaleCopy()).toBe(en['nav.account']);
  });

  it('cold starts a keychain still holding white into light, not into system', async () => {
    // ADR-033's White was withdrawn. The migration lives in
    // `readStoredAppearance`, and this is the end-to-end half of it.
    //
    // The phone is set to DARK on purpose: that is the only setting where the
    // two possible outcomes differ. Migrated to `light`, the shell opens pale;
    // dropped to `system`, it opens dark. On a light phone both answers paint
    // the same ground and the test would assert nothing.
    setColorScheme('dark');
    stored({ 'injishi.auth-token': 'a-stored-bearer-token', 'injishi.appearance': 'white' });

    render(<RootLayout />);
    expect(await resolvedGround()).toBe(palettes.light.bgApp);
  });

  it('opens in the stored dark over a light phone', async () => {
    setColorScheme('light');
    stored({ 'injishi.auth-token': 'a-stored-bearer-token', 'injishi.appearance': 'dark' });

    render(<RootLayout />);
    expect(await resolvedGround()).toBe(palettes.dark.bgApp);
  });

  it('follows the phone when nothing is stored', async () => {
    setColorScheme('dark');
    stored({ 'injishi.auth-token': 'a-stored-bearer-token' });

    render(<RootLayout />);
    expect(await resolvedGround()).toBe(palettes.dark.bgApp);
  });

  it('falls back to system rather than trusting a junk stored appearance', async () => {
    setColorScheme('dark');
    stored({ 'injishi.auth-token': 'a-stored-bearer-token', 'injishi.appearance': 'chartreuse' });

    render(<RootLayout />);
    expect(await resolvedGround()).toBe(palettes.dark.bgApp);
  });

  it('still paints when every keychain read throws', async () => {
    // A keychain that refuses costs the user their preferences. It must never
    // cost them the app.
    getItem.mockRejectedValue(new Error('keychain unavailable'));
    render(<RootLayout />);

    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    expect(hideSplash).toHaveBeenCalled();
  });

  it('paints anyway when the font loader never settles', async () => {
    // Some web and export environments no-op the loader silently. A splash that
    // never lifts is worse than a late typeface, which is what the bound is for.
    //
    // **`setImmediate` must stay real, and this suite hung outright without
    // that.** React Native's scheduler flushes its work through `setImmediate`,
    // so a bare `jest.useFakeTimers()` takes away the very thing `await act()`
    // is waiting on, and the await never resolves. Worse than a failure: Jest's
    // own `testTimeout` is scheduled on the same faked clock, so it never fires
    // either and the suite sits silent forever instead of going red at 60s.
    // A full `pnpm test` run stalled here with no output naming the test, which
    // reads as a hung machine rather than as a broken assertion.
    //
    // Only the timer this test actually drives is faked. `FONT_FALLBACK_MS` is
    // a `setTimeout`, and that is the clock `advanceTimersByTime` moves.
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'clearImmediate'] });
    fonts.mockReturnValue([false, null]);

    try {
      render(<RootLayout />);
      expect(screen.queryByTestId('navigator')).toBeNull();

      // Jest runs as `__DEV__`, where the bound is ten seconds rather than a
      // release build's 1.2: in development the fonts come from Metro over the
      // LAN, and painting before they land clips labels (FONT_FALLBACK_MS).
      await act(async () => {
        jest.advanceTimersByTime(1200);
      });
      expect(screen.queryByTestId('navigator')).toBeNull();

      await act(async () => {
        jest.advanceTimersByTime(10_000 - 1200);
      });

      expect(screen.getByTestId('navigator')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('paints when the font loader fails outright', async () => {
    fonts.mockReturnValue([false, new Error('font download failed')]);
    render(<RootLayout />);
    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
  });
});

describe('the provider hooks', () => {
  // Each one throws on purpose rather than returning a default, because a
  // component reading a provider that is not there is a mounting bug, and a
  // silent default turns it into a subtle rendering bug instead.
  it.each([
    ['useTheme', () => require('@/theme/theme').useTheme(), /within a ThemeProvider/],
    ['useSession', () => require('@/session').useSession(), /within a SessionProvider/],
    ['useDomain', () => require('@/domain').useDomain(), /within a DomainProvider/],
    ['useT', () => require('@/i18n/i18n').useT(), /within a LocaleProvider/],
  ])('%s throws outside its provider', (_name, call, message) => {
    function Bare() {
      call();
      return <Text>never rendered</Text>;
    }
    expect(() => render(<Bare />)).toThrow(message);
  });

  it('does not throw inside them', () => {
    const { ThemeProvider } = require('@/theme/theme');
    const { LocaleProvider } = require('@/i18n/i18n');
    const { SessionProvider } = require('@/session');
    const { DomainProvider } = require('@/domain');

    function Inside() {
      require('@/theme/theme').useTheme();
      require('@/session').useSession();
      require('@/domain').useDomain();
      require('@/i18n/i18n').useT();
      return <View testID="inside" />;
    }

    // `SessionProvider` clears the query cache on sign out and on a 401, so it
    // reads a `QueryClient` and has to be mounted under one, exactly as
    // `app/_layout.tsx` mounts it.
    const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');

    render(
      <QueryClientProvider client={new QueryClient()}>
        <ThemeProvider>
          <LocaleProvider>
            <SessionProvider initial="authenticated">
              <DomainProvider initial="residence">
                <Inside />
              </DomainProvider>
            </SessionProvider>
          </LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('inside')).toBeTruthy();
  });
});
