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
/** Roles holding ONE value in both themes (the ADR-010 call 2 rule, kept). */
export declare const herouiFixed: {
    readonly ink: "oklch(25.00% 0.0093 145.10)";
    readonly white: "#FFFFFF";
    readonly black: "var(--ink)";
    readonly snow: "oklch(99.11% 0 0)";
    readonly eclipse: "oklch(25.00% 0.0093 145.10)";
    readonly slateLine: "oklch(50.50% 0.0140 145.10)";
    readonly surfaceTint: "oklch(95.00% 0.0056 145.10)";
    readonly canvas: "oklch(95.50% 0.0056 145.10)";
    readonly controlWash: "oklch(50.50% 0.0140 145.10)";
    readonly placeholderDim: "oklch(50.50% 0.0140 145.10)";
};
/** HeroUI roles, light theme. */
export declare const herouiLight: {
    readonly accent: "oklch(54.00% 0.1594 145.10)";
    readonly accentForeground: "oklch(99.11% 0 0)";
    readonly background: "oklch(95.50% 0.0056 145.10)";
    readonly backdrop: "oklch(50.00% 0.0187 145.10 / 0.4)";
    readonly border: "oklch(88.00% 0.0070 145.10)";
    readonly danger: "oklch(58.50% 0.2328 25.74)";
    readonly dangerForeground: "oklch(99.11% 0 0)";
    readonly default: "oklch(92.00% 0.0056 145.10)";
    readonly defaultForeground: "oklch(25.00% 0.0093 145.10)";
    readonly fieldBackground: "oklch(97.00% 0.0028 145.10)";
    readonly fieldBorder: "oklch(88.00% 0.0093 145.10)";
    readonly fieldForeground: "oklch(25.00% 0.0093 145.10)";
    readonly fieldPlaceholder: "oklch(50.50% 0.0140 145.10)";
    readonly focus: "oklch(54.00% 0.1594 145.10)";
    readonly foreground: "oklch(25.00% 0.0093 145.10)";
    readonly muted: "oklch(50.50% 0.0140 145.10)";
    readonly overlay: "oklch(97.50% 0.0037 145.10)";
    readonly overlayForeground: "oklch(25.00% 0.0093 145.10)";
    readonly scrollbar: "oklch(82.00% 0.0093 145.10)";
    readonly segment: "#FFFFFF";
    readonly segmentForeground: "oklch(25.00% 0.0093 145.10)";
    readonly separator: "oklch(92.00% 0.0047 145.10)";
    readonly success: "oklch(73.29% 0.1935 150.81)";
    readonly successForeground: "oklch(25.00% 0.0093 145.10)";
    readonly surface: "oklch(97.50% 0.0037 145.10)";
    readonly surfaceForeground: "oklch(25.00% 0.0093 145.10)";
    readonly surfaceSecondary: "oklch(95.00% 0.0056 145.10)";
    readonly surfaceSecondaryForeground: "oklch(25.00% 0.0093 145.10)";
    readonly surfaceTertiary: "oklch(93.50% 0.0075 145.10)";
    readonly surfaceTertiaryForeground: "oklch(25.00% 0.0093 145.10)";
    readonly warning: "oklch(78.19% 0.1585 72.33)";
    readonly warningForeground: "oklch(25.00% 0.0093 145.10)";
    readonly accentText: "oklch(49.00% 0.1594 145.10)";
    readonly dangerText: "oklch(52.50% 0.2328 25.74)";
    readonly info: "oklch(51.50% 0.1600 285.00)";
    readonly foregroundHover: "oklch(34.00% 0.0093 145.10)";
    readonly fieldOutline: "oklch(59.50% 0.0199 145.10)";
    readonly chart1: "oklch(42.00% 0.1400 145.10)";
    readonly chart2: "oklch(50.00% 0.1600 145.10)";
    readonly chart3: "oklch(55.00% 0.1800 145.10)";
    readonly chart4: "oklch(65.00% 0.1400 145.10)";
    readonly chart5: "oklch(75.00% 0.1000 145.10)";
    readonly chartTrack: "oklch(93.00% 0.0250 145.10)";
    readonly chartMuted: "oklch(80.00% 0.0150 145.10)";
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
export declare const herouiDark: {
    readonly accent: "oklch(54.00% 0.1594 145.10)";
    readonly accentForeground: "oklch(99.11% 0 0)";
    readonly background: "oklch(16.00% 0.0093 145.10)";
    readonly backdrop: "oklch(0% 0 0 / 0.5)";
    readonly border: "oklch(30.00% 0.0093 145.10)";
    readonly danger: "oklch(58.00% 0.1967 24.63)";
    readonly dangerForeground: "oklch(99.11% 0 0)";
    readonly default: "oklch(26.00% 0.0093 145.10)";
    readonly defaultForeground: "oklch(99.11% 0 0)";
    readonly fieldBackground: "oklch(22.00% 0.0084 145.10)";
    readonly fieldBorder: "oklch(32.00% 0.0117 145.10)";
    readonly fieldForeground: "oklch(99.11% 0 0)";
    readonly fieldPlaceholder: "oklch(65.00% 0.0093 145.10)";
    readonly focus: "oklch(54.00% 0.1594 145.10)";
    readonly foreground: "oklch(99.11% 0 0)";
    readonly muted: "oklch(65.00% 0.0093 145.10)";
    readonly overlay: "oklch(20.00% 0.0093 145.10)";
    readonly overlayForeground: "oklch(99.11% 0 0)";
    readonly scrollbar: "oklch(35.00% 0.0093 145.10)";
    readonly segment: "oklch(28.00% 0.0117 145.10)";
    readonly segmentForeground: "oklch(99.11% 0 0)";
    readonly separator: "oklch(28.00% 0.0084 145.10)";
    readonly success: "oklch(73.29% 0.1935 150.81)";
    readonly successForeground: "oklch(20.00% 0.0093 145.10)";
    readonly surface: "oklch(20.00% 0.0093 145.10)";
    readonly surfaceForeground: "oklch(99.11% 0 0)";
    readonly surfaceSecondary: "oklch(24.00% 0.0093 145.10)";
    readonly surfaceSecondaryForeground: "oklch(99.11% 0 0)";
    readonly surfaceTertiary: "oklch(27.00% 0.0093 145.10)";
    readonly surfaceTertiaryForeground: "oklch(99.11% 0 0)";
    readonly warning: "oklch(82.03% 0.1388 76.34)";
    readonly warningForeground: "oklch(20.00% 0.0093 145.10)";
    readonly accentText: "oklch(63.50% 0.1594 145.10)";
    readonly dangerText: "oklch(67.50% 0.1967 24.63)";
    readonly info: "oklch(67.00% 0.1600 285.00)";
    readonly foregroundHover: "oklch(88.00% 0.0093 145.10)";
    readonly fieldOutline: "oklch(55.00% 0.0199 145.10)";
    readonly chart1: "oklch(54.00% 0.1200 145.10)";
    readonly chart2: "oklch(60.00% 0.1400 145.10)";
    readonly chart3: "oklch(70.00% 0.1600 145.10)";
    readonly chart4: "oklch(78.00% 0.1200 145.10)";
    readonly chart5: "oklch(85.00% 0.0800 145.10)";
    readonly chartTrack: "oklch(32.00% 0.0300 145.10)";
    readonly chartMuted: "oklch(46.00% 0.0150 145.10)";
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
export declare const herouiMixes: {
    readonly light: {
        readonly accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)";
        readonly accentHover: "color-mix(in oklab, var(--accent) 90%, var(--ink) 10%)";
        readonly dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)";
    };
    readonly dark: {
        readonly accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)";
        readonly accentHover: "color-mix(in oklab, var(--accent) 90%, var(--ink) 10%)";
        readonly dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)";
        readonly accentSoftForeground: "color-mix(in oklab, var(--accent) 80%, var(--foreground) 34%)";
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
/** Non-colour theme values the design system sets: radius 0.5rem, field radius 0.75rem. */
export declare const herouiRadius = "0.5rem";
export declare const herouiFieldRadius = "0.75rem";
/**
 * The base spacing unit every Tailwind spacing, width and height utility
 * multiplies (`p-4` is `calc(var(--spacing) * 4)`). The design system sets
 * 0.265625rem, 4.25px, in place of Tailwind's 0.25rem. It moves every padding,
 * gap and sized box in every app by the same 6.25%, so it is one value here
 * and nowhere else. ADR-027's named rhythms are literal lengths and do not
 * follow it.
 */
export declare const herouiSpacing = "0.265625rem";
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