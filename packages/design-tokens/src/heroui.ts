/**
 * The HeroUI 3 semantic layer — the Injishi teal theme.
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
 * at saved `updatedAt` 1792979018879 on 2026-10-26; read before at
 * 1791346544685 on 2026-10-07, and first read at 1791209095850): the `mouve`
 * Pro theme at base tone neutral, hue 177.90, radius 0.5rem, field radius
 * 0.25rem, a 0.85px field border, a 3.75px spacing unit, Figtree for body and
 * Instrument Sans for headings. They are transcribed verbatim EXCEPT where a
 * transcribed value fails WCAG,
 * and every one of those is marked CORRECTED at its declaration with the
 * measurement that moved it. The rule is ADR-025's, unchanged: keep the
 * source's hue and chroma, move only lightness, and only as far as the floor
 * requires. So a re-export from the HeroUI editor is a DIFF to read against
 * this file, never a paste over it.
 *
 * Every ratio below is the WORSE of two paintings of the authored value: the
 * CSS Color 4 gamut map (lightness and hue held, chroma reduced) and a plain
 * per-channel clip. They differ only out of sRGB, which teal at the saved
 * chroma 0.18 is; the export's own DESIGN.md resolves its hexes by clipping.
 *
 * This replaced the green of the 2026-10-07 save (hue 145.10), which replaced
 * ADR-025's teal (hue 208). The hue moved, so every neutral moved with it: the
 * greys are the theme hue at low chroma, and this save carries about twice the
 * neutral chroma the last one did (0.0208 on the ink, 0.0093 before).
 *
 * The accent is the export CSS's `oklch(55% 0.18 177.90)`, the `mouve` accent
 * at the saved hue. The save's manifest also stores an `accentHex` of
 * `#008160`, which neither generated output renders; the generated CSS wins.
 *
 * Where the design system's two outputs disagree, its generated CSS wins over
 * its DESIGN.md. DESIGN.md resolves the light `surface`, `overlay` and
 * `field-background` to pure white; the CSS the HeroUI preview renders sets
 * them to the values below. Where the CSS is SILENT, DESIGN.md fills the gap:
 * the export never sets `--eclipse`, so the `mouve` theme's own (hue 300)
 * would stand, while DESIGN.md resolves it at the saved hue.
 *
 * FIVE roles are authored here that the design system does not produce,
 * because HeroUI has no role for them and Injishi does:
 *
 *  - `accentText`  — teal as TEXT on a light canvas. `--accent` is a FILL; as
 *                    text on `default` (L 0.92), the darkest light ground text
 *                    sits on, it measures 3.69:1, under 4.5:1, so a separate
 *                    darker step is required. Same hue, so it reads as one
 *                    colour. In dark the accent itself clears the floor.
 *  - `info`        — the fifth status hue, violet 285. It moved there under
 *                    ADR-025 because blue was then the accent. It stays: teal
 *                    177.90 sits between success 150.81 and the blues, so the
 *                    status set has no hue to spare, and 285 still clears
 *                    every one.
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

import type { RoleMap } from "./semantic";
import type { TypeStep } from "./layout";


/** Roles holding ONE value in both themes (the ADR-010 call 2 rule, kept). */
export const herouiFixed = {
    // A brand chip must not invert. `ink` is the design system's `eclipse`, the
    // near-black on the theme's own hue, so a chip cannot clash with the surface
    // it lands on.
    ink: "oklch(25.00% 0.0208 177.90)",
    white: "#FFFFFF",
    // Pure black never ships (ramps.ts). The `mouve` theme sets it to
    // `oklch(0% 0 0)`; this keeps the ADR-010 rule instead.
    black: "var(--ink)",
    // HeroUI's two named neutrals. The design system mixes `--accent-hover`
    // toward `--snow`, and the `mouve` component layer reads both. `eclipse`
    // is DESIGN.md's: the export CSS leaves it to `mouve`, at hue 300.
    snow: "oklch(99.11% 0 0)",
    eclipse: "oklch(25.00% 0.0208 177.90)",
    slateLine: "oklch(50.00% 0.0312 177.90)",
    surfaceTint: "oklch(95.00% 0.0125 177.90)",
    canvas: "oklch(95.50% 0.0125 177.90)",
    controlWash: "oklch(50.00% 0.0312 177.90)",
    placeholderDim: "oklch(50.00% 0.0312 177.90)",
} as const satisfies RoleMap;

