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
/** Roles holding ONE value in both themes (the ADR-010 call 2 rule, kept). */
export declare const herouiFixed: {
    readonly ink: "oklch(25.00% 0.0208 177.90)";
    readonly white: "#FFFFFF";
    readonly black: "var(--ink)";
    readonly snow: "oklch(99.11% 0 0)";
    readonly eclipse: "oklch(25.00% 0.0208 177.90)";
    readonly slateLine: "oklch(50.00% 0.0312 177.90)";
    readonly surfaceTint: "oklch(95.00% 0.0125 177.90)";
    readonly canvas: "oklch(95.50% 0.0125 177.90)";
    readonly controlWash: "oklch(50.00% 0.0312 177.90)";
    readonly placeholderDim: "oklch(50.00% 0.0312 177.90)";
};
/** HeroUI roles, light theme. */
export declare const herouiLight: {
    readonly accent: "oklch(51.00% 0.1800 177.90)";
    readonly accentForeground: "oklch(99.11% 0 0)";
    readonly background: "oklch(95.50% 0.0125 177.90)";
    readonly backdrop: "oklch(50.00% 0.0416 177.90 / 0.4)";
    readonly border: "oklch(88.00% 0.0156 177.90)";
    readonly danger: "oklch(58.50% 0.2328 25.74)";
    readonly dangerForeground: "oklch(99.11% 0 0)";
    readonly default: "oklch(92.00% 0.0125 177.90)";
    readonly defaultForeground: "oklch(25.00% 0.0208 177.90)";
    readonly fieldBackground: "oklch(97.00% 0.0062 177.90)";
    readonly fieldBorder: "oklch(88.00% 0.0208 177.90)";
    readonly fieldForeground: "oklch(25.00% 0.0208 177.90)";
    readonly fieldPlaceholder: "oklch(50.00% 0.0312 177.90)";
    readonly focus: "oklch(51.00% 0.1800 177.90)";
    readonly foreground: "oklch(25.00% 0.0208 177.90)";
    readonly muted: "oklch(50.00% 0.0312 177.90)";
    readonly overlay: "oklch(97.50% 0.0083 177.90)";
    readonly overlayForeground: "oklch(25.00% 0.0208 177.90)";
    readonly scrollbar: "oklch(82.00% 0.0208 177.90)";
    readonly segment: "#FFFFFF";
    readonly segmentForeground: "oklch(25.00% 0.0208 177.90)";
    readonly separator: "oklch(92.00% 0.0104 177.90)";
    readonly success: "oklch(73.29% 0.1935 150.81)";
    readonly successForeground: "oklch(25.00% 0.0208 177.90)";
    readonly surface: "oklch(97.50% 0.0083 177.90)";
    readonly surfaceForeground: "oklch(25.00% 0.0208 177.90)";
    readonly surfaceSecondary: "oklch(95.00% 0.0125 177.90)";
    readonly surfaceSecondaryForeground: "oklch(25.00% 0.0208 177.90)";
    readonly surfaceTertiary: "oklch(93.50% 0.0166 177.90)";
    readonly surfaceTertiaryForeground: "oklch(25.00% 0.0208 177.90)";
    readonly warning: "oklch(78.19% 0.1585 72.33)";
    readonly warningForeground: "oklch(25.00% 0.0208 177.90)";
    readonly accentText: "oklch(46.00% 0.1800 177.90)";
    readonly dangerText: "oklch(52.00% 0.2328 25.74)";
    readonly info: "oklch(52.00% 0.1600 285.00)";
    readonly foregroundHover: "oklch(34.00% 0.0208 177.90)";
    readonly fieldOutline: "oklch(60.00% 0.0445 177.90)";
    readonly chart1: "oklch(42.00% 0.1400 177.90)";
    readonly chart2: "oklch(50.00% 0.1600 177.90)";
    readonly chart3: "oklch(55.00% 0.1800 177.90)";
    readonly chart4: "oklch(65.00% 0.1400 177.90)";
    readonly chart5: "oklch(75.00% 0.1000 177.90)";
    readonly chartTrack: "oklch(93.00% 0.0250 177.90)";
    readonly chartMuted: "oklch(80.00% 0.0150 177.90)";
};
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
export declare const herouiDark: {
    readonly accent: "oklch(70.00% 0.1600 177.90)";
    readonly accentForeground: "oklch(15.00% 0.0208 177.90)";
    readonly background: "oklch(16.00% 0.0208 177.90)";
    readonly backdrop: "oklch(0% 0 0 / 0.5)";
    readonly border: "oklch(30.00% 0.0208 177.90)";
    readonly danger: "oklch(58.00% 0.1967 24.63)";
    readonly dangerForeground: "oklch(99.11% 0 0)";
    readonly default: "oklch(26.00% 0.0208 177.90)";
    readonly defaultForeground: "oklch(99.11% 0 0)";
    readonly fieldBackground: "oklch(22.00% 0.0187 177.90)";
    readonly fieldBorder: "oklch(32.00% 0.0260 177.90)";
    readonly fieldForeground: "oklch(99.11% 0 0)";
    readonly fieldPlaceholder: "oklch(65.00% 0.0208 177.90)";
    readonly focus: "oklch(70.00% 0.1600 177.90)";
    readonly foreground: "oklch(99.11% 0 0)";
    readonly muted: "oklch(65.00% 0.0208 177.90)";
    readonly overlay: "oklch(20.00% 0.0208 177.90)";
    readonly overlayForeground: "oklch(99.11% 0 0)";
    readonly scrollbar: "oklch(35.00% 0.0208 177.90)";
    readonly segment: "oklch(28.00% 0.0260 177.90)";
    readonly segmentForeground: "oklch(99.11% 0 0)";
    readonly separator: "oklch(28.00% 0.0187 177.90)";
    readonly success: "oklch(73.29% 0.1935 150.81)";
    readonly successForeground: "oklch(20.00% 0.0208 177.90)";
    readonly surface: "oklch(20.00% 0.0208 177.90)";
    readonly surfaceForeground: "oklch(99.11% 0 0)";
    readonly surfaceSecondary: "oklch(24.00% 0.0208 177.90)";
    readonly surfaceSecondaryForeground: "oklch(99.11% 0 0)";
    readonly surfaceTertiary: "oklch(27.00% 0.0208 177.90)";
    readonly surfaceTertiaryForeground: "oklch(99.11% 0 0)";
    readonly warning: "oklch(82.03% 0.1388 76.34)";
    readonly warningForeground: "oklch(20.00% 0.0208 177.90)";
    readonly accentText: "oklch(70.00% 0.1600 177.90)";
    readonly dangerText: "oklch(67.00% 0.1967 24.63)";
    readonly info: "oklch(66.00% 0.1600 285.00)";
    readonly foregroundHover: "oklch(88.00% 0.0208 177.90)";
    readonly fieldOutline: "oklch(54.50% 0.0445 177.90)";
    readonly chart1: "oklch(53.00% 0.1200 177.90)";
    readonly chart2: "oklch(60.00% 0.1400 177.90)";
    readonly chart3: "oklch(70.00% 0.1600 177.90)";
    readonly chart4: "oklch(78.00% 0.1200 177.90)";
    readonly chart5: "oklch(85.00% 0.0800 177.90)";
    readonly chartTrack: "oklch(32.00% 0.0300 177.90)";
    readonly chartMuted: "oklch(46.00% 0.0150 177.90)";
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
export declare const herouiElevation: {
    readonly light: {
        readonly surfaceShadow: "0 0 5px 0 rgba(0, 0, 0, 0.02), 0 2px 10px 0 rgba(0, 0, 0, 0.06), 0 0 1px 0 rgba(0, 0, 0, 0.2)";
        readonly overlayShadow: "0 24px 40px -12px rgb(0 0 0 / 0.08), 0 16px 28px -8px rgb(0 0 0 / 0.04), 0 4px 6px -2px rgb(0 0 0 / 0.04), 0 0 2px 0 rgb(0 0 0 / 0.04), 0 0 0 1px rgb(0 0 0 / 0.04)";
        readonly fieldShadow: "inset 0 0 2px 0 rgba(0, 0, 0, 0.04), inset 0 0 4px 0 rgba(0, 0, 0, 0.03), inset 0 0 2px 0 rgba(0, 0, 0, 0.03)";
        readonly mouveRaisedShadow: "0 1px 2px -0.5px rgba(255, 255, 255, 0.12) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.16) inset, 0 8px 24px -4px rgba(255, 255, 255, 0.16) inset, 0 8px 8px -3px rgba(0, 0, 0, 0.03), 0 5px 5px -2.5px rgba(0, 0, 0, 0.03), 0 3px 3px -1.5px rgba(0, 0, 0, 0.03), 0 2px 2px -1px rgba(0, 0, 0, 0.03), 0 1px 1px -0.5px rgba(0, 0, 0, 0.03), 0 0.5px 0.5px rgba(0, 0, 0, 0.03)";
        readonly mouveAccentFillShadow: "0 1px 2px -0.5px rgba(255, 255, 255, 0.12) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.16) inset, 0 8px 24px -4px rgba(255, 255, 255, 0.16) inset";
        readonly mouvePressedShadow: "inset 0 1px 2px 0 rgba(0, 0, 0, 0.08), inset 0 0 4px 0 rgba(0, 0, 0, 0.06), inset 0 1px 1px 0 rgba(0, 0, 0, 0.05)";
    };
    readonly dark: {
        readonly surfaceShadow: "inset 0 1px 0 0 #ffffff0a, inset 0 0 0 1px #ffffff0a, 0 0 0 1px #00000029, 0 1px 1px -0.5px #0000002e, 0 3px 3px -1.5px #0000002e, 0 6px 6px -3px #0000002e, 0 12px 12px -6px #0000002e";
        readonly overlayShadow: "0 1px 3px rgba(255, 255, 255, 0.04) inset, 0 0.5px 0.5px rgba(255, 255, 255, 0.04) inset, 0 16px 56px rgba(0, 0, 0, 0.24), 0 4px 16px rgba(0, 0, 0, 0.24), 0 1px 2px rgba(0, 0, 0, 0.24), 0 0 0 1px rgba(0, 0, 0, 0.1)";
        readonly fieldShadow: "inset 0 1px 1px 0 rgba(255, 255, 255, 0.02), inset 0 -0.5px 1px 0 rgba(255, 255, 255, 0.06), inset 1px 1.5px 4px 0 rgba(0, 0, 0, 0.06), inset 1px 1.5px 4px 0 rgba(0, 0, 0, 0.08)";
        readonly mouveRaisedShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.2), inset 0 1px 2px -0.5px rgba(255, 255, 255, 0.14), inset 0 8px 24px -4px rgba(255, 255, 255, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.4), 0 1px 1px -0.5px #0000004d, 0 3px 3px -1.5px #0000004d, 0 6px 6px -3px #0000004d, 0 12px 12px -6px #0000004d";
        readonly mouveAccentFillShadow: "inset 0 1px 0 0 rgba(255, 255, 255, 0.2), inset 0 1px 2px -0.5px rgba(255, 255, 255, 0.14), inset 0 8px 24px -4px rgba(255, 255, 255, 0.1)";
        readonly mouvePressedShadow: "inset 0 1px 2px 0 rgba(255, 255, 255, 0.05), inset 0 1px 1px 0 rgba(255, 255, 255, 0.1)";
    };
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
 * 70% + foreground 30%, dark accent 80% + foreground 30%): 4.59:1 at worst in
 * light, on `default`, and 6.33:1 in dark (5.85:1 on its 16% hover tint),
 * where the accent is now light. No override is needed in either theme, and
 * the dark one the last save needed is gone. The light 20% hover tint measures
 * 4.32:1, as it did before; ADR-068 lists it under "Measured, not fixed".
 *
 * `vibrantPalette` is saved ON and is NOT applied here: its soft text (the
 * base at 92%) measures 3.42:1 for the accent and 1.73:1 for warning in light.
 */
