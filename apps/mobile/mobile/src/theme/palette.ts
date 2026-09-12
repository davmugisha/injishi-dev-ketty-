/**
 * GENERATED FILE — do not edit by hand.
 *
 * Written by `scripts/derive-palette.mjs` from the HeroUI roles in
 * `@injishi/design-tokens`. To change a colour, change the token and re-run
 * the script; re-running it on unchanged tokens produces no diff (AC-10).
 *
 * This is the teal HeroUI palette the rest of the platform already renders,
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
 *     textBody          14.71:1
 *     textMuted         4.65:1
 *     textLink          4.83:1
 *     success600        4.52:1
 *     warning600        4.62:1
 *     danger600         4.73:1
 *     domainResidence   4.65:1
 *     textOnBrand       5.7:1
 *     borderStrong      3.26:1
 *   dark:
 *     textBody          14.54:1
 *     textMuted         5.73:1
 *     textLink          6.22:1
 *     success600        4.63:1
 *     warning600        4.64:1
 *     danger600         4.52:1
 *     domainResidence   4.63:1
 *     textOnBrand       5.7:1
 *     borderStrong      3.23:1
 *
 * `textOnBrand` is near-INK, not white. The accent fill sits at L 0.65, which
 * carries white at 3.10:1 and ink at 5.7:1 — so anything drawn on an
 * accent fill takes this value (ADR-025 correction #1).
 */

export type ColorScheme = 'light' | 'dark';

/** Light scheme. */
const light = {
  /* Brand ramp — retiring. These were the ink ramp wearing brand names; ADR-030 maps them onto neutral roles and nothing new may use them. */
  brand900: '#131A1B', // foreground — oklch(21.03% 0.0100 208.00)
  brand700: '#2D3435', // foregroundHover — oklch(32.00% 0.0100 208.00)
  brand500: '#5B6B6D', // muted — oklch(51.50% 0.0199 208.00)
  brand300: '#D7E0E1', // border — oklch(90.00% 0.0100 208.00)
  brand200: '#DDE7E8', // separator — oklch(92.00% 0.0100 208.00)
  brand100: '#E9F1F2', // surfaceSecondary — oklch(95.24% 0.0080 208.00)

  /* Status hues. The *500 keys are the FILL roles; the *600 keys are the pinned text steps. */
  success600: '#007500', // success at L 48.00% — text step, see TEXT_STEPS — oklch(48.00% 0.1974 145.31)
  success500: '#3FC752', // success — oklch(73.29% 0.1974 145.31)
  warning600: '#955200', // warning at L 50.50% — text step, see TEXT_STEPS — oklch(50.50% 0.1617 66.83)
  warning500: '#FCA029', // warning — oklch(78.19% 0.1617 66.83)
  danger600: '#B20023', // danger at L 47.00% — text step, see TEXT_STEPS — oklch(47.00% 0.2374 20.24)
  danger500: '#E50039', // danger — oklch(58.00% 0.2374 20.24)

  /* Domains. Teal for Hospitality, violet for Residence — the one hue clear of accent 208, success 145, warning 67 and danger 20. */
  domainHospitality: '#0DA1B2', // accent — oklch(65.00% 0.1100 208.00)
  domainResidence: '#594BB4', // info at L 48.50% — fill AND ink, see TEXT_STEPS — oklch(48.50% 0.1600 285.00)

  /* Grounds and surfaces. The three surface roles are one step apart in dark (ADR-019). */
  bgApp: '#EEF7F9', // background — oklch(97.02% 0.0100 208.00)
  bgTint: '#E9F1F2', // surfaceSecondary — oklch(95.24% 0.0080 208.00)
  surface1: '#FFFFFF', // surface — oklch(100.00% 0.0050 208.00)
  surface2: '#E9F1F2', // surfaceSecondary — oklch(95.24% 0.0080 208.00)
  surface3: '#E4ECED', // surfaceTertiary — oklch(93.73% 0.0080 208.00)
  surfaceSunken: '#EEF7F9', // background — oklch(97.02% 0.0100 208.00)
  surfaceInverse: '#131A1B', // foreground — oklch(21.03% 0.0100 208.00)
  elevate1: '#E9F1F2', // surfaceSecondary — oklch(95.24% 0.0080 208.00)
  elevate2: '#E4ECED', // surfaceTertiary — oklch(93.73% 0.0080 208.00)

  /* Text. */
  textStrong: '#131A1B', // foreground — oklch(21.03% 0.0100 208.00)
  textBody: '#131A1B', // foreground — HeroUI has one body step, not two — oklch(21.03% 0.0100 208.00)
  textMuted: '#5B6B6D', // muted — oklch(51.50% 0.0199 208.00)
  textSubtle: '#5B6B6D', // muted — collapses onto muted — oklch(51.50% 0.0199 208.00)
  textOnBrand: '#15191A', // accentForeground — NEAR-INK, not white: the accent fill carries white at 3.10:1 and ink at 5.70:1 — oklch(21.03% 0.0059 208.00)
  textLink: '#00707F', // accentText — teal authored for use as text — oklch(49.00% 0.1100 208.00)

  /* Foregrounds for a SOLID status fill. Each is HeroUI's own answer for its own fill; none is white. */
  textOnSuccess: '#171917', // successForeground — near-ink at the success hue. White on this fill measures ~2:1 — oklch(21.03% 0.0059 145.31)
  textOnWarning: '#1A1816', // warningForeground — near-ink at the warning hue — oklch(21.03% 0.0059 66.83)
  textOnDanger: '#FCFCFC', // dangerForeground — near-WHITE here, because the danger fill is the one dark enough to carry it (ADR-025 #2 moved it to L 58 for exactly this) — oklch(99.11% 0 0)

  /* Borders and controls. */
  borderSubtle: '#DDE7E8', // separator — oklch(92.00% 0.0100 208.00)
  borderDefault: '#D7E0E1', // border — decorative hairline, 1.24:1, and that is allowed — oklch(90.00% 0.0100 208.00)
  borderStrong: '#738486', // fieldOutline — the control boundary that meets 3:1 — oklch(60.00% 0.0199 208.00)
  borderBrand: '#0DA1B2', // accent — oklch(65.00% 0.1100 208.00)
  action: '#131A1B', // primary -> foreground — the solid neutral button — oklch(21.03% 0.0100 208.00)
  actionHover: '#2D3435', // primaryHover -> foregroundHover — RN has no hover; this is the pressed step — oklch(32.00% 0.0100 208.00)
  actionActive: '#2D3435', // foregroundHover — oklch(32.00% 0.0100 208.00)
  actionSubtle: '#E9F1F2', // surfaceSecondary — oklch(95.24% 0.0080 208.00)
  focusRing: '#008F9F', // focus — oklch(59.00% 0.1100 208.00)

  /* Tint fills — the hue at 0.14 alpha, eight-digit #RRGGBBAA. */
  success100: '#3FC75224', // success at 0.14 alpha — oklch(73.29% 0.1974 145.31)
  warning100: '#FCA02924', // warning at 0.14 alpha — oklch(78.19% 0.1617 66.83)
  danger100: '#E5003924', // danger at 0.14 alpha — oklch(58.00% 0.2374 20.24)
  neutral100: '#E4EDEF', // default — oklch(94.00% 0.0100 208.00)
  neutral200: '#E4ECED', // surfaceTertiary — oklch(93.73% 0.0080 208.00)
  neutral400: '#5B6B6D', // muted — oklch(51.50% 0.0199 208.00)
  neutral500: '#5B6B6D', // muted — oklch(51.50% 0.0199 208.00)
  neutral600: '#5B6B6D', // muted — oklch(51.50% 0.0199 208.00)
  domainHospitality100: '#E9F1F2', // surfaceSecondary — oklch(95.24% 0.0080 208.00)
  domainResidence100: '#594BB424', // domainResidence at 0.14 alpha — oklch(48.50% 0.1600 285.00)
} as const;

