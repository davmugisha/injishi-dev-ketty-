"use strict";
/**
 * The HeroUI 3 semantic layer — the Injishi green theme.
 *
 * This is the SAME kind of artifact as `semantic.ts`: a role -> value map with
 * one authored source. What differs is the VOCABULARY. HeroUI 3 reads its own
 * role names off CSS variables (`--accent`, `--surface`, `--field-background`,
 * …), so a HeroUI component only renders correctly when those exact names
 * resolve. Emitting them here rather than pasting a theme block into five
 * `globals.css` files is what keeps ADR-010's "one semantic source" true after
 * the move to HeroUI.
 *
 * SOURCE (ADR-068). Values are OKLCH, transcribed from the saved HeroUI Pro
 * Design System "Injishi" (`de231dfa-8a53-40c9-ba3b-cd9d5a93685b`, re-read
 * at saved `updatedAt` 1791346544685 on 2026-10-07;
 * first read at 1791209095850): the `mouve` Pro theme at base tone neutral, hue
 * 145.10, chroma 0.1594, accent `#1C882D`, radius 0.5rem, field radius 0.75rem.
 * They are transcribed verbatim EXCEPT where a transcribed value fails WCAG,
 * and every one of those is marked CORRECTED at its declaration with the
 * measurement that moved it. The rule is ADR-025's, unchanged: keep the
 * source's hue and chroma, move only lightness, and only as far as the floor
 * requires. So a re-export from the HeroUI editor is a DIFF to read against
 * this file, never a paste over it.
 *
 * This replaced ADR-025's teal (hue 208). The hue moved, so every neutral moved
 * with it: the greys are the green hue at near-zero chroma, as they were teal
 * before.
 *
 * Where the design system's two outputs disagree, its generated CSS wins over
 * its DESIGN.md. DESIGN.md resolves the light `surface`, `overlay` and
 * `field-background` to pure white and dark `chart-3` to the accent; the CSS
 * the HeroUI preview renders sets them to the values below.
 *
 * FIVE roles are authored here that the design system does not produce,
 * because HeroUI has no role for them and Injishi does:
 *
 *  - `accentText`  — green as TEXT on a light canvas. `--accent` is a FILL; as
 *                    text on `default` (L 0.92), the darkest light ground text
 *                    sits on, it measures 3.74:1, under 4.5:1, so a separate
 *                    darker step is required. Same hue, so it reads as one
 *                    colour.
 *  - `info`        — the fifth status hue, violet 285. It moved there under
 *                    ADR-025 because blue was then the accent. It stays: green
 *                    accent 145 sits beside success 150.81, so the status set
 *                    has no hue to spare, and 285 still clears every one.
 *  - `foregroundHover` — the hover step under the solid neutral button, one
 *                    small move off `foreground`. Aliasing it to `muted` jumped
 *                    a near-black fill to mid-grey.
 *  - `dangerText`  — red as TEXT, the counterpart of `accentText`. `--danger`
 *                    is a FILL tuned so `--danger-foreground` reads on it;
 *                    nothing tuned it for reading on a surface. It binds on the
 *                    12px field errors in the checkout, which is every "Check
 *                    that number" a guest sees.
 *  - `fieldOutline` — the form-field BOUNDARY for `border-input`. `--border`
 *                    and `--field-border` are decorative hairlines near 1.3:1
 *                    and WCAG 1.4.11 does not bind on them; a field outline is
 *                    a control boundary and 3:1 does bind.
 *
 * NO `*-hover` role is authored here beyond `foregroundHover`. `@heroui/styles`
 * DERIVES every other one from the base role with `color-mix`. Overriding one
 * with a hand-picked value replaces the derivation for that role alone and
 * quietly breaks the system's one hover convention. Change `--accent` and every
 * hover moves with it. The two exceptions, `--accent-hover` and
 * `--danger-hover`, are still mixes of their base role, only toward `ink`
 * rather than toward a light label (`herouiMixes`, below).
 *
 * @see semantic.ts for the pre-HeroUI vocabulary, still emitted for the apps
 *      that have not been converted yet.
 * @see ADR-025 for the correction rule, ADR-068 for this palette's source.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.herouiFixedGrounds = exports.herouiSpacing = exports.herouiFieldRadius = exports.herouiRadius = exports.herouiAliases = exports.herouiMixes = exports.herouiElevation = exports.herouiDark = exports.herouiLight = exports.herouiFixed = void 0;
/** Roles holding ONE value in both themes (the ADR-010 call 2 rule, kept). */
exports.herouiFixed = {
    // A brand chip must not invert. `ink` is the design system's `eclipse`, the
    // near-black on the theme's own hue, so a chip cannot clash with the surface
    // it lands on.
    ink: "oklch(25.00% 0.0093 145.10)",
    white: "#FFFFFF",
    // Pure black never ships (ramps.ts). The `mouve` theme sets it to
    // `oklch(0% 0 0)`; this keeps the ADR-010 rule instead.
    black: "var(--ink)",
    // HeroUI's two named neutrals. The design system mixes `--accent-hover`
    // toward `--snow`, and the `mouve` component layer reads both.
    snow: "oklch(99.11% 0 0)",
    eclipse: "oklch(25.00% 0.0093 145.10)",
    slateLine: "oklch(50.50% 0.0140 145.10)",
    surfaceTint: "oklch(95.00% 0.0056 145.10)",
    canvas: "oklch(95.50% 0.0056 145.10)",
    controlWash: "oklch(50.50% 0.0140 145.10)",
    placeholderDim: "oklch(50.50% 0.0140 145.10)",
};
/** HeroUI roles, light theme. */
exports.herouiLight = {
    // CORRECTED. The source's L 54.91 (`#1C882D`) carries `snow` at 4.44:1.
    // L 54.00 carries it at 4.63:1, and the two are not told apart by eye.
    accent: "oklch(54.00% 0.1594 145.10)",
    accentForeground: "oklch(99.11% 0 0)",
    background: "oklch(95.50% 0.0056 145.10)",
    backdrop: "oklch(50.00% 0.0187 145.10 / 0.4)",
    border: "oklch(88.00% 0.0070 145.10)",
    // CORRECTED. The `mouve` red at L 65.32 carries `snow` at 3.48:1, the same
    // failure ADR-025 #2 fixed. L 58.50 carries it at 4.59:1.
    danger: "oklch(58.50% 0.2328 25.74)",
    dangerForeground: "oklch(99.11% 0 0)",
    default: "oklch(92.00% 0.0056 145.10)",
    defaultForeground: "oklch(25.00% 0.0093 145.10)",
    fieldBackground: "oklch(97.00% 0.0028 145.10)",
    fieldBorder: "oklch(88.00% 0.0093 145.10)",
    fieldForeground: "oklch(25.00% 0.0093 145.10)",
    // CORRECTED, and held equal to `muted` the way the source does. Placeholder
    // text is text; 4.5:1 binds.
    fieldPlaceholder: "oklch(50.50% 0.0140 145.10)",
    // The focus ring is a control boundary (WCAG 2.4.11): 3:1. The accent
    // clears it at 3.74:1 on the darkest light ground, so it is the accent.
    focus: "oklch(54.00% 0.1594 145.10)",
    foreground: "oklch(25.00% 0.0093 145.10)",
    // CORRECTED. `--muted` IS the muted TEXT role in HeroUI's vocabulary, and
    // every `text-muted-foreground` site aliases onto it. The source's L 58.00
    // measures 3.34:1 on `default` and 3.52:1 on `surfaceTertiary`; L 50.50
    // measures 4.59:1 on `default`, the harder of the two.
    muted: "oklch(50.50% 0.0140 145.10)",
    overlay: "oklch(97.50% 0.0037 145.10)",
    overlayForeground: "oklch(25.00% 0.0093 145.10)",
    scrollbar: "oklch(82.00% 0.0093 145.10)",
    segment: "#FFFFFF",
    segmentForeground: "oklch(25.00% 0.0093 145.10)",
    separator: "oklch(92.00% 0.0047 145.10)",
    success: "oklch(73.29% 0.1935 150.81)",
    successForeground: "oklch(25.00% 0.0093 145.10)",
    surface: "oklch(97.50% 0.0037 145.10)",
    surfaceForeground: "oklch(25.00% 0.0093 145.10)",
    surfaceSecondary: "oklch(95.00% 0.0056 145.10)",
    surfaceSecondaryForeground: "oklch(25.00% 0.0093 145.10)",
    surfaceTertiary: "oklch(93.50% 0.0075 145.10)",
    surfaceTertiaryForeground: "oklch(25.00% 0.0093 145.10)",
    warning: "oklch(78.19% 0.1585 72.33)",
    warningForeground: "oklch(25.00% 0.0093 145.10)",
    // --- authored here, not by the design system (see file header) ---
    // L 49.00 measures 4.59:1 on `default`, the darkest light ground.
    accentText: "oklch(49.00% 0.1594 145.10)",
    // The fill's own L 58.50 measures 3.71:1 as text; L 52.50 measures
    // 4.52:1 on `default`, the darkest light ground.
    dangerText: "oklch(52.50% 0.2328 25.74)",
    // CORRECTED. ADR-025's L 52.50 measures 4.50:1 on the new, darker
    // `default`, with no margin. L 51.50 measures 4.7:1.
    info: "oklch(51.50% 0.1600 285.00)",
    foregroundHover: "oklch(34.00% 0.0093 145.10)",
    // L 59.50 measures 3.14:1 on `default`, the darkest light ground.
    fieldOutline: "oklch(59.50% 0.0199 145.10)",
    // --- the chart roles (see the note below the dark set) ---
    chart1: "oklch(42.00% 0.1400 145.10)",
    chart2: "oklch(50.00% 0.1600 145.10)",
    chart3: "oklch(55.00% 0.1800 145.10)",
    chart4: "oklch(65.00% 0.1400 145.10)",
    chart5: "oklch(75.00% 0.1000 145.10)",
    chartTrack: "oklch(93.00% 0.0250 145.10)",
    chartMuted: "oklch(80.00% 0.0150 145.10)",
};
/**
 * The chart roles.
 *
 *  - `chart1`…`chart5` — the design system's five-step ramp on the theme hue,
 *                   darkest first, which HeroUI Pro's charts read as
 *                   `--chart-1`…`--chart-5`. `chart1` is the series colour of
 *                   every one-series chart on the platform, and it must clear
 *                   3:1 on every surface it is drawn on: light L 0.42 measures
 *                   6.26:1; dark is CORRECTED below. Slots two to five are ONE
 *                   hue at five lightnesses, which reads as an ordered scale,
 *                   not as five categories. A chart whose series are unordered
 *                   categories is not served by them; run the palette validator
 *                   when the first one exists, as ADR-025 asked.
 *  - `chartTrack` — the unfilled part of a bar or meter: a lighter step of the
 *                   SAME hue, so the whole length reads as one scale. It is
 *                   decorative; the value is always text.
 *  - `chartMuted` — de-emphasis. A bar a filter has set aside keeps its length
 *                   and loses its colour; its label keeps full contrast.
 *
 * Status colours are NOT chart colours. A bar that means good or bad wears
 * `success`/`warning`/`danger` with an icon and a word; a bar that means "how
 * much" wears `chart1`.
 */
