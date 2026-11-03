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
/** Roles holding ONE value in both themes (the ADR-010 call 2 rule, kept). */
export declare const herouiFixed: {
    readonly ink: "oklch(25.00% 0.0093 150.84)";
    readonly white: "#FFFFFF";
    readonly black: "var(--ink)";
    readonly snow: "oklch(99.11% 0 0)";
    readonly eclipse: "oklch(25.00% 0.0093 150.84)";
    readonly slateLine: "oklch(51.00% 0.0140 150.84)";
    readonly surfaceTint: "oklch(95.00% 0.0056 150.84)";
    readonly canvas: "oklch(95.43% 0.0058 154.55)";
    readonly controlWash: "oklch(51.00% 0.0140 150.84)";
    readonly placeholderDim: "oklch(51.00% 0.0140 150.84)";
    readonly accentInk: "oklch(47.50% 0.1934 150.84)";
};
/** HeroUI roles, light theme. */
export declare const herouiLight: {
    readonly accent: "oklch(73.29% 0.1934 150.84)";
    readonly accentForeground: "oklch(0% 0 0)";
    readonly background: "oklch(95.43% 0.0058 154.55)";
    readonly backdrop: "oklch(50.00% 0.0187 150.84 / 0.4)";
    readonly border: "oklch(88.00% 0.0070 150.84)";
    readonly danger: "oklch(59.00% 0.2328 25.74)";
    readonly dangerForeground: "oklch(99.11% 0 0)";
    readonly default: "oklch(92.00% 0.0056 150.84)";
    readonly defaultForeground: "oklch(25.00% 0.0093 150.84)";
    readonly fieldBackground: "oklch(97.00% 0.0028 150.84)";
    readonly fieldBorder: "oklch(63.00% 0.0093 150.84)";
    readonly fieldForeground: "oklch(25.00% 0.0093 150.84)";
    readonly fieldPlaceholder: "oklch(51.00% 0.0140 150.84)";
    readonly focus: "oklch(60.50% 0.1934 150.84)";
    readonly foreground: "oklch(25.00% 0.0093 150.84)";
    readonly muted: "oklch(51.00% 0.0140 150.84)";
    readonly overlay: "oklch(97.50% 0.0037 150.84)";
    readonly overlayForeground: "oklch(25.00% 0.0093 150.84)";
    readonly scrollbar: "oklch(82.00% 0.0093 150.84)";
    readonly segment: "#FFFFFF";
    readonly segmentForeground: "oklch(25.00% 0.0093 150.84)";
    readonly separator: "oklch(92.00% 0.0047 150.84)";
    readonly success: "oklch(73.29% 0.1935 150.81)";
    readonly successForeground: "oklch(0% 0 0)";
    readonly surface: "#FFFFFF";
    readonly surfaceForeground: "oklch(25.00% 0.0093 150.84)";
    readonly surfaceSecondary: "oklch(95.00% 0.0056 150.84)";
    readonly surfaceSecondaryForeground: "oklch(25.00% 0.0093 150.84)";
    readonly surfaceTertiary: "oklch(93.50% 0.0075 150.84)";
    readonly surfaceTertiaryForeground: "oklch(25.00% 0.0093 150.84)";
    readonly warning: "oklch(78.19% 0.1585 72.33)";
    readonly warningForeground: "oklch(0% 0 0)";
    readonly accentText: "oklch(47.50% 0.1934 150.84)";
    readonly dangerText: "oklch(52.50% 0.2328 25.74)";
    readonly successText: "oklch(47.50% 0.1935 150.81)";
    readonly warningText: "oklch(51.50% 0.1585 72.33)";
    readonly info: "oklch(52.00% 0.1600 285.00)";
    readonly foregroundHover: "oklch(34.00% 0.0093 150.84)";
    readonly fieldOutline: "oklch(60.00% 0.0199 150.84)";
    readonly pressed: "oklch(25.00% 0.0093 150.84 / 0.08)";
    readonly chart1: "oklch(42.00% 0.1400 150.84)";
    readonly chart2: "oklch(50.00% 0.1600 150.84)";
    readonly chart3: "oklch(55.00% 0.1800 150.84)";
    readonly chart4: "oklch(65.00% 0.1400 150.84)";
    readonly chart5: "oklch(75.00% 0.1000 150.84)";
    readonly chartTrack: "oklch(93.00% 0.0250 150.84)";
    readonly chartMuted: "oklch(80.00% 0.0150 150.84)";
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
export declare const herouiDark: {
    readonly accent: "oklch(73.29% 0.1934 150.84)";
    readonly accentForeground: "oklch(0% 0 0)";
    readonly background: "oklch(0% 0 0)";
    readonly backdrop: "oklch(0% 0 0 / 0.5)";
    readonly border: "oklch(30.00% 0.0093 150.84)";
    readonly danger: "oklch(58.50% 0.1967 24.63)";
    readonly dangerForeground: "oklch(99.11% 0 0)";
    readonly default: "oklch(26.00% 0.0093 150.84)";
    readonly defaultForeground: "oklch(99.11% 0 0)";
    readonly fieldBackground: "oklch(22.00% 0.0084 150.84)";
    readonly fieldBorder: "oklch(46.50% 0.0117 150.84)";
    readonly fieldForeground: "oklch(99.11% 0 0)";
    readonly fieldPlaceholder: "oklch(65.00% 0.0093 150.84)";
    readonly focus: "oklch(73.29% 0.1934 150.84)";
    readonly foreground: "oklch(99.11% 0 0)";
    readonly muted: "oklch(65.00% 0.0093 150.84)";
    readonly overlay: "oklch(20.00% 0.0093 150.84)";
    readonly overlayForeground: "oklch(99.11% 0 0)";
    readonly scrollbar: "oklch(35.00% 0.0093 150.84)";
    readonly segment: "oklch(28.00% 0.0117 150.84)";
    readonly segmentForeground: "oklch(99.11% 0 0)";
    readonly separator: "oklch(28.00% 0.0084 150.84)";
    readonly success: "oklch(73.29% 0.1935 150.81)";
    readonly successForeground: "oklch(0% 0 0)";
    readonly surface: "oklch(0% 0 0)";
    readonly surfaceForeground: "oklch(99.11% 0 0)";
    readonly surfaceSecondary: "oklch(24.00% 0.0093 150.84)";
    readonly surfaceSecondaryForeground: "oklch(99.11% 0 0)";
    readonly surfaceTertiary: "oklch(27.00% 0.0093 150.84)";
    readonly surfaceTertiaryForeground: "oklch(99.11% 0 0)";
    readonly warning: "oklch(82.03% 0.1388 76.34)";
    readonly warningForeground: "oklch(0% 0 0)";
    readonly accentText: "oklch(73.29% 0.1934 150.84)";
    readonly dangerText: "oklch(67.00% 0.1967 24.63)";
    readonly successText: "oklch(73.29% 0.1935 150.81)";
    readonly warningText: "oklch(82.03% 0.1388 76.34)";
    readonly info: "oklch(66.00% 0.1600 285.00)";
    readonly foregroundHover: "oklch(88.00% 0 0)";
    readonly fieldOutline: "oklch(54.50% 0.0199 150.84)";
    readonly pressed: "oklch(99.11% 0 0 / 0.08)";
    readonly chart1: "oklch(53.00% 0.1200 150.84)";
    readonly chart2: "oklch(60.00% 0.1400 150.84)";
    readonly chart3: "oklch(70.00% 0.1600 150.84)";
    readonly chart4: "oklch(78.00% 0.1200 150.84)";
    readonly chart5: "oklch(85.00% 0.0800 150.84)";
    readonly chartTrack: "oklch(32.00% 0.0300 150.84)";
    readonly chartMuted: "oklch(46.00% 0.0150 150.84)";
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
export declare const herouiMixes: {
    readonly light: {
        readonly accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)";
        readonly accentHover: "color-mix(in oklab, var(--accent) 90%, oklch(15% 0.0300 150.84) 10%)";
        readonly dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)";
    };
    readonly dark: {
        readonly accentSoft: "color-mix(in oklab, var(--accent) 15%, transparent)";
        readonly accentHover: "color-mix(in oklab, var(--accent) 90%, oklch(15% 0.0300 150.84) 10%)";
        readonly dangerHover: "color-mix(in oklab, var(--danger) 90%, var(--ink) 10%)";
    };
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
export declare const herouiSoftLabels: {
    readonly light: {
        readonly accentSoftForeground: "oklch(50.00% 0.1934 150.84)";
        readonly successSoftForeground: "oklch(50.50% 0.1935 150.81)";
        readonly dangerSoftForeground: "oklch(52.00% 0.2328 25.74)";
        readonly warningSoftForeground: "oklch(54.50% 0.1585 72.33)";
    };
    readonly dark: {};
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
/** Non-colour theme values the design system sets: radius and field radius 0.5rem. */
export declare const herouiRadius = "0.5rem";
export declare const herouiFieldRadius = "0.5rem";
/**
 * The form-field border width. HeroUI ships `--field-border-width: 0px`, so a
 * field has no border of its own; the design system draws a hairline. HeroUI
 * reads the width under two names (`--field-border-width`, and the
 * `--border-width-field` its theme maps from it), so both are emitted from
 * this one value. The "Injishi.hs" export CSS is silent on it; its DESIGN.md
 * gives 1px under both names (ADR-068 D-n: DESIGN.md fills the gap).
 */
export declare const herouiFieldBorderWidth = "1px";
/**
 * The base spacing unit every Tailwind spacing, width and height utility
 * multiplies (`p-4` is `calc(var(--spacing) * 4)`). The design system sets
 * 0.265625rem, 4.25px (its spacing scale 1.12), in place of Tailwind's
 * 0.25rem; the last save set 3.75px. It moves every padding, gap and sized
 * box in every app by the same 6.25% over Tailwind's, so it is one value here
 * and nowhere else. ADR-027's named rhythms are literal lengths and do not
 * follow it.
 */
export declare const herouiSpacing = "0.265625rem";
/**
 * Letter spacing. The design system's tracking base is 0em, so its scale is
 * Tailwind's own, as its DESIGN.md lists it (the export CSS is silent).
 * Restated as a plain `@theme` block anyway, so the design system stays the
 * source if a Tailwind release moves its defaults. Nothing applies
 * `tracking-normal` to body text by default; neither does the export.
 */
export declare const herouiTracking: {
    readonly tighter: "-0.05em";
    readonly tight: "-0.025em";
    readonly normal: "0em";
    readonly wide: "0.025em";
    readonly wider: "0.05em";
    readonly widest: "0.1em";
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
export declare const herouiTypeScale: {
    readonly xs: {
        readonly size: "0.8125rem";
        readonly lineHeight: "calc(1 / 0.8125)";
    };
    readonly sm: {
        readonly size: "0.9375rem";
        readonly lineHeight: "calc(1.25 / 0.9375)";
    };
    readonly base: {
        readonly size: "1.0625rem";
        readonly lineHeight: "calc(1.5 / 1.0625)";
    };
    readonly lg: {
        readonly size: "1.1875rem";
        readonly lineHeight: "calc(1.75 / 1.1875)";
    };
    readonly xl: {
        readonly size: "1.375rem";
        readonly lineHeight: "calc(1.75 / 1.375)";
    };
    readonly "2xl": {
        readonly size: "1.5625rem";
        readonly lineHeight: "calc(2 / 1.5625)";
    };
    readonly "3xl": {
        readonly size: "1.9375rem";
        readonly lineHeight: "calc(2.25 / 1.9375)";
    };
    readonly "4xl": {
        readonly size: "2.375rem";
        readonly lineHeight: "calc(2.5 / 2.375)";
    };
    readonly "5xl": {
        readonly size: "3.125rem";
    };
    readonly "6xl": {
        readonly size: "3.875rem";
    };
    readonly "7xl": {
        readonly size: "4.75rem";
    };
    readonly "8xl": {
        readonly size: "6.375rem";
    };
    readonly "9xl": {
        readonly size: "8.5rem";
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