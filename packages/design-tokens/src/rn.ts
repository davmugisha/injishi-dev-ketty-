/**
 * The React Native scales — the space grid, the corners, the type steps.
 *
 * ADR-034 task 6: *"Exactly one declaration of `radius`, `space` and `font` for
 * React Native in the repo."* Before this file there were two, and they
 * disagreed:
 *
 *   package  radius { sm: 4, md: 8, lg: 12, pill: 9999 }   font { ui: "Outfit" }
 *   mobile   radius { none: 0, xs: 4, sm: 8, md: 10,       Figtree
 *                     lg: 14, xl: 20, pill: 999 }
 *
 * The package's copy was not merely unused — it was WRONG. Nothing in the repo
 * imported it (checked: `radius`, `space` and `font` had zero consumers), so it
 * drifted freely: `Outfit` was replaced by Figtree in the app and the package
 * never heard, and its four-step radius set never grew the `xs`, `xl` and
 * `none` the app actually draws with. A second declaration that nobody reads is
 * how a design system acquires values that are true nowhere.
 *
 * The values here are `apps/mobile`'s, unchanged. That direction is deliberate:
 * ADR-034 decision 3 is *"reconstruction, never redesign"*, and the app's set is
 * the one that ships on a device today. Moving a corner or a step is a separate
 * change with its own before-and-after.
 *
 * WHAT IS NOT HERE, and why:
 *
 *   - **The font family.** ADR-025 held that `--font-sans` is the APP's fact
 *     because the family differs per app, and `ui-tokens.md` repeats it for the
 *     layout scale. A scale is shared; a typeface is a brand decision per
 *     surface. `fontFamily` stays in `apps/mobile/src/theme/tokens.ts`.
 *   - **Shadows and scrims.** They are React Native style OBJECTS, not scale
 *     values, and the scrim alphas were solved against this product's own
 *     photography. They stay with the app that renders them.
 *
 * THE TWO TYPE SCALES ARE NOT THE SAME SCALE, and that is worth stating plainly
 * because the names collide. `layout.ts` carries the CSS scale ADR-027
 * specifies — `xl` is 20px there. This file carries the React Native scale —
 * `xl` is 22px, and the body step is `md` where the web calls it `base`. They
 * were authored separately for two different rendering models and reconciling
 * them is a real design decision with 757 mobile call sites behind it, not a
 * tidy-up. It is owed, and it is not this change.
 */

/** The 4px base grid. Every gap, pad and margin in the app is a step on it. */
export const rnSpace = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/**
 * Corners.
 *
 * `parity.md` §5.2 maps these onto web's enforced set of three rather than the
 * reverse — `md` is the control corner, `lg` the card corner, `pill` the round
 * one — and keeps `xs`, `sm`, `xl` and `none` as deprecated aliases rather than
 * deleting them, because deleting breaks call sites for no visual gain.
 */
export const rnRadius = {
  none: 0,
  xs: 4,
  sm: 8, // badges, chips, small controls
  md: 10, // inputs, buttons
  lg: 14, // cards, panels, sheets, images
  xl: 20, // feature blocks, modals
  pill: 999,
} as const;

/** The type scale, in device pixels. 16px base. */
export const rnFontSize = {
  "2xs": 11,
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  "2xl": 28,
  "3xl": 36,
} as const;

/**
 * The leading that belongs to each step.
 *
 * A step is a PAIR. `ui-rules.md`: *"A hand-typed size also ships no line
 * height, so two of them at the same pixel value still disagree."* Before this
 * pair existed, `Text` took a number and shipped no leading at all, and 757
 * call sites had typed one.
 *
 * The curve tightens as the size grows — body at 1.5 is comfortable, a 36px
 * heading at 1.5 has a hole through the middle of it — and every value is even,
 * so a stack of text lands on the half-grid.
 */
export const rnLineHeight = {
  "2xs": 16,
  xs: 18,
  sm: 20,
  md: 24,
  lg: 26,
  xl: 30,
  "2xl": 36,
  "3xl": 44,
} as const satisfies Record<keyof typeof rnFontSize, number>;

export type RnSpaceStep = keyof typeof rnSpace;
export type RnRadiusStep = keyof typeof rnRadius;
export type RnTextSize = keyof typeof rnFontSize;
