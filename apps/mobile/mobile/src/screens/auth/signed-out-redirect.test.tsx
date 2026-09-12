/**
 * Signing out lands on sign in.
 *
 * This is the half of Session 1's shell edit that `src/bootstrap.test.tsx`
 * cannot reach. That file drives the real `SessionProvider`, so it can prove
 * what a COLD START does with each stored flag, but it has no handle on the
 * session once the shell is up — and signing out is a TRANSITION, from a
 * mounted shell to an anonymous one, which is exactly the case a mount-time
 * assertion misses.
 *
 * So this file, and only this file, mocks `useSession` down to a status it
 * controls, and re-renders the root layout across the flip. Everything else the
 * bootstrap needs is mocked the same way `bootstrap.test.tsx` mocks it; the
 * duplication is deliberate, because sharing those mocks would mean sharing the
 * session mock too and that would quietly weaken the cold-start assertions.
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import { setColorScheme } from '@/test-utils';

const mockReplace = jest.fn();
const mockSegments: string[] = [];
let mockStatus: 'authenticated' | 'anonymous' = 'authenticated';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => 'authenticated'),
  setItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-font', () => ({ useFonts: jest.fn(() => [true, null]) }));

jest.mock('expo-network', () => ({
  useNetworkState: jest.fn(() => ({ isConnected: true, isInternetReachable: true })),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => children,
    useSafeAreaInsets: () => ({ top: 47, left: 0, right: 0, bottom: 34 }),
  };
});

jest.mock('expo-router', () => {
  const { View: RNView } = jest.requireActual('react-native');
  const Stack = ({ children }: { children?: React.ReactNode }) => (
    <RNView testID="navigator">{children}</RNView>
  );
  Stack.Screen = () => null;
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
    useSegments: () => mockSegments,
  };
});

// The one mock this file exists for. The provider itself stays real, so the
// shell still mounts the way it does in production; only what the shell READS
// is under the test's control.
jest.mock('@/session', () => {
  const actual = jest.requireActual('@/session');
  return {
    ...actual,
    useSession: () => ({ status: mockStatus, signIn: jest.fn(), signOut: jest.fn() }),
  };
});

import RootLayout from '../../../app/_layout';

beforeEach(() => {
  jest.clearAllMocks();
  setColorScheme('light');
  mockStatus = 'authenticated';
  mockSegments.splice(0, mockSegments.length, '(tabs)');
});

describe('the signed-out gate', () => {
  it('sends the reader to sign in the moment the session goes anonymous', async () => {
    const { rerender } = render(<RootLayout />);

    // Standing in the shell, on a tab, signed in. Nothing to redirect.
    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();

    // What Account's "Sign out" row does.
    mockStatus = 'anonymous';
    rerender(<RootLayout />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in'));
  });

  it('does not redirect again once the reader is already in the auth stack', async () => {
    mockStatus = 'anonymous';
    mockSegments.splice(0, mockSegments.length, '(auth)');

    render(<RootLayout />);

    await waitFor(() => expect(screen.getByTestId('navigator')).toBeTruthy());
    // Otherwise every keystroke on verify-otp would bounce the reader back to
    // sign-in, and an invite link could never open activate.
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
