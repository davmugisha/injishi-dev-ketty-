/**
 * `injishi/no-duplicate-shared-component` — one component vocabulary (ADR-036).
 *
 * The failure this catches is not a bug you can see. `apps/web`, `apps/app` and
 * `@injishi/ui` each carried their own `button.tsx`, and every one of them
 * looked correct on its own. What was wrong only showed up across them: the
 * three disagreed about what a variant is called, how tall a button is, and
 * what shape its corners are.
 *
 * And a copy does not receive fixes. The package's `button.tsx` carried a long
 * comment describing a specific HeroUI trap — pass the built variant string as
 * `className` and the element ends up with two variant classes, with the
 * stylesheet's order picking the winner. Somebody hit that, diagnosed it, fixed
 * it, and wrote down why. `apps/web`'s copy still had the bug months later,
 * live on the sign in screen, where a button asking for `variant="ghost"`
 * rendered `button--primary`. That is the whole argument, and it is why this is
 * a rule rather than a paragraph in AGENTS.md: the paragraph already existed.
 *
 * Three things are refused:
 *
 *  1. A file at `src/components/ui/<name>.tsx` whose `<name>` matches something
 *     `@injishi/ui` exports. The export list is read from the package at rule
 *     load time rather than hardcoded, so the rule cannot drift from it.
 *  2. A raw Tailwind palette class in a `.tsx` file (`bg-green-800`,
 *     `text-slate-500`). ADR-027 call 8 specified this for `apps/web`; ADR-036
 *     call 12 extends it to `apps/app`. These are not merely untidy: the
 *     marketplace stylesheet registers no project ramp, so `text-green-800`
 *     there resolves to Tailwind's stock green, a different hue from the teal
 *     accent it sits beside.
 *  3. A deprecated variant or size alias from ADR-036 calls 3 and 4, as a
 *     WARNING rather than an error. The aliases still work, on purpose, so no
 *     call site broke on the day the copies were deleted. The warning is what
 *     gives their removal a list to work from.
 *
 * It reaches `apps/admin` since ADR-034 moved that app beside the plugin and
 * ADR-040 took it onto the package; there it runs at `warn` until the last of
 * admin's own `components/ui/` copies is deleted (ADR-040 call 7).
 */

import { readdirSync } from 'node:fs';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The components `@injishi/ui` owns, read off disk so this list cannot go
 * stale. Resolved relative to this file: the plugin lives in `injishi/tools/`
 * and the package in `injishi/packages/ui/`.
 *
 * This used to read `injishi/vendor/ui/` and fall back to an EMPTY set when the
 * directory was missing, on the grounds that the mirror might not be synced
 * yet. ADR-034 renamed `vendor/` to `packages/` and the fallback swallowed it:
 * check 1 below matched nothing in any app from that day, silently, and the
 * "0" ADR-040 recorded for `apps/admin` was that, not a count. Found and fixed
 * during ADR-040 phase 2. The package is source now, not a mirror, so a missing
 * directory is a broken checkout and it fails loudly.
 */
function sharedComponentNames() {
  const here = dirname(fileURLToPath(import.meta.url));
  const componentsDir = join(here, '..', '..', 'packages', 'ui', 'src', 'components');
  let files;
  try {
    files = readdirSync(componentsDir);
  } catch (cause) {
    throw new Error(
      `injishi/no-duplicate-shared-component: cannot read ${componentsDir}. ` +
        'The rule needs the @injishi/ui source to know what the package owns.',
      { cause },
    );
  }
  return new Set(files.filter((f) => f.endsWith('.tsx')).map((f) => basename(f, '.tsx')));
}

const SHARED = sharedComponentNames();

/** Tailwind's stock colour ramps. `ink` and `green` are the project's own. */
const STOCK_RAMPS =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|' +
  'teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

const RAW_PALETTE = new RegExp(
  `\\b(?:bg|text|border|ring|from|via|to|decoration|outline|divide|shadow|accent|caret|fill|stroke)-(?:${STOCK_RAMPS})-\\d{2,3}\\b`,
  'g',
);

