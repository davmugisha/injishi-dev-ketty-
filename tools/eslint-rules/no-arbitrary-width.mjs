/**
 * `injishi/no-arbitrary-width` — a page width is one of six names.
 *
 * ADR-027 counted **31 distinct `max-w-*` values** in `apps/web`, twelve of them
 * hand-typed. The visible consequence is that page bands do not line up down
 * the page: a hero constrained to 1120px sits above a band at `max-w-5xl`
 * (1024px) above a caption at 760px, and the left edge walks.
 *
 * Six names replace them, in the `--container-*` namespace so each is an
 * ordinary `max-w-*` utility:
 *
 *   max-w-page 70rem · max-w-wide 52.5rem · max-w-read 42rem
 *   max-w-narrow 32rem · max-w-form 28rem · max-w-tile 25rem
 *
 * Three of the six deliberately equal a stock Tailwind width, and ADR-027 says
 * why that is the point rather than an oversight: *"The value is not what makes
 * a width enforceable; the NAME is. `max-w-read` says why it was chosen and can
 * be re-tuned in one place, and `max-w-2xl` says nothing."*
 *
 * So this rule refuses BOTH shapes — the hand-typed `max-w-[760px]` and the
 * stock `max-w-2xl` — because a rule that took only the first would leave the
 * scale at nine names and re-tuning still impossible. ADR-034's Verify plants
 * `max-w-3xl` and expects it to fail, which settles the question ADR-027's own
 * rule table left half-open.
 *
 * WHAT STAYS LEGAL, and this list is most of what makes the rule survivable:
 *
 *   max-w-none, max-w-full, max-w-screen-*  not a container size
 *   max-w-prose, max-w-[46ch]               a READING MEASURE — a line length,
 *                                           which is a different question
 *   max-w-[100%], max-w-[90vw]              a RELATIONSHIP — describes
 *   max-w-[min(920px,calc(100vw-3rem))]     behaviour rather than picking a
 *                                           value
 *   max-w-(--container-page)                the paren form, Tailwind 4's
 *                                           spelling for a raw variable
 *
 * ADR-027 names the first three as its exceptions 2 and 3. They are shapes, not
 * a file list, so they stay legal everywhere rather than in an exempted file.
 *
 * NOT IN SCOPE: bare `w-[…]`. ADR-027's rule table names it, and building it
 * that way flagged carousel items and icon boxes — fixed-size elements that are
 * not page widths and have no named replacement. ADR-028 learned the general
 * lesson the hard way and wrote it down: *"A rule that fails the build on
 * correct code is a rule the team turns off, and that takes the cases that do
 * matter down with it."* The concept this rule enforces is the page width, and
 * every row of ADR-027 section 4's own table is a `max-w`.
 *
 * THE `native` HALF (mobile spec 0002, D-z) answers the question this half
 * declined, because on the phone it has an answer. A phone has no page width;
 * what it has is fixed boxes, the touch floor, an icon tile, a thumbnail, and
 * the kit names every one of them in `src/components/ui/metrics.ts` (D-m), on
 * the 4 px grid `rnSpace` steps (D-v). So a carousel item and an icon box DO
 * have a named replacement here, and the native half refuses:
 *
 *   w-[88px], min-h-[52px], size-[72px]  a dimension in brackets
 *   width: 50, minHeight: 22             a number in a style object, for
 *                                        width, height, their minimums and
 *                                        maximums, and flexBasis
 *
 * and it keeps what stays legal everywhere: a relationship (`w-[31%]`,
 * `width: "100%"`, `calc()`), a grid step class (`w-12`, `h-0.5`, Tailwind's
 * spacing, which equals `rnSpace`), `0`, and any value read from a name.
 * Where a refused size sits on the grid, the message names the grid class.
 * `native: true` turns the page width half off unless a config names it.
 */

import { filenameOf } from './native-vocabulary.mjs';
import { isExemptFile, looksLikeClasses, splitVariants, stripOpacity, tokens, walkStrings } from './shared-strings.mjs';

/** `w-[88px]`, `max-h-[60px]`, `size-[72px]`: a dimension in brackets. */
const NATIVE_ARBITRARY = /^((?:(?:min|max)-)?(?:w|h)|size)-\[(.+)\]$/;

