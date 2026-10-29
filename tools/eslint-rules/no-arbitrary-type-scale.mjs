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
 *
 * THE `native` HALF is the phone that replaced that app on 2026-10-14 (mobile
 * spec 0002, D-z), and it is a third shape rather than an edit to the second,
 * because the second still has callers: `apps/web`'s planted controls assert it
 * with the defaults on. The new app has no `<Text size>` at all. Its `Text`
 * takes a ROLE from the type table (`display` to `micro`, D-i), which brings
 * the size, the leading, the Figtree weight and the growth cap together, and
 * `text.tsx` is the one file that turns a role into a `fontSize`. So the
 * native half refuses every other way to set a size:
 *
 *   text-[13px]            a hand typed size
 *   text-sm, text-2xl      Tailwind's steps, which Uniwind compiles and the
 *                          phone's scale does not share (`xl` is 20 there, 22
 *                          here), each a size with no role behind it
 *   fontSize: anything     outside `text.tsx`, even `rnFontSize.md`: a step
 *                          read without its role still ships no leading
 *
 * `native: true` turns the other two halves off unless a config names them,
 * because `text-sm` is a web step and a phone violation, and one string cannot
 * be both.
 */

import { filenameOf } from './native-vocabulary.mjs';
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

/** Tailwind's type steps, plus web's `2xs`, in px: on the phone each is a size with no role. */
const STOCK_TEXT = /^text-(2xs|xs|sm|base|lg|xl|[2-9]xl)$/;
const STOCK_TEXT_PX = {
  '2xs': 11,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
  '7xl': 72,
  '8xl': 96,
  '9xl': 128,
};

/**
 * The phone's type table (`textRoles` in `apps/mobile/src/components/ui/text.tsx`): each
 * role at its `rnFontSize` step. `body` and `headline` share 16; the suggestion names
 * `body`, and the author picks the weight.
 */
const NATIVE_ROLES = [
  ['micro', 11],
  ['caption', 12],
  ['callout', 14],
  ['body', 16],
  ['title3', 18],
  ['title2', 22],
  ['title1', 28],
  ['display', 36],
];
const STEP_ROLE = {
  '2xs': 'micro',
  xs: 'caption',
  sm: 'callout',
  md: 'body',
  lg: 'title3',
  xl: 'title2',
  '2xl': 'title1',
  '3xl': 'display',
};

/** The kit file that alone turns a role into a `fontSize`. */
const TEXT_FILE = 'src/components/ui/text.tsx';

/** Chain a listener onto one a previous half already registered. */
function on(listeners, key, fn) {
  const prev = listeners[key];
  listeners[key] = prev
    ? (node) => {
        prev(node);
        fn(node);
      }
    : fn;
}

/** The role a `fontSize` value was reaching for: a literal's nearest, `rnFontSize.x`'s own. */
function roleForValue(value) {
  if (value?.type === 'Literal' && typeof value.value === 'number') return nearestStep(value.value, NATIVE_ROLES);
  if (value?.type === 'MemberExpression' && value.object?.type === 'Identifier' && value.object.name === 'rnFontSize') {
    const step = value.property?.type === 'Identifier' && !value.computed ? value.property.name : value.property?.value;
    if (STEP_ROLE[step]) return STEP_ROLE[step];
  }
  return 'body';
}

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
          native: { type: 'boolean' },
          textFile: { type: 'string' },
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
      nativeClass:
        "Draw this text with `<Text role=\"{{role}}\">` instead of `{{actual}}`. On the phone a size comes with its role from the type table, with the leading, the Figtree weight and the growth cap that belong to it (mobile spec 0002, D-i to D-k); a class sets a size alone, and Tailwind's steps are not the phone's.",
      nativeFontSize:
        "`fontSize` is set in one place, `{{textFile}}`. Draw this text with `<Text role=\"{{role}}\">`, or spread `roleText(\"{{role}}\")` on a kit part that labels HeroUI's own text (mobile spec 0002, D-i): a size set anywhere else ships without its leading and its growth cap.",
    },
  },

  create(context) {
    if (isExemptFile(context)) return {};
    const options = context.options[0] ?? {};
    const native = options.native === true;
    const web = options.web ?? !native;
    const mobile = options.mobile ?? !native;

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
      for (const [key, fn] of Object.entries(stringVisitors)) on(listeners, key, fn);
    }

    if (mobile) {
      /** `<Text size={13}>` — a number where the scale expects a name. */
      on(listeners, 'JSXAttribute', (node) => {
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
      });

      /** `fontSize: 13` in a StyleSheet or an inline style object. */
      on(listeners, 'Property', (node) => {
        const key = node.key?.type === 'Identifier' ? node.key.name : node.key?.value;
        if (!RN_SIZE_KEYS.has(key)) return;
        const value = node.value;
        if (value?.type !== 'Literal' || typeof value.value !== 'number') return;
        context.report({
          node: value,
          messageId: 'numericFontSize',
          data: { actual: String(value.value), step: nearestStep(value.value, SNAP_MOBILE) },
        });
      });
    }

    if (native) {
      const textFile = options.textFile ?? TEXT_FILE;
      const isTextFile = filenameOf(context).endsWith(textFile);

      /** `text-[13px]` and `text-sm`, in every string the file holds. */
      const stringVisitors = walkStrings((value, node) => {
        if (!looksLikeClasses(value)) return;
        for (const token of tokens(value)) {
          const bare = stripOpacity(splitVariants(token).base);
          const arbitrary = ARBITRARY_TEXT.exec(bare);
          const stock = arbitrary ? null : STOCK_TEXT.exec(bare);
          if (!arbitrary && !stock) continue;
          const px = arbitrary ? toPx(arbitrary[1], arbitrary[2]) : STOCK_TEXT_PX[stock[1]];
          context.report({
            node,
            messageId: 'nativeClass',
            data: { actual: bare, role: px === null ? 'body' : nearestStep(px, NATIVE_ROLES) },
          });
        }
      });
      for (const [key, fn] of Object.entries(stringVisitors)) on(listeners, key, fn);

      /** `fontSize:` in any object, whatever its value, outside the type table's file. */
      on(listeners, 'Property', (node) => {
        if (isTextFile || node.parent?.type !== 'ObjectExpression') return;
        const key = node.key?.type === 'Identifier' && !node.computed ? node.key.name : node.key?.value;
        if (!RN_SIZE_KEYS.has(key)) return;
        context.report({
          node,
          messageId: 'nativeFontSize',
          data: { textFile, role: roleForValue(node.value) },
        });
      });
    }

    return listeners;
  },
};

export default rule;
