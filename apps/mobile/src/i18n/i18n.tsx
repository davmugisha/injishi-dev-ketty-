/**
 * `t()` — the message accessor, and the seam Paraglide (F-A20) replaces.
 *
 * Paraglide compiles messages into typed functions and is `[planned]`, not
 * installed. Until then this holds the same contract: a key, an optional set of
 * named values, and a string back. Call it through `useT()` so a language
 * change repaints — a module-level `t` would return the right string and never
 * tell React to draw it.
 *
 * A missing key returns the key itself rather than an empty string. A blank
 * label is invisible in review; `leases.tabActive` sitting in the UI is not.
 *
 * `translate()` is the same lookup without the hook, for the one caller that
 * cannot have one: the root `ErrorBoundary` renders *instead of* the provider
 * tree, so `useT()` there would throw inside the thing catching throws. It
 * reads the last locale the provider set, which is the user's choice on any
 * crash after bootstrap and `en` before it.
 *
 * The locale is the third bootstrap value (ADR-031 child "locale persistence").
 * `readStoredLocale()` sits below beside the provider, mirroring
 * `readStoredDomain()` in `domain.tsx`, and `app/_layout.tsx` resolves it in the
 * same `Promise.all` as the domain and the session. A first launch with nothing
 * stored follows the device language, narrowed to a catalogue we ship.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
import { catalogues, en, type Locale, type MessageKey } from './messages';

export type { Locale, MessageKey };
export { LOCALES } from './messages';

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

interface LocaleState {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translate;
}

const LocaleContext = createContext<LocaleState | null>(null);

/* ------------------------------------------------------------- persistence */

const STORE_KEY = 'injishi.locale';

// The same note as `domain.tsx` and `session.tsx`: SecureStore is a native
// keychain binding with no web implementation, so every call throws on web.
// All three bootstrap values degrade to their defaults there.
const persistable = Platform.OS !== 'web';

/** Narrowing guard, so a stored value is trusted only if we still ship it. */
function isLocale(value: string | null): value is Locale {
  return value !== null && Object.prototype.hasOwnProperty.call(catalogues, value);
}

/**
 * The device language, narrowed to a catalogue we actually ship.
 *
 * `languageCode` rather than the full tag, so `rw-RW` and a bare `rw` both
 * resolve to `rw`. Narrowed against the catalogues rather than trusted, so a
 * phone set to French gets `en` — a language we ship — instead of a locale with
 * no catalogue behind it. `getLocales()` returns an empty array in some
 * environments, which the optional chain covers.
 */
export function deviceLocale(): Locale {
  try {
    const code = getLocales()[0]?.languageCode;
    return code === 'rw' ? 'rw' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Read during bootstrap, before the shell paints — see `app/_layout.tsx`. It
 * sits here beside the provider for the same reason `readStoredDomain()` sits
 * beside `DomainProvider`: the reader and the thing it seeds are one decision.
 *
 * A failed read returns `null` and the caller falls back to the device locale.
 * A lost preference costs one tap; it must never cost a crash.
 */
export async function readStoredLocale(): Promise<Locale | null> {
  if (!persistable) return null;
  try {
    const stored = await SecureStore.getItemAsync(STORE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Whether this build may open in a language other than English.
 *
 * v1.0 ships in English only (owner decision). The Kinyarwanda catalogue is
 * still partly placeholders, 133 values ending in " (RW)" (sign in read "Email
 * address (RW)"), and a phone set to Kinyarwanda used to open straight into
 * them (mobile audit 2026-10-05, SA-18). The catalogue and the stored choice
 * are kept, so turning this on is the whole of the change when the Kinyarwanda
 * work lands.
 */
export const KINYARWANDA_AVAILABLE = false;

/**
 * The locale the app opens in: an explicit stored choice first, then the device
 * language. The order is load bearing — someone who deliberately switched to
 * English on a Kinyarwanda phone stays in English. While Kinyarwanda is not
 * available, always English.
 */
export function resolveInitialLocale(
  stored: Locale | null,
  kinyarwandaAvailable: boolean = KINYARWANDA_AVAILABLE,
): Locale {
  if (!kinyarwandaAvailable) return 'en';
  return stored ?? deviceLocale();
}

async function writeStoredLocale(l: Locale): Promise<void> {
  if (!persistable) return;
  try {
    await SecureStore.setItemAsync(STORE_KEY, l);
  } catch {
    // Same trade as the domain and session writes: a lost preference costs one
    // tap after a relaunch, and is never worth taking the shell down for.
  }
}

/** `{name}` → the value. Unfilled placeholders are left visible on purpose. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * The last locale a `LocaleProvider` rendered with. Module state on purpose —
 * see `translate()` below; nothing else may read it.
 */
let lastLocale: Locale = 'en';

/** Provider-free lookup. Prefer `useT()`: this does not re-render on a switch. */
export function translate(
  key: MessageKey,
  values?: Record<string, string | number>,
  locale: Locale = lastLocale,
): string {
  return interpolate(catalogues[locale][key] ?? en[key] ?? key, values);
}

export function LocaleProvider({
  initial = 'en',
  children,
}: {
  initial?: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initial);
  lastLocale = locale;

  // Persist on every switch, the same way `signIn`/`signOut` and `setDomain`
  // do. The write is fire-and-forget: the UI has already changed language and
  // must not wait on the keychain to say so.
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    void writeStoredLocale(l);
  }, []);

  const t = useCallback<Translate>(
    (key, values) => {
      // Fall back through EN before falling back to the key, so a message the
      // RW catalogue is missing still reads as a sentence.
      const message = catalogues[locale][key] ?? en[key] ?? key;
      return interpolate(message, values);
    },
    [locale],
  );

  const value = useMemo<LocaleState>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleState(): LocaleState {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useT / useLocale must be used within a LocaleProvider');
  return ctx;
}

export function useT(): Translate {
  return useLocaleState().t;
}

export function useLocale(): { locale: Locale; setLocale: (l: Locale) => void } {
  const { locale, setLocale } = useLocaleState();
  return { locale, setLocale };
}
