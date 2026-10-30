/**
 * `injishi/surface-vocabulary` — one surface vocabulary (ADR-037 call 7).
 *
 * ADR-036 made the COMPONENT one thing. This rule is about what sits around
 * it: the corner a surface is drawn with, the size a caller types by hand, the
 * second button system a stylesheet still offers, and the ground that pins the
 * theme one way and then paints itself the other. Each of those had more than
 * one right answer on 2026-09-06, measured in a browser, and a rule is what
 * turns "should" into a count.
 *
 * Four checks, two severities, all read from every STRING in the file, because
 * this codebase writes classes in ternaries, class maps, `cn()` arguments and
 * template literals, not only in a JSX `className`:
 *
 *  1. `deletedCorner` (warn): `rounded-sm|md|lg|xl|2xl|3xl`. ADR-027 call 6
 *     named `rounded`, `rounded-card` and `rounded-full` and deleted the rest;
 *     this is the check that decision never had.
 *  2. `handTypedSize` (warn): `text-[13px]` and friends. The eight named steps
 *     are the scale; a bracket size ships no line height, so two of them at the
 *     same pixel value still disagree. It WARNS rather than errors because the
 *     scale has no 13px step and the operator screens are written at 13px
 *     throughout; that is a type scale decision ADR-037 records as owed, not a
 *     lint outcome. `clamp()` and `vw` sizes are behaviour, not numbers, and
 *     pass.
 *  3. `legacyClass` (error): `btn`, `btn-*`, `badge`, `badge-*` in a class
 *     string. The rules behind them are deleted from `_injishi-app.css`, so a
 *     surviving use renders an unstyled anchor.
 *  4. `refusedGround` (error): a fixed ground token (`bg-white`, `bg-canvas`,
 *     `bg-surface-tint`, `bg-ink`, `bg-black`, `bg-control-wash`) and a
 *     `dark:bg-` on the same class string. The fixed ground re pins the theme
 *     block to one lightness (ADR-028), and the `dark:` twin paints the other,
 *     so every `text-foreground` inside is invisible in dark. That is the
 *     property page title on 2026-09-06.
 *
 * It reads literals only: a class built from a variable is a hole and passes,
 * the same limit ADR-028 recorded for its own rule.
 *
 * THE `native` HALF (mobile spec 0002, D-z) is the same question asked of the
 * phone, where the answer is shorter. Its corners follow the save through
 * HeroUI's `--radius` (D-u), so `rounded-lg` is a corner there, and its type
 * sizes are `no-arbitrary-type-scale`'s. What the phone can get wrong in a
 * surface is the GROUND: a `bg-` that is not one of the surfaces HeroUI Native
 * and the palette define. `bg-muted` paints a text colour as a fill,
 * `bg-foreground` inverts a tile no theme measured, `bg-black/40` is a scrim
 * typed by hand where `bg-backdrop` is the scrim, and `bg-accent/10` invents a
 * soft fill beside the real one, at a contrast nobody checked. The set it
 * allows is read in `native-vocabulary.mjs`, from the palette's generated
 * files and HeroUI's own grounds, so a role the palette adds is allowed the
 * day it is emitted. With `native: true` this rule checks grounds only.
 * `surface-refusals` takes no option: its two refusals are web classes.
 */

import { GROUND_PAIRS, backgroundColourOf } from './native-vocabulary.mjs';
import { splitVariants, stripOpacity, tokens } from './shared-strings.mjs';

const NATIVE_GROUNDS = [...GROUND_PAIRS.keys()].sort();

const DELETED_CORNER = /\brounded-(?:sm|md|lg|xl|2xl|3xl)\b/g;
const HAND_TYPED_SIZE = /\btext-\[\d+(?:\.\d+)?px\]/g;
const LEGACY_CLASS = /(?:^|\s)(btn|badge)(?:-[a-z]+)?(?=\s|$)/g;
const FIXED_GROUND = /(?:^|\s)bg-(?:white|canvas|surface-tint|ink|black|control-wash)(?=\s|$)/;
const DARK_GROUND = /(?:^|\s)dark:bg-[a-z0-9-]+(?:\/\d+)?(?=\s|$)/;

/** Icon names such as `badge-check` are data, not classes. */
const ICON_NAME_ONLY = /^(?:badge|btn)-[a-z-]+$/;

