/**
 * The Appearance preference, and the one invariant that holds it together.
 *
 * `Appearance` is one value wider than the OS can report, and since ADR-033 it
 * is one value wider than `ColorScheme` too. That gap is where the bugs live:
 *
 *   - `system` must resolve to light or dark and **never** to white. The OS has
 *     no white to report, so a `system` that produced one would be this app
 *     inventing a preference nobody expressed — and it would be invisible,
 *     because the result is a perfectly valid scheme.
 *   - `white` must survive the keychain. It is the one choice that cannot be
 *     recovered from the device if the stored value is dropped: a lost `dark`
 *     falls back to a phone that is probably already dark, and a lost `white`
 *     falls back to a scheme the reader explicitly moved away from.
 *   - `white` must be resolved BEFORE the first frame. A scheme resolved after
 *     mount is a visible flash, and `app/_layout.tsx` awaits this read for
 *     exactly that reason; `src/bootstrap.test.tsx` asserts the ordering.
 *
 * `resolveScheme` is a pure function and is tested as one. The provider is
 * mounted only where the assertion needs a real render.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text as RNText } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  APPEARANCES,
  ThemeProvider,
  readStoredAppearance,
  resolveScheme,
  useTheme,
  type Appearance,
} from './theme';
import { palettes, type ColorScheme } from './palette';
import type { ColorSchemeName } from 'react-native';

/**
 * What the platform can hand `resolveScheme` at runtime, which is WIDER than
 * what its types admit. React Native declares `ColorSchemeName` as
 * `'light' | 'dark' | 'unspecified'`, but `useColorScheme()` returns `null` on
 * react-native-web and `Appearance.getColorScheme()` is typed
 * `ColorSchemeName | null | undefined` in the same file — so both nullish values
 * reach this function on a real device or in the web export.
 *
 * The cast is the point of the list, not a way around it: the invariant has to
 * hold for values the types deny, because those are exactly the ones nothing
 * else is checking.
 */
const PLATFORM_VALUES = ['light', 'dark', 'unspecified', null, undefined] as unknown as ColorSchemeName[];

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
}));

const getItem = SecureStore.getItemAsync as jest.Mock;

beforeEach(() => {
  getItem.mockReset();
  getItem.mockResolvedValue(null);
  (SecureStore.setItemAsync as jest.Mock).mockReset();
  (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
});

/**
 * Prints what the provider actually resolved, so an assertion reads a value,
 * and offers a way to change it, so the write path is reachable from a test.
 */
function Probe({ choose }: { choose?: Appearance }) {
  const { scheme, appearance, c, setAppearance } = useTheme();
  return (
    <>
      <RNText testID="probe">{`${appearance}/${scheme}/${c.bgApp}`}</RNText>
      {choose ? (
        <Pressable testID="choose" onPress={() => setAppearance(choose)}>
          <RNText>choose</RNText>
        </Pressable>
      ) : null}
    </>
  );
}

const mount = (initial: Appearance, choose?: Appearance) =>
  render(
    <ThemeProvider initial={initial}>
      <Probe choose={choose} />
    </ThemeProvider>,
  );

describe('APPEARANCES', () => {
  it('carries three values, in the order the preference draws them', () => {
    expect(APPEARANCES).toEqual(['system', 'light', 'dark']);
  });

  it('holds every drawable scheme plus system, and nothing else', () => {
    const schemes: ColorScheme[] = ['light', 'dark'];
    expect([...APPEARANCES].sort()).toEqual([...schemes, 'system'].sort());
  });
});

describe('resolveScheme', () => {
  it.each(['light', 'dark'] as const)(
    'returns %s unchanged, whatever the phone says',
    (choice) => {
      for (const system of PLATFORM_VALUES) {
        expect(resolveScheme(choice, system)).toBe(choice);
      }
    },
  );

  it('resolves system to dark only when the phone says dark', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
  });

  it.each(PLATFORM_VALUES.filter((v) => v !== 'dark'))(
    'resolves system to light when the phone says %s',
    (system) => {
      expect(resolveScheme('system', system)).toBe('light');
    },
  );

});

describe('the stored appearance', () => {
  it.each(APPEARANCES)('accepts %s back out of the keychain', async (stored) => {
    getItem.mockResolvedValue(stored);
    await expect(readStoredAppearance()).resolves.toBe(stored);
  });

  it('migrates a stored white — the value ADR-033 added and this build withdrew — to light', async () => {
    // Not null, and not `system`. Somebody who chose White asked for a fixed
    // pale scheme, so `light` is what they meant; falling back to `system`
    // would hand them a dark app at dusk on a preference they never set.
    getItem.mockResolvedValue('white');
    await expect(readStoredAppearance()).resolves.toBe('light');
  });

  it.each(['White', 'WHITE', 'blanc', '', 'system ', 'lightdark'])(
    'rejects %p rather than trusting the keychain',
    async (junk) => {
      getItem.mockResolvedValue(junk);
      await expect(readStoredAppearance()).resolves.toBeNull();
    },
  );

  it('returns null when the keychain read throws, so the caller can fall back', async () => {
    getItem.mockRejectedValue(new Error('keychain locked'));
    await expect(readStoredAppearance()).resolves.toBeNull();
  });

  it('writes nothing on mount, so opening the app never overwrites a choice', () => {
    mount('system');
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('writes the choice through to the keychain when it is made', async () => {
    mount('system', 'dark');
    fireEvent.press(screen.getByTestId('choose'));

    // The repaint is synchronous and the write is fire-and-forget: the tree has
    // already changed colour before the keychain has been asked anything, which
    // is the ordering that keeps a slow keychain off the render path.
    expect(screen.getByTestId('probe').props.children).toBe(
      `dark/dark/${palettes.dark.bgApp}`,
    );
    await waitFor(() =>
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('injishi.appearance', 'dark'),
    );
  });

  it('survives a keychain that refuses the write, because a lost preference is not a crash', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
    mount('system', 'dark');
    fireEvent.press(screen.getByTestId('choose'));
    await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalled());
    expect(screen.getByTestId('probe').props.children).toContain('dark');
  });
});

describe('the provider paints what was chosen', () => {
  it.each(['light', 'dark'] as const)('draws the %s palette', (choice) => {
    mount(choice);
    expect(screen.getByTestId('probe').props.children).toBe(
      `${choice}/${choice}/${palettes[choice].bgApp}`,
    );
  });

  it('resolves system on a light phone to the tinted light scheme', () => {
    // The Light this product means is the teal-tinted one, not a white page.
    // ADR-033 added a neutral White beside it and this build withdrew that,
    // so `light` is now the only pale scheme there is to land on.
    mount('system');
    expect(screen.getByTestId('probe').props.children).toBe(
      `system/light/${palettes.light.bgApp}`,
    );
  });
});
