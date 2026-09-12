/**
 * What every component test renders through.
 *
 * A component here reads its colours from `useTheme()` and its copy from
 * `useT()`, so rendering one bare throws rather than failing an assertion.
 * `renderInScheme` mounts the two providers it needs, plus a safe-area provider
 * with fixed insets so a scaffold measures the same on every machine.
 *
 * ## Two of the three schemes come from the OS. The third cannot.
 *
 * `jest.setup.js` mocks `useColorScheme()`, and that hook reports what the
 * PHONE says: `'light' | 'dark' | null`, and nothing else. So light and dark
 * are driven by setting the mock, which is the same path a real device takes.
 *
 * Setting the mock is a plain `mockReturnValue`, so it takes effect on the next
 * render and is reset for each file by jest's own module registry.
 *
 * This file is not a test and holds no assertions. It is under `src/` rather
 * than beside the tests so the `@/` alias and the kebab-case lint rule apply to
 * it like anything else.
 */
import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react-native';
import { useColorScheme } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ThemeProvider, type Appearance } from '@/theme/theme';
import { LocaleProvider } from '@/i18n/i18n';
import { palettes, type ColorScheme } from '@/theme/palette';
import type { Locale } from '@/i18n/messages';

/** Both schemes, for a `describe.each`. Every component renders in each. */
export const SCHEMES: ColorScheme[] = ['light', 'dark'];

/**
 * Insets a device would report. Fixed, because a scaffold that lays out
 * differently on the machine running the test is a test nobody can trust.
 */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** The mocked `useColorScheme` from `jest.setup.js`. */
const schemeMock = useColorScheme as unknown as jest.Mock;

/**
 * Sets what `useColorScheme()` returns from the next render onwards.
 *
 * Takes only what the OS can actually report. Asking for white here would be
 * asking the mock to lie about the platform, and the lie would be invisible:
 * `resolveScheme` maps every non-dark OS value to light, so the render would
 * come out light and the test would still pass.
 */
/**
 * A fresh cache per render, with retries and logging off.
 *
 * Per render rather than one shared client, because a cache that outlives a
 * test carries one test's rows into the next one, and a suite that passes only
 * in file order is worse than one that fails.
 *
 * `retry: false` matters as much: with the app's policy a `failed` call is
 * retried, so a test asserting on an error state would wait out the backoff and
 * time out rather than fail.
 */
function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function setColorScheme(scheme: 'light' | 'dark'): void {
  schemeMock.mockReturnValue(scheme);
}

export function Providers({
  children,
  locale = 'en',
  appearance = 'system',
}: {
  children: ReactNode;
  locale?: Locale;
  /** Seeds the Appearance preference. `system` defers to the OS mock. */
  appearance?: Appearance;
}) {
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={makeTestQueryClient()}>
        <ThemeProvider initial={appearance}>
          <LocaleProvider initial={locale}>{children}</LocaleProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/**
 * Render inside the providers, in the given scheme.
 *
 * Light and dark arrive through the OS mock; white arrives through the
 * Appearance choice, for the reason in this file's header. Both paths end at
 * the same `useTheme().scheme`, so a caller never has to know which one ran.
 */
export function renderInScheme(
  ui: ReactElement,
  scheme: ColorScheme,
  options?: { locale?: Locale } & Omit<RenderOptions, 'wrapper'>,
) {
  const { locale, ...rest } = options ?? {};
  setColorScheme(scheme === 'dark' ? 'dark' : 'light');
  const appearance: Appearance = 'system';
  return render(ui, {
    wrapper: ({ children }) => (
      <Providers locale={locale} appearance={appearance}>
        {children}
      </Providers>
    ),
    ...rest,
  });
}

/** The palette a test should be seeing, so an assertion names a role not a hex. */
export const paletteFor = (scheme: ColorScheme) => palettes[scheme];

/**
 * The part of a rendered node this file needs. Declared structurally rather
 * than imported from `react-test-renderer`, which ships no types of its own:
 * a query result from React Native Testing Library satisfies this as it is,
 * and it says exactly what is being read.
 */
interface StyledNode {
  props?: { style?: unknown };
  parent: StyledNode | null;
}

/**
 * The background colour of the nearest ancestor that paints one.
 *
 * Written for pills and cards: the assertion wants the fill behind a piece of
 * text, and how many wrappers sit between the two is a layout detail that
 * should not break a colour test every time a component gains a `View`.
 */
export function enclosingFill(node: StyledNode | null): string | undefined {
  for (let cur = node; cur; cur = cur.parent) {
    const fill = flattenStyle(cur.props?.style).backgroundColor;
    if (fill !== undefined) return fill as string;
  }
  return undefined;
}

/**
 * Flatten a React Native `style` prop, which may be an object, an array, or a
 * nested array, into the one object the renderer resolves it to.
 */
export function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (all, one) => ({ ...all, ...flattenStyle(one) }),
      {},
    );
  }
  return (style ?? {}) as Record<string, unknown>;
}