/** HeroUI roles, dark theme. Same key set as `herouiLight` by construction. */
exports.herouiDark = {
    // CORRECTED, as light. The accent is one value in both themes.
    accent: "oklch(54.00% 0.1594 145.10)",
    accentForeground: "oklch(99.11% 0 0)",
    background: "oklch(16.00% 0.0093 145.10)",
    backdrop: "oklch(0% 0 0 / 0.5)",
    border: "oklch(30.00% 0.0093 145.10)",
    // CORRECTED. The `mouve` dark red at L 59.40 carries `snow` at 4.35:1.
    // L 58.00 carries it at 4.6:1.
    danger: "oklch(58.00% 0.1967 24.63)",
    dangerForeground: "oklch(99.11% 0 0)",
    default: "oklch(26.00% 0.0093 145.10)",
    defaultForeground: "oklch(99.11% 0 0)",
    fieldBackground: "oklch(22.00% 0.0084 145.10)",
    fieldBorder: "oklch(32.00% 0.0117 145.10)",
    fieldForeground: "oklch(99.11% 0 0)",
    fieldPlaceholder: "oklch(65.00% 0.0093 145.10)",
    // 3.15:1 on the lightest dark surface, so the accent clears 3:1 here too.
    focus: "oklch(54.00% 0.1594 145.10)",
    foreground: "oklch(99.11% 0 0)",
    // 4.66:1 on the lightest dark surface, as the source wrote it.
    muted: "oklch(65.00% 0.0093 145.10)",
    overlay: "oklch(20.00% 0.0093 145.10)",
    overlayForeground: "oklch(99.11% 0 0)",
    scrollbar: "oklch(35.00% 0.0093 145.10)",
    segment: "oklch(28.00% 0.0117 145.10)",
    segmentForeground: "oklch(99.11% 0 0)",
    separator: "oklch(28.00% 0.0084 145.10)",
    success: "oklch(73.29% 0.1935 150.81)",
    successForeground: "oklch(20.00% 0.0093 145.10)",
    surface: "oklch(20.00% 0.0093 145.10)",
    surfaceForeground: "oklch(99.11% 0 0)",
    surfaceSecondary: "oklch(24.00% 0.0093 145.10)",
    surfaceSecondaryForeground: "oklch(99.11% 0 0)",
    surfaceTertiary: "oklch(27.00% 0.0093 145.10)",
    surfaceTertiaryForeground: "oklch(99.11% 0 0)",
    warning: "oklch(82.03% 0.1388 76.34)",
    warningForeground: "oklch(20.00% 0.0093 145.10)",
    // --- authored here, not by the design system (see file header) ---
    // L 63.50 measures 4.66:1 on the lightest dark surface.
    accentText: "oklch(63.50% 0.1594 145.10)",
    // L 67.50 measures 4.64:1 on the lightest dark surface.
    dangerText: "oklch(67.50% 0.1967 24.63)",
    info: "oklch(67.00% 0.1600 285.00)",
    foregroundHover: "oklch(88.00% 0.0093 145.10)",
    // L 55.00 measures 3.12:1 on the lightest dark surface.
    fieldOutline: "oklch(55.00% 0.0199 145.10)",
    // CORRECTED. The source's dark `chart-1` at L 50.00 measures 2.61:1 on the
    // lightest dark surface. L 54.00 measures 3.1:1.
    chart1: "oklch(54.00% 0.1200 145.10)",
    chart2: "oklch(60.00% 0.1400 145.10)",
    chart3: "oklch(70.00% 0.1600 145.10)",
    chart4: "oklch(78.00% 0.1200 145.10)",
    chart5: "oklch(85.00% 0.0800 145.10)",
    chartTrack: "oklch(32.00% 0.0300 145.10)",
    chartMuted: "oklch(46.00% 0.0150 145.10)",
};
/**
 * Elevation, per theme: the design system's three HeroUI shadows and the three
 * the `mouve` component layer reads (`@injishi/ui/pro.css` imports that layer).
 *
 * These are NOT colour roles, so they sit outside `herouiLight`/`herouiDark`:
 * a role there becomes a `--color-*` utility, and `bg-surface-shadow` is not a
 * thing anyone should be able to write. The `mouve` theme declares them only
 * under its own `.mouve-light`/`.mouve-dark` classes, which no app sets, so
 * without this map its raised buttons and pressed pills read undefined
 * variables and draw nothing.
 */