/** Style keys that carry a dimension. */
const DIMENSION_KEYS = new Set(['width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'flexBasis']);

/** `rnSpace` (`packages/design-tokens/src/rn.ts`): step -> px. */
const RN_SPACE = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 };

/** The kit's own dimension names, where a refused size most likely belongs. */
const METRICS_FILE = 'src/components/ui/metrics.ts';

/** A number in px from `52px`, `3.25rem` or a bare `52`; null for any other unit. */
function nativePx(inner) {
  const m = /^(-?[0-9.]+)(px|rem)?$/.exec(inner);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return m[2] === 'rem' ? n * 16 : n;
}

/** Tailwind's stock half steps, 2 to 14 px. Above them the grid is whole steps of 4. */
const HALF_STEPS = new Set([0.5, 1.5, 2.5, 3.5]);

/** The grid class for `px` on `prefix`, when it sits on the 4 px grid. */
function gridClass(prefix, px) {
  if (px === null || px < 0) return null;
  const step = px / 4;
  if (!Number.isInteger(step) && !HALF_STEPS.has(step)) return null;
  return `${prefix}-${step}`;
}

function rnSpaceStep(px) {
  const hit = Object.entries(RN_SPACE).find(([, value]) => value === px);
  return hit ? hit[0] : null;
}

/** The phone's half: brackets in class strings, numbers in style objects. */
function nativeListeners(context) {
  const inMetrics = filenameOf(context).endsWith(METRICS_FILE);
  return {
    ...walkStrings((value, node) => {
      if (!looksLikeClasses(value)) return;
      for (const token of tokens(value)) {
        const bare = stripOpacity(splitVariants(token).base);
        const match = NATIVE_ARBITRARY.exec(bare);
        if (!match) continue;
        const [, prefix, inner] = match;
        if (inner.startsWith('--') || isRelationshipOrMeasure(inner)) continue;
        const px = nativePx(inner);
        if (px === 0) continue;
        const grid = gridClass(prefix, px);
        context.report({
          node,
          messageId: 'nativeClass',
          data: {
            actual: bare,
            fix: grid
              ? `It sits on the 4 px grid: write \`${grid}\`.`
              : `Name it in \`${METRICS_FILE}\` and set it from there.`,
          },
        });
      }
    }),

    Property(node) {
      if (inMetrics || node.parent?.type !== 'ObjectExpression') return;
      const key = node.key?.type === 'Identifier' && !node.computed ? node.key.name : node.key?.value;
      if (!DIMENSION_KEYS.has(key)) return;
      const value = node.value;
      if (value?.type !== 'Literal' || typeof value.value !== 'number' || value.value === 0) return;
      const step = rnSpaceStep(value.value);
      context.report({
        node: value,
        messageId: 'nativeStyle',
        data: {
          key,
          actual: String(value.value),
          fix: step ? `It is a grid step: \`rnSpace[${step}]\`.` : `Name it in \`${METRICS_FILE}\`.`,
        },
      });
    },
  };
}

/** The six names ADR-027 section 4 establishes. */
const CONTAINERS = ['page', 'wide', 'read', 'narrow', 'form', 'tile'];

/** Stock Tailwind container steps. Legal Tailwind, refused vocabulary. */
const STOCK = new Set(['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl']);

/** Names that are not a container size at all and are always legal. */
const NOT_A_WIDTH = new Set(['none', 'full', 'min', 'max', 'fit', 'prose']);

/** `max-w-[…]` — capture what is inside the brackets. */
const ARBITRARY = /^max-w-\[(.+)\]$/;

/** `max-w-<name>` with no brackets or parentheses. */
const NAMED = /^max-w-([a-z0-9-]+)$/;

/**
 * A reading measure or a relationship, both of which stay.
 *
 * `ch` is a line length. `%`, `vw`, `vh`, `dvh`, `svh` and any `min()`,
 * `max()`, `clamp()` or `calc()` describe how the box behaves against something
 * else, rather than choosing a number, so no name could replace them.
 */
function isRelationshipOrMeasure(inner) {
  if (/\d(ch)$/.test(inner)) return true;
  if (/\d(%|vw|vh|dvw|dvh|svw|svh|lvw|lvh)$/.test(inner)) return true;
  if (/^(min|max|clamp|calc)\(/.test(inner)) return true;
  // `--container-page` in brackets is the v3 spelling and fails SILENTLY on
  // Tailwind 4, so it is refused rather than waved through as a variable.
  return false;
}

/** The px value of a hand-typed width, when it has one, for the suggestion. */
function pxOf(inner) {
  const m = /^(-?[0-9.]+)(px|rem)$/.exec(inner);
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === 'rem' ? n * 16 : n;
}

/** The ADR-027 section 4 absorb table, as the nearest name at or above. */
const ABSORB = [
  [400, 'tile'],
  [448, 'form'],
  [512, 'narrow'],
  [672, 'read'],
  [840, 'wide'],
  [Infinity, 'page'],
];

/** Stock step -> the name ADR-027 folds it into. */
const STOCK_ABSORB = {
  '3xs': 'tile',
  '2xs': 'tile',
  xs: 'tile',
  sm: 'tile',
  md: 'form',
  lg: 'narrow',
  xl: 'narrow',
  '2xl': 'read',
  '3xl': 'wide',
  '4xl': 'wide',
  '5xl': 'page',
  '6xl': 'page',
  '7xl': 'page',
};

function nearestName(px) {
  if (px === null) return 'page';
  for (const [ceiling, name] of ABSORB) if (px <= ceiling) return name;
  return 'page';
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require one of the six named page widths. A width chosen by number cannot be re-tuned and does not line up with the band above it.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          native: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      nativeClass:
        '`{{actual}}` is a size typed by hand. {{fix}} A size on the phone is a grid step or a name in `metrics.ts`, so it can be re-tuned in one place (mobile spec 0002, D-m, D-v). A relationship (`%`, `calc()`) stays legal.',
      nativeStyle:
        '`{{key}}: {{actual}}` is a size typed by hand. {{fix}} Every fixed dimension reads `metrics` or a step of `rnSpace`, so it can be re-tuned in one place (mobile spec 0002, D-m, D-v).',
      arbitrary:
        'Use `max-w-{{name}}` instead of `{{actual}}`. Six named page widths replace thirty-one (ADR-027 §4): {{names}}. A reading measure (`ch`, `max-w-prose`) or a relationship (`%`, `vw`, `min()`, `calc()`) is not a page width and stays legal.',
      stock:
        'Use `max-w-{{name}}` instead of `{{actual}}`. A stock step is legal Tailwind and refused vocabulary: `max-w-read` says why the width was chosen and can be re-tuned in one place, `{{actual}}` says nothing (ADR-027 §4).',
      bracketVariable:
        'Tailwind 4 spells a raw variable with PARENTHESES: `max-w-(--container-page)`. `{{actual}}` is the v3 spelling and fails SILENTLY on 4.3.2 — no rule is emitted and the element renders unconstrained. Prefer the named utility.',
    },
  },

  create(context) {
    if (isExemptFile(context)) return {};
    const options = context.options[0] ?? {};
    return options.native === true ? nativeListeners(context) : webListeners(context);
  },
};

/** The web half: the six page widths. */
function webListeners(context) {
  const names = CONTAINERS.map((n) => `max-w-${n}`).join(', ');

  return walkStrings((value, node) => {
    if (!looksLikeClasses(value)) return;
    for (const token of tokens(value)) {
      const base = stripOpacity(splitVariants(token).base);

      const arbitrary = ARBITRARY.exec(base);
      if (arbitrary) {
        const inner = arbitrary[1];
        if (inner.startsWith('--')) {
          context.report({ node, messageId: 'bracketVariable', data: { actual: base } });
          continue;
        }
        if (isRelationshipOrMeasure(inner)) continue;
        context.report({
          node,
          messageId: 'arbitrary',
          data: { actual: base, name: nearestName(pxOf(inner)), names },
        });
        continue;
      }

      const named = NAMED.exec(base);
      if (!named) continue;
      const step = named[1];
      if (CONTAINERS.includes(step) || NOT_A_WIDTH.has(step)) continue;
      if (step.startsWith('screen-')) continue;
      if (!STOCK.has(step)) continue;
      context.report({
        node,
        messageId: 'stock',
        data: { actual: base, name: STOCK_ABSORB[step] },
      });
    }
  });
}

export default rule;
