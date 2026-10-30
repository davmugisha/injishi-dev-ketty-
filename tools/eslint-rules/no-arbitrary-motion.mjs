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
 * The `mobile` option was reserved for the app the phone replaced and was
 * never written: its durations were numbers passed to Reanimated, and naming
 * that shape needed the scale to reach React Native first. It has now, as
 * `motionMs` and `easingCurves` read straight from `motion.ts`, and the kit's
 * press motion reads both (mobile spec 0002, D-q). So the React Native half is
 * the `native` option (D-z), and it reads the shapes a phone moves in:
 *
 *   duration: 300                 in any object: Reanimated's `withTiming`,
 *                                 `Animated.timing`, HeroUI's `timingConfig`.
 *                                 `animationDuration` and
 *                                 `transitionDuration` too, and a builder's
 *                                 `FadeIn.duration(300)`
 *   Easing.out(Easing.quad)       a stock curve, reported once at the outside
 *   Easing.bezier(0.2, 0, 0, 1)   a curve typed by its control points
 *   easing: 'ease-in-out'         a curve by its CSS name
 *   damping: 12, stiffness: 90    a spring typed by its physics; the scale's
 *                                 spring is a curve, `easingCurves.spring`
 *   duration-300, ease-in-out     in a class string, which Uniwind does not
 *                                 animate by name on the phone
 *
 * It reads literals only. `motionMs.travel / 2` passes, because arithmetic on a
 * step is idiomatic; so does a constant, because a dwell (how long a toast
 * stays) is not a movement and a name beside its use is the honest fix for
 * it. `duration: 0` passes for the web half's reason. `native: true` turns the
 * web half off unless a config names it.
 */

import { isExemptFile, looksLikeClasses, splitVariants, stripOpacity, tokens, walkStrings } from './shared-strings.mjs';

/** Object keys that carry how long a movement takes. */
const DURATION_KEYS = new Set(['duration', 'animationDuration', 'transitionDuration']);

/** Object keys that carry a curve by name. */
const EASING_KEYS = new Set(['easing', 'animationTimingFunction', 'transitionTimingFunction']);

/** A spring's physics. */
const SPRING_KEYS = new Set(['damping', 'stiffness', 'mass', 'dampingRatio']);

/** The `Easing` members that take a curve rather than being one. */
const CURVE_FACTORIES = new Set(['bezier', 'bezierFn']);

/** Which named curve a stock `Easing` member, or a CSS curve name, was reaching for. */
const NATIVE_CURVE = {
  out: 'settle',
  in: 'leave',
  inOut: 'move',
  linear: 'move',
  ease: 'settle',
  'ease-out': 'settle',
  'ease-in': 'leave',
  'ease-in-out': 'move',
};

/** A number, a negative number, or arithmetic on numbers only: the shapes nobody named. */
function isBareNumber(node) {
  if (node?.type === 'Literal') return typeof node.value === 'number';
  if (node?.type === 'UnaryExpression') return isBareNumber(node.argument);
  if (node?.type === 'BinaryExpression') return isBareNumber(node.left) && isBareNumber(node.right);
  return false;
}

/** A literal duration in ms, from `300`, `'300ms'` or `'0.3s'`; null when it is not one. */
function literalMs(node) {
  if (node?.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node?.type === 'Literal' && typeof node.value === 'string') return toMs(node.value);
  return null;
}

function propertyKey(node) {
  if (node.parent?.type !== 'ObjectExpression') return null;
  if (node.key?.type === 'Identifier' && !node.computed) return node.key.name;
  return typeof node.key?.value === 'string' ? node.key.value : null;
}

/** `Easing.x`, as `x`, or null. */
function easingMember(node) {
  if (node?.type !== 'MemberExpression' || node.computed) return null;
  if (node.object?.type !== 'Identifier' || node.object.name !== 'Easing') return null;
  return node.property?.type === 'Identifier' ? node.property.name : null;
}

/** The identifier a builder chain starts from: `FadeIn` in `FadeIn.duration(300).delay(50)`. */
function chainRoot(node) {
  let current = node;
  while (current) {
    if (current.type === 'MemberExpression') current = current.object;
    else if (current.type === 'CallExpression') current = current.callee;
    else break;
  }
  return current;
}