exports.herouiElevation = {
    light: {
        surfaceShadow: "0 0 5px 0 rgba(0, 0, 0, 0.02), 0 2px 10px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.2)",
        overlayShadow: "0 24px 40px -12px rgb(0 0 0 / 0.08), 0 16px 28px -8px rgb(0 0 0 / 0.04), 0 4px 6px -2px rgb(0 0 0 / 0.04), 0 0 2px 0 rgb(0 0 0 / 0.04), 0 0 0 1px rgb(0 0 0 / 0.04)",
        fieldShadow: "inset 0 0 2px 0 rgba(0, 0, 0, 0.04), inset 0 0 4px 0 rgba(0, 0, 0, 0.03), inset 0 0 2px 0 rgba(0, 0, 0, 0.03)",
        mouveRaisedShadow: "0 1px 2px -0.5px rgba(255, 255, 255, 0.12) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.16) inset, 0 8px 24px -4px rgba(255, 255, 255, 0.16) inset, 0 8px 8px -3px rgba(0, 0, 0, 0.03), 0 5px 5px -2.5px rgba(0, 0, 0, 0.03), 0 3px 3px -1.5px rgba(0, 0, 0, 0.03), 0 2px 2px -1px rgba(0, 0, 0, 0.03), 0 1px 1px -0.5px rgba(0, 0, 0, 0.03), 0 0.5px 0.5px rgba(0, 0, 0, 0.03)",
        mouveAccentFillShadow: "0 1px 2px -0.5px rgba(255, 255, 255, 0.12) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.16) inset, 0 8px 24px -4px rgba(255, 255, 255, 0.16) inset",
        mouvePressedShadow: "inset 0 1px 2px 0 rgba(0, 0, 0, 0.08), inset 0 0 4px 0 rgba(0, 0, 0, 0.06), inset 0 1px 1px 0 rgba(0, 0, 0, 0.05)",
    },
    dark: {
        surfaceShadow: "inset 0 1px 0 0 #ffffff0a, inset 0 0 0 1px #ffffff0a, 0 0 0 1px #00000029, 0 1px 1px -0.5px #0000002e, 0 3px 3px -1.5px #0000002e, 0 6px 6px -3px #0000002e, 0 12px 12px -6px #0000002e",
        overlayShadow: "0 1px 3px rgba(255, 255, 255, 0.04) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.04) inset, 0 16px 56px rgba(0, 0, 0, 0.24), 0 4px 16px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(0, 0, 0, 0.1)",
        fieldShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.02), inset 0 -0.5px 1px 0 rgba(255, 255, 255, 0.06), inset 1px 1.5px 4px 0 rgba(0, 0, 0, 0.06), inset 1px 1.5px 4px 0 rgba(0, 0, 0, 0.08)",
        mouveRaisedShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.2), inset 0 1px 2px -0.5px rgba(255, 255, 255, 0.14), inset 0 8px 24px -4px rgba(255, 255, 255, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.4), 0 1px 1px -0.5px #0000004d, 0 3px 3px -1.5px #0000004d, 0 6px 6px -3px #0000004d, 0 12px 12px -6px #0000004d",
        mouveAccentFillShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.2), inset 0 1px 2px -0.5px rgba(255, 255, 255, 0.14), inset 0 8px 24px -4px rgba(255, 255, 255, 0.1)",
        mouvePressedShadow: "inset 0 1px 2px 0 rgba(255, 255, 255, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)",
    },
};
/**
 * Mixes HeroUI derives, re-stated where the design system saves its own, and
 * where a saved value pushes the text drawn on it under the floor.
 *
 * `@heroui/styles` derives each `*-soft` tint from its base role with
 * `color-mix`: `--accent-soft` is the accent at 15% in light and at 12% in
 * dark. The design system saves `--accent-soft` at 15% in BOTH themes (its
 * variable overrides, re-read 2026-10-07), so the dark tint is one step
 * stronger than HeroUI's. Light restates HeroUI's default on purpose: the
 * design system is the source, and a HeroUI release that moves its default
 * must not move Injishi's.
 *
 * The mix names `var(--accent)`, never the saved literal. The saved accent is
 * L 54.91, which this file corrects to L 54.00, and a tint of the uncorrected
 * value would be a second accent.
 *
 * Not colour roles, for the reason `herouiElevation` is not: a role in
 * `herouiLight` becomes a `--color-*` utility, and HeroUI's shared theme
 * already maps `--color-accent-soft` onto `--accent-soft`, so declaring it
 * here as well would give one utility two definitions.
 *
 * Measured with the text HeroUI draws on the tint, `accent-soft-foreground`,
 * over every ground a chip sits on. Light keeps HeroUI's derivation (accent
 * 70%, foreground 30%): 4.62:1 at worst, on `default`. Dark is CORRECTED
 * below.
 */
