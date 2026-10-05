/**
 * The root crash screen (`ErrorBoundary` in `app/_layout.tsx`), ADR-063 AC-3.
 *
 * A release build never prints the error: it may hold text the server wrote
 * or something the person typed. It shows the reference that finds the event
 * in Sentry, or says plainly that no report was sent. A development build
 * still shows the message, because that is who is reading it there.
 *
 * The reporter is mocked; its suite proves the reference is the event's and
 * that a re-render never sends twice. This file lives under `src/` for the
 * reason `bootstrap.test.tsx` gives: `app/` is a route table.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { en } from '@/i18n/messages';
import { ErrorBoundary } from '../app/_layout';

const mockRootReplace = jest.fn();

jest.mock('expo-router', () => {
  const Stack = () => null;
  Stack.Screen = () => null;
  Stack.Protected = () => null;
  return {
    Stack,
    // The imperative router the crash screen's "Go to the start" uses: the
    // boundary renders instead of the layout, so it has no hook to call.
    router: { replace: (href: unknown) => mockRootReplace(href) },
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
    useSegments: () => [],
    useNavigationContainerRef: () => ({ current: null }),
  };
});

let mockReference: string | null = 'ABCD1234';
const mockReport = jest.fn((_error: unknown) => mockReference);
jest.mock('@/lib/crash-reporter', () => ({
  reportRenderError: (error: unknown) => mockReport(error),
  markAppLoaded: jest.fn(),
  registerNavigationContainer: jest.fn(),
}));

let mockDevelopment = false;
jest.mock('@/lib/crash-env', () => ({
  get IS_DEVELOPMENT_BUILD() {
    return mockDevelopment;
  },
  DIAGNOSTICS_ALLOWED: true,
}));

const SECRET = 'Jane Mukamana is not a member of Kimihurura cell';

function crash(retry = jest.fn()) {
  const error = new Error(SECRET);
  const view = render(<ErrorBoundary error={error} retry={retry} />);
  return { error, retry, view };
}

beforeEach(() => {
  mockReference = 'ABCD1234';
  mockDevelopment = false;
  mockReport.mockClear();
});

describe('the crash screen', () => {
  it('reports the error and shows its reference, never the message, in a release build', () => {
    const { error } = crash();
    expect(mockReport).toHaveBeenCalledWith(error);
    const reference = screen.getByTestId('crash-ref');
    expect(reference.props.selectable).toBe(true);
    expect(screen.getByText(en['state.crashRef'].replace('{ref}', 'ABCD1234'))).toBeTruthy();
    expect(screen.getByText(en['state.crashRefHint'])).toBeTruthy();
    expect(screen.getByText(en['state.crashOffline'])).toBeTruthy();
    expect(screen.queryByText(SECRET)).toBeNull();
    expect(screen.queryByText(en['state.crashNoReport'])).toBeNull();
  });

  it('says no report was sent, and shows no reference, when none was made', () => {
    mockReference = null;
    crash();
    expect(screen.getByText(en['state.crashNoReport'])).toBeTruthy();
    expect(screen.queryByTestId('crash-ref')).toBeNull();
    expect(screen.queryByText(SECRET)).toBeNull();
  });

  it('still shows the message in a development build', () => {
    mockDevelopment = true;
    mockReference = null;
    crash();
    expect(screen.getByText(SECRET)).toBeTruthy();
    expect(screen.getByText(en['state.crashNoReport'])).toBeTruthy();
  });

  it('shows the same reference when it renders again', () => {
    const { error, retry, view } = crash();
    view.rerender(<ErrorBoundary error={error} retry={retry} />);
    expect(mockReport).toHaveBeenLastCalledWith(error);
    expect(screen.getByText(en['state.crashRef'].replace('{ref}', 'ABCD1234'))).toBeTruthy();
  });

  it('reloads', () => {
    const { retry } = crash();
    fireEvent.press(screen.getByRole('button', { name: en['state.crashRetry'] }));
    expect(retry).toHaveBeenCalled();
  });

  it('offers a way out of an error that recurs on every render', () => {
    // Reload re-renders the screen that threw, so an error that repeats on
    // render left killing the app as the only escape (mobile audit SA-29).
    const { retry } = crash();
    mockRootReplace.mockClear();

    fireEvent.press(screen.getByRole('button', { name: en['state.notFoundAction'] }));

    expect(mockRootReplace).toHaveBeenCalledWith('/');
    expect(retry).toHaveBeenCalled();
  });
});
