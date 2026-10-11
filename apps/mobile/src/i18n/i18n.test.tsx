/**
 * `t()`, `translate()`, and the locale that has to survive a cold start.
 *
 * The persistence half is ADR-031 child "locale persistence": an explicit
 * stored choice beats the device language, an unreadable or unrecognised value
 * falls back rather than throwing, and a switch is written to the keychain.
 */
import { render, renderHook, screen, act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { getLocales, type Locale } from 'expo-localization';
import { Text } from 'react-native';
import {
  KINYARWANDA_AVAILABLE,
  LocaleProvider,
  deviceLocale,
  readStoredLocale,
  resolveInitialLocale,
  translate,
  useLocale,
  useT,
} from './i18n';
import { en, rw, type MessageKey } from './messages';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'en' }]),
}));

const getItem = SecureStore.getItemAsync as jest.MockedFunction<typeof SecureStore.getItemAsync>;
const setItem = SecureStore.setItemAsync as jest.MockedFunction<typeof SecureStore.setItemAsync>;
const locales = getLocales as jest.MockedFunction<typeof getLocales>;

/**
 * SDK 57 widened expo-localization's `Locale` to thirteen required fields and
 * retyped `getLocales()` as a non-empty tuple, so the partial fixtures below no
 * longer overlap the type and `[]` no longer satisfies it. The code under test
 * reads `languageCode` and nothing else, so the fixtures stay minimal and the
 * widening happens once, here, instead of at every call site.
 */
const asLocales = (...values: Partial<Locale>[]) =>
  values as unknown as ReturnType<typeof getLocales>;

beforeEach(() => {
  jest.clearAllMocks();
  getItem.mockResolvedValue(null);
  locales.mockReturnValue(asLocales({ languageCode: 'en' }));
});

describe('interpolation', () => {
  it('fills a named placeholder', () => {
    expect(translate('state.loadingList', { label: 'trips' })).toBe('Loading trips');
  });

  it('leaves an unfilled placeholder visible, rather than blanking it', () => {
    // Deliberate: a half-filled sentence is findable in review, an empty one is
    // not. `i18n.tsx` documents this.
    expect(translate('state.loadingList')).toBe('Loading {label}');
    expect(translate('state.loadingList', { other: 'x' })).toBe('Loading {label}');
  });

  it('returns the key itself for a key no catalogue has', () => {
    expect(translate('leases.noSuchKey' as MessageKey)).toBe('leases.noSuchKey');
  });
});

describe('t() through the provider', () => {
  it('reads the active catalogue', () => {
    render(
      <LocaleProvider initial="rw">
        <Message />
      </LocaleProvider>,
    );
    expect(screen.getByTestId('m').props.children).toBe(rw['leases.title']);
  });

  it('falls through EN before falling back to the key', () => {
    // The type system already forbids a missing RW key, so this reproduces the
    // state the fallback exists for and puts it back afterwards.
    const key: MessageKey = 'leases.title';
    const original = rw[key];
    delete (rw as Record<string, string>)[key];
    try {
      render(
        <LocaleProvider initial="rw">
          <Message />
        </LocaleProvider>,
      );
      expect(screen.getByTestId('m').props.children).toBe(en[key]);
    } finally {
      rw[key] = original;
    }
  });
});

describe('deviceLocale()', () => {
  it('is rw on a Kinyarwanda device', () => {
    locales.mockReturnValue(asLocales({ languageCode: 'rw' }));
    expect(deviceLocale()).toBe('rw');
  });

  it('reads the language, not the region, so rw-RW resolves too', () => {
    locales.mockReturnValue(asLocales({ languageCode: 'rw', languageTag: 'rw-RW' }));
    expect(deviceLocale()).toBe('rw');
  });

  it('is en for a language we ship no catalogue for', () => {
    locales.mockReturnValue(asLocales({ languageCode: 'fr' }));
    expect(deviceLocale()).toBe('en');
  });

  it('is en when the device reports no locale at all', () => {
    locales.mockReturnValue(asLocales());
    expect(deviceLocale()).toBe('en');
  });
});

describe('readStoredLocale()', () => {
  it('returns a stored locale we still ship', async () => {
    getItem.mockResolvedValue('rw');
    await expect(readStoredLocale()).resolves.toBe('rw');
  });

  it('ignores a stored value that is not a known locale', async () => {
    getItem.mockResolvedValue('kli');
    await expect(readStoredLocale()).resolves.toBeNull();
  });

  it('returns null rather than throwing when the keychain read fails', async () => {
    getItem.mockRejectedValue(new Error('keychain unavailable'));
    await expect(readStoredLocale()).resolves.toBeNull();
  });
});

describe('resolveInitialLocale()', () => {
  it('opens in English in v1, whatever is stored or set on the phone', () => {
    // v1.0 is English only; the RW catalogue is still partly placeholders, and
    // a Kinyarwanda phone used to open into them (mobile audit SA-18).
    locales.mockReturnValue(asLocales({ languageCode: 'rw' }));
    expect(KINYARWANDA_AVAILABLE).toBe(false);
    expect(resolveInitialLocale('rw')).toBe('en');
    expect(resolveInitialLocale(null)).toBe('en');
  });

  describe('once Kinyarwanda is available', () => {
    it('takes the stored choice over the device language', () => {
      locales.mockReturnValue(asLocales({ languageCode: 'rw' }));
      expect(resolveInitialLocale('en', true)).toBe('en');
    });

    it('falls back to the device language when nothing is stored', () => {
      locales.mockReturnValue(asLocales({ languageCode: 'rw' }));
      expect(resolveInitialLocale(null, true)).toBe('rw');
    });
  });
});

describe('setLocale', () => {
  it('persists the switch, so it survives a cold start', () => {
    const { result } = renderHook(() => useLocale(), {
      wrapper: ({ children }) => <LocaleProvider initial="en">{children}</LocaleProvider>,
    });

    act(() => result.current.setLocale('rw'));

    expect(result.current.locale).toBe('rw');
    expect(setItem).toHaveBeenCalledWith('injishi.locale', 'rw');
  });
});

function Message() {
  const t = useT();
  return <Text testID="m">{t('leases.title')}</Text>;
}