/** Every palette key resolves to a color string; both schemes share the shape. */
export type Palette = { [K in keyof typeof light]: string };

/** Dark scheme. Same key set by construction. */
const dark: Palette = {
  /* Brand ramp — retiring. These were the ink ramp wearing brand names; ADR-030 maps them onto neutral roles and nothing new may use them. */
  brand900: '#F5FEFF', // foreground — oklch(99.11% 0.0100 208.00)
  brand700: '#D0D9DB', // foregroundHover — oklch(88.00% 0.0100 208.00)
  brand500: '#92A4A6', // muted — oklch(70.50% 0.0199 208.00)
  brand300: '#232A2B', // border — oklch(28.00% 0.0100 208.00)
  brand200: '#1C2324', // separator — oklch(25.00% 0.0100 208.00)
  brand100: '#1B2527', // surfaceSecondary — oklch(25.70% 0.0149 208.00)

  /* Status hues. The *500 keys are the FILL roles; the *600 keys are the pinned text steps. */
  success600: '#35C04A', // success at L 71.00% — text step, see TEXT_STEPS — oklch(71.00% 0.1974 145.31)
  success500: '#3FC752', // success — oklch(73.29% 0.1974 145.31)
  warning600: '#E69D37', // warning at L 75.00% — text step, see TEXT_STEPS — oklch(75.00% 0.1416 70.84)
  warning500: '#FDB351', // warning — oklch(82.03% 0.1416 70.84)
  danger600: '#FF5E6C', // danger at L 70.50% — text step, see TEXT_STEPS — oklch(70.50% 0.2006 19.13)
  danger500: '#D52F46', // danger — oklch(57.50% 0.2006 19.13)

  /* Domains. Teal for Hospitality, violet for Residence — the one hue clear of accent 208, success 145, warning 67 and danger 20. */
  domainHospitality: '#0DA1B2', // accent — oklch(65.00% 0.1100 208.00)
  domainResidence: '#A39BFF', // info at L 74.50% — fill AND ink, see TEXT_STEPS — oklch(74.50% 0.1600 285.00)

  /* Grounds and surfaces. The three surface roles are one step apart in dark (ADR-019). */
  bgApp: '#030707', // background — oklch(12.00% 0.0100 208.00)
  bgTint: '#1B2527', // surfaceSecondary — oklch(25.70% 0.0149 208.00)
  surface1: '#0D1B1D', // surface — oklch(21.03% 0.0199 208.00)
  surface2: '#1B2527', // surfaceSecondary — oklch(25.70% 0.0149 208.00)
  surface3: '#1F292B', // surfaceTertiary — oklch(27.21% 0.0149 208.00)
  surfaceSunken: '#030707', // background — oklch(12.00% 0.0100 208.00)
  surfaceInverse: '#F5FEFF', // foreground — oklch(99.11% 0.0100 208.00)
  elevate1: '#1B2527', // surfaceSecondary — oklch(25.70% 0.0149 208.00)
  elevate2: '#1F292B', // surfaceTertiary — oklch(27.21% 0.0149 208.00)

  /* Text. */
  textStrong: '#F5FEFF', // foreground — oklch(99.11% 0.0100 208.00)
  textBody: '#F5FEFF', // foreground — HeroUI has one body step, not two — oklch(99.11% 0.0100 208.00)
  textMuted: '#92A4A6', // muted — oklch(70.50% 0.0199 208.00)
  textSubtle: '#92A4A6', // muted — collapses onto muted — oklch(70.50% 0.0199 208.00)
  textOnBrand: '#15191A', // accentForeground — NEAR-INK, not white: the accent fill carries white at 3.10:1 and ink at 5.70:1 — oklch(21.03% 0.0059 208.00)
  textLink: '#37B7C8', // accentText — teal authored for use as text — oklch(72.00% 0.1100 208.00)

  /* Foregrounds for a SOLID status fill. Each is HeroUI's own answer for its own fill; none is white. */
  textOnSuccess: '#171917', // successForeground — near-ink at the success hue. White on this fill measures ~2:1 — oklch(21.03% 0.0059 145.31)
  textOnWarning: '#1A1815', // warningForeground — near-ink at the warning hue — oklch(21.03% 0.0059 70.84)
  textOnDanger: '#FCFCFC', // dangerForeground — near-WHITE here, because the danger fill is the one dark enough to carry it (ADR-025 #2 moved it to L 58 for exactly this) — oklch(99.11% 0 0)

  /* Borders and controls. */
  borderSubtle: '#1C2324', // separator — oklch(25.00% 0.0100 208.00)
  borderDefault: '#232A2B', // border — decorative hairline, 1.24:1, and that is allowed — oklch(28.00% 0.0100 208.00)
  borderStrong: '#68787B', // fieldOutline — the control boundary that meets 3:1 — oklch(56.00% 0.0199 208.00)
  borderBrand: '#0DA1B2', // accent — oklch(65.00% 0.1100 208.00)
  action: '#F5FEFF', // primary -> foreground — the solid neutral button — oklch(99.11% 0.0100 208.00)
  actionHover: '#D0D9DB', // primaryHover -> foregroundHover — RN has no hover; this is the pressed step — oklch(88.00% 0.0100 208.00)
  actionActive: '#D0D9DB', // foregroundHover — oklch(88.00% 0.0100 208.00)
  actionSubtle: '#1B2527', // surfaceSecondary — oklch(25.70% 0.0149 208.00)
  focusRing: '#0DA1B2', // focus — oklch(65.00% 0.1100 208.00)

  /* Tint fills — the hue at 0.16 alpha, eight-digit #RRGGBBAA. */
  success100: '#3FC75229', // success at 0.16 alpha — oklch(73.29% 0.1974 145.31)
  warning100: '#FDB35129', // warning at 0.16 alpha — oklch(82.03% 0.1416 70.84)
  danger100: '#D52F4629', // danger at 0.16 alpha — oklch(57.50% 0.2006 19.13)
  neutral100: '#22292A', // default — oklch(27.40% 0.0100 208.00)
  neutral200: '#1F292B', // surfaceTertiary — oklch(27.21% 0.0149 208.00)
  neutral400: '#92A4A6', // muted — oklch(70.50% 0.0199 208.00)
  neutral500: '#92A4A6', // muted — oklch(70.50% 0.0199 208.00)
  neutral600: '#92A4A6', // muted — oklch(70.50% 0.0199 208.00)
  domainHospitality100: '#1B2527', // surfaceSecondary — oklch(25.70% 0.0149 208.00)
  domainResidence100: '#A39BFF29', // domainResidence at 0.16 alpha — oklch(74.50% 0.1600 285.00)
};


export const palettes: Record<ColorScheme, Palette> = { light, dark };