/** HeroUI roles, light theme. */
export const herouiLight = {
    // CORRECTED. The saved L 55.00 carries `snow` at 3.92:1. L 51.00 carries
    // it at 4.56:1. Out of sRGB at C 0.18, it paints as about `#007B66` mapped
    // and `#008466` clipped.
    accent: "oklch(51.00% 0.1800 177.90)",
    accentForeground: "oklch(99.11% 0 0)",
    background: "oklch(95.50% 0.0125 177.90)",
    backdrop: "oklch(50.00% 0.0416 177.90 / 0.4)",
    border: "oklch(88.00% 0.0156 177.90)",
    // CORRECTED. The `mouve` red at L 65.32 carries `snow` at 3.48:1, the same
    // failure ADR-025 #2 fixed. L 58.50 carries it at 4.59:1.
    danger: "oklch(58.50% 0.2328 25.74)",
    dangerForeground: "oklch(99.11% 0 0)",
    default: "oklch(92.00% 0.0125 177.90)",
    defaultForeground: "oklch(25.00% 0.0208 177.90)",
    fieldBackground: "oklch(97.00% 0.0062 177.90)",
    fieldBorder: "oklch(88.00% 0.0208 177.90)",
    fieldForeground: "oklch(25.00% 0.0208 177.90)",
    // CORRECTED, and held equal to `muted` the way the source does. Placeholder
    // text is text; 4.5:1 binds.
    fieldPlaceholder: "oklch(50.00% 0.0312 177.90)",
    // The focus ring is a control boundary (WCAG 2.4.11): 3:1. The accent
    // clears it at 3.69:1 on the darkest light ground, so it is the accent.
    focus: "oklch(51.00% 0.1800 177.90)",
    foreground: "oklch(25.00% 0.0208 177.90)",
    // CORRECTED. `--muted` IS the muted TEXT role in HeroUI's vocabulary, and
    // every `text-muted-foreground` site aliases onto it. The saved L 58.00
    // measures 3.32:1 on `default`, the darkest light ground; L 50.00 measures
    // 4.69:1 there.
    muted: "oklch(50.00% 0.0312 177.90)",
    overlay: "oklch(97.50% 0.0083 177.90)",
    overlayForeground: "oklch(25.00% 0.0208 177.90)",
    scrollbar: "oklch(82.00% 0.0208 177.90)",
    segment: "#FFFFFF",
    segmentForeground: "oklch(25.00% 0.0208 177.90)",
    separator: "oklch(92.00% 0.0104 177.90)",
    success: "oklch(73.29% 0.1935 150.81)",
    successForeground: "oklch(25.00% 0.0208 177.90)",
    surface: "oklch(97.50% 0.0083 177.90)",
    surfaceForeground: "oklch(25.00% 0.0208 177.90)",
    surfaceSecondary: "oklch(95.00% 0.0125 177.90)",
    surfaceSecondaryForeground: "oklch(25.00% 0.0208 177.90)",
    surfaceTertiary: "oklch(93.50% 0.0166 177.90)",
    surfaceTertiaryForeground: "oklch(25.00% 0.0208 177.90)",
    warning: "oklch(78.19% 0.1585 72.33)",
    warningForeground: "oklch(25.00% 0.0208 177.90)",

    // --- authored here, not by the design system (see file header) ---
    // L 46.00 measures 4.56:1 on `default`, the darkest light ground.
    accentText: "oklch(46.00% 0.1800 177.90)",
    // The fill's own L 58.50 measures 3.7:1 as text; L 52.00 measures
    // 4.57:1 on `default`, the darkest light ground.
    dangerText: "oklch(52.00% 0.2328 25.74)",
    // L 52.00 measures 4.59:1 on `default`.
    info: "oklch(52.00% 0.1600 285.00)",
    foregroundHover: "oklch(34.00% 0.0208 177.90)",
    // L 60.00 measures 3.06:1 on `default`, the darkest light ground. Its
    // chroma keeps the ratio to the neutrals it had at 0.0199 under the last
    // save, now that the save's own neutral chroma has more than doubled.
    fieldOutline: "oklch(60.00% 0.0445 177.90)",

    // --- the chart roles (see the note below the dark set) ---
    chart1: "oklch(42.00% 0.1400 177.90)",
    chart2: "oklch(50.00% 0.1600 177.90)",
    chart3: "oklch(55.00% 0.1800 177.90)",
    chart4: "oklch(65.00% 0.1400 177.90)",
    chart5: "oklch(75.00% 0.1000 177.90)",
    chartTrack: "oklch(93.00% 0.0250 177.90)",
    chartMuted: "oklch(80.00% 0.0150 177.90)",
} as const satisfies RoleMap;

