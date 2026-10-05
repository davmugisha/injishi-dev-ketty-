/**
 * The React Native scales — the space grid, the corners, the type steps.
 *
 * ADR-034 task 6: *"Exactly one declaration of `radius`, `space` and `font` for
 * React Native in the repo."* Before this file there were two, and they
 * disagreed:
 *
 *   package  radius { sm: 4, md: 8, lg: 12, pill: 9999 }   font { ui: "Outfit" }
 *   mobile   radius { none: 0, xs: 4, sm: 8, md: 10,       Figtree
 *                     lg: 14, xl: 20, pill: 999 }
 *
 * The package's copy was not merely unused — it was WRONG. Nothing in the repo
 * imported it (checked: `radius`, `space` and `font` had zero consumers), so it
 * drifted freely: `Outfit` was replaced by Figtree in the app and the package
 * never heard, and its four-step radius set never grew the `xs`, `xl` and
 * `none` the app actually draws with. A second declaration that nobody reads is
 * how a design system acquires values that are true nowhere.
 *
 * The values here were `apps/mobile`'s, unchanged. That direction is deliberate:
 * ADR-034 decision 3 is *"reconstruction, never redesign"*, and the app's set is
 * the one that ships on a device today. Moving a corner or a step is a separate
 * change with its own before-and-after, and ADR-064 is the first: it moved the
 * corners to HeroUI's, with screenshots before and after.
 *
 * WHAT IS NOT HERE, and why:
 *
 *   - **The font family.** ADR-025 held that `--font-sans` is the APP's fact
 *     because the family differs per app, and `ui-tokens.md` repeats it for the
 *     layout scale. A scale is shared; a typeface is a brand decision per
 *     surface. `fontFamily` stays in `apps/mobile/src/theme/tokens.ts`.
 *   - **Shadows and scrims.** They are React Native style OBJECTS, not scale
 *     values, and the scrim alphas were solved against this product's own
 *     photography. They stay with the app that renders them.
 *
 * THE TWO TYPE SCALES ARE NOT THE SAME SCALE, and that is worth stating plainly
 * because the names collide. `layout.ts` carries the CSS scale ADR-027
 * specifies — `xl` is 20px there. This file carries the React Native scale —
 * `xl` is 22px, and the body step is `md` where the web calls it `base`. They
 * were authored separately for two different rendering models and reconciling
 * them is a real design decision with 757 mobile call sites behind it, not a
 * tidy-up. It is owed, and it is not this change.
 */
/** The 4px base grid. Every gap, pad and margin in the app is a step on it. */
export declare const rnSpace: {
    readonly 0: 0;
    readonly 1: 4;
    readonly 2: 8;
    readonly 3: 12;
    readonly 4: 16;
    readonly 5: 20;
    readonly 6: 24;
    readonly 8: 32;
    readonly 10: 40;
    readonly 12: 48;
    readonly 16: 64;
};
/**
 * Corners, as five ROLES (ADR-064 AC-6).
 *
 * The values are HeroUI Native 1.0.10's, read from its stylesheets: 8 for small
 * boxes, 14 for fields (its `field` radius), 24 for surfaces, 32 for a sheet's
 * top corners. A corner is chosen by what the element IS and how big it is,
 * never by eye: an element 48pt or smaller takes `sm` or `pill`, fields and
 * tiles `md`, surfaces `lg` (AC-21). This supersedes `parity.md` §5.2's map onto
 * web's three corners, for mobile.
 *
 * The keys kept their names and took new values, so every screen follows at
 * once. That is right for most uses and wrong for some (a token that suited a
 * card can be wrong on a thumbnail), which is why slice 4 reviews each use.
 */
export declare const rnRadiusRoles: {
    readonly sm: 8;
    readonly md: 14;
    readonly lg: 24;
    readonly xl: 32;
    readonly pill: 999;
};
/**
 * The roles, plus two names that are retiring.
 *
 * `xs` and `none` are not roles and slice 4 of ADR-064 deletes them, with every
 * read moved to a role. Until then they alias, on the restyle branch only, so
 * the screens that still spell them compile: `xs` was the smallest corner, so it
 * reads `sm`, and `none` stays 0 because nothing draws with it. Never add a
 * read of either.
 */
export declare const rnRadius: {
    /** @deprecated ADR-064 slice 4 removes it. Read `sm`. */
    readonly xs: 8;
    /** @deprecated ADR-064 slice 4 removes it. Not a corner. */
    readonly none: 0;
    readonly sm: 8;
    readonly md: 14;
    readonly lg: 24;
    readonly xl: 32;
    readonly pill: 999;
};
/** The type scale, in device pixels. 16px base. */
export declare const rnFontSize: {
    readonly "2xs": 11;
    readonly xs: 12;
    readonly sm: 14;
    readonly md: 16;
    readonly lg: 18;
    readonly xl: 22;
    readonly "2xl": 28;
    readonly "3xl": 36;
};
/**
 * The leading that belongs to each step.
 *
 * A step is a PAIR. `ui-rules.md`: *"A hand-typed size also ships no line
 * height, so two of them at the same pixel value still disagree."* Before this
 * pair existed, `Text` took a number and shipped no leading at all, and 757
 * call sites had typed one.
 *
 * The curve tightens as the size grows — body at 1.5 is comfortable, a 36px
 * heading at 1.5 has a hole through the middle of it — and every value is even,
 * so a stack of text lands on the half-grid.
 */
export declare const rnLineHeight: {
    readonly "2xs": 16;
    readonly xs: 18;
    readonly sm: 20;
    readonly md: 24;
    readonly lg: 26;
    readonly xl: 30;
    readonly "2xl": 36;
    readonly "3xl": 44;
};
export type RnSpaceStep = keyof typeof rnSpace;
export type RnRadiusStep = keyof typeof rnRadius;
export type RnRadiusRole = keyof typeof rnRadiusRoles;
export type RnTextSize = keyof typeof rnFontSize;
//# sourceMappingURL=rn.d.ts.map