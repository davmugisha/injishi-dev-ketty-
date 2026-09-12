/**
 * Theme context. Resolves the active palette and exposes it plus the
 * scheme-independent tokens through `useTheme()`.
 *
 * ## Appearance is a choice, not only a reading of the OS
 *
 * **Session 11 added that.** Frames R5, R14 and B25 all put Appearance in the
 * PREFERENCES section beside Language, and a preference that only reports what
 * the phone already decided is not a preference. `system` is the default,
 * because a phone that switches at dusk should take the app with it unless
 * somebody has said otherwise.
 *
 * **`white` was a fourth value and is one no longer.** F0 added it (ADR-033);
 * it is withdrawn here because the scheme it named was a neutral ground, and
 * the light scheme this product wants is the tinted teal one — a Light that is
 * not white. Removing it leaves the three the platform itself can mean, so
 * `Appearance` is now exactly one value wider than `ColorScheme`: `system`,
 * which is the extra one, and which still resolves to light or dark only.
 *
 * A phone that stored `white` before the removal is migrated to `light` on the
 * next read rather than dropped to `system` — see `readStoredAppearance`.
 *
 * It is persisted and read during bootstrap for the same reason the locale and
 * the domain are (`app/_layout.tsx`): a scheme resolved after mount is a
 * visible flash of the other one, and it is the most visible of the three.
 *
 * `useColorScheme()` is still read, and still on every render, because
 * `system` has to keep following the OS while it is selected — the hook is
 * what re-renders the tree when the phone flips at sunset.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme, type ColorSchemeName } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  palettes,
  space,
  radius,
  fontSize,
  fontFamily,
  shadow,
  scrim,
  onPhoto,
  onPhotoMuted,
  onPhotoDim,
  type ColorScheme,
  type Palette,
} from './tokens';

/** What the reader chose, which is one value wider than what gets drawn. */
export type Appearance = 'system' | 'light' | 'dark';

/** The order the preference draws them: the automatic one, then lightest down. */
export const APPEARANCES: readonly Appearance[] = ['system', 'light', 'dark'];

export interface Theme {
  /** The scheme actually drawn, after `system` has been resolved. */
  scheme: ColorScheme;
  /** The reader's own choice, which `system` keeps distinct from its result. */
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
  c: Palette;
  space: typeof space;
  radius: typeof radius;
  fontSize: typeof fontSize;
  font: typeof fontFamily;
  shadow: typeof shadow;
  /**
   * The photographic scrims, and the two FIXED foregrounds they carry. On the
   * theme so a component never reaches into `tokens.ts` for a colour, and
   * scheme-independent on purpose: a photograph does not invert, so what is
   * drawn on one must not either (design brief §6, §8.7).
   */
  scrim: typeof scrim;
  onPhoto: string;
  onPhotoMuted: string;
  onPhotoDim: string;
}

const ThemeContext = createContext<Theme | null>(null);

/* ------------------------------------------------------------- persistence */

const STORE_KEY = 'injishi.appearance';

// The same note as `domain.tsx`, `session.tsx` and `i18n.tsx`: SecureStore is a
// native keychain binding with no web implementation, so every call throws
// there and the preference degrades to `system`.
const persistable = Platform.OS !== 'web';

function isAppearance(value: string | null): value is Appearance {
  return APPEARANCES.includes(value as Appearance);
}

/**
 * Read during bootstrap, before the shell paints — see `app/_layout.tsx`.
 * A failed read returns `null` and the caller falls back to `system`, which is
 * the value somebody who has never chosen would have had anyway.
 */
export async function readStoredAppearance(): Promise<Appearance | null> {
  if (!persistable) return null;
  try {
    const stored = await SecureStore.getItemAsync(STORE_KEY);
    // ADR-033's `white` was withdrawn. A phone that stored it chose a fixed
    // pale scheme, so `light` is what they asked for and `system` is not:
    // dropping them to `system` would flip their app to dark at dusk on the
    // strength of a value they never set.
    if (stored === 'white') return 'light';
    return isAppearance(stored) ? stored : null;
  } catch {
    return null;
  }
}

async function writeStoredAppearance(a: Appearance): Promise<void> {
  if (!persistable) return;
  try {
    await SecureStore.setItemAsync(STORE_KEY, a);
  } catch {
    // Same trade as the locale write: a lost preference costs one tap after a
    // relaunch and is never worth taking the shell down for.
  }
}

/** The scheme to draw, from the choice and what the OS currently reports. */
export function resolveScheme(
  appearance: Appearance,
  // `ColorSchemeName`, which is wider than the two values the OS can mean: React
  // Native reports `'unspecified'` on a platform that has no preference at all.
  // Every value but `'dark'` resolves to light, so the widening costs nothing
  // and the narrow signature would have made this the one call site that needed
  // a cast.
  system: ColorSchemeName,
): ColorScheme {
  // An explicit choice IS the scheme: both drawable values are choices.
  if (appearance !== 'system') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({
  initial = 'system',
  children,
}: {
  initial?: Appearance;
  children: ReactNode;
}) {
  const system = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>(initial);
  const scheme = resolveScheme(appearance, system);

  // Persist on every switch, fire-and-forget: the tree has already repainted
  // and must not wait on the keychain to say so.
  const setAppearance = useCallback((a: Appearance) => {
    setAppearanceState(a);
    void writeStoredAppearance(a);
  }, []);

  const value = useMemo<Theme>(
    () => ({
      scheme,
      appearance,
      setAppearance,
      c: palettes[scheme],
      space,
      radius,
      fontSize,
      font: fontFamily,
      shadow,
      scrim,
      onPhoto,
      onPhotoMuted,
      onPhotoDim,
    }),
    [scheme, appearance, setAppearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