exports.herouiMixes = {
    light: {
        accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)",
        // CORRECTED, both themes, by the owner's call of 2026-10-07. HeroUI's
        // hover (and the design system's saved `--accent-hover`) mixes 10% of
        // the LABEL into the fill. The label here is snow, so hover lightens
        // the fill under it: 3.86:1 on the accent and 3.83:1 on danger, against
        // 4.63:1 and 4.59:1 at rest. Mixed toward `ink` instead, the same 10%,
        // they measure 5.22:1 and 5.25:1. The fill colours are untouched.
        accentHover: "color-mix(in oklab, var(--accent) 90%, var(--ink) 10%)",
        dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)",
    },
    dark: {
        accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)",
        // CORRECTED, as light: 3.86:1 and 3.84:1 toward snow, 5.22:1 and
        // 5.25:1 toward ink.
        accentHover: "color-mix(in oklab, var(--accent) 90%, var(--ink) 10%)",
        dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)",
        // CORRECTED. The saved 15% tint under HeroUI's dark derivation (accent
        // 80%, foreground 30%) measures 4.42:1 on `surfaceTertiary`, where
        // HeroUI's own 12% measured 4.58:1. The tint is what the design system
        // saved, so the text moves instead, lighter only: foreground 34%
        // measures 4.61:1 resting and 4.56:1 on the 16% hover tint (4.37:1
        // before).
        accentSoftForeground: "color-mix(in oklab, var(--accent) 80%, var(--foreground) 34%)",
    },
};
exports.herouiAliases = {
    card: "surface",
    cardForeground: "surfaceForeground",
    popover: "overlay",
    popoverForeground: "overlayForeground",
    primary: "foreground",
    primaryHover: "foregroundHover",
    primaryForeground: "background",
    secondary: "surfaceSecondary",
    secondaryForeground: "surfaceSecondaryForeground",
    mutedForeground: "muted",
    destructive: "danger",
    destructiveForeground: "dangerForeground",
    input: "fieldOutline",
    field: "fieldBackground",
    ring: "focus",
    accentBrand: "accent",
    accentBrandHover: "accentHover",
    accentBrandForeground: "accentForeground",
    // HeroUI's scrollbar system reads --scrollbar-thumb, not --scrollbar, and
    // ships its own default (color-mix of --foreground at 15%). Aliasing the two
    // is what makes `scrollbar` and `scrollbar-thin` paint the Injishi colour
    // instead of a grey derived from the text role. Without this line the
    // `scrollbar` role below is defined and read by nothing.
    scrollbarThumb: "scrollbar",
};
/** Non-colour theme values the design system sets: radius 0.5rem, field radius 0.75rem. */
exports.herouiRadius = "0.5rem";
exports.herouiFieldRadius = "0.75rem";
/**
 * The base spacing unit every Tailwind spacing, width and height utility
 * multiplies (`p-4` is `calc(var(--spacing) * 4)`). The design system sets
 * 0.265625rem, 4.25px, in place of Tailwind's 0.25rem. It moves every padding,
 * gap and sized box in every app by the same 6.25%, so it is one value here
 * and nowhere else. ADR-027's named rhythms are literal lengths and do not
 * follow it.
 */
exports.herouiSpacing = "0.265625rem";
/**
 * The twin of `semantic.ts`'s `fixedGrounds`, for this vocabulary: which fixed
 * roles may be a GROUND, split by the lightness they hold (ADR-028).
 *
 * The two lists are identical today because both vocabularies name the same
 * eight fixed roles. They are still declared twice rather than shared, because
 * the two palettes are free to diverge — a role added to one is not thereby a
 * role in the other — and a pin built from the wrong vocabulary's list would
 * emit a selector for a utility that does not exist in the sheet it lands in.
 */
exports.herouiFixedGrounds = {
    light: ["canvas", "white", "surfaceTint"],
    dark: ["ink", "black", "controlWash"],
};
