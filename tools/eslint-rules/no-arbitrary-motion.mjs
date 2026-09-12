/**
 * `injishi/no-arbitrary-motion` — a duration and a curve are chosen from the
 * scale, never typed by hand.
 *
 * This is `no-arbitrary-type-scale`'s twin, one dimension over, and it exists
 * for the reason that rule's own history proves: ADR-027 wrote the type scale
 * down, `ui-rules.md` said it was enforced, and a month later `apps/web` still
 * held 163 hand-typed sizes, because a vocabulary nobody can break by accident
 * is the only kind that survives. [ADR-046](046-motion-and-state-vocabulary.md)
 * added the motion scale and recorded that it shipped with no rule behind it.
 * This is the rule.
 *
 * What the scale is (`ui-tokens.md` § Motion, authored in
 * `packages/design-tokens/src/motion.ts`): five durations named for what they
 * are FOR — `instant` 120ms, `quick` 180, `settle` 240, `travel` 320, `arrive`
 * 480 — and four curves named for how a thing MOVES: `settle`, `leave`, `move`,
 * `spring`.
 *
 * What this catches, in every string in the file rather than in a `className`
 * attribute (the shared walker's reason applies unchanged — this codebase
 * builds classes in ternaries, class maps and `cn()` arguments):
 *
 *   duration-300      a number nobody can re-tune, and one nobody chose: it is
 *                     Tailwind's, not this product's
 *   duration-[220ms]  the same, spelled longer
 *   ease-in-out       a stock curve. `ease-settle` says what it is for
 *   ease-[cubic-bezier(…)]
 *
 * THREE THINGS IT DELIBERATELY ALLOWS:
 *
 *  - `duration-0`. Turning a transition off is a decision, not a value, and no
 *    named step can express it.
 *  - `ease-linear` and `duration-*` INSIDE `packages/ui`'s HeroUI adapters is
 *    not special-cased — the package is on the same vocabulary as the apps, and
 *    its own overlay timings are exactly what ADR-046 wants re-tuned centrally.
 *    Report them; they are a count, not a pardon.
 *  - The `motion-safe:` / `motion-reduce:` variants, which say WHEN rather than
 *    how long. `splitVariants` already reduces a token to its base, so
 *    `motion-reduce:duration-0` is read as `duration-0` and allowed.
 *
 * The React Native half is deliberately NOT written yet, and the option
 * defaults to off. Mobile's durations are numbers passed to Reanimated
 * (`withTiming(1, { duration: MOTION_MS / 2 })`), where the arithmetic on a
 * token is idiomatic and a bare number is not always a violation. Naming that
 * shape correctly needs the mobile half of the scale to exist first (ADR-046
 * leaves `apps/mobile` reading `motionMs.travel` and nothing else).
 */

import { isExemptFile, looksLikeClasses, splitVariants, stripOpacity, tokens, walkStrings } from './shared-strings.mjs';

/** `duration-300`, `duration-[220ms]`. */
const DURATION = /^duration-(\[[^\]]+\]|\d+)$/;

/** `ease-in`, `ease-out`, `ease-in-out`, `ease-linear`, `ease-[…]`. */
const EASING = /^ease-(in-out|in|out|linear|initial|\[[^\]]+\])$/;

/** The scale, in ms. `ui-tokens.md` § Motion owns these values. */
const STEPS = [
  ['instant', 120],
  ['quick', 180],
  ['settle', 240],
  ['travel', 320],
  ['arrive', 480],
];

/** `220ms`, `0.3s`, `300` (Tailwind's bare number is ms) -> ms, or null. */
function toMs(raw) {
  const text = raw.startsWith('[') ? raw.slice(1, -1) : raw;
  const match = /^(-?[0-9.]+)(ms|s)?$/.exec(text.trim());
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n)) return null;
  return match[2] === 's' ? n * 1000 : n;
}

/** Nearest step, ties rounding UP — slower reads as calmer, never as broken. */
function nearestStep(ms) {
  let best = STEPS[STEPS.length - 1][0];
  let bestDelta = Infinity;
  for (const [name, value] of STEPS) {
    const delta = Math.abs(ms - value);
    if (delta <= bestDelta) {
      bestDelta = delta;
      best = name;
    }
  }
  return best;
}

/**
 * Which named curve a stock one was reaching for.
 *
 * Not a measurement — the point is to name the INTENT the author had, which is
 * the thing a stock curve cannot carry: `ease-out` is what everybody types for
 * "arriving", and `settle` is what arriving is called here.
 */
const CURVE = {
  'ease-out': 'settle',
  'ease-in': 'leave',
  'ease-in-out': 'move',
  'ease-linear': 'move',
  'ease-initial': 'settle',
};

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a named duration and a named easing curve. A hand-typed duration is a number nobody chose and nobody can re-tune; a stock curve says how a thing moves without saying what the movement is for.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          web: { type: 'boolean' },
          mobile: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      duration:
        'Use the named step `duration-{{step}}` instead of `{{actual}}`. The motion scale is five durations named for what they are for (ui-tokens.md § Motion, ADR-046); a number here cannot be re-tuned and says nothing about which moment it serves.',
      easing:
        'Use the named curve `ease-{{curve}}` instead of `{{actual}}`. The four curves are named for how a thing moves — settle (arriving), leave (going), move (here to there), spring (a small win) — so the intent survives a re-tune (ui-tokens.md § Motion, ADR-046).',
    },
  },

  create(context) {
    if (isExemptFile(context)) return {};
    const options = context.options[0] ?? {};
    const web = options.web !== false;
    if (!web) return {};

    return walkStrings((value, node) => {
      if (!looksLikeClasses(value)) return;
      for (const token of tokens(value)) {
        const { base } = splitVariants(token);
        const bare = stripOpacity(base);

        const duration = DURATION.exec(bare);
        if (duration) {
          const ms = toMs(duration[1]);
          // `duration-0` turns a transition off, which no named step can say.
          if (ms === 0) continue;
          context.report({
            node,
            messageId: 'duration',
            data: { actual: bare, step: ms === null ? 'settle' : nearestStep(ms) },
          });
          continue;
        }

        if (EASING.test(bare)) {
          context.report({
            node,
            messageId: 'easing',
            data: { actual: bare, curve: CURVE[bare] ?? 'settle' },
          });
        }
      }
    });
  },
};

export default rule;
