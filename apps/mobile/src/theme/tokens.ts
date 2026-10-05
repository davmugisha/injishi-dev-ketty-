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
 * values, the segmented control's pair of grounds, and `kitMetrics`, every
 * number the kit draws with (ADR-064). The shadows and the pair differ by
 * scheme; `useTheme()` resolves them, so no component checks the scheme.
 */
export { palettes, type Palette, type ColorScheme } from './palette';

import type { BoxShadowValue, ViewStyle } from 'react-native';
import { ink, rnFontSize, rnLineHeight, rnRadius, rnSpace } from '@injishi/design-tokens';
import type { ColorScheme, Palette } from './palette';

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

/* ---- Shadows (ADR-064) ---------------------------------------------------- */

/** A colour at an alpha, as the 8-digit hex React Native accepts. */
function withAlpha(hex: string, alpha: number): string {
  return (
    hex +
    Math.round(Math.min(1, Math.max(0, alpha)) * 255)
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  );
}

/** The one white a shadow uses: the dark scheme's crisp inner edge. */
const EDGE_WHITE = '#FFFFFF';

/** What a shadow token spreads into a style. Never both keys at once. */
export type ShadowStyle = Pick<ViewStyle, 'boxShadow' | 'elevation'>;

/**
 * The two depths the kit draws, by ROLE.
 *
 *   - `surface` is for things in the flow: a card, a field, the sliding pill of
 *     a segmented control.
 *   - `overlay` is for things that float: a toast, the undo bar, a sheet, the
 *     sticky bar.
 *
 * The `xs`, `sm`, `md` and `lg` names are the four this replaced, kept as
 * aliases on the restyle branch only so the screens that spread them still
 * compile: the two light ones read `surface` and the two heavy ones `overlay`.
 * ADR-064 slice 4 moves every screen to a role and deletes them.
 */
export interface ShadowSet {
  surface: ShadowStyle;
  overlay: ShadowStyle;
  /** @deprecated ADR-064 slice 4 removes it. Read `surface`. */
  xs: ShadowStyle;
  /** @deprecated ADR-064 slice 4 removes it. Read `surface`. */
  sm: ShadowStyle;
  /** @deprecated ADR-064 slice 4 removes it. Read `overlay`. */
  md: ShadowStyle;
  /** @deprecated ADR-064 slice 4 removes it. Read `overlay`. */
  lg: ShadowStyle;
}

/** One soft layer, straight down, in ink rather than black (design brief §8.3). */
const inkLayer = (offsetY: number, blurRadius: number, alpha: number): BoxShadowValue => ({
  offsetX: 0,
  offsetY,
  blurRadius,
  spreadDistance: 0,
  color: withAlpha(ink[950], alpha),
});

/**
 * The layers, transcribed from HeroUI (rationale.md, Evidence).
 *
 * `surface` is HeroUI Native's own three layers. `overlay` takes HeroUI WEB's
 * strengths, because Native's (.02, .01, .03) are too faint to lift a toast off
 * a white card. Both are tinted ink.
 *
 * Dark draws no surface shadow at all: depth in the dark scheme is the surface
 * step (ADR-019), and a shadow on a near-black ground is mud. What floats gets a
 * crisp 1px inner edge instead, where HeroUI blurs it, so the edge the AC
 * describes is the one drawn.
 */
const LAYERS: Record<ColorScheme, { surface: ShadowStyle; overlay: ShadowStyle }> = {
  light: {
    surface: { boxShadow: [inkLayer(2, 4, 0.04), inkLayer(1, 2, 0.06), inkLayer(0, 1, 0.06)] },
    overlay: { boxShadow: [inkLayer(2, 8, 0.06), inkLayer(-6, 12, 0.03), inkLayer(14, 28, 0.08)] },
  },
  dark: {
    surface: {},
    overlay: {
      boxShadow: [
        {
          offsetX: 0,
          offsetY: 0,
          blurRadius: 0,
          spreadDistance: 1,
          color: withAlpha(EDGE_WHITE, 0.2),
          inset: true,
        },
      ],
    },
  },
};

