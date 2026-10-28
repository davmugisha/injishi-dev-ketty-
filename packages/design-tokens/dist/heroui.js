"use strict";
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
 * Design System "Injishi" (`de231dfa-8a53-40c9-ba3b-cd9d5a93685b`, read at
 * saved `updatedAt` 1793037720487, 2026-10-26 18:02 UTC, on 2026-10-28; read
 * before at 1792979018879, 1791346544685 and first at 1791209095850). Its four
 * exports sit verbatim in `saves/1793037720487/`. The save is the `mouve` Pro
 * theme at base tone neutral, hue 177.90, radius 0.5rem, field radius 0.25rem,
 * a 0.85px field border, a 3.75px spacing unit, Figtree for body and
 * Instrument Sans for headings. Values are transcribed verbatim EXCEPT where a
 * transcribed value fails its floor in the contrast table (spec 0002 of the
 * mobile context; `scripts/contrast-table.mjs` measures it and the emitter
 * refuses to write past a breach), and every one of those is marked CORRECTED
 * at its declaration with the measurement that moved it. The rule is
 * ADR-025's, unchanged: keep the source's hue and chroma, move only lightness,
 * and only as far as the floor requires. So a re-export from the HeroUI editor
 * is a DIFF to read against this file, never a paste over it.
 *
 * Every ratio below is the WORSE of two paintings of the authored value: the
 * CSS Color 4 gamut map (lightness and hue held, chroma reduced) and a plain
 * per-channel clip. They differ only out of sRGB, which the status reds and
 * greens are; the export's own DESIGN.md resolves its hexes by clipping.
 *
 * The 18:02 save is the first to give each role its own hue. The light
 * neutrals sit at 172.11 (the background at 178.40, the ink at 179.83), the
 * dark neutrals at 150.84, the hue of the success green. The light accent
 * drops to chroma 0.09, inside sRGB, so it paints as exactly `#006B55`; the
 * dark accent IS the success green, `#17C964`, so in dark accent and success
 * are one colour and status never relies on colour alone (spec 0002 D-ac).
 * The save's manifest also stores an `accentHex` of `#008160`, which neither
 * generated output renders; the generated CSS wins.
 *
 * Where the design system's two outputs disagree, its generated CSS wins over
 * its DESIGN.md. DESIGN.md resolves the light `surface`, `overlay` and
 * `field-background` to pure white; the CSS the HeroUI preview renders sets
 * them to the values below. Where the CSS is SILENT, the `mouve` theme's own
 * rule stands (most text roles are `var(--foreground)` or `var(--eclipse)`),
 * and DESIGN.md resolves `--eclipse`: the export never sets it, so the
 * `mouve` theme's own (hue 300) would stand, while DESIGN.md resolves it at
 * the saved hue (`#172520`).
 *
 * EIGHT roles are authored here that the design system does not produce,
 * because HeroUI has no role for them and Injishi does. The four `*Text`
 * roles are a status colour as TEXT: each equals its fill when the fill clears
 * 4.5:1 as text on every ground, else it is a darker step of the same hue.
 *
 *  - `accentText`  — the accent as TEXT. In both themes the accent itself
 *                    clears the floor, so it equals the fill.
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
    ink: "oklch(24.98% 0.0215 170.32)",
    white: "#FFFFFF",
    // Pure black never ships (ramps.ts). The `mouve` theme sets it to
    // `oklch(0% 0 0)`; this keeps the ADR-010 rule instead.
    black: "var(--ink)",
    // HeroUI's two named neutrals. The design system mixes `--accent-hover`
    // toward `--snow`, and the `mouve` component layer reads both. `eclipse`
    // is DESIGN.md's light `#172520`: the export CSS leaves it to `mouve`, at
    // hue 300. (DESIGN.md's dark eclipse, `#1A251D`, differs by a hair; a
    // fixed role holds one value, and the light one is the one text reads.)
    snow: "oklch(99.11% 0 0)",
    eclipse: "oklch(24.98% 0.0215 170.32)",
    // The fixed twins of three light roles: `muted` (slate line, control wash,
    // dim placeholder), `surfaceSecondary` (tint) and `background` (canvas).
    slateLine: "oklch(49.50% 0.0317 176.00)",
    surfaceTint: "oklch(95.00% 0.0125 172.11)",
    canvas: "oklch(95.51% 0.0123 178.40)",
    controlWash: "oklch(49.50% 0.0317 176.00)",
    placeholderDim: "oklch(49.50% 0.0317 176.00)",
};
/** HeroUI roles, light theme. */
exports.herouiLight = {
    // Not corrected. The saved accent carries `snow` at 6.33:1; inside sRGB,
    // it paints as exactly `#006B55`.
    accent: "oklch(47.02% 0.0911 172.11)",
    accentForeground: "oklch(99.11% 0 0)",
    background: "oklch(95.51% 0.0123 178.40)",
    backdrop: "oklch(50.00% 0.0416 172.11 / 0.4)",
    border: "oklch(88.00% 0.0156 172.11)",
    // Not corrected: the save's own red carries `snow` at 5.48:1.
    danger: "oklch(53.86% 0.1937 26.72)",
    dangerForeground: "oklch(99.11% 0 0)",
    default: "oklch(92.00% 0.0125 172.11)",
    defaultForeground: "oklch(24.98% 0.0215 170.32)",
    fieldBackground: "oklch(97.00% 0.0062 172.11)",
    // CORRECTED. The field border is the boundary a person finds a field by,
    // so it is a control boundary (WCAG 1.4.11): 3:1 on `background` and
    // `surface`, the owner's call of 2026-10-28 under spec 0002. The saved
    // L 88.00 measures 1.25:1 on `background`; L 63.00 measures 3.05:1.
    fieldBorder: "oklch(63.00% 0.0208 172.11)",
    fieldForeground: "oklch(25.05% 0.0201 179.83)",
    // Held equal to `muted` the way the source does. Placeholder text is text;
    // 4.5:1 binds, and `muted` clears it.
    fieldPlaceholder: "oklch(49.50% 0.0317 176.00)",
    // The focus ring is a control boundary (WCAG 2.4.11): 3:1. The accent
    // clears it at 5.15:1 on the darkest light ground, so it is the accent.
    focus: "oklch(47.02% 0.0911 172.11)",
    foreground: "oklch(25.05% 0.0201 179.83)",
    // `--muted` IS the muted TEXT role in HeroUI's vocabulary, and every
    // `text-muted-foreground` site aliases onto it. The 18:02 save moved it
    // from L 58.00 to L 49.50 itself, so the old correction is gone: it
    // measures 4.78:1 on `default`, the darkest light ground.
    muted: "oklch(49.50% 0.0317 176.00)",
    overlay: "oklch(97.50% 0.0083 172.11)",
    overlayForeground: "oklch(25.05% 0.0201 179.83)",
    scrollbar: "oklch(82.00% 0.0208 172.11)",
    segment: "#FFFFFF",
    segmentForeground: "oklch(25.05% 0.0201 179.83)",
    separator: "oklch(92.00% 0.0104 172.11)",
    success: "oklch(73.29% 0.1934 150.84)",
    successForeground: "oklch(24.98% 0.0215 170.32)",
    surface: "oklch(97.50% 0.0083 172.11)",
    surfaceForeground: "oklch(25.05% 0.0201 179.83)",
    surfaceSecondary: "oklch(95.00% 0.0125 172.11)",
    surfaceSecondaryForeground: "oklch(25.05% 0.0201 179.83)",
    surfaceTertiary: "oklch(93.50% 0.0166 172.11)",
    surfaceTertiaryForeground: "oklch(25.05% 0.0201 179.83)",
    warning: "oklch(78.19% 0.1584 72.32)",
    warningForeground: "oklch(24.98% 0.0215 170.32)",
    // --- authored here, not by the design system (see file header) ---
    // The accent itself: 5.15:1 on `default`, the darkest light ground.
    accentText: "oklch(47.02% 0.0911 172.11)",
    // CORRECTED. The fill's own L 53.86 measures 4.46:1 as text on `default`,
    // the darkest light ground; L 53.50 measures 4.53:1 there.
    dangerText: "oklch(53.50% 0.1937 26.72)",
    // CORRECTED. The fill's L 73.29 measures 1.74:1 as text on `default`;
    // L 47.50 measures 4.57:1 there.
    successText: "oklch(47.50% 0.1934 150.84)",
    // CORRECTED. The fill's L 78.19 measures 1.62:1 as text on `default`;
    // L 51.50 measures 4.57:1 there.
    warningText: "oklch(51.50% 0.1584 72.32)",
    // L 52.00 measures 4.63:1 on `default`.
    info: "oklch(52.00% 0.1600 285.00)",
    foregroundHover: "oklch(34.00% 0.0201 179.83)",
    // L 60.00 measures 3.06:1 on `default`, the darkest light ground. Its
    // chroma keeps the ratio to the neutrals it had at 0.0199 two saves ago,
    // when the save's own neutral chroma was half what it is now.
    fieldOutline: "oklch(60.00% 0.0445 172.11)",
    pressed: "oklch(25.05% 0.0201 179.83 / 0.08)",
    // --- the chart roles (see the note below the dark set) ---
    chart1: "oklch(42.00% 0.1400 172.11)",
    chart2: "oklch(50.00% 0.1600 172.11)",
    chart3: "oklch(55.00% 0.1800 172.11)",
    chart4: "oklch(65.00% 0.1400 172.11)",
    chart5: "oklch(75.00% 0.1000 172.11)",
    chartTrack: "oklch(93.00% 0.0250 172.11)",
    chartMuted: "oklch(80.00% 0.0150 172.11)",
};
/**
 * The chart roles.
 *
 *  - `chart1`…`chart5` — the design system's five-step ramp on the theme hue,
 *                   darkest first, which HeroUI Pro's charts read as
 *                   `--chart-1`…`--chart-5`. `chart1` is the series colour of
 *                   every one-series chart on the platform, and it must clear
 *                   3:1 on every surface it is drawn on: light L 0.42 measures
 *                   5.78:1; dark is CORRECTED below. Slots two to five are ONE
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
    // Not corrected. Since the 18:02 save the dark accent is the success green,
    // `#17C964`, carrying a DARK label (L 15.00, ADR-025 correction 1) at
    // 8.94:1.
    accent: "oklch(73.29% 0.1934 150.84)",
    accentForeground: "oklch(15.00% 0.0208 150.84)",
    background: "oklch(15.95% 0.0203 177.41)",
    backdrop: "oklch(0% 0 0 / 0.5)",
    border: "oklch(30.00% 0.0208 150.84)",
    // CORRECTED. The saved dark red at L 65.32 carries `snow` at 3.48:1, the
    // same failure ADR-025 #2 fixed. L 59.00 carries it at 4.51:1, and the
    // label stays white (spec 0002 D-c).
    danger: "oklch(59.00% 0.2328 25.73)",
    dangerForeground: "oklch(99.11% 0 0)",
    default: "oklch(26.00% 0.0208 150.84)",
    defaultForeground: "oklch(99.11% 0 0)",
    fieldBackground: "oklch(22.00% 0.0187 150.84)",
    // CORRECTED, as light: the saved L 32.00 measures 1.44:1 on `surface`;
    // L 50.00 measures 3.04:1 there and 3.27:1 on `background`.
    fieldBorder: "oklch(50.00% 0.0260 150.84)",
    fieldForeground: "oklch(99.11% 0.0001 263.28)",
    fieldPlaceholder: "oklch(78.73% 0.0285 173.63)",
    // 6.82:1 on the lightest dark surface, so the accent clears 3:1 here too.
    focus: "oklch(73.29% 0.1934 150.84)",
    foreground: "oklch(99.11% 0.0001 263.28)",
    // 7.76:1 on the lightest dark surface, as the source wrote it.
    muted: "oklch(78.73% 0.0285 173.63)",
    overlay: "oklch(20.00% 0.0208 150.84)",
    overlayForeground: "oklch(99.11% 0.0001 263.28)",
    scrollbar: "oklch(35.00% 0.0208 150.84)",
    segment: "oklch(28.00% 0.0260 150.84)",
    segmentForeground: "oklch(99.11% 0.0001 263.28)",
    separator: "oklch(28.00% 0.0187 150.84)",
    success: "oklch(73.29% 0.1934 150.84)",
    successForeground: "oklch(20.00% 0.0208 150.84)",
    surface: "oklch(20.00% 0.0208 150.84)",
    surfaceForeground: "oklch(99.11% 0.0001 263.28)",
    surfaceSecondary: "oklch(24.00% 0.0208 150.84)",
    surfaceSecondaryForeground: "oklch(99.11% 0.0001 263.28)",
    surfaceTertiary: "oklch(27.00% 0.0208 150.84)",
    surfaceTertiaryForeground: "oklch(99.11% 0.0001 263.28)",
    warning: "oklch(78.19% 0.1584 72.32)",
    warningForeground: "oklch(20.00% 0.0208 150.84)",
    // --- authored here, not by the design system (see file header) ---
    // The accent itself: 6.82:1 on the lightest dark surface, so no separate
    // text step is needed in this theme.
    accentText: "oklch(73.29% 0.1934 150.84)",
    // CORRECTED. The saved red's L 65.32 measures 4.19:1 as text on the
    // lightest dark surface; L 70.00 measures 4.54:1 there.
    dangerText: "oklch(70.00% 0.2328 25.73)",
    // The fills themselves: 6.82:1 and 7.33:1 on the lightest dark surface.
    successText: "oklch(73.29% 0.1934 150.84)",
    warningText: "oklch(78.19% 0.1584 72.32)",
    // L 66.00 measures 4.59:1 on the lightest dark surface.
    info: "oklch(66.00% 0.1600 285.00)",
    foregroundHover: "oklch(88.00% 0.0001 263.28)",
    // L 54.50 measures 3.08:1 on the lightest dark surface.
    fieldOutline: "oklch(54.50% 0.0445 150.84)",
    pressed: "oklch(99.11% 0.0001 263.28 / 0.08)",
    // CORRECTED. The source's dark `chart-1` at L 50.00 measures 2.64:1 on the
    // lightest dark surface. L 53.50 measures 3.06:1.
    chart1: "oklch(53.50% 0.1200 150.84)",
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
 * 70% + foreground 30%, dark accent 80% + foreground 30%): 5.61:1 at worst in
 * light, on `default`, and 6.86:1 in dark (6.33:1 on its 16% hover tint). No
 * override is needed in either theme. The light 20% hover tint, which ADR-068
 * listed under "Measured, not fixed" at 4.32:1, now measures 5.21:1: the
 * 18:02 accent is darker.
 *
 * `vibrantPalette` is saved ON and is NOT applied on the web: its soft text
 * (the base at 92%) measures 4.52:1 for the accent and 2.00:1 for warning in
 * light. The phone does apply it (`global.css` imports HeroUI Native's vibrant
 * sheet), and `herouiSoftLabels` below is what keeps its soft text readable.
 */