/**
 * The chart roles.
 *
 *  - `chart1`…`chart5` — the design system's five-step ramp on the theme hue,
 *                   darkest first, which HeroUI Pro's charts read as
 *                   `--chart-1`…`--chart-5`. `chart1` is the series colour of
 *                   every one-series chart on the platform, and it must clear
 *                   3:1 on every surface it is drawn on: light L 0.42 measures
 *                   5.74:1; dark is CORRECTED below. Slots two to five are ONE
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
export const herouiDark = {
    // Not corrected. Since the 2026-10-26 save the dark accent is its own
    // value, a lighter teal carrying a DARK label (L 15.00), at 8.11:1.
    accent: "oklch(70.00% 0.1600 177.90)",
    accentForeground: "oklch(15.00% 0.0208 177.90)",
    background: "oklch(16.00% 0.0208 177.90)",
    backdrop: "oklch(0% 0 0 / 0.5)",
    border: "oklch(30.00% 0.0208 177.90)",
    // CORRECTED. The `mouve` dark red at L 59.40 carries `snow` at 4.35:1.
    // L 58.00 carries it at 4.6:1.
    danger: "oklch(58.00% 0.1967 24.63)",
    dangerForeground: "oklch(99.11% 0 0)",
    default: "oklch(26.00% 0.0208 177.90)",
    defaultForeground: "oklch(99.11% 0 0)",
    fieldBackground: "oklch(22.00% 0.0187 177.90)",
    fieldBorder: "oklch(32.00% 0.0260 177.90)",
    fieldForeground: "oklch(99.11% 0 0)",
    fieldPlaceholder: "oklch(65.00% 0.0208 177.90)",
    // 6.18:1 on the lightest dark surface, so the accent clears 3:1 here too.
    focus: "oklch(70.00% 0.1600 177.90)",
    foreground: "oklch(99.11% 0 0)",
    // 4.68:1 on the lightest dark surface, as the source wrote it.
    muted: "oklch(65.00% 0.0208 177.90)",
    overlay: "oklch(20.00% 0.0208 177.90)",
    overlayForeground: "oklch(99.11% 0 0)",
    scrollbar: "oklch(35.00% 0.0208 177.90)",
    segment: "oklch(28.00% 0.0260 177.90)",
    segmentForeground: "oklch(99.11% 0 0)",
    separator: "oklch(28.00% 0.0187 177.90)",
    success: "oklch(73.29% 0.1935 150.81)",
    successForeground: "oklch(20.00% 0.0208 177.90)",
    surface: "oklch(20.00% 0.0208 177.90)",
    surfaceForeground: "oklch(99.11% 0 0)",
    surfaceSecondary: "oklch(24.00% 0.0208 177.90)",
    surfaceSecondaryForeground: "oklch(99.11% 0 0)",
    surfaceTertiary: "oklch(27.00% 0.0208 177.90)",
    surfaceTertiaryForeground: "oklch(99.11% 0 0)",
    warning: "oklch(82.03% 0.1388 76.34)",
    warningForeground: "oklch(20.00% 0.0208 177.90)",

    // --- authored here, not by the design system (see file header) ---
    // The accent itself: 6.18:1 on the lightest dark surface, so no separate
    // text step is needed in this theme.
    accentText: "oklch(70.00% 0.1600 177.90)",
    // L 67.00 measures 4.56:1 on the lightest dark surface.
    dangerText: "oklch(67.00% 0.1967 24.63)",
    // L 66.00 measures 4.6:1 on the lightest dark surface.
    info: "oklch(66.00% 0.1600 285.00)",
    foregroundHover: "oklch(88.00% 0.0208 177.90)",
    // L 54.50 measures 3.09:1 on the lightest dark surface.
    fieldOutline: "oklch(54.50% 0.0445 177.90)",

    // CORRECTED. The source's dark `chart-1` at L 50.00 measures 2.72:1 on the
    // lightest dark surface. L 53.00 measures 3.1:1.
    chart1: "oklch(53.00% 0.1200 177.90)",
    chart2: "oklch(60.00% 0.1400 177.90)",
    chart3: "oklch(70.00% 0.1600 177.90)",
    chart4: "oklch(78.00% 0.1200 177.90)",
    chart5: "oklch(85.00% 0.0800 177.90)",
    chartTrack: "oklch(32.00% 0.0300 177.90)",
    chartMuted: "oklch(46.00% 0.0150 177.90)",
} as const satisfies RoleMap;

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
export const herouiElevation = {
    light: {
        surfaceShadow:
            "0 0 5px 0 rgba(0, 0, 0, 0.02), 0 2px 10px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.2)",
        overlayShadow:
            "0 24px 40px -12px rgb(0 0 0 / 0.08), 0 16px 28px -8px rgb(0 0 0 / 0.04), 0 4px 6px -2px rgb(0 0 0 / 0.04), 0 0 2px 0 rgb(0 0 0 / 0.04), 0 0 0 1px rgb(0 0 0 / 0.04)",
        fieldShadow:
            "inset 0 0 2px 0 rgba(0, 0, 0, 0.04), inset 0 0 4px 0 rgba(0, 0, 0, 0.03), inset 0 0 2px 0 rgba(0, 0, 0, 0.03)",
        mouveRaisedShadow:
            "0 1px 2px -0.5px rgba(255, 255, 255, 0.12) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.16) inset, 0 8px 24px -4px rgba(255, 255, 255, 0.16) inset, 0 8px 8px -3px rgba(0, 0, 0, 0.03), 0 5px 5px -2.5px rgba(0, 0, 0, 0.03), 0 3px 3px -1.5px rgba(0, 0, 0, 0.03), 0 2px 2px -1px rgba(0, 0, 0, 0.03), 0 1px 1px -0.5px rgba(0, 0, 0, 0.03), 0 0.5px 0.5px rgba(0, 0, 0, 0.03)",
        mouveAccentFillShadow:
            "0 1px 2px -0.5px rgba(255, 255, 255, 0.12) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.16) inset, 0 8px 24px -4px rgba(255, 255, 255, 0.16) inset",
        mouvePressedShadow:
            "inset 0 1px 2px 0 rgba(0, 0, 0, 0.08), inset 0 0 4px 0 rgba(0, 0, 0, 0.06), inset 0 1px 1px 0 rgba(0, 0, 0, 0.05)",
    },
    dark: {
        surfaceShadow:
            "inset 0 1px 0 0 #ffffff0a, inset 0 0 0 1px #ffffff0a, 0 0 0 1px #00000029, 0 1px 1px -0.5px #0000002e, 0 3px 3px -1.5px #0000002e, 0 6px 6px -3px #0000002e, 0 12px 12px -6px #0000002e",
        overlayShadow:
            "0 1px 3px rgba(255, 255, 255, 0.04) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.04) inset, 0 16px 56px rgba(0, 0, 0, 0.24), 0 4px 16px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(0, 0, 0, 0.1)",
        fieldShadow:
            "inset 0 1px 1px 0 rgba(255, 255, 255, 0.02), inset 0 -0.5px 1px 0 rgba(255, 255, 255, 0.06), inset 1px 1.5px 4px 0 rgba(0, 0, 0, 0.06), inset 1px 1.5px 4px 0 rgba(0, 0, 0, 0.08)",
        mouveRaisedShadow:
            "inset 0 1px 0 0 rgba(255, 255, 255, 0.2), inset 0 1px 2px -0.5px rgba(255, 255, 255, 0.14), inset 0 8px 24px -4px rgba(255, 255, 255, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.4), 0 1px 1px -0.5px #0000004d, 0 3px 3px -1.5px #0000004d, 0 6px 6px -3px #0000004d, 0 12px 12px -6px #0000004d",
        mouveAccentFillShadow:
            "inset 0 1px 0 0 rgba(255, 255, 255, 0.2), inset 0 1px 2px -0.5px rgba(255, 255, 255, 0.14), inset 0 8px 24px -4px rgba(255, 255, 255, 0.1)",
        mouvePressedShadow:
            "inset 0 1px 2px 0 rgba(255, 255, 255, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)",
    },
} as const satisfies Readonly<Record<"light" | "dark", RoleMap>>;

/**
 * Mixes HeroUI derives, re-stated where the token sheet's cascade needs them
 * stated, and where a derived value pushes the text drawn on it under the
 * floor.
 *
 * `@heroui/styles` derives each `*-soft` tint from its base role with
 * `color-mix`: `--accent-soft` is the accent at 15% in light and at 12% in
 * dark. The 2026-10-26 save no longer overrides either (the 2026-10-07 save
 * held dark at 15%), so both are HeroUI's own, restated on purpose: the design
 * system is the source, and a HeroUI release that moves its default must not
 * move Injishi's.
 *
 * THE CASCADE IS WHY DARK RESTATES WHAT LIGHT OVERRIDES. The light block below
 * is emitted on `:root` and is unlayered; HeroUI's dark derivations sit in a
 * layer. So any mix the light block declares and the dark block does not
 * leaks into dark, over HeroUI's own dark value. Every key in `light` must
 * therefore have a `dark` twin.
 *
 * The mix names `var(--accent)`, never a literal, so a tint follows the
 * corrected accent rather than the saved L 55.00, and is not a second accent.
 *
 * Not colour roles, for the reason `herouiElevation` is not: a role in
 * `herouiLight` becomes a `--color-*` utility, and HeroUI's shared theme
 * already maps `--color-accent-soft` onto `--accent-soft`, so declaring it
 * here as well would give one utility two definitions.
 *
 * Measured with the text HeroUI draws on the tint, `accent-soft-foreground`,
 * over every ground a chip sits on, at HeroUI's own derivation (light accent
 * 70% + foreground 30%, dark accent 80% + foreground 30%): 4.59:1 at worst in
 * light, on `default`, and 6.33:1 in dark (5.85:1 on its 16% hover tint),
 * where the accent is now light. No override is needed in either theme, and
 * the dark one the last save needed is gone. The light 20% hover tint measures
 * 4.32:1, as it did before; ADR-068 lists it under "Measured, not fixed".
 *
 * `vibrantPalette` is saved ON and is NOT applied here: its soft text (the
 * base at 92%) measures 3.42:1 for the accent and 1.73:1 for warning in light.
 */
