/**
 * Semantic tokens map the ramps onto roles. Components consume these, never the
 * raw ramp steps or hex.
 *
 * ADR-010 replaced the old flat `light`/`dark` pair with three kinds of role,
 * because one flat object could not express either of the two shapes the
 * vocabulary actually needs:
 *
 *  - `fixed`   — one value, emitted identically into `:root` and `.dark`.
 *                `ink`, `white` and `black` are navy, white and navy in BOTH
 *                themes; `bg-ink` + `text-white` is a brand chip, not a
 *                surface, so it must not invert (ADR-010 call 2).
 *  - `light` / `dark` — the theme-following pair, as before.
 *  - `aliases` — a role name pointing at another role name. The generator
 *                wraps the right-hand side in `var(--…)` rather than treating
 *                it as a colour, which is the only way to tell
 *                `--accent-brand: var(--accent)` from a hex.
 *
 * Hard rules encoded here:
 *  - accent fills take INK text (white on green-600 is 2.98:1, fails AA)
 *  - muted text on white is ink-600 (5.4:1); never lighter
 *  - dark mode is raised-surface: ink-950 canvas, ink-900 cards, ink-800
 *    overlays, on every route group (ADR-019, which replaced ADR-010 call 3's
 *    inverted card but kept its one-convention-everywhere invariant)
 *  - every dark role is measured against ink-800, the lightest of the three
 *    dark surfaces. Clearing the hardest surface clears all of them
 *  - the error colour is crimson, not the stock red: the stock red and the
 *    brand green are the same colour to a deuteranope (ADR-010 call 4)
 *
 * Values referencing `var(--…)` are CSS-only. React Native reads `ink`,
 * `green` and `status` (see src/ramps.ts and `status` below), never these.
 */
/**
 * Status hues for the React Native client, which has no CSS variables and
 * therefore cannot read `light`/`dark` below. Web's error colour is the ADR-010
 * crimson in `light`/`dark`; this set still carries the pre-ADR-010 red because
 * ADR-010 scoped its change to the five web route groups. Folding mobile onto
 * the crimson is a follow-up, not this feature.
 */
export declare const status: {
    readonly success: "#1B9101";
    readonly successOnWhite: "#147900";
    readonly warning: "#A26001";
    readonly destructive: "#D01D21";
    readonly info: "#0379A1";
};
/** A role name -> CSS value map. Values may be hex, rgba, or `var(--…)`. */
export type RoleMap = Readonly<Record<string, string>>;
/**
 * Roles that hold ONE value in both themes (ADR-010 call 2).
 *
 * `slate-line`, `surface-tint`, `canvas`, `control-wash` and `placeholder-dim`
 * come from the donor `@theme` block verbatim; they sit on surfaces that do not
 * follow the theme either.
 */
export declare const fixed: {
    readonly ink: "#042330";
    readonly white: "#FFFFFF";
    readonly black: "var(--ink-950)";
    readonly slateLine: "#858D9A";
    readonly surfaceTint: "#E6E9F2";
    readonly canvas: "#F7FAFB";
    readonly controlWash: "#696D78";
    readonly placeholderDim: "#878787";
};
/** Theme-following roles, light theme: white canvas, ink text. */
export declare const light: {
    readonly background: "#FFFFFF";
    readonly foreground: "var(--ink-950)";
    readonly card: "#FFFFFF";
    readonly cardForeground: "var(--ink-950)";
    readonly popover: "#FFFFFF";
    readonly popoverForeground: "var(--ink-950)";
    readonly primary: "var(--ink-950)";
    readonly primaryHover: "var(--ink-800)";
    readonly primaryForeground: "#FFFFFF";
    readonly secondary: "var(--ink-50)";
    readonly secondaryForeground: "var(--ink-950)";
    readonly muted: "var(--ink-50)";
    readonly mutedForeground: "var(--ink-600)";
    readonly accent: "var(--green-600)";
    readonly accentHover: "var(--green-700)";
    readonly accentForeground: "var(--ink-950)";
    readonly accentText: "var(--green-800)";
    readonly destructive: "#b3123c";
    readonly destructiveForeground: "#FFFFFF";
    readonly success: "var(--green-700)";
    readonly warning: "#A26001";
    readonly info: "#0379A1";
    readonly border: "rgba(4, 35, 48, 0.14)";
    readonly input: "rgba(4, 35, 48, 0.22)";
    readonly field: "#FFFFFF";
    readonly ring: "var(--green-700)";
};
/**
 * Theme-following roles, dark theme: ink canvas, raised ink surfaces.
 *
 * ADR-019 replaced ADR-010's inverted card. The invariant call 3 protected —
 * ONE card convention on every route group — is kept; the convention itself
 * changed, because the inverted one was unreadable.
 *
 * The inverted card made `--card` near-white (`ink-50`) while every
 * theme-following TEXT role stayed tuned for the navy page. Anything secondary
 * inside a card therefore landed pale-on-pale: `muted-foreground` measured
 * 1.44:1 and `accent-text` 1.41:1 against `--card`, against a 4.5:1 floor.
 * `CardDescription` in `@injishi/ui` is `text-muted-foreground`, so that was
 * every card description in all four apps. ADR-010's proof route never caught
 * it: its contrast table measured 11 pairs, all against `--background`.
 *
 * The three surfaces now step up in lightness the way the elevation model in
 * `ui-tokens.md` has always described, and `apps/pms` has always shipped:
 *
 *   background  ink-950  #042330   the canvas
 *   card        ink-900  #093344   raised
 *   popover     ink-800  #09465D   overlays (menus, dialogs, tooltips)
 *
 * Every value below is measured against the LIGHTEST of those three, `ink-800`,
 * because a role that clears the hardest surface clears all of them. That is
 * the rule ADR-010 was missing, and it is what moved `info` and `destructive`:
 * both cleared `ink-950` and failed `ink-800` (4.45:1 and 3.92:1). They step up
 * the same hue — ADR-010 call 4 chose crimson over the stock red for the
 * deuteranopia collision, and that choice is untouched.
 */