exports.herouiMixes = {
    light: {
        accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)",
        // CORRECTED, by the owner's call of 2026-10-07. HeroUI's hover (and the
        // design system's saved `--accent-hover`) mixes 10% of the LABEL into
        // the fill. The label here is snow, so hover would lighten the fill
        // under it. Mixed toward `ink` instead, the same 10%, the label keeps
        // its floor: 6.99:1 on the accent and 6.13:1 on danger (toward snow,
        // danger would fall to 4.48:1). The fill colours are untouched.
        accentHover: "color-mix(in oklab, var(--accent) 90%, var(--ink) 10%)",
        dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)",
    },
    dark: {
        accentSoft: "color-mix(in oklab, var(--accent) 12%, transparent)",
        // HeroUI's own derivation, restated only so the light block's ink mix
        // cannot leak into dark (see above). The dark accent carries a DARK
        // label, so D-j's reason for mixing toward ink is absent here; toward
        // its own label the hover keeps 7.17:1.
        accentHover: "color-mix(in oklab, var(--accent) 90%, var(--accent-foreground) 10%)",
        // CORRECTED, as light: the danger label is still snow. 5.13:1 (toward
        // snow, 3.77:1).
        dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)",
    },
};
/**
 * Soft labels HeroUI derives that fail their floor, authored instead.
 *
 * A soft chip, tile or banner draws `<tone>-soft-foreground` on `<tone>-soft`
 * (the tone at 15%, or 12% on the web in dark) over the surface it sits on.
 * HeroUI DERIVES the label by mixing the tone with the foreground, and the two
 * platforms mix differently (`scripts/contrast-table.mjs` restates both). For
 * the light status fills, which are light colours made to carry a dark label,
 * no derivation reaches 4.5:1: light success measures 4.21:1 on the web and
 * 2.10:1 on the phone, light warning 4.44:1 and 2.00:1. Each is CORRECTED by
 * ADR-025's rule, the tone's hue and chroma held and only lightness moved, and
 * both platforms then draw the one value (spec 0002 D-c).
 *
 * Not colour roles, for the reason `herouiMixes` is not: HeroUI's own theme
 * already maps `--color-success-soft-foreground` onto the variable.
 *
 * One dark label fails too, and only because of a correction above: the dark
 * danger fill moved to L 59.00 for its white label, and the phone's vibrant
 * label (92% danger) moved with it.
 *
 * Every other soft label clears the floor as derived and stays derived. The
 * emitter restates the derivation for each light key in the dark blocks it
 * writes, so a light override can never leak into dark (the cascade note above
 * `herouiMixes`).
 */