/** ADR-036 calls 3 and 4. Each still resolves; each is on its way out. */
const DEPRECATED_VARIANT = new Set(['solid', 'accent', 'default']);
const DEPRECATED_SIZE = new Set(['default', 'xs', 'tab', 'icon-xs', 'icon-lg']);

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A component @injishi/ui owns is defined there and nowhere else; ' +
        'colour comes from a role, never from a Tailwind ramp.',
    },
    schema: [],
    messages: {
      duplicate:
        "`{{name}}` is already a component in `@injishi/ui`. Import it from " +
        'there instead of defining a second one here. Two copies drift, and ' +
        'a fix to one never reaches the other (ADR-036 call 1).',
      rawPalette:
        '`{{cls}}` is a raw Tailwind palette class. Use a role instead ' +
        '(`bg-accent`, `text-accent-text`, `text-muted-foreground`). The ' +
        'marketplace stylesheet registers no project ramp, so this resolves ' +
        "to Tailwind's stock colour, not Injishi's (ADR-027 call 2).",
      deprecatedVariant:
        '`variant="{{value}}"` is a deprecated alias for `primary` and is ' +
        'being removed. Say which one you mean (ADR-036 call 3).',
      deprecatedSize:
        '`size="{{value}}"` is a deprecated alias and is being removed. ' +
        'The five sizes are sm, md, lg, icon, icon-sm (ADR-036 call 4).',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename();

    // 1. A local copy of a component the package owns.
    const parts = filename.split(/[\\/]/);
    const uiIndex = parts.lastIndexOf('ui');
    const inComponentsUi =
      uiIndex > 0 && parts[uiIndex - 1] === 'components' && uiIndex === parts.length - 2;

    if (inComponentsUi && extname(filename) === '.tsx') {
      const name = basename(filename, '.tsx');
      if (SHARED.has(name)) {
        return {
          Program(node) {
            context.report({ node, messageId: 'duplicate', data: { name } });
          },
        };
      }
    }

    return {
      // 2. Raw palette classes, wherever a string literal carries them.
      Literal(node) {
        if (typeof node.value !== 'string') return;
        for (const match of node.value.matchAll(RAW_PALETTE)) {
          context.report({ node, messageId: 'rawPalette', data: { cls: match[0] } });
        }
      },

      TemplateElement(node) {
        const raw = node.value?.cooked;
        if (typeof raw !== 'string') return;
        for (const match of raw.matchAll(RAW_PALETTE)) {
          context.report({ node, messageId: 'rawPalette', data: { cls: match[0] } });
        }
      },

      // 3. Deprecated variant and size aliases, as a warning trail.
      //
      // Scoped to `<Button>` deliberately. `default` is a DEPRECATED ALIAS on
      // Button and a REAL VARIANT on Badge, so a rule that reads the attribute
      // without the element renames working code: the first draft of this rule
      // flagged `<Badge variant="default">` in `explore/result-card.tsx`, the
      // fix was applied, and the typecheck caught it. Keeping the element check
      // is what stops that from being a silent edit next time.
      JSXAttribute(node) {
        const attr = node.name?.name;
        if (attr !== 'variant' && attr !== 'size') return;

        const owner = node.parent;
        const ownerName =
          owner?.type === 'JSXOpeningElement' && owner.name?.type === 'JSXIdentifier'
            ? owner.name.name
            : null;
        if (ownerName !== 'Button') return;

        const v = node.value;
        if (!v || v.type !== 'Literal' || typeof v.value !== 'string') return;

        if (attr === 'variant' && DEPRECATED_VARIANT.has(v.value)) {
          context.report({
            node: v,
            messageId: 'deprecatedVariant',
            data: { value: v.value },
          });
        }
        if (attr === 'size' && DEPRECATED_SIZE.has(v.value)) {
          context.report({
            node: v,
            messageId: 'deprecatedSize',
            data: { value: v.value },
          });
        }
      },
    };
  },
};

export default rule;
