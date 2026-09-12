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
 */

import { isExemptFile, looksLikeClasses, splitVariants, stripOpacity, tokens, walkStrings } from './shared-strings.mjs';

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
    schema: [],
    messages: {
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
  },
};

export default rule;
