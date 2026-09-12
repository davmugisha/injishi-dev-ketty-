/**
 * `injishi/no-arbitrary-type-scale` — a type size is chosen from the scale,
 * never typed by hand.
 *
 * ADR-027 measured `apps/web` and found **164 hand-typed font sizes across 24
 * distinct values**, from 9px to 56px, sitting on top of 359 uses of the named
 * scale. The damage is not that any one of them is wrong. It is that two cards
 * side by side disagree by one or two pixels, which reads as sloppiness with no
 * single line to blame it on, and that a hand-typed size ships **no line
 * height** — so two of them at the same pixel value still disagree.
 *
 * The scale is eleven named steps (`ui-tokens.md` § Layout Scale, settled by
 * ADR-034 task 4): seven of Tailwind's own plus `2xs`, `display-sm`,
 * `display-md` and `display-lg`, which `@injishi/design-tokens` authors with a
 * line height each. This rule is what makes those eleven the only answers.
 *
 * TWO SURFACES, TWO SHAPES. The failure is the same on both and it does not
 * look the same:
 *
 *   web    `text-[13px]`      — a Tailwind arbitrary value
 *   mobile `<Text size={13}>` — a number where a token name belongs, and
 *          `fontSize: 13` in a StyleSheet
 *
 * `apps/mobile` carried **745** of the second shape, and its `Text` primitive
 * defaulted to `15`, which is not a step on its own scale — so every `<Text>`
 * written without an explicit size rendered off-scale. Turning that API from a
 * number into a token name is what let this rule reach React Native at all;
 * before that there was nothing here for a rule to check.
 *
 * The `mobile` option selects the second shape. Both are on by default so that
 * a config which forgets the option gets more checking rather than less.
 */

import { isExemptFile, looksLikeClasses, splitVariants, stripOpacity, tokens, walkStrings } from './shared-strings.mjs';

/** `text-[13px]`, `text-[0.625rem]`, `text-[1.2em]` — a length in brackets. */
const ARBITRARY_TEXT = /^text-\[(-?[0-9.]+)(px|rem|em|pt)\]$/;

/**
 * The snap tables, in px. Used only to name the step the author almost
 * certainly meant, so the message carries the fix rather than the complaint.
 *
 * THE TWO SURFACES HAVE DIFFERENT SCALES and the messages must not confuse
 * them. Web is ADR-027 section 3 — eleven steps topping out at `display-lg`,
 * 56px. Mobile is `apps/mobile/src/theme/tokens.ts` — eight steps topping out
 * at `3xl`, 36px, and it names the body step `md` where web names it `base`.
 * Suggesting `fontSize.base` in a React Native file names a token that does not
 * exist, which is worse than suggesting nothing.
 */
const SNAP = [
  ['2xs', 11],
  ['xs', 12],
  ['sm', 14],
  ['base', 16],
  ['lg', 18],
  ['xl', 20],
  ['2xl', 24],
  ['3xl', 30],
  ['display-sm', 32],
  ['display-md', 44],
  ['display-lg', 56],
];

/** 16px base, so a rem is 16 and an em is treated the same at the call site. */
function toPx(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (unit === 'px') return n;
  if (unit === 'pt') return (n * 96) / 72;
  return n * 16;
}

/** `apps/mobile/src/theme/tokens.ts`. Eight steps, and `md` where web says `base`. */
const SNAP_MOBILE = [
  ['2xs', 11],
  ['xs', 12],
  ['sm', 14],
  ['md', 16],
  ['lg', 18],
  ['xl', 22],
  ['2xl', 28],
  ['3xl', 36],
];

/**
 * Nearest step, ties rounding UP.
 *
 * Computed rather than looked up in a band table, because the bands have to
 * agree EXACTLY with `apps/mobile/scripts/codemod-text-size.mjs` — a rule that
 * suggests `sm` where the codemod wrote `md` teaches the next author the wrong
 * answer, and 15px is a tie, and there are 52 of them. Ties round up for the
 * same reason ADR-027 gave for the web scale: at these sizes the risk worth
 * avoiding is text too small to read.
 */