export declare const dark: {
    readonly background: "var(--ink-950)";
    readonly foreground: "var(--ink-100)";
    readonly card: "var(--ink-900)";
    readonly cardForeground: "var(--ink-100)";
    readonly popover: "var(--ink-800)";
    readonly popoverForeground: "var(--ink-100)";
    readonly primary: "var(--ink-100)";
    readonly primaryHover: "var(--ink-200)";
    readonly primaryForeground: "var(--ink-950)";
    readonly secondary: "rgba(230, 244, 251, 0.08)";
    readonly secondaryForeground: "var(--ink-100)";
    readonly muted: "rgba(230, 244, 251, 0.08)";
    readonly mutedForeground: "var(--ink-300)";
    readonly accent: "var(--green-600)";
    readonly accentHover: "var(--green-500)";
    readonly accentForeground: "var(--ink-950)";
    readonly accentText: "var(--green-300)";
    readonly destructive: "#FF96B4";
    readonly destructiveForeground: "var(--ink-950)";
    readonly success: "var(--green-400)";
    readonly warning: "#E0A85C";
    readonly info: "#70C0DC";
    readonly border: "rgba(230, 244, 251, 0.34)";
    readonly input: "rgba(230, 244, 251, 0.48)";
    readonly field: "rgba(230, 244, 251, 0.06)";
    readonly ring: "var(--green-400)";
};
/**
 * Alias -> role. Emitted as `--<alias>: var(--<role>)`, so the 13 existing
 * `accent-brand` uses in apps/web keep resolving while `<Button variant="accent">`
 * starts working off the real `accent` names (ADR-010 supporting call 1b).
 */
export declare const aliases: {
    readonly accentBrand: "accent";
    readonly accentBrandHover: "accentHover";
    readonly accentBrandForeground: "accentForeground";
};
/**
 * The card radius, asked for by role rather than by size (ADR-010 call 5a).
 *
 * ADR-025 moved it from 1.5rem to 1rem. It is not a free value: it has to stay
 * on the same rounding scale as `--radius`, which that pass dropped from
 * 0.75rem to 0.5rem. At 1.5rem the card was suddenly THREE times the base step
 * while every other corner in the scale is base ±4px, so a card read as a
 * different design system from the button inside it. 1rem is exactly
 * `--radius-2xl` (`calc(var(--radius) + 8px)`), so the largest corner the scale
 * emits and the card corner are now one value.
 */
export declare const radiusCard = "1rem";
/**
 * The control thumb shadow, re-derived from the brand navy at the alpha the
 * donor used. It replaces `#003b8140`, a blue that was an orphan in both
 * palettes (ADR-010 call 7). `0x40` is 25%.
 */