export const herouiMixes = {
    light: {
        accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)",
        // CORRECTED, by the owner's call of 2026-10-07. HeroUI's hover (and the
        // design system's saved `--accent-hover`) mixes 10% of the LABEL into
        // the fill. The label here is snow, so hover would lighten the fill
        // under it. Mixed toward `ink` instead, the same 10%, the label keeps
        // its floor: 5.18:1 on the accent and 5.22:1 on danger. The fill
        // colours are untouched.
        accentHover: "color-mix(in oklab, var(--accent) 90%, var(--ink) 10%)",
        dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)",
    },
    dark: {
        accentSoft: "color-mix(in oklab, var(--accent) 12%, transparent)",
        // HeroUI's own derivation, restated only so the light block's ink mix
        // cannot leak into dark (see above). The dark accent carries a DARK
        // label since the 2026-10-26 save, so D-j's reason for mixing toward
        // ink is absent here; toward its own label the hover keeps 6.52:1.
        accentHover: "color-mix(in oklab, var(--accent) 90%, var(--accent-foreground) 10%)",
        // CORRECTED, as light: the danger label is still snow. 5.23:1.
        dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)",
    },
} as const satisfies Readonly<Record<"light" | "dark", RoleMap>>;

export const herouiAliases = {
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
} as const satisfies Readonly<
  Record<string, keyof typeof herouiLight | keyof typeof herouiFixed | "accentHover">