/**
 * One implementation, two rule ids, because ESLint gives a rule one severity
 * and these checks need two. `surface-vocabulary` carries the two COUNTS
 * (corners, sizes) at warn; `surface-refusals` carries the two things that
 * render wrong on screen (legacy class, refused ground) at error.
 */
function makeRule(kind) {
const counts = kind === 'counts';
const refusals = kind === 'refusals';
/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Three corners, a named type step, the shared Button and Badge, and a ' +
        'ground that agrees with its theme: the surface vocabulary (ADR-037).',
    },
    schema: counts
      ? [
          {
            type: 'object',
            properties: { native: { type: 'boolean' } },
            additionalProperties: false,
          },
        ]
      : [],
    messages: {
      nativeGround:
        '`{{cls}}` is not a ground on the phone. Paint one of the surfaces HeroUI Native and the palette define: ' +
        '{{grounds}} (mobile spec 0002, D-z). `bg-pressed` is the kit\'s press layer, `bg-backdrop` the scrim.',
      nativeOpacity:
        '`{{cls}}` is a ground at an opacity: a colour the palette never measured for contrast (D-c). ' +
        'Use {{fix}} (mobile spec 0002, D-z).',
      deletedCorner:
        '`{{cls}}` is not a corner in this product. Use `rounded` for a ' +
        'control, `rounded-card` for a surface, `rounded-full` for a pill ' +
        '(ADR-027 call 6, ADR-037 call 7).',
      handTypedSize:
        '`{{cls}}` is a hand typed size and ships no line height. Use a named ' +
        'step: text-2xs, text-xs, text-sm, text-base, text-lg, text-xl, ' +
        'text-2xl, text-3xl, text-display-sm, text-display-md, ' +
        'text-display-lg (ADR-027 call 4, ADR-037 call 7).',
      legacyClass:
        '`{{cls}}` is a deleted class: the `.btn` and `.badge` rules are gone ' +
        'from `_injishi-app.css`. Render `Button` or `Badge` from `@injishi/ui` ' +
        '(ADR-037 call 2).',
      refusedGround:
        'A fixed ground with a `dark:bg-` twin. The fixed class pins the theme ' +
        'block to one lightness and the twin paints the other, so every ' +
        'theme role inside is unreadable in dark. Use `bg-background` or ' +
        '`bg-card`, which invert on their own (ADR-028 call 3, ADR-037 call 6).',
    },
  },

  create(context) {
    const native = counts && context.options[0]?.native === true;

    /** The phone's half: every `bg-` names a ground the palette defines, at full strength. */
    function checkGrounds(node, value) {
      for (const token of tokens(value)) {
        const { base } = splitVariants(token);
        if (!base.startsWith('bg-')) continue;
        const solid = stripOpacity(base);
        const colour = backgroundColourOf(solid.slice(3));
        if (!colour) continue;
        if (!GROUND_PAIRS.has(colour)) {
          context.report({ node, messageId: 'nativeGround', data: { cls: base, grounds: NATIVE_GROUNDS.join(', ') } });
        } else if (solid !== base) {
          const soft = GROUND_PAIRS.has(`${colour}-soft`) ? `\`bg-${colour}-soft\`, its soft fill` : null;
          context.report({
            node,
            messageId: 'nativeOpacity',
            data: { cls: base, fix: soft ?? '`bg-backdrop` for a scrim, or a ground at full strength' },
          });
        }
      }
    }

    function check(node, value) {
      if (typeof value !== 'string' || value.length < 4) return;
      if (native) {
        checkGrounds(node, value);
        return;
      }

      // Refused ground: one string carrying both halves.
      if (refusals && FIXED_GROUND.test(value) && DARK_GROUND.test(value)) {
        context.report({ node, messageId: 'refusedGround' });
      }

      if (counts) for (const m of value.matchAll(DELETED_CORNER)) {
        context.report({ node, messageId: 'deletedCorner', data: { cls: m[0] } });
      }
      if (counts) for (const m of value.matchAll(HAND_TYPED_SIZE)) {
        context.report({ node, messageId: 'handTypedSize', data: { cls: m[0] } });
      }
      if (refusals && !ICON_NAME_ONLY.test(value.trim())) {
        for (const m of value.matchAll(LEGACY_CLASS)) {
          context.report({ node, messageId: 'legacyClass', data: { cls: m[0].trim() } });
        }
      }
    }

    return {
      Literal(node) {
        check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

return rule;
}

export const surfaceVocabulary = makeRule('counts');
export const surfaceRefusals = makeRule('refusals');
export default surfaceVocabulary;