export declare const herouiMixes: {
    readonly light: {
        readonly accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)";
        readonly accentHover: "color-mix(in oklab, var(--accent) 90%, var(--ink) 10%)";
        readonly dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)";
    };
    readonly dark: {
        readonly accentSoft: "color-mix(in oklab, var(--accent) 12%, transparent)";
        readonly accentHover: "color-mix(in oklab, var(--accent) 90%, var(--accent-foreground) 10%)";
        readonly dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)";
    };
};
export declare const herouiAliases: {
    readonly card: "surface";
    readonly cardForeground: "surfaceForeground";
    readonly popover: "overlay";
    readonly popoverForeground: "overlayForeground";
    readonly primary: "foreground";
    readonly primaryHover: "foregroundHover";
    readonly primaryForeground: "background";
    readonly secondary: "surfaceSecondary";
    readonly secondaryForeground: "surfaceSecondaryForeground";
    readonly mutedForeground: "muted";
    readonly destructive: "danger";
    readonly destructiveForeground: "dangerForeground";
    readonly input: "fieldOutline";
    readonly field: "fieldBackground";
    readonly ring: "focus";
    readonly accentBrand: "accent";
    readonly accentBrandHover: "accentHover";
    readonly accentBrandForeground: "accentForeground";
    readonly scrollbarThumb: "scrollbar";
};
/** Non-colour theme values the design system sets: radius 0.5rem, field radius 0.25rem. */
export declare const herouiRadius = "0.5rem";
export declare const herouiFieldRadius = "0.25rem";
/**
 * The form-field border width. HeroUI ships `--field-border-width: 0px`, so a
 * field has no border of its own; the design system draws a hairline. HeroUI
 * reads the width under two names (`--field-border-width`, and the
 * `--border-width-field` its theme maps from it), and the export sets both,
 * so both are emitted from this one value.
 */