>;

/** Non-colour theme values the design system sets: radius 0.5rem, field radius 0.25rem. */
export const herouiRadius = "0.5rem";
export const herouiFieldRadius = "0.25rem";

/**
 * The form-field border width. HeroUI ships `--field-border-width: 0px`, so a
 * field has no border of its own; the design system draws a hairline. HeroUI
 * reads the width under two names (`--field-border-width`, and the
 * `--border-width-field` its theme maps from it), and the export sets both,
 * so both are emitted from this one value.
 */
export const herouiFieldBorderWidth = "0.8488516842015111px";

/**
 * The base spacing unit every Tailwind spacing, width and height utility
 * multiplies (`p-4` is `calc(var(--spacing) * 4)`). The design system sets
 * 0.234375rem, 3.75px, in place of Tailwind's 0.25rem (it was 4.25px under the
 * last save). It moves every padding, gap and sized box in every app by the
 * same 6.25% under Tailwind's, so it is one value here and nowhere else.
 * ADR-027's named rhythms are literal lengths and do not follow it.
 */
export const herouiSpacing = "0.234375rem";

/**
 * Letter spacing. The design system's tracking base is -0.01em, and it shifts
 * Tailwind's whole tracking scale with it. Emitted as a plain `@theme` block,
 * so `tracking-tight` and the rest read these. Nothing applies
 * `tracking-normal` to body text by default; neither does the export.
 */