function nearestStep(px, table = SNAP) {
  let best = table[table.length - 1][0];
  let bestDelta = Infinity;
  for (const [name, value] of table) {
    const delta = Math.abs(px - value);
    // `<=` over an ascending table makes a tie pick the LARGER step.
    if (delta <= bestDelta) {
      bestDelta = delta;
      best = name;
    }
  }
  return best;
}

/** React Native prop and style keys that carry a font size. */
const RN_SIZE_KEYS = new Set(['fontSize']);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a named type step. A hand-typed size disagrees with the size beside it by a pixel or two and ships no line height, so two of them at the same value still disagree.',
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
      arbitrary:
        'Use the named step `text-{{step}}` instead of `{{actual}}`. The type scale is eleven named steps and each carries its own line height (ui-tokens.md, ADR-027 §3); a hand-typed size ships none, so two of them at the same pixel value still disagree.',
      numericSize:
        'Pass a token name, not a number: `size="{{step}}"` instead of `size={{{actual}}}`. `Text` takes `keyof fontSize` so the step brings its line height with it (parity.md §5.1); a number is a size nothing measures and nothing can re-tune.',
      numericFontSize:
        'Use a token: `fontSize: fontSize.{{step}}` instead of `fontSize: {{actual}}`. Every size in this app comes from the scale in `src/theme/tokens.ts` (ui-rules.md); a literal here is a step the scale does not know about.',
    },
  },

  create(context) {
    if (isExemptFile(context)) return {};
    const options = context.options[0] ?? {};
    const web = options.web !== false;
    const mobile = options.mobile !== false;

    const listeners = {};

    if (web) {
      const stringVisitors = walkStrings((value, node) => {
        if (!looksLikeClasses(value)) return;
        for (const token of tokens(value)) {
          const { base } = splitVariants(token);
          const match = ARBITRARY_TEXT.exec(stripOpacity(base));
          if (!match) continue;
          const px = toPx(match[1], match[2]);
          context.report({
            node,
            messageId: 'arbitrary',
            data: { actual: base, step: px === null ? 'base' : nearestStep(px) },
          });
        }
      });
      Object.assign(listeners, stringVisitors);
    }

    if (mobile) {
      /** `<Text size={13}>` — a number where the scale expects a name. */
      listeners.JSXAttribute = (node) => {
        if (node.name?.name !== 'size') return;
        const value = node.value;
        if (value?.type !== 'JSXExpressionContainer') return;
        const expr = value.expression;
        if (expr?.type !== 'Literal' || typeof expr.value !== 'number') return;

        // `Icon` and the vector-icon components take a glyph size in device
        // pixels, which is a different thing from a type step: a 20px icon
        // beside 16px text is a deliberate optical match, not an off-scale
        // heading. Only elements whose name IS the type primitive are checked.
        const element = node.parent?.name;
        const elementName =
          element?.type === 'JSXIdentifier'
            ? element.name
            : element?.type === 'JSXMemberExpression'
              ? element.property?.name
              : null;
        if (elementName !== 'Text') return;

        context.report({
          node: expr,
          messageId: 'numericSize',
          data: { actual: String(expr.value), step: nearestStep(expr.value, SNAP_MOBILE) },
        });
      };

      /** `fontSize: 13` in a StyleSheet or an inline style object. */
      listeners.Property = (node) => {
        const key = node.key?.type === 'Identifier' ? node.key.name : node.key?.value;
        if (!RN_SIZE_KEYS.has(key)) return;
        const value = node.value;
        if (value?.type !== 'Literal' || typeof value.value !== 'number') return;
        context.report({
          node: value,
          messageId: 'numericFontSize',
          data: { actual: String(value.value), step: nearestStep(value.value, SNAP_MOBILE) },
        });
      };
    }

    return listeners;
  },
};

export default rule;
