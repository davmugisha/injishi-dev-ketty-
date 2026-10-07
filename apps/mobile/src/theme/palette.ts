/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by `scripts/derive-palette.mjs` from the HeroUI roles in
 * `@injishi/design-tokens`. To change a colour, change the token and re-run
 * the script; re-running it on unchanged tokens produces no diff (AC-10).
 *
 * This is the green HeroUI palette the rest of the platform already renders,
 * converted from `oklch()` to hex once, at build time, because React Native's
 * colour parser does not dependably accept `oklch()`. Out-of-gamut roles were
 * gamut-mapped by reducing chroma with lightness and hue held, so a value here
 * is the closest in-gamut colour to what a browser paints for the same token —
 * never a clipped approximation of it.
 *
 * The key set is the one `tokens.ts` has always exported, so no screen had to
 * change. Each key's comment names the HeroUI role it reads and the `oklch()`
 * string it came from, so any value here traces back to its source in one step.
 * ADR-030 child "the React Native palette" owns the mapping and retires the
 * `brand*` and `neutral*` keys once every call site has moved.
 *
 * Measured, every scheme, against `surfaceTertiary` — the darkest light
 * surface and the lightest dark one, and therefore the worst case in each:
 *
 *   light:
 *     textBody          13.19:1
 *     textMuted         4.82:1
 *     textLink          4.82:1
 *     success600        4.65:1
 *     warning600        4.61:1
 *     danger600         4.75:1
 *     domainResidence   4.64:1
 *     textOnBrand       4.63:1
 *     borderStrong      3.3:1
 *   dark:
 *     textBody          14.58:1
 *     textMuted         4.66:1
 *     textLink          4.66:1
 *     success600        4.66:1
 *     warning600        4.63:1
 *     danger600         4.53:1
 *     domainResidence   4.66:1
 *     textOnBrand       4.63:1
 *     borderStrong      3.12:1
 *
 * `textOnBrand` is snow, the ink the design system puts on its accent. ADR-068
 * set the accent fill at L 0.54 so that snow measures 4.63:1 on it; anything
 * drawn on an accent fill takes this value, and nothing else does.
 */

export type ColorScheme = 'light' | 'dark';

