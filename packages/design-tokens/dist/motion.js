"use strict";
/**
 * The motion scale — how long things take, and how they move while they do.
 *
 * New on 2026-09-11. Until this file the product had no motion vocabulary at
 * all: every transition was Tailwind's stock 150ms, HeroUI's own curves, or a
 * number typed at the call site, and `apps/mobile/src/motion.ts` said so in as
 * many words — its 320ms was "the web coverflow's own duration, which the brief
 * names as the value to carry across because `tokens.ts` emits no mobile motion
 * tokens". This is those tokens.
 *
 * WHY MOTION IS A TOKEN AND NOT A TASTE. Timing is how an interface tells a
 * person what just happened to them. A toast that snaps in at 150ms linear and
 * a toast that settles in at 240ms reading as "set down" carry the same text
 * and do not say the same thing. If every builder picks a number, the product
 * speaks in eleven voices; a scale is a refusal to answer the question twice,
 * the same refusal `layout.ts` makes for type and width.
 *
 * Every step is therefore named for what it is FOR, not for how long it is:
 * `settle` can be re-tuned in one place, `duration-[240ms]` never can.
 *
 * THE RULE REDUCED MOTION FOLLOWS is not decided here — `ui-registry.md` owns
 * it: keep colour, opacity and shadow feedback at `instant` and drop only
 * travel and looping animation. A blanket kill also removes the state changes
 * that say hovered, focused, selected or disabled. `@injishi/ui/styles.css`
 * carries that rule for every web consumer; `apps/mobile/src/motion.ts`
 * carries it for React Native.
 *
 * @see ui-tokens.md § Motion, which tabulates this scale.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.easingCurves = exports.motionMs = void 0;
/**
 * Durations, in milliseconds, so React Native can use them as numbers. The CSS
 * emitter appends the unit.
 *
 * The bands follow one principle: the heavier the news, the more time it is
 * given. A press answers inside 200ms or the control feels dead; a confirmation
 * that a booking went through gets a beat longer, because it is worth a beat.
 */
exports.motionMs = {
    /**
     * Colour, opacity, focus and shadow. The state change that must still
     * register when a person has asked for reduced motion.
     */
    instant: 120,
    /** A control answering a press or a hover. */
    quick: 180,
    /** Something arriving in place: a toast, a menu, a dialog, an inline error. */
    settle: 240,
    /** Something crossing the screen: a sheet, a drawer, a carousel slide. */
    travel: 320,
    /**
     * News that deserves a beat: a completed step, a confirmation, a first
     * empty state. Never used for a response to a press.
     */
    arrive: 480,
};
/**
 * Curves, as the four control points of a cubic Bézier, so React Native's
 * `Easing.bezier(...curve)` and CSS's `cubic-bezier()` read one source.
 *
 * There is no linear curve here on purpose. Linear motion is mechanical — the
 * look of a loading bar in a tool nobody chose — and nothing in this product
 * that a person feels should move like it. The skeleton shimmer is the one
 * linear loop, and it belongs to HeroUI.
 */
exports.easingCurves = {
    /**
     * Arriving. Fast at first, then a long soft deceleration, like something
     * set down rather than dropped. The default for everything entering.
     */
    settle: [0.22, 1, 0.36, 1],
    /**
     * Leaving. Gathers a little weight as it goes, so an exit reads as a
     * decision rather than a flicker. Always paired with a SHORTER duration than
     * the entrance: a person has already moved on.
     */
    leave: [0.5, 0, 0.75, 0],
    /**
     * From here to there, when both ends are on screen: a tab indicator, a
     * reordered row. Symmetric, so neither end feels favoured.
     */
    move: [0.65, 0, 0.35, 1],
    /**
     * A small win. Overshoots by a few percent and comes back, like a loose
     * spring. Only for acknowledgement — a checkmark, a saved heart — never for a
     * control, where an overshoot reads as imprecision.
     */
    spring: [0.34, 1.4, 0.64, 1],
};