function short(text) {
  const flat = text.replace(/\s+/g, ' ');
  return flat.length > 48 ? `${flat.slice(0, 45)}...` : flat;
}

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
          native: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      duration:
        'Use the named step `duration-{{step}}` instead of `{{actual}}`. The motion scale is five durations named for what they are for (ui-tokens.md § Motion, ADR-046); a number here cannot be re-tuned and says nothing about which moment it serves.',
      easing:
        'Use the named curve `ease-{{curve}}` instead of `{{actual}}`. The four curves are named for how a thing moves — settle (arriving), leave (going), move (here to there), spring (a small win) — so the intent survives a re-tune (ui-tokens.md § Motion, ADR-046).',
      nativeDuration:
        'Read the duration from `motionMs` instead of `{{actual}}`: `motionMs.{{step}}` is the nearest step. Five durations named for what they are for replace every number (motion.ts, mobile spec 0002 D-q); arithmetic on a step is fine, a bare number is one nobody can re-tune. A dwell rather than a movement (how long a toast stays) is not on the scale: name it beside its use.',
      nativeEasing:
        'Use a named curve, `Easing.bezier(...easingCurves.{{curve}})`, instead of `{{actual}}`. The four curves are named for how a thing moves: settle (arriving), leave (going), move (here to there), spring (a small win) (motion.ts, ADR-046).',
      nativeSpring:
        'A spring typed by its physics (`{{actual}}`) is a curve nobody can re-tune. The scale\'s spring is a curve: `withTiming(to, { duration: motionMs.settle, easing: Easing.bezier(...easingCurves.spring) })` (motion.ts, ADR-046).',
      nativeClass:
        'Move this with Reanimated on a step of `motionMs` and a curve of `easingCurves` instead of `{{actual}}`: the phone has no named motion classes, so a class here is a number or a stock curve (mobile spec 0002, D-z).',
    },
  },

  create(context) {
    if (isExemptFile(context)) return {};
    const options = context.options[0] ?? {};
    const native = options.native === true;
    const web = options.web ?? !native;
    if (native) return nativeListeners(context, web);
    if (!web) return {};
    return webListeners(context);
  },
};

/** The phone's half: literals in objects, `Easing` calls and builder chains, then class strings. */
function nativeListeners(context, alsoWeb) {
  const source = context.sourceCode ?? context.getSourceCode();
  const strings = alsoWeb
    ? webListeners(context)
    : walkStrings((value, node) => {
        if (!looksLikeClasses(value)) return;
        // `easing: "ease-in-out"` is a curve by name, reported by the Property listener below.
        if (node.parent?.type === 'Property' && node.parent.value === node && EASING_KEYS.has(propertyKey(node.parent))) {
          return;
        }
        for (const token of tokens(value)) {
          const bare = stripOpacity(splitVariants(token).base);
          const duration = DURATION.exec(bare);
          if (duration && toMs(duration[1]) === 0) continue;
          if (duration || EASING.test(bare)) {
            context.report({ node, messageId: 'nativeClass', data: { actual: bare } });
          }
        }
      });

  return {
    ...strings,

    Property(node) {
      const key = propertyKey(node);
      if (!key) return;
      const value = node.value;
      if (DURATION_KEYS.has(key)) {
        const ms = literalMs(value);
        if (ms === 0) return;
        if (ms !== null || isBareNumber(value)) {
          context.report({
            node: value,
            messageId: 'nativeDuration',
            data: { actual: short(source.getText(value)), step: ms === null ? 'settle' : nearestStep(ms) },
          });
        }
        return;
      }
      if (EASING_KEYS.has(key) && value?.type === 'Literal' && typeof value.value === 'string') {
        context.report({
          node: value,
          messageId: 'nativeEasing',
          data: { actual: value.value, curve: NATIVE_CURVE[value.value] ?? 'settle' },
        });
        return;
      }
      if (SPRING_KEYS.has(key) && isBareNumber(value)) {
        context.report({ node, messageId: 'nativeSpring', data: { actual: short(source.getText(node)) } });
      }
    },

    CallExpression(node) {
      // `FadeIn.duration(300)`: a layout animation builder, whose chain starts at a
      // capitalised preset or a `new Keyframe(...)`, so `dayjs.duration(3, "d")` is not read.
      const callee = node.callee;
      if (callee?.type === 'MemberExpression' && !callee.computed && callee.property?.name === 'duration') {
        const root = chainRoot(callee.object);
        const builder = root?.type === 'NewExpression' || (root?.type === 'Identifier' && /^[A-Z]/.test(root.name));
        const ms = literalMs(node.arguments[0]);
        if (builder && ms !== null && ms !== 0) {
          context.report({
            node: node.arguments[0],
            messageId: 'nativeDuration',
            data: { actual: short(source.getText(node)), step: nearestStep(ms) },
          });
        }
        return;
      }
      // `Easing.bezier(0.2, 0, 0, 1)`: a curve typed by hand. A spread of `easingCurves.x`,
      // or names destructured from one, pass.
      if (CURVE_FACTORIES.has(easingMember(callee)) && node.arguments.some(isBareNumber)) {
        context.report({
          node,
          messageId: 'nativeEasing',
          data: { actual: short(source.getText(node)), curve: 'settle' },
        });
      }
    },

    MemberExpression(node) {
      const name = easingMember(node);
      if (!name || CURVE_FACTORIES.has(name)) return;
      // Once per expression: `Easing.inOut(Easing.quad)` is one stock curve, reported at
      // `Easing.inOut`, not again at the `Easing.quad` inside it.
      for (let up = node.parent; up; up = up.parent) {
        if (up.type === 'CallExpression' && up.callee !== node && easingMember(up.callee)) return;
      }
      const reported = node.parent?.type === 'CallExpression' && node.parent.callee === node ? node.parent : node;
      context.report({
        node: reported,
        messageId: 'nativeEasing',
        data: { actual: short(source.getText(reported)), curve: NATIVE_CURVE[name] ?? 'settle' },
      });
    },
  };
}

/** The web half: Tailwind's motion classes in every string. */
function webListeners(context) {
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
}

export default rule;