export const herouiTracking = {
    tighter: "-0.06em",
    tight: "-0.035em",
    normal: "-0.01em",
    wide: "0.015em",
    wider: "0.04em",
    widest: "0.09em",
} as const satisfies Readonly<Record<string, string>>;

/**
 * The design system's text scale: Tailwind's thirteen named steps at the
 * values its type scale (0.8) gives them. Each leading is the step's Tailwind
 * line box held in absolute terms (`text-sm` keeps 1.25rem). From `5xl` up the
 * export sets no leading, so Tailwind's own (1) stands.
 *
 * ADR-027's four authored steps (`layout.ts`) are separate names and do not
 * move. `xs` now equals `2xs` at 11px; the eyebrow keeps its own name.
 */
export const herouiTypeScale = {
    xs: { size: "0.6875rem", lineHeight: "calc(1 / 0.6875)" },
    sm: { size: "0.8125rem", lineHeight: "calc(1.25 / 0.8125)" },
    base: { size: "0.9375rem", lineHeight: "calc(1.5 / 0.9375)" },
    lg: { size: "1.0625rem", lineHeight: "calc(1.75 / 1.0625)" },
    xl: { size: "1.1875rem", lineHeight: "calc(1.75 / 1.1875)" },
    "2xl": { size: "1.375rem", lineHeight: "calc(2 / 1.375)" },
    "3xl": { size: "1.75rem", lineHeight: "calc(2.25 / 1.75)" },
    "4xl": { size: "2rem", lineHeight: "calc(2.5 / 2)" },
    "5xl": { size: "2.75rem" },
    "6xl": { size: "3.375rem" },
    "7xl": { size: "4rem" },
    "8xl": { size: "5.25rem" },
    "9xl": { size: "7rem" },
} as const satisfies Readonly<Record<string, Pick<TypeStep, "size"> & Partial<TypeStep>>>;

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
export const herouiFixedGrounds = {
  light: ["canvas", "white", "surfaceTint"],
  dark: ["ink", "black", "controlWash"],
} as const satisfies Readonly<Record<"light" | "dark", readonly (keyof typeof herouiFixed)[]>>;

export type HeroUIPalette = typeof herouiLight;
