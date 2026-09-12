/**
 * `injishi/no-raw-color-classes` — colour is asked for by role, never by ramp
 * step and never by hex.
 *
 * ADR-027 section 1 deletes the legacy palette and keeps the two RAMPS, on
 * purpose: `--ink-*` and `--green-*` are still read by the `@theme inline` map
 * and by `apps/mobile` through the package's TypeScript export. Keeping them
 * opens a loophole, and section 8 says so plainly: without this rule *"an
 * inline `style` prop is a permanent legal route back to brand green, which is
 * precisely the defect `app-shell.tsx` demonstrates today."*
 *
 * That defect is worth restating, because it is the reason the rule reads
 * strings rather than class attributes. The account avatar in the header of
 * **every signed-in screen** was
 * `style={{ background: "linear-gradient(140deg, var(--green-400), var(--green-600))" }}`
 * — a green disc inside teal chrome on every page behind the sign-in boundary,
 * that no `className` audit finds.
 *
 * THREE SHAPES ARE REFUSED, per ADR-027 section 8:
 *
 *   1. A colour utility naming a ramp step: `bg-green-800`, `text-red-500`,
 *      `border-ink-300`. Thirteen prefixes, listed below.
 *   2. A hex literal anywhere in a string.
 *   3. `var(--green-*)` or `var(--ink-*)` anywhere in a string — the loophole
 *      the kept ramps open.
 *
 * MOBILE. React Native has no class names, so shape 1 does not exist there and
 * shapes 2 and 3 collapse into one: a hex literal in a `StyleSheet`, a prop or
 * a constant. `apps/mobile` carried **27 of them outside `src/theme/`**, each a
 * colour the generated palette cannot move and no contrast test measures. The
 * `allowHexIn` option carries the one place hex legitimately lives — the theme
 * directory, where `palette.ts` is generated from the tokens and `tokens.ts`
 * authors the photographic scrims, which are fixed grounds by construction and
 * documented as such at their declaration.
 *
 * HOW HEX IS DETECTED, stated because the naive version is wrong. A six- or
 * eight-digit `#RRGGBB[AA]` is always a colour. A three- or four-digit `#RGB`
 * is also a valid URL fragment — `href="#abc"` — so it is flagged only when the
 * whole string is that and nothing else. That trade misses `"#fff solid"` and
 * keeps every anchor in the codebase legal, which is the right way round: a
 * rule that fails on `href="#faq"` is a rule someone disables.
 */

import { isExemptFile, looksLikeClasses, splitVariants, stripOpacity, tokens, walkStrings } from './shared-strings.mjs';

/** Every utility prefix that paints. ADR-027 §8 lists all thirteen. */
const COLOUR_PREFIXES = [
  'bg',
  'text',
  'border',
  'ring',
  'from',
  'to',
  'via',
  'fill',
  'stroke',
  'outline',
  'decoration',
  'divide',
  'placeholder',
];

/**
 * Stock Tailwind palette names, plus the two Injishi ramps.
 *
 * `ink` and `green` are in this list for the reason section 1 gives: the ramps
 * survive the palette deletion, so `bg-green-800` still COMPILES. A rule that
 * only knew Tailwind's names would let the exact class ADR-027 was written to
 * remove keep working.
 */
const PALETTES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  'ink',
];

const RAMP_CLASS = new RegExp(
  `^(?:${COLOUR_PREFIXES.join('|')})-(?:${PALETTES.join('|')})-(?:50|\\d{2,3})$`,
);

/** `#RRGGBB` or `#RRGGBBAA`, anywhere in a string. */
const HEX_LONG = /#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/;
/** `#RGB` or `#RGBA`, but only as the entire string. */
const HEX_SHORT_WHOLE = /^#[0-9a-fA-F]{3,4}$/;
/** The kept ramps, reached through a raw variable. */
const RAMP_VAR = /var\(\s*--(?:ink|green)-\d{2,3}\s*\)/;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a semantic colour role. A ramp step or a hex literal is a colour the theme cannot move and no contrast measurement covers.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          classes: { type: 'boolean' },
          hex: { type: 'boolean' },
          allowHexIn: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      rampClass:
        'Use a semantic role, not a ramp step: `{{actual}}`. Roles are the only colours the theme can move and the only ones a contrast measurement covers — a fill is `bg-accent text-accent-foreground`, teal as text is `text-accent-text` (ADR-027 §2).',
      hexLiteral:
        'Colour is a token, not a literal: `{{actual}}`. A hex here cannot be moved by regenerating the palette and no contrast test measures it (ui-rules.md; ADR-027 §8).',
      rampVar:
        'A raw ramp variable is the loophole ADR-027 §8 closes: `{{actual}}`. The ramps survive the palette deletion, so `var(--green-600)` in an inline style is a permanent route back to brand green. Use `var(--accent)`.',
    },
  },

  create(context) {
    if (isExemptFile(context)) return {};
    const options = context.options[0] ?? {};
    const checkClasses = options.classes !== false;
    const checkHex = options.hex !== false;
    const allowHexIn = options.allowHexIn ?? [];

    const filename = (context.filename ?? context.getFilename?.() ?? '').replace(/\\/g, '/');
    const hexAllowed = allowHexIn.some((fragment) => filename.includes(fragment));

    return walkStrings((value, node) => {
      if (!looksLikeClasses(value)) return;

      if (checkHex && !hexAllowed) {
        const long = HEX_LONG.exec(value);
        if (long) {
          context.report({ node, messageId: 'hexLiteral', data: { actual: long[0] } });
        } else if (HEX_SHORT_WHOLE.test(value.trim())) {
          context.report({ node, messageId: 'hexLiteral', data: { actual: value.trim() } });
        }
      }

      const rampVar = RAMP_VAR.exec(value);
      if (rampVar) context.report({ node, messageId: 'rampVar', data: { actual: rampVar[0] } });

      if (!checkClasses) return;
      for (const token of tokens(value)) {
        const base = stripOpacity(splitVariants(token).base);
        if (RAMP_CLASS.test(base)) {
          context.report({ node, messageId: 'rampClass', data: { actual: base } });
        }
      }
    });
  },
};

export default rule;
