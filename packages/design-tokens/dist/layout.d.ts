/**
 * The layout scale — type steps, page widths, spacing rhythm.
 *
 * New in this checkout. ADR-027 specified all of it and `ui-tokens.md` has
 * tabulated it since, but no file ever defined it: `layout.ts` lived on the
 * other side of the `injishi.managed` mirror and never crossed. ADR-034 task 4
 * adds it here, which is the first time `text-2xs` or `max-w-page` resolves to
 * anything in this repository.
 *
 * WHAT THIS FILE IS FOR. Colour was never the hard part of a design system.
 * The hard part is that a builder reaching for "slightly bigger than body" has
 * infinite choices and picks a different one each time, and three years later
 * the product has 24 type sizes and eleven page widths and no two headings
 * agree. A scale is a refusal to answer that question twice. Everything here
 * is therefore a NAME first and a value second — `max-w-read` says why the
 * width was chosen and can be re-tuned in one place; `max-w-2xl` says nothing
 * and can never be re-tuned at all.
 *
 * Every token lands in a Tailwind 4 theme namespace, so every one is an
 * ordinary utility. There is no bracket syntax and no `var()` at a call site.
 *
 * THE COUNT, SETTLED. `ui-rules.md` says "eight named type steps" and then
 * lists eleven, and ADR-034 task 4 is the place that resolves it. The answer is
 * **eleven steps, four of them authored here.** Tailwind ships seven usable
 * named steps (`xs` through `3xl`) and 359 call sites already read correctly on
 * them; replacing those would be churn with no gain. What Tailwind does not
 * serve is either end of the range — the uppercase eyebrow below `xs`, and the
 * three display sizes above `3xl` — and that gap is where all 24 hand-typed
 * sizes came from. So four steps are added, not eleven authored.
 *
 * @see ADR-027 sections 3-5 and 7, which own this scale.
 * @see ui-tokens.md § Layout Scale, which tabulates it.
 */
/**
 * A type step: a size and the leading that belongs to it.
 *
 * The leading is not optional and that is the whole point. `ui-rules.md`:
 * *"A hand-typed size also ships no line height, so two of them at the same
 * pixel value still disagree."* A display size shipped without one is a hero
 * every builder has to guess at.
 */
export type TypeStep = Readonly<{
    size: string;
    lineHeight: string;
}>;
/**
 * The four steps ADDED to Tailwind's named scale.
 *
 * Tailwind 4 pairs a leading with a size by writing a SECOND token whose name
 * ends `--line-height`, with TWO dashes: `--text-display-lg--line-height`. One
 * dash registers an unrelated token and the size ships with no leading at all,
 * silently. The emitter writes both keys for every step here so that spelling
 * is made once, in one place, rather than at four declarations.
 */
export declare const typeSteps: {
    /** The uppercase eyebrow and badge caps. Below Tailwind's `xs`. */
    readonly "2xs": {
        readonly size: "0.6875rem";
        readonly lineHeight: "1.4";
    };
    /** A section heading. */
    readonly "display-sm": {
        readonly size: "2rem";
        readonly lineHeight: "1.2";
    };
    /** A page heading. */
    readonly "display-md": {
        readonly size: "2.75rem";
        readonly lineHeight: "1.1";
    };
    /** A hero. */
    readonly "display-lg": {
        readonly size: "3.5rem";
        readonly lineHeight: "1.05";
    };
};
/**
 * The full vocabulary a builder chooses from — the four above plus Tailwind's
 * seven. This is the allow-list `injishi/no-arbitrary-type-scale` enforces, so
 * it is exported rather than retyped in the rule: a step added here becomes
 * legal at a call site in the same commit, and one removed fails the build.
 */
export declare const typeScale: readonly ["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "display-sm", "display-md", "display-lg"];
/**
 * Six page widths, in the `--container-*` namespace because that is the
 * namespace `max-w-*` reads from, so each is a first-class utility.
 *
 * Three of the six equal a stock Tailwind width, and that is the point rather
 * than an oversight. The value is not what makes a width enforceable; the NAME
 * is.
 *
 * `max-w-none`, `max-w-prose` and any `ch` measure are NOT widths in this sense
 * — they express a line length, which is a different question — and they stay
 * legal.
 */
export declare const containers: {
    /** The page shell. 1120px. */
    readonly page: "70rem";
    /** A wide content band. 840px. */
    readonly wide: "52.5rem";
    /** Prose and guides. 672px. */
    readonly read: "42rem";
    /** A single-column panel. 512px. */
    readonly narrow: "32rem";
    /** Forms, dialogs, empty states. 448px. */
    readonly form: "28rem";
    /** A caption beside or under a heading. 400px. */
    readonly tile: "25rem";
};
/**
 * Three spacing steps, in the `--spacing-*` namespace, so each produces the
 * whole utility family at once: `p-inset`, `px-inset`, `py-band`, `gap-block`,
 * `mt-band`, `space-y-block`.
 *
 * This is a rhythm, NOT a ban on the numeric scale. `gap-2` between two chips
 * is still right and no lint rule touches it. What the rhythm exists to stop is
 * a band padded `py-16` above a band padded `py-12`.
 */
export declare const rhythm: {
    /** Between page bands. 64px. */
    readonly band: "4rem";
    /** Between blocks inside a band. 24px. */
    readonly block: "1.5rem";
    /** Padding inside a card or panel. 16px. */
    readonly inset: "1rem";
};
export type TypeStepName = (typeof typeScale)[number];
export type ContainerName = keyof typeof containers;
export type RhythmName = keyof typeof rhythm;
//# sourceMappingURL=layout.d.ts.map