export declare const herouiFieldBorderWidth = "0.8488516842015111px";
/**
 * The base spacing unit every Tailwind spacing, width and height utility
 * multiplies (`p-4` is `calc(var(--spacing) * 4)`). The design system sets
 * 0.234375rem, 3.75px, in place of Tailwind's 0.25rem (it was 4.25px under the
 * last save). It moves every padding, gap and sized box in every app by the
 * same 6.25% under Tailwind's, so it is one value here and nowhere else.
 * ADR-027's named rhythms are literal lengths and do not follow it.
 */
export declare const herouiSpacing = "0.234375rem";
/**
 * Letter spacing. The design system's tracking base is -0.01em, and it shifts
 * Tailwind's whole tracking scale with it. Emitted as a plain `@theme` block,
 * so `tracking-tight` and the rest read these. Nothing applies
 * `tracking-normal` to body text by default; neither does the export.
 */
export declare const herouiTracking: {
    readonly tighter: "-0.06em";
    readonly tight: "-0.035em";
    readonly normal: "-0.01em";
    readonly wide: "0.015em";
    readonly wider: "0.04em";
    readonly widest: "0.09em";
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
export declare const herouiTypeScale: {
    readonly xs: {
        readonly size: "0.6875rem";
        readonly lineHeight: "calc(1 / 0.6875)";
    };
    readonly sm: {
        readonly size: "0.8125rem";
        readonly lineHeight: "calc(1.25 / 0.8125)";
    };
    readonly base: {
        readonly size: "0.9375rem";
        readonly lineHeight: "calc(1.5 / 0.9375)";
    };
    readonly lg: {
        readonly size: "1.0625rem";
        readonly lineHeight: "calc(1.75 / 1.0625)";
    };
    readonly xl: {
        readonly size: "1.1875rem";
        readonly lineHeight: "calc(1.75 / 1.1875)";
    };
    readonly "2xl": {
        readonly size: "1.375rem";
        readonly lineHeight: "calc(2 / 1.375)";
    };
    readonly "3xl": {
        readonly size: "1.75rem";
        readonly lineHeight: "calc(2.25 / 1.75)";
    };
    readonly "4xl": {
        readonly size: "2rem";
        readonly lineHeight: "calc(2.5 / 2)";
    };
    readonly "5xl": {
        readonly size: "2.75rem";
    };
    readonly "6xl": {
        readonly size: "3.375rem";
    };
    readonly "7xl": {
        readonly size: "4rem";
    };
    readonly "8xl": {
        readonly size: "5.25rem";
    };
    readonly "9xl": {
        readonly size: "7rem";
    };
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
export declare const herouiFixedGrounds: {
    readonly light: readonly ["canvas", "white", "surfaceTint"];
    readonly dark: readonly ["ink", "black", "controlWash"];
};
export type HeroUIPalette = typeof herouiLight;
//# sourceMappingURL=heroui.d.ts.map