/** Light scheme. */
const light = {
  /* Brand ramp — retiring. These were the ink ramp wearing brand names; ADR-030 maps them onto neutral roles and nothing new may use them. */
  brand900: '#1F231F', // foreground — oklch(25.00% 0.0093 145.10)
  brand700: '#353935', // foregroundHover — oklch(34.00% 0.0093 145.10)
  brand500: '#606760', // muted — oklch(50.50% 0.0140 145.10)
  brand300: '#D5D9D5', // border — oklch(88.00% 0.0070 145.10)
  brand200: '#E3E5E3', // separator — oklch(92.00% 0.0047 145.10)
  brand100: '#ECEFEC', // surfaceSecondary — oklch(95.00% 0.0056 145.10)

  /* Status hues. The *500 keys are the FILL roles; the *600 keys are the pinned text steps. */
  success600: '#007124', // success at L 47.00% — text step, see TEXT_STEPS — oklch(47.00% 0.1935 150.81)
  success500: '#17C964', // success — oklch(73.29% 0.1935 150.81)
  warning600: '#905500', // warning at L 50.50% — text step, see TEXT_STEPS — oklch(50.50% 0.1585 72.33)
  warning500: '#F5A524', // warning — oklch(78.19% 0.1585 72.33)
  danger600: '#B30007', // danger at L 47.00% — text step, see TEXT_STEPS — oklch(47.00% 0.2328 25.74)
  danger500: '#E60F25', // danger — oklch(58.50% 0.2328 25.74)

  /* Domains. Teal for Hospitality, violet for Residence — the one hue clear of accent 208, success 145, warning 67 and danger 20. */
  domainHospitality: '#17852A', // accent — oklch(54.00% 0.1594 145.10)
  domainResidence: '#594BB4', // info at L 48.50% — fill AND ink, see TEXT_STEPS — oklch(48.50% 0.1600 285.00)

  /* Grounds and surfaces. The three surface roles are one step apart in dark (ADR-019). */
  bgApp: '#EEF1EE', // background — oklch(95.50% 0.0056 145.10)
  bgTint: '#ECEFEC', // surfaceSecondary — oklch(95.00% 0.0056 145.10)
  surface1: '#F5F7F5', // surface — oklch(97.50% 0.0037 145.10)
  surface2: '#ECEFEC', // surfaceSecondary — oklch(95.00% 0.0056 145.10)
  surface3: '#E6EBE6', // surfaceTertiary — oklch(93.50% 0.0075 145.10)
  surfaceSunken: '#EEF1EE', // background — oklch(95.50% 0.0056 145.10)
  surfaceInverse: '#1F231F', // foreground — oklch(25.00% 0.0093 145.10)
  elevate1: '#ECEFEC', // surfaceSecondary — oklch(95.00% 0.0056 145.10)
  elevate2: '#E6EBE6', // surfaceTertiary — oklch(93.50% 0.0075 145.10)

  /* Text. */
  textStrong: '#1F231F', // foreground — oklch(25.00% 0.0093 145.10)
  textBody: '#1F231F', // foreground — HeroUI has one body step, not two — oklch(25.00% 0.0093 145.10)
  textMuted: '#606760', // muted — oklch(50.50% 0.0140 145.10)
  textSubtle: '#606760', // muted — collapses onto muted — oklch(50.50% 0.0140 145.10)
  textOnBrand: '#FCFCFC', // accentForeground — snow on the green accent fill (ADR-068); never pure white — oklch(99.11% 0 0)
  textLink: '#007618', // accentText — the accent hue authored for use as text — oklch(49.00% 0.1594 145.10)

  /* Foregrounds for a SOLID status fill. Each is HeroUI's own answer for its own fill; none is white. */
  textOnSuccess: '#1F231F', // successForeground — near-ink at the success hue. White on this fill measures ~2:1 — oklch(25.00% 0.0093 145.10)
  textOnWarning: '#1F231F', // warningForeground — near-ink at the warning hue — oklch(25.00% 0.0093 145.10)
  textOnDanger: '#FCFCFC', // dangerForeground — near-WHITE here, because the danger fill is the one dark enough to carry it (ADR-025 #2 moved it to L 58 for exactly this) — oklch(99.11% 0 0)

  /* Borders and controls. */
  borderSubtle: '#E3E5E3', // separator — oklch(92.00% 0.0047 145.10)
  borderDefault: '#D5D9D5', // border — decorative hairline, 1.24:1, and that is allowed — oklch(88.00% 0.0070 145.10)
  borderStrong: '#788278', // fieldOutline — the control boundary that meets 3:1 — oklch(59.50% 0.0199 145.10)
  borderBrand: '#17852A', // accent — oklch(54.00% 0.1594 145.10)
  action: '#1F231F', // primary -> foreground — the solid neutral button — oklch(25.00% 0.0093 145.10)
  actionHover: '#353935', // primaryHover -> foregroundHover — RN has no hover; this is the pressed step — oklch(34.00% 0.0093 145.10)
  actionActive: '#353935', // foregroundHover — oklch(34.00% 0.0093 145.10)
  actionSubtle: '#ECEFEC', // surfaceSecondary — oklch(95.00% 0.0056 145.10)
  pressInk: '#1F231F', // ink — the fixed near-black; the press highlight on a fill whose label is lighter than it, so a press darkens away from the label (ADR-068) — oklch(25.00% 0.0093 145.10)
  focusRing: '#17852A', // focus — oklch(54.00% 0.1594 145.10)

  /* Tint fills — the hue at 0.14 alpha, eight-digit #RRGGBBAA. */
  success100: '#17C96424', // success at 0.14 alpha — oklch(73.29% 0.1935 150.81)
  warning100: '#F5A52424', // warning at 0.14 alpha — oklch(78.19% 0.1585 72.33)
  danger100: '#E60F2524', // danger at 0.14 alpha — oklch(58.50% 0.2328 25.74)
  neutral100: '#E2E5E2', // default — oklch(92.00% 0.0056 145.10)
  neutral200: '#E6EBE6', // surfaceTertiary — oklch(93.50% 0.0075 145.10)
  neutral400: '#606760', // muted — oklch(50.50% 0.0140 145.10)
  neutral500: '#606760', // muted — oklch(50.50% 0.0140 145.10)
  neutral600: '#606760', // muted — oklch(50.50% 0.0140 145.10)
  domainHospitality100: '#ECEFEC', // surfaceSecondary — oklch(95.00% 0.0056 145.10)
  domainResidence100: '#594BB424', // domainResidence at 0.14 alpha — oklch(48.50% 0.1600 285.00)
} as const;