exports.herouiSoftLabels = {
    light: {
        // CORRECTED. L 48.50 measures 4.59:1 on `success-soft` over `surface`.
        successSoftForeground: "oklch(48.50% 0.1934 150.84)",
        // CORRECTED. L 53.00 measures 4.58:1 on `warning-soft` over `surface`.
        warningSoftForeground: "oklch(53.00% 0.1584 72.32)",
    },
    dark: {
        // CORRECTED. The phone's derivation from the corrected fill measures
        // 4.14:1 on `danger-soft` over `surface` (the web's, 5.75:1); L 65.00
        // measures 4.59:1.
        dangerSoftForeground: "oklch(65.00% 0.2328 25.73)",
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
/** Non-colour theme values the design system sets: radius 0.5rem, field radius 0.25rem. */
exports.herouiRadius = "0.5rem";
exports.herouiFieldRadius = "0.25rem";
/**
 * The form-field border width. HeroUI ships `--field-border-width: 0px`, so a
 * field has no border of its own; the design system draws a hairline. HeroUI
 * reads the width under two names (`--field-border-width`, and the
 * `--border-width-field` its theme maps from it), and the export sets both,
 * so both are emitted from this one value.
 */
exports.herouiFieldBorderWidth = "0.8488516842015111px";
/**
 * The base spacing unit every Tailwind spacing, width and height utility
 * multiplies (`p-4` is `calc(var(--spacing) * 4)`). The design system sets
 * 0.234375rem, 3.75px, in place of Tailwind's 0.25rem (it was 4.25px under the
 * last save). It moves every padding, gap and sized box in every app by the
 * same 6.25% under Tailwind's, so it is one value here and nowhere else.
 * ADR-027's named rhythms are literal lengths and do not follow it.
 */
exports.herouiSpacing = "0.234375rem";
/**
 * Letter spacing. The design system's tracking base is -0.01em, and it shifts
 * Tailwind's whole tracking scale with it. Emitted as a plain `@theme` block,
 * so `tracking-tight` and the rest read these. Nothing applies
 * `tracking-normal` to body text by default; neither does the export.
 */
exports.herouiTracking = {
    tighter: "-0.06em",
    tight: "-0.035em",
    normal: "-0.01em",
    wide: "0.015em",
    wider: "0.04em",
    widest: "0.09em",
};
/**
 * The design system's text scale: Tailwind's thirteen named steps at the
 * values its type scale (0.8) gives them. Each leading is the step's Tailwind
 * line box held in absolute terms (`text-sm` keeps 1.25rem). From `5xl` up the
 * export sets no leading, so Tailwind's own (1) stands.
 *
 * ADR-027's four authored steps (`layout.ts`) are separate names and do not
 * move. `xs` now equals `2xs` at 11px; the eyebrow keeps its own name.
 */
exports.herouiTypeScale = {
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
