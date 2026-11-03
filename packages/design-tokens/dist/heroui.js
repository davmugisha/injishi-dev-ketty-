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
 * Design System "Injishi.hs" (`989b3560-28bd-4ec7-8cba-f6e90c10991e`, read at
 * saved `updatedAt` 1793682439460 on 2026-11-03). It replaces the design
 * system "Injishi" (`de231dfa-8a53-40c9-ba3b-cd9d5a93685b`), read last at
 * 1793037720487 and before at 1792979018879, 1791346544685 and 1791209095850.
 * Each save's four exports sit verbatim in `saves/<updatedAt>/`. This one is
 * the `mouve` Pro theme at base tone neutral, every role on hue 150.84 (the
 * light background at 154.55), the accent `#17C964` carrying a pure black
 * label in both themes, a pure black dark canvas, radius and field radius
 * 0.5rem, a 1px field border, a 4.25px spacing unit, a 1.1 type scale and
 * Outfit for body and headings. Values are transcribed verbatim EXCEPT where a
 * transcribed value fails its floor in the contrast table (spec 0002 of the
 * mobile context; `scripts/contrast-table.mjs` measures it and the emitter
 * refuses to write past a breach), and every one of those is marked CORRECTED
 * at its declaration with the measurement that moved it. The rule is
 * ADR-025's, unchanged: keep the source's hue and chroma, move only lightness,
 * in 0.5% steps, and only as far as the floor requires. So a re-export from
 * the HeroUI editor is a DIFF to read against this file, never a paste over it.
 *
 * Every ratio below is the WORSE of two paintings of the authored value: the
 * CSS Color 4 gamut map (lightness and hue held, chroma reduced) and a plain
 * per-channel clip. They differ only out of sRGB, which the status reds and
 * greens are; the export's own DESIGN.md resolves its hexes by clipping.
 *
 * PURE BLACK SHIPS, for the roles this save names and no others (the owner's
 * call of 2026-11-03, lifting ADR-068 D-h for them): the dark `background` and
 * `surface`, and the labels on the accent and on the success and warning
 * fills, in both themes. The `black` primitive below stays `var(--ink)`, so a
 * `bg-black` or `text-black` utility still draws the near-black ink.
 *
 * The accent is one bright green in both themes, `#17C964`, the success
 * green, so accent and success are one colour and status never relies on
 * colour alone (spec 0002 D-ac). As TEXT it reads only on dark grounds; in
 * light, `accentText`, the focus ring and the soft label each take a darker
 * step of it.
 *
 * Where the design system's two outputs disagree, its generated CSS wins over
 * its DESIGN.md. DESIGN.md resolves the light `overlay` and
 * `field-background` to pure white; the CSS the HeroUI preview renders sets
 * them to the values below. Where the CSS is SILENT, DESIGN.md fills the gap
 * (ADR-068 D-n): `--eclipse` (the light ink, `#1F231F`), the light segment
 * and the status fills, which the export leaves to the `mouve` theme and
 * DESIGN.md resolves.
 *
 * EIGHT roles are authored here that the design system does not produce,
 * because HeroUI has no role for them and Injishi does. The four `*Text`
 * roles are a status colour as TEXT: each equals its fill when the fill clears
 * 4.5:1 as text on every ground, else it is a darker step of the same hue.
 *
 *  - `accentText`  — the accent as TEXT. In dark the accent itself clears the
 *                    floor, so it equals the fill; in light it is a darker
 *                    step of the same green.
 *  - `dangerText`  — red as TEXT. `--danger` is a FILL tuned so
 *                    `--danger-foreground` reads on it; nothing tuned it for
 *                    reading on a surface. It binds on the 12px field errors
 *                    in the checkout, which is every "Check that number" a
 *                    guest sees.
 *  - `successText`, `warningText` — green and amber as TEXT, for the phone's
 *                    status words (spec 0002 D-c). Both fills are light
 *                    colours made to carry a dark label, so in light each
 *                    needs its own darker step.
 *  - `info`        — the fifth status hue, violet 285. It moved there under
 *                    ADR-025 because blue was then the accent. It stays: the
 *                    accent sits between success and the blues, so the status
 *                    set has no hue to spare, and 285 still clears every one.
 *  - `foregroundHover` — the hover step under the solid neutral button, one
 *                    small move off `foreground`. Aliasing it to `muted` jumped
 *                    a near-black fill to mid-grey.
 *  - `fieldOutline` — the form-field BOUNDARY for `border-input`, at 3:1 on
 *                    every ground, `default` included. `--field-border` now
 *                    clears 3:1 on `background` and `surface` too (CORRECTED
 *                    below); the outline keeps the stricter guarantee.
 *  - `pressed`     — the press highlight on the phone (spec 0002 D-q): the
 *                    foreground at 8%, drawn over the element while a finger
 *                    is down. It is state feedback, not a boundary, so no
 *                    floor applies (the owner's call of 2026-10-28).
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
exports.herouiFixedGrounds = exports.herouiTypeScale = exports.herouiTracking = exports.herouiSpacing = exports.herouiFieldBorderWidth = exports.herouiFieldRadius = exports.herouiRadius = exports.herouiAliases = exports.herouiSoftLabels = exports.herouiMixes = exports.herouiElevation = exports.herouiDark = exports.herouiLight = exports.herouiFixed = void 0;
/** Roles holding ONE value in both themes (the ADR-010 call 2 rule, kept). */
exports.herouiFixed = {
    // A brand chip must not invert. `ink` is the design system's `eclipse`, the
    // near-black on the theme's own hue, so a chip cannot clash with the surface
    // it lands on.
    ink: "oklch(25.00% 0.0093 150.84)",
    white: "#FFFFFF",
    // The PRIMITIVE stays the ink (ramps.ts, ADR-010). The `mouve` theme sets
    // it to `oklch(0% 0 0)`. The roles the save paints pure black carry the
    // literal themselves (see the file header), so this one stays narrow.
    black: "var(--ink)",
    // HeroUI's two named neutrals; the `mouve` component layer reads both.
    // `eclipse` is DESIGN.md's `#1F231F`, the same in both themes: the export
    // CSS leaves it to `mouve`, at hue 300.
    snow: "oklch(99.11% 0 0)",
    eclipse: "oklch(25.00% 0.0093 150.84)",
    // The fixed twins of three light roles: `muted` (slate line, control wash,
    // dim placeholder), `surfaceSecondary` (tint) and `background` (canvas).
    slateLine: "oklch(51.00% 0.0140 150.84)",
    surfaceTint: "oklch(95.00% 0.0056 150.84)",
    canvas: "oklch(95.43% 0.0058 154.55)",
    controlWash: "oklch(51.00% 0.0140 150.84)",
    placeholderDim: "oklch(51.00% 0.0140 150.84)",
    // The fixed twin of the light `accentText`: the accent as ink on a plate
    // that never goes dark (`bg-white/95` over a photograph), where
    // `accent-text` would carry its dark twin onto white. Move it with
    // `herouiLight.accentText`.
    accentInk: "oklch(47.50% 0.1934 150.84)",
};
/** HeroUI roles, light theme. */
exports.herouiLight = {
    // Not corrected. The saved accent carries its pure black label at 9.57:1.
    accent: "oklch(73.29% 0.1934 150.84)",
    accentForeground: "oklch(0% 0 0)",
    background: "oklch(95.43% 0.0058 154.55)",
    backdrop: "oklch(50.00% 0.0187 150.84 / 0.4)",
    border: "oklch(88.00% 0.0070 150.84)",
    // CORRECTED. The export leaves the red to `mouve`, which DESIGN.md
    // resolves at L 65.32 (`#FF383C`); it carries `snow` at 3.48:1. L 59.00
    // carries it at 4.51:1, and the label stays white.
    danger: "oklch(59.00% 0.2328 25.74)",
    dangerForeground: "oklch(99.11% 0 0)",
    default: "oklch(92.00% 0.0056 150.84)",
    defaultForeground: "oklch(25.00% 0.0093 150.84)",
    fieldBackground: "oklch(97.00% 0.0028 150.84)",
    // CORRECTED. The field border is the boundary a person finds a field by,
    // so it is a control boundary (WCAG 1.4.11): 3:1 on `background` and
    // `surface`, the owner's call of 2026-10-28 under spec 0002. The saved
    // L 88.00 measures 1.25:1 on `background`; L 63.00 measures 3.06:1.
    fieldBorder: "oklch(63.00% 0.0093 150.84)",
    fieldForeground: "oklch(25.00% 0.0093 150.84)",
    // Held equal to `muted` the way the source does. Placeholder text is text;
    // 4.5:1 binds, and `muted` clears it.
    fieldPlaceholder: "oklch(51.00% 0.0140 150.84)",
    // CORRECTED. The focus ring is a control boundary (WCAG 2.4.11): 3:1 on
    // `background` and `surface`. The saved ring is the accent, which measures
    // 1.92:1 on `background`; L 60.50 measures 3.04:1 on white.
    focus: "oklch(60.50% 0.1934 150.84)",
    foreground: "oklch(25.00% 0.0093 150.84)",
    // CORRECTED. `--muted` IS the muted TEXT role in HeroUI's vocabulary, and
    // every `text-muted-foreground` site aliases onto it. The saved L 58.00
    // measures 3.36:1 on `default`, the darkest light ground; L 51.00 measures
    // 4.51:1 there.
    muted: "oklch(51.00% 0.0140 150.84)",
    overlay: "oklch(97.50% 0.0037 150.84)",
    overlayForeground: "oklch(25.00% 0.0093 150.84)",
    scrollbar: "oklch(82.00% 0.0093 150.84)",
    segment: "#FFFFFF",
    segmentForeground: "oklch(25.00% 0.0093 150.84)",
    separator: "oklch(92.00% 0.0047 150.84)",
    success: "oklch(73.29% 0.1935 150.81)",
    successForeground: "oklch(0% 0 0)",
    surface: "#FFFFFF",
    surfaceForeground: "oklch(25.00% 0.0093 150.84)",
    surfaceSecondary: "oklch(95.00% 0.0056 150.84)",
    surfaceSecondaryForeground: "oklch(25.00% 0.0093 150.84)",
    surfaceTertiary: "oklch(93.50% 0.0075 150.84)",
    surfaceTertiaryForeground: "oklch(25.00% 0.0093 150.84)",
    warning: "oklch(78.19% 0.1585 72.33)",
    warningForeground: "oklch(0% 0 0)",
    // --- authored here, not by the design system (see file header) ---
    // CORRECTED. The accent's L 73.29 measures 1.73:1 as text on `default`,
    // the darkest light ground; L 47.50 measures 4.56:1 there.
    accentText: "oklch(47.50% 0.1934 150.84)",
    // CORRECTED. The saved fill's L 65.32 measures 2.82:1 as text on
    // `default`; L 52.50 measures 4.53:1 there.
    dangerText: "oklch(52.50% 0.2328 25.74)",
    // CORRECTED. The fill's L 73.29 measures 1.73:1 as text on `default`;
    // L 47.50 measures 4.56:1 there.
    successText: "oklch(47.50% 0.1935 150.81)",
    // CORRECTED. The fill's L 78.19 measures 1.61:1 as text on `default`;
    // L 51.50 measures 4.56:1 there.
    warningText: "oklch(51.50% 0.1585 72.33)",
    // L 52.00 measures 4.61:1 on `default`.
    info: "oklch(52.00% 0.1600 285.00)",
    foregroundHover: "oklch(34.00% 0.0093 150.84)",
    // L 60.00 measures 3.09:1 on `default`, the darkest light ground. Its
    // chroma is the 0.0199 it had when the neutrals last sat at 0.0093.
    fieldOutline: "oklch(60.00% 0.0199 150.84)",
    pressed: "oklch(25.00% 0.0093 150.84 / 0.08)",
    // --- the chart roles (see the note below the dark set) ---
    chart1: "oklch(42.00% 0.1400 150.84)",
    chart2: "oklch(50.00% 0.1600 150.84)",
    chart3: "oklch(55.00% 0.1800 150.84)",
    chart4: "oklch(65.00% 0.1400 150.84)",
    chart5: "oklch(75.00% 0.1000 150.84)",
    chartTrack: "oklch(93.00% 0.0250 150.84)",
    chartMuted: "oklch(80.00% 0.0150 150.84)",
};
/**
 * The chart roles.
 *
 *  - `chart1`…`chart5` — the design system's five-step ramp on the theme hue,
 *                   darkest first, which HeroUI Pro's charts read as
 *                   `--chart-1`…`--chart-5`. `chart1` is the series colour of
 *                   every one-series chart on the platform, and it must clear
 *                   3:1 on every surface it is drawn on: light L 0.42 measures
 *                   6.12:1; dark is CORRECTED below. Slots two to five are ONE
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
    // Not corrected. The accent is the same green as light, carrying its pure
    // black label at 9.57:1.
    accent: "oklch(73.29% 0.1934 150.84)",
    accentForeground: "oklch(0% 0 0)",
    // Pure black, as saved (the owner's call of 2026-11-03; file header).
    background: "oklch(0% 0 0)",
    backdrop: "oklch(0% 0 0 / 0.5)",
    border: "oklch(30.00% 0.0093 150.84)",
    // CORRECTED. The export leaves the dark red to `mouve`, which DESIGN.md
    // resolves at L 59.40 (`#DB3B3E`); it carries `snow` at 4.35:1. L 58.50
    // carries it at 4.51:1, and the label stays white (spec 0002 D-c).
    danger: "oklch(58.50% 0.1967 24.63)",
    dangerForeground: "oklch(99.11% 0 0)",
    default: "oklch(26.00% 0.0093 150.84)",
    defaultForeground: "oklch(99.11% 0 0)",
    fieldBackground: "oklch(22.00% 0.0084 150.84)",
    // CORRECTED, as light: the saved L 32.00 measures 1.66:1 on the black
    // `background` and `surface`; L 46.50 measures 3.03:1 on both.
    fieldBorder: "oklch(46.50% 0.0117 150.84)",
    fieldForeground: "oklch(99.11% 0 0)",
    fieldPlaceholder: "oklch(65.00% 0.0093 150.84)",
    // The accent: 9.57:1 on the black canvas, so it clears 3:1 as saved.
    focus: "oklch(73.29% 0.1934 150.84)",
    foreground: "oklch(99.11% 0 0)",
    // 4.66:1 on `surfaceTertiary`, the lightest dark ground, as saved.
    muted: "oklch(65.00% 0.0093 150.84)",
    overlay: "oklch(20.00% 0.0093 150.84)",
    overlayForeground: "oklch(99.11% 0 0)",
    scrollbar: "oklch(35.00% 0.0093 150.84)",
    segment: "oklch(28.00% 0.0117 150.84)",
    segmentForeground: "oklch(99.11% 0 0)",
    separator: "oklch(28.00% 0.0084 150.84)",
    success: "oklch(73.29% 0.1935 150.81)",
    successForeground: "oklch(0% 0 0)",
    // Pure black, as saved, so a card sits on the canvas by its border and
    // shadow, not by its fill.
    surface: "oklch(0% 0 0)",
    surfaceForeground: "oklch(99.11% 0 0)",
    surfaceSecondary: "oklch(24.00% 0.0093 150.84)",
    surfaceSecondaryForeground: "oklch(99.11% 0 0)",
    surfaceTertiary: "oklch(27.00% 0.0093 150.84)",
    surfaceTertiaryForeground: "oklch(99.11% 0 0)",
    warning: "oklch(82.03% 0.1388 76.34)",
    warningForeground: "oklch(0% 0 0)",
    // --- authored here, not by the design system (see file header) ---
    // The accent itself: 6.85:1 on the lightest dark surface, so no separate
    // text step is needed in this theme.
    accentText: "oklch(73.29% 0.1934 150.84)",
    // CORRECTED. The saved red's L 59.40 measures 3.37:1 as text on the
    // lightest dark surface; L 67.00 measures 4.58:1 there.
    dangerText: "oklch(67.00% 0.1967 24.63)",
    // The fills themselves, which clear 4.5:1 on every dark ground.
    successText: "oklch(73.29% 0.1935 150.81)",
    warningText: "oklch(82.03% 0.1388 76.34)",
    // L 66.00 measures 4.61:1 on the lightest dark surface.
    info: "oklch(66.00% 0.1600 285.00)",
    foregroundHover: "oklch(88.00% 0 0)",
    // L 54.50 measures 3.06:1 on the lightest dark surface.
    fieldOutline: "oklch(54.50% 0.0199 150.84)",
    pressed: "oklch(99.11% 0 0 / 0.08)",
    // CORRECTED. The source's dark `chart-1` at L 50.00 measures 2.65:1 on the
    // lightest dark surface. L 53.00 measures 3.01:1.
    chart1: "oklch(53.00% 0.1200 150.84)",
    chart2: "oklch(60.00% 0.1400 150.84)",
    chart3: "oklch(70.00% 0.1600 150.84)",
    chart4: "oklch(78.00% 0.1200 150.84)",
    chart5: "oklch(85.00% 0.0800 150.84)",
    chartTrack: "oklch(32.00% 0.0300 150.84)",
    chartMuted: "oklch(46.00% 0.0150 150.84)",
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
 * Mixes HeroUI derives, re-stated where the token sheet's cascade needs them
 * stated, and where a derived value pushes the text drawn on it under the
 * floor.
 *
 * `@heroui/styles` derives each `*-soft` tint from its base role with
 * `color-mix`: `--accent-soft` is the accent at 15% in light and at 12% in
 * dark. The "Injishi.hs" save overrides both to 15%, so dark is the save's
 * 15%, not HeroUI's 12%. Both are restated on purpose: the design system is
 * the source, and a HeroUI release that moves its default must not move
 * Injishi's.
 *
 * THE CASCADE IS WHY DARK RESTATES WHAT LIGHT OVERRIDES. The light block below
 * is emitted on `:root` and is unlayered; HeroUI's dark derivations sit in a
 * layer. So any mix the light block declares and the dark block does not
 * leaks into dark, over HeroUI's own dark value. Every key in `light` must
 * therefore have a `dark` twin.
 *
 * The mix names `var(--accent)`, never a literal, so a tint follows the
 * accent this file ships, and is not a second accent.
 *
 * Not colour roles, for the reason `herouiElevation` is not: a role in
 * `herouiLight` becomes a `--color-*` utility, and HeroUI's shared theme
 * already maps `--color-accent-soft` onto `--accent-soft`, so declaring it
 * here as well would give one utility two definitions.
 *
 * The light accent's soft label is authored (`herouiSoftLabels`, below): at
 * HeroUI's derivation (accent 70% + foreground 30%) it measures 3.43:1 on the
 * tint over `surface`. Dark keeps the derivation (accent 80% + foreground
 * 30%), 10.00:1 over the black surface and 6.53:1 over `surfaceTertiary`.
 *
 * `vibrantPalette` is saved OFF in "Injishi.hs". The web never applied it
 * (ADR-068 D-p). The phone's sheet still imports HeroUI Native's vibrant
 * labels (92% of the tone), which measure 2.24:1 for the light accent and
 * 2.13:1 for light warning; `herouiSoftLabels` below is what keeps its soft
 * text readable.
 */
exports.herouiMixes = {
    light: {
        accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)",
        // The save's own hover: 10% toward a near-black at the theme hue. The
        // label is black now, so hover darkens the fill under a dark label and
        // ADR-068 D-j's reason for mixing toward ink is absent. The black label
        // measures 7.68:1 on it.
        accentHover: "color-mix(in oklab, var(--accent) 90%, oklch(15% 0.0300 150.84) 10%)",
        // CORRECTED, by the owner's call of 2026-10-07 (ADR-068 D-j). The
        // danger label is snow, and HeroUI's hover mixes 10% of the label into
        // the fill, which lightens it under a white label. Toward `ink`, the
        // same 10%, snow measures 5.13:1; toward snow it would be 3.77:1.
        dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)",
    },
    dark: {
        // The save's 15%, not HeroUI's dark 12% (see above).
        accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)",
        // The save's own hover, as light, restated so the light block cannot
        // leak into dark (see above). 7.68:1 under the black label.
        accentHover: "color-mix(in oklab, var(--accent) 90%, oklch(15% 0.0300 150.84) 10%)",
        // CORRECTED, as light: the danger label is still snow. 5.14:1.
        dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)",
    },
};
/**
 * Soft labels HeroUI derives that fail their floor, authored instead.
 *
 * A soft chip, tile or banner draws `<tone>-soft-foreground` on `<tone>-soft`
 * (the tone at 15%, or 12% on the web in dark) over the surface it sits on.
 * HeroUI DERIVES the label by mixing the tone with the foreground, and the two
 * platforms mix differently (`scripts/contrast-table.mjs` restates both). In
 * light every tone of this palette is a bright colour, so the derivations
 * fall short: the accent measures 3.43:1 on the web and 2.24:1 on the phone,
 * success 4.49:1 and 2.24:1, warning 2.13:1 on the phone and danger 3.28:1 on
 * the phone. Each is CORRECTED by ADR-025's rule, the tone's hue and chroma
 * held and only lightness moved, and both platforms then draw the one value
 * (spec 0002 D-c).
 *
 * Not colour roles, for the reason `herouiMixes` is not: HeroUI's own theme
 * already maps `--color-success-soft-foreground` onto the variable.
 *
 * Every dark soft label clears the floor as derived (the phone's danger, the
 * closest, at 4.74:1) and stays derived. The emitter restates the derivation
 * for each light key in the dark blocks it writes, so a light override can
 * never leak into dark (the cascade note above `herouiMixes`).
 *
 * Measured, not fixed: the table measures each label over `surface`. Over the
 * darker `default`, the light accent label measures 3.73:1 on its 15% tint,
 * and 4.40:1 over `surface` on the 20% hover tint.
 */