/**
 * Android below 9 (API 28) does not draw `boxShadow`, so there the tokens fall
 * back to a plain elevation (AC-26). The dark scheme still draws nothing in the
 * flow: the fallback replaces a shadow, it does not add one where there was none.
 */
const ELEVATION = { surface: 2, overlay: 6 } as const;

/** Android below API 28, where `boxShadow` draws nothing. */
export function isLegacyShadowPlatform(platform: { OS: string; Version: number | string }): boolean {
  return platform.OS === 'android' && typeof platform.Version === 'number' && platform.Version < 28;
}

function withAliases(surface: ShadowStyle, overlay: ShadowStyle): ShadowSet {
  return { surface, overlay, xs: surface, sm: surface, md: overlay, lg: overlay };
}

const SHADOWS: Record<ColorScheme, ShadowSet> = {
  light: withAliases(LAYERS.light.surface, LAYERS.light.overlay),
  dark: withAliases(LAYERS.dark.surface, LAYERS.dark.overlay),
};

const LEGACY_SHADOWS: Record<ColorScheme, ShadowSet> = {
  light: withAliases({ elevation: ELEVATION.surface }, { elevation: ELEVATION.overlay }),
  dark: withAliases({}, { elevation: ELEVATION.overlay }),
};

/**
 * The shadow set for a scheme on a platform. `useTheme().shadow` is this, so a
 * component spreads `shadow.surface` and never checks the scheme itself.
 * Returns shared objects, so a style that spreads one costs no allocation.
 */
export function shadowFor(scheme: ColorScheme, legacy: boolean): ShadowSet {
  return (legacy ? LEGACY_SHADOWS : SHADOWS)[scheme];
}

/* ---- The segmented control's two grounds (ADR-064 AC-11) ------------------ */

/**
 * The track and the sliding indicator of a segmented control, as palette keys.
 *
 * They SWAP between schemes, and that is the whole point of the pair: in light
 * the track is the darker `surface3` and the indicator a white `surface1` that
 * casts the surface shadow; in dark there is no shadow to lift it, so the
 * indicator takes the lighter step instead. The order test pins "track darker
 * than indicator" in both, so if ADR-019 ever reorders the surfaces it fails
 * loudly rather than drawing an indicator nobody can see.
 */
export const segmentRoles: Record<ColorScheme, { track: keyof Palette; indicator: keyof Palette }> = {
  light: { track: 'surface3', indicator: 'surface1' },
  dark: { track: 'surface1', indicator: 'surface3' },
};

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
const inkAlpha = (alpha: number): string => withAlpha(SCRIM_INK, alpha);

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
  /**
   * The wash behind a sheet or a modal, ink at 20% in BOTH schemes (ADR-064,
   * HeroUI's bottom sheet backdrop). Not a photograph scrim, but it lives here
   * for the same reason: it is a fixed ground, not a role that inverts.
   */
  backdrop: inkAlpha(0.2),
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

/* ---- The kit's own measurements (ADR-064 AC-22) --------------------------- */

/**
 * Every height, inset, gap, hit slop, opacity, border width and scale the kit
 * draws with, in one table, so a component reads a name and never types a
 * number. A number typed at a call site is how the 18, 13, 9 and 7 insets got
 * in (drift row D7): each was somebody's eye on one day.
 *
 * The values are HeroUI Native 1.0.10's, measured from its stylesheets
 * (ADR-064 rationale.md, Evidence), except where the ADR's Design section
 * departs from them on purpose. Where the ADR names no value, the one the kit
 * drew before stays (AC-21) and is marked so.
 *
 * Grouped by component. A group may be read before its component is restyled:
 * the table is the target, and slices 2 and 3 of ADR-064 move each component
 * onto it.
 */
