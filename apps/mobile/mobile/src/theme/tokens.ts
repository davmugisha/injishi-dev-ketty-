/**
 * Injishi — design tokens for React Native (the mobile client, both domains).
 *
 * COLOR lives in `palette.ts`, which is generated from the HeroUI roles in
 * `@injishi/design-tokens` by `scripts/derive-palette.mjs` and committed. This
 * file re-exports it, so `@/theme/tokens` stays the one import every screen and
 * component already uses and no call site had to change.
 *
 * The SCALES — the 4px space grid, the corners, the type steps and their
 * leadings — are owned by `@injishi/design-tokens` since ADR-034 task 6 and
 * re-exported here under the names every screen already uses. What is still
 * authored in this file is what belongs to this app: the typefaces (a family is
 * a per-surface brand decision, ADR-025), the shadow set and the photographic
 * scrims, both of which are React Native style objects rather than scale
 * values.
 */
export { palettes, type Palette, type ColorScheme } from './palette';

import { ink, rnFontSize, rnLineHeight, rnRadius, rnSpace } from '@injishi/design-tokens';

/* ---- Non-color tokens (scheme-independent) ------------------------------- */

/**
 * The scales come from the PACKAGE now (ADR-034 task 6).
 *
 * They used to be authored here, and the package shipped a second, different
 * copy that nothing imported — a four-step radius against this file's seven,
 * and `Outfit` against Figtree. Two declarations, neither checking the other,
 * and the unread one drifted until it was true nowhere.
 *
 * Re-exported under the names every screen already uses, so the move cost no
 * call site. `@/theme/tokens` is still the one import.
 */
export const space = rnSpace;
export const radius = rnRadius;

/** The type scale, in device pixels. Owned by the package; see `rn.ts`. */
export const fontSize = rnFontSize;

/**
 * The leading that belongs to each step.
 *
 * NEW with the `Text` API change, and it is the half of the type scale that was
 * missing. `fontSize` has always been here; `Text` did not read it — it took
 * `size?: number` and defaulted to **15**, which is not a step on this scale,
 * so every `<Text>` written without an explicit size rendered off-scale. 757
 * call sites typed a number instead, and none of them shipped a line height.
 *
 * `ui-rules.md` names that exact failure: *"A hand-typed size also ships no
 * line height, so two of them at the same pixel value still disagree."* A step
 * is a PAIR — a size and the leading that belongs to it — and pairing them in
 * the token package rather than at the call site is what makes the pair
 * impossible to separate.
 */
export const lineHeight = rnLineHeight;

/** A step on the type scale, by name. The only thing `Text` accepts. */
export type TextSize = keyof typeof fontSize;

export const fontFamily = {
  // families are loaded by expo-google-fonts in src/theme/fonts.ts
  body: "Figtree_400Regular",
  bodyMedium: "Figtree_500Medium",
  bodySemibold: "Figtree_600SemiBold",
  bodyBold: "Figtree_700Bold",
  display: "Spectral_500Medium",
  displaySemibold: "Spectral_600SemiBold",
  // numerics / IDs / codes render in Figtree too — no mono family
  mono: "Figtree_400Regular",
  monoMedium: "Figtree_500Medium",
  monoSemibold: "Figtree_600SemiBold",
} as const;

/**
 * Soft, low-spread shadows tinted with ink (#042330) rather than pure black.
 * Returned as RN shadow style objects; elevation approximates on Android.
 */
export const shadow = {
  xs: {
    shadowColor: ink[950],
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sm: {
    shadowColor: ink[950],
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  md: {
    shadowColor: ink[950],
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  lg: {
    shadowColor: ink[950],
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
} as const;

/* ---- Photographic scrims (design brief §6) -------------------------------- */

/**
 * The scrims that put white text on a photograph, built from the same ink the
 * shadows are — `rgb(4 35 48)`, ink-950, **not** the teal `--ink` role.
 *
 * These live here rather than in a component for the reason every other value
 * does: a component may not write a colour. They are not palette keys because
 * they cannot be. A photograph does not invert with the scheme, so a scrim over
 * one is a FIXED ground and owes FIXED foregrounds (ADR-028, and design brief
 * §8.7's third consequence, which names translucent grounds over photography as
 * exactly the case the theme-following rule does not reach). A scrim resolved
 * from the palette would go pale in the dark scheme and take the white text
 * with it.
 *
 * The four values are transcribed from `apps/web/src/app/_injishi-public.css`,
 * where they were solved rather than chosen: every catalogue photograph was
 * decoded and, per caption line, the minimum alpha to put white on it at 4.5:1
 * was computed per pixel. Against the brightest stock — pale overcast skies,
 * white façades — the 99th percentile asks for .61, .52, .53 and .50, and
 * `caption` clears all four with margin. Do not re-tune them by eye.
 *
 * Each is a stop array for `expo-linear-gradient`, ordered the way that
 * component reads them (first stop at the START of the gradient).
 *
 * **The plate anchors to the caption, not to the frame** (design brief §6.3).
 * Draw `caption` as a box behind the caption block that grows with it, and hang
 * `captionFade` off the plate's top edge. A fixed-height gradient pinned to the
 * bottom of the image is the thing these values replaced.
 */
const SCRIM_INK = ink[950];

/** `#042330` at an alpha, as the 8-digit hex React Native accepts. */
function inkAlpha(alpha: number): string {
  return (
    SCRIM_INK +
    Math.round(Math.min(1, Math.max(0, alpha)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  );
}

export const scrim = {
  /** The plate directly behind caption text. Darkest at its BOTTOM edge. */
  caption: [inkAlpha(0.82), inkAlpha(0.95)] as [string, string],
  /** Carries the plate back up into the photograph. Give it a height. */
  captionFade: [inkAlpha(0), inkAlpha(0.82)] as [string, string],
  /** Full-frame wash for a hero. Inherited from the page hero, not measured. */
  hero: [inkAlpha(0.7), inkAlpha(0.35), inkAlpha(0.8)] as [string, string, string],
  /**
   * The floor, not the mechanism: the plate does the work and this catches the
   * edges it cannot — a glyph overhanging the fade, and any environment that
   * drops the plate.
   */
  textShadow: { color: inkAlpha(0.9), offset: { width: 0, height: 1 }, radius: 3 },
} as const;

/**
 * The fixed foreground a scrim carries. `white` is a project token here and an
 * explicit exception to "no literal colour" (design brief §8.4) — it is the
 * only value that holds its contrast over ink at these alphas in both schemes.
 */
export const onPhoto = '#FFFFFF';
export const onPhotoMuted = '#FFFFFFCC';
/** The inactive page dot on a gallery. Fixed, for the same reason. */
export const onPhotoDim = '#FFFFFF59';