exports.herouiSoftLabels = {
    light: {
        // CORRECTED. L 50.00 measures 4.59:1 on `accent-soft` over `surface`.
        accentSoftForeground: "oklch(50.00% 0.1934 150.84)",
        // CORRECTED. L 50.50 measures 4.50:1 on `success-soft` over `surface`.
        successSoftForeground: "oklch(50.50% 0.1935 150.81)",
        // CORRECTED. L 52.00 measures 4.53:1 on `danger-soft` over `surface`.
        dangerSoftForeground: "oklch(52.00% 0.2328 25.74)",
        // CORRECTED. L 54.50 measures 4.57:1 on `warning-soft` over `surface`.
        warningSoftForeground: "oklch(54.50% 0.1585 72.33)",
    },
    dark: {},
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
/** Non-colour theme values the design system sets: radius and field radius 0.5rem. */
exports.herouiRadius = "0.5rem";
exports.herouiFieldRadius = "0.5rem";
/**
 * The form-field border width. HeroUI ships `--field-border-width: 0px`, so a
 * field has no border of its own; the design system draws a hairline. HeroUI
 * reads the width under two names (`--field-border-width`, and the
 * `--border-width-field` its theme maps from it), so both are emitted from
 * this one value. The "Injishi.hs" export CSS is silent on it; its DESIGN.md
 * gives 1px under both names (ADR-068 D-n: DESIGN.md fills the gap).
 */
exports.herouiFieldBorderWidth = "1px";
/**
 * The base spacing unit every Tailwind spacing, width and height utility
 * multiplies (`p-4` is `calc(var(--spacing) * 4)`). The design system sets
 * 0.265625rem, 4.25px (its spacing scale 1.12), in place of Tailwind's
 * 0.25rem; the last save set 3.75px. It moves every padding, gap and sized
 * box in every app by the same 6.25% over Tailwind's, so it is one value here
 * and nowhere else. ADR-027's named rhythms are literal lengths and do not
 * follow it.
 */
exports.herouiSpacing = "0.265625rem";
/**
 * Letter spacing. The design system's tracking base is 0em, so its scale is
 * Tailwind's own, as its DESIGN.md lists it (the export CSS is silent).
 * Restated as a plain `@theme` block anyway, so the design system stays the
 * source if a Tailwind release moves its defaults. Nothing applies
 * `tracking-normal` to body text by default; neither does the export.
 */
exports.herouiTracking = {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0em",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
};
/**
 * The design system's text scale: Tailwind's thirteen named steps at the
 * values its type scale (1.1) gives them. Each leading is the step's Tailwind
 * line box held in absolute terms (`text-sm` keeps 1.25rem). From `5xl` up the
 * export sets no leading, so Tailwind's own (1) stands.
 *
 * ADR-027's four authored steps (`layout.ts`) are separate names and do not
 * move. `xs` is 13px now, two pixels over `2xs`.
 */
exports.herouiTypeScale = {
    xs: { size: "0.8125rem", lineHeight: "calc(1 / 0.8125)" },
    sm: { size: "0.9375rem", lineHeight: "calc(1.25 / 0.9375)" },
    base: { size: "1.0625rem", lineHeight: "calc(1.5 / 1.0625)" },
    lg: { size: "1.1875rem", lineHeight: "calc(1.75 / 1.1875)" },
    xl: { size: "1.375rem", lineHeight: "calc(1.75 / 1.375)" },
    "2xl": { size: "1.5625rem", lineHeight: "calc(2 / 1.5625)" },
    "3xl": { size: "1.9375rem", lineHeight: "calc(2.25 / 1.9375)" },
    "4xl": { size: "2.375rem", lineHeight: "calc(2.5 / 2.375)" },
    "5xl": { size: "3.125rem" },
    "6xl": { size: "3.875rem" },
    "7xl": { size: "4.75rem" },
    "8xl": { size: "6.375rem" },
    "9xl": { size: "8.5rem" },
};
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