export const kitMetrics = {
  /** The touch floor every control reaches, drawn or made up with hit slop (design brief §7.2). */
  touchTarget: 44,
  /** A disabled control draws at half strength, pressable or not. HeroUI's value. */
  disabledOpacity: 0.5,
  /** The 1px edge: an outline button, a field at rest, a divider. */
  hairline: 1,
  /** A focused or invalid field's edge. Its inset shrinks by the difference, so text never moves. */
  emphasisEdge: 1.5,

  /** Press feedback, owned by `PressableScale` (AC-5). */
  press: {
    /** `pressScale(w) = max(scaleFloor, 1 - shrinkPx / w)`: a wide control shrinks less. */
    shrinkPx: 4.5,
    /** No control shrinks more than HeroUI's widest step, however narrow it is. */
    scaleFloor: 0.97,
    /** The width assumed before the first layout reports the real one. */
    widthBeforeLayout: 300,
    /** The highlight overlay, in the control's content colour, on a filled control. */
    highlightFilled: 0.1,
    /** The same on a control with no fill of its own, where it reads stronger. */
    highlightTransparent: 0.06,
    /** How far a finger may drift and still press. Kept from before (AC-21). */
    retentionOffset: 12,
  },

  /**
   * `Button` (AC-2). Heights are MINIMUMS, so large text grows the button and a
   * long label wraps rather than being cut. The vertical inset is not HeroUI's
   * (its buttons are a fixed height and never wrap); it is what keeps a wrapped
   * label off the edge, and it is under the minimum at every size, so a one
   * line label still sits at the minimum.
   */
  button: {
    sm: { minHeight: 40, insetX: 14, insetY: 8, gap: 6, icon: 16, hitSlop: 2 },
    md: { minHeight: 48, insetX: 16, insetY: 8, gap: 8, icon: 18, hitSlop: 0 },
    lg: { minHeight: 56, insetX: 20, insetY: 8, gap: 10, icon: 20, hitSlop: 0 },
  },

  /** The busy ring in a `pending` button's icon slot (AC-4). Three quarters drawn. */
  spinner: { size: 16, stroke: 2 },

  /** `Card` (AC-7). The footer's 14 and the title block's 2 are kept from before (AC-21). */
  card: { inset: 16, gap: 12, titleGap: 2, footerInsetY: 14 },

  /** `InputField`, `TextArea`, `SearchPill`, `SignaturePad` (AC-9). */
  field: { minHeight: 48, inset: 12, gap: 6, icon: 16, iconInset: 12, signatureHeight: 190 },

  /** `Badge` (AC-10): HeroUI's chip sm and md. The dot is kept from before (AC-21). */
  badge: {
    md: { height: 20, insetX: 8 },
    lg: { height: 28, insetX: 12 },
    gap: 4,
    dot: 6,
  },

  /** `Tag` and `FilterChip` (AC-10): HeroUI's tag group lg. 36 + 4 + 4 reaches the floor. */
  chip: { minHeight: 36, insetX: 12, hitSlop: 4, gap: 8 },

  /** `SegmentedTabs` (AC-11). 36 + 4 + 4 reaches the floor. */
  segmented: { trackInset: 3, triggerMinHeight: 36, triggerInsetX: 12, triggerInsetY: 6, hitSlop: 4 },

  /** `Sheet` and `ModalSheet` (AC-8). */
  sheet: {
    inset: 20,
    grabberWidth: 36,
    grabberHeight: 4,
    closeSize: 32,
    closeIcon: 18,
    closeHitSlop: 12,
  },

  /** `Toast` and `UndoBar` (AC-13). */
  toast: { inset: 16, gap: 12 },

  /** `WriteError`, `OfflineNote`, `QueueBanner` as alert cards (AC-13). */
  alert: { inset: 12, gap: 12, icon: 18 },

  /** `ListRow` (AC-12). 12 vertical, not HeroUI's 16, to keep dense lists dense. */
  listRow: { insetY: 12, insetX: 16, gap: 12, chevron: 16, tile: 36, minHeight: 44 },

  /** `Skeleton` (AC-14): the band crossing it, by scheme. */
  skeleton: { bandLight: 0.6, bandDark: 0.08 },
} as const;