export declare const shadowControl = "0 2px 8px rgba(4, 35, 48, 0.25)";
export declare const palettes: {
    readonly light: {
        readonly background: "#FFFFFF";
        readonly foreground: "var(--ink-950)";
        readonly card: "#FFFFFF";
        readonly cardForeground: "var(--ink-950)";
        readonly popover: "#FFFFFF";
        readonly popoverForeground: "var(--ink-950)";
        readonly primary: "var(--ink-950)";
        readonly primaryHover: "var(--ink-800)";
        readonly primaryForeground: "#FFFFFF";
        readonly secondary: "var(--ink-50)";
        readonly secondaryForeground: "var(--ink-950)";
        readonly muted: "var(--ink-50)";
        readonly mutedForeground: "var(--ink-600)";
        readonly accent: "var(--green-600)";
        readonly accentHover: "var(--green-700)";
        readonly accentForeground: "var(--ink-950)";
        readonly accentText: "var(--green-800)";
        readonly destructive: "#b3123c";
        readonly destructiveForeground: "#FFFFFF";
        readonly success: "var(--green-700)";
        readonly warning: "#A26001";
        readonly info: "#0379A1";
        readonly border: "rgba(4, 35, 48, 0.14)";
        readonly input: "rgba(4, 35, 48, 0.22)";
        readonly field: "#FFFFFF";
        readonly ring: "var(--green-700)";
    };
    readonly dark: {
        readonly background: "var(--ink-950)";
        readonly foreground: "var(--ink-100)";
        readonly card: "var(--ink-900)";
        readonly cardForeground: "var(--ink-100)";
        readonly popover: "var(--ink-800)";
        readonly popoverForeground: "var(--ink-100)";
        readonly primary: "var(--ink-100)";
        readonly primaryHover: "var(--ink-200)";
        readonly primaryForeground: "var(--ink-950)";
        readonly secondary: "rgba(230, 244, 251, 0.08)";
        readonly secondaryForeground: "var(--ink-100)";
        readonly muted: "rgba(230, 244, 251, 0.08)";
        readonly mutedForeground: "var(--ink-300)";
        readonly accent: "var(--green-600)";
        readonly accentHover: "var(--green-500)";
        readonly accentForeground: "var(--ink-950)";
        readonly accentText: "var(--green-300)";
        readonly destructive: "#FF96B4";
        readonly destructiveForeground: "var(--ink-950)";
        readonly success: "var(--green-400)";
        readonly warning: "#E0A85C";
        readonly info: "#70C0DC";
        readonly border: "rgba(230, 244, 251, 0.34)";
        readonly input: "rgba(230, 244, 251, 0.48)";
        readonly field: "rgba(230, 244, 251, 0.06)";
        readonly ring: "var(--green-400)";
    };
};
export type ThemeName = keyof typeof palettes;
export type SemanticPalette = typeof light;
/**
 * Which of the `fixed` roles may be a GROUND, split by the lightness they hold
 * (ADR-028). This is the register the emitter builds the fixed-ground pin's
 * selectors from — `bg-canvas`, `bg-ink` and the rest — so the list is written
 * once and the generator never retypes it.
 *
 * Three of the eight fixed roles are missing on purpose. `slateLine` and
 * `placeholderDim` are FOREGROUNDS: pinning a whole theme block inside a hairline
 * or a placeholder colour would be meaningless, and `bg-slate-line` names a
 * surface nothing draws. `ink` and `black` are the same value, and both appear
 * because both classes are written.
 *
 * A new fixed ground is added HERE and nowhere else, which is the point: the
 * pin is emitted into two stylesheets now, and a hand-kept selector list in the
 * generator would be one list to update in two places, forgotten in one.
 */
export declare const fixedGrounds: {
    readonly light: readonly ["canvas", "white", "surfaceTint"];
    readonly dark: readonly ["ink", "black", "controlWash"];
};
/**
 * RETIRED by ADR-034 task 6. `radius`, `space` and `font` used to live here as
 * "non-color primitives (shared across platforms)". They were shared with
 * nothing: no file in the repo imported any of the three, and
 * `apps/mobile/src/theme/tokens.ts` carried its own, different set — a
 * seven-step radius against this file's four, and Figtree against this file's
 * `Outfit`, which the app stopped using and this declaration never heard about.
 *
 * The React Native scales are authored once now, in `./rn.ts`, from the values
 * the app actually ships. The font FAMILY is deliberately not among them:
 * ADR-025 held that a family is the app's fact because it differs per surface,
 * while a scale does not.
 */
//# sourceMappingURL=semantic.d.ts.map