/** Every palette key resolves to a color string; both schemes share the shape. */
export type Palette = { [K in keyof typeof light]: string };

/** Dark scheme. Same key set by construction. */
const dark: Palette = {
  /* Brand ramp — retiring. These were the ink ramp wearing brand names; ADR-030 maps them onto neutral roles and nothing new may use them. */
  brand900: '#FCFCFC', // foreground — oklch(99.11% 0 0)
  brand700: '#D4D9D4', // foregroundHover — oklch(88.00% 0.0093 145.10)
  brand500: '#8C918C', // muted — oklch(65.00% 0.0093 145.10)
  brand300: '#2B2F2B', // border — oklch(30.00% 0.0093 145.10)
  brand200: '#262A26', // separator — oklch(28.00% 0.0084 145.10)
  brand100: '#1D201D', // surfaceSecondary — oklch(24.00% 0.0093 145.10)

  /* Status hues. The *500 keys are the FILL roles; the *600 keys are the pinned text steps. */
  success600: '#00C15D', // success at L 71.00% — text step, see TEXT_STEPS — oklch(71.00% 0.1935 150.81)
  success500: '#17C964', // success — oklch(73.29% 0.1935 150.81)
  warning600: '#DFA136', // warning at L 75.00% — text step, see TEXT_STEPS — oklch(75.00% 0.1388 76.34)
  warning500: '#F7B750', // warning — oklch(82.03% 0.1388 76.34)
  danger600: '#FF625F', // danger at L 70.50% — text step, see TEXT_STEPS — oklch(70.50% 0.1967 24.63)
  danger500: '#D6363A', // danger — oklch(58.00% 0.1967 24.63)

  /* Domains. Teal for Hospitality, violet for Residence — the one hue clear of accent 208, success 145, warning 67 and danger 20. */
  domainHospitality: '#17852A', // accent — oklch(54.00% 0.1594 145.10)
  domainResidence: '#A39BFF', // info at L 74.50% — fill AND ink, see TEXT_STEPS — oklch(74.50% 0.1600 285.00)

  /* Grounds and surfaces. The three surface roles are one step apart in dark (ADR-019). */
  bgApp: '#0B0E0B', // background — oklch(16.00% 0.0093 145.10)
  bgTint: '#1D201D', // surfaceSecondary — oklch(24.00% 0.0093 145.10)
  surface1: '#131713', // surface — oklch(20.00% 0.0093 145.10)
  surface2: '#1D201D', // surfaceSecondary — oklch(24.00% 0.0093 145.10)
  surface3: '#242824', // surfaceTertiary — oklch(27.00% 0.0093 145.10)
  surfaceSunken: '#0B0E0B', // background — oklch(16.00% 0.0093 145.10)
  surfaceInverse: '#FCFCFC', // foreground — oklch(99.11% 0 0)
  elevate1: '#1D201D', // surfaceSecondary — oklch(24.00% 0.0093 145.10)
  elevate2: '#242824', // surfaceTertiary — oklch(27.00% 0.0093 145.10)

  /* Text. */
  textStrong: '#FCFCFC', // foreground — oklch(99.11% 0 0)
  textBody: '#FCFCFC', // foreground — HeroUI has one body step, not two — oklch(99.11% 0 0)
  textMuted: '#8C918C', // muted — oklch(65.00% 0.0093 145.10)
  textSubtle: '#8C918C', // muted — collapses onto muted — oklch(65.00% 0.0093 145.10)
  textOnBrand: '#FCFCFC', // accentForeground — snow on the green accent fill (ADR-068); never pure white — oklch(99.11% 0 0)
  textLink: '#3EA348', // accentText — the accent hue authored for use as text — oklch(63.50% 0.1594 145.10)

  /* Foregrounds for a SOLID status fill. Each is HeroUI's own answer for its own fill; none is white. */
  textOnSuccess: '#131713', // successForeground — near-ink at the success hue. White on this fill measures ~2:1 — oklch(20.00% 0.0093 145.10)
  textOnWarning: '#131713', // warningForeground — near-ink at the warning hue — oklch(20.00% 0.0093 145.10)
  textOnDanger: '#FCFCFC', // dangerForeground — near-WHITE here, because the danger fill is the one dark enough to carry it (ADR-025 #2 moved it to L 58 for exactly this) — oklch(99.11% 0 0)

  /* Borders and controls. */
  borderSubtle: '#262A26', // separator — oklch(28.00% 0.0084 145.10)
  borderDefault: '#2B2F2B', // border — decorative hairline, 1.24:1, and that is allowed — oklch(30.00% 0.0093 145.10)
  borderStrong: '#6B756B', // fieldOutline — the control boundary that meets 3:1 — oklch(55.00% 0.0199 145.10)
  borderBrand: '#17852A', // accent — oklch(54.00% 0.1594 145.10)
  action: '#FCFCFC', // primary -> foreground — the solid neutral button — oklch(99.11% 0 0)
  actionHover: '#D4D9D4', // primaryHover -> foregroundHover — RN has no hover; this is the pressed step — oklch(88.00% 0.0093 145.10)
  actionActive: '#D4D9D4', // foregroundHover — oklch(88.00% 0.0093 145.10)
  actionSubtle: '#1D201D', // surfaceSecondary — oklch(24.00% 0.0093 145.10)
  pressInk: '#1F231F', // ink — the fixed near-black; the press highlight on a fill whose label is lighter than it, so a press darkens away from the label (ADR-068) — oklch(25.00% 0.0093 145.10)
  focusRing: '#17852A', // focus — oklch(54.00% 0.1594 145.10)

  /* Tint fills — the hue at 0.16 alpha, eight-digit #RRGGBBAA. */
  success100: '#17C96429', // success at 0.16 alpha — oklch(73.29% 0.1935 150.81)
  warning100: '#F7B75029', // warning at 0.16 alpha — oklch(82.03% 0.1388 76.34)
  danger100: '#D6363A29', // danger at 0.16 alpha — oklch(58.00% 0.1967 24.63)
  neutral100: '#212521', // default — oklch(26.00% 0.0093 145.10)
  neutral200: '#242824', // surfaceTertiary — oklch(27.00% 0.0093 145.10)
  neutral400: '#8C918C', // muted — oklch(65.00% 0.0093 145.10)
  neutral500: '#8C918C', // muted — oklch(65.00% 0.0093 145.10)
  neutral600: '#8C918C', // muted — oklch(65.00% 0.0093 145.10)
  domainHospitality100: '#1D201D', // surfaceSecondary — oklch(24.00% 0.0093 145.10)
  domainResidence100: '#A39BFF29', // domainResidence at 0.16 alpha — oklch(74.50% 0.1600 285.00)
};


export const palettes: Record<ColorScheme, Palette> = { light, dark };
