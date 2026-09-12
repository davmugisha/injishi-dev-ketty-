/**
 * `injishi/ground-foreground-agreement` — a ground and everything drawn on it
 * agree on whether they invert.
 *
 * ADR-028 states the rule in one sentence: **a fixed ground carries fixed
 * foregrounds; a theme-following ground carries theme-following foregrounds;
 * mixing them is a defect in both directions.** "Foreground" means everything
 * drawn on the ground, not only text — `text-*`, `border-*`, `ring-*`,
 * `divide-*`, `fill-*`, `stroke-*`, and any nested `bg-*`. The break that
 * prompted the ADR was a nested background and a border, not a word of text, so
 * a text-only rule would have missed most of it.
 *
 * MOST OF ADR-028 IS CSS, NOT THIS RULE. The fixed-ground pin blocks in
 * `injishi-heroui.css` redeclare all the theme-following roles inside any fixed
 * ground, which handles inheritance at any depth. This rule owns only the two
 * cases CSS cannot see, and it reads a single element's class list rather than
 * attempting parent-to-child analysis:
 *
 *   1. **The mirror case.** A fixed foreground in the same class list as a
 *      theme-following ground — `bg-card text-ink`. CSS cannot repair it,
 *      because the author asked for a specific fixed colour on a surface that
 *      moves, and only a person knows which of the two was wrong.
 *   2. **A variant that strands something** (call 5 and 5a).
 *   3. **`ground-theme` on the ground itself** (call 4a) — one line that reads
 *      like a careful annotation and cancels the thing it annotates.
 *
 * WHY VARIANTS MATTER, and it is mechanical rather than stylistic: the pin
 * selector is the BARE class. A variant compiles to a different class token, so
 * `.bg-ink` does not match an element whose class is `md:bg-ink`. The utility
 * paints the new ground and the theme block stays where it was — a dark panel
 * wearing light text, at that breakpoint only, and nowhere else.
 *
 * The refusal is deliberately NARROWER than "no variant on a fixed ground".
 * ADR-028 built the blunt version first: it flagged ten sites in `apps/web` and
 * **six of them were correct code**, and the ADR wrote down what that teaches —
 * *"A rule that fails the build on correct code is a rule the team turns off,
 * and that takes the cases that do matter down with it."* So three shapes are
 * allowed and the tests below pin each one.
 *
 * `accent` IS NOT A VIOLATION, and this is read from the tokens rather than
 * hardcoded. Some theme-following roles carry the same value in both blocks —
 * `accent` and `accent-foreground` do — so `bg-accent text-white` is stable
 * while `bg-primary text-white` is a genuine failure. The rule resolves each
 * role's light and dark value from `@injishi/design-tokens` and compares them,
 * *"so this stays true if either value later changes."*
 *
 * WHAT THE RULE CAN SEE, stated so nobody expects more. Literal strings only: a
 * `className`/`class` attribute holding a string literal or an expression-free
 * template literal, and string-literal arguments to `cn(...)`. A class in a
 * variable, imported, built by a variant map, or passed through a slot-prop
 * object is out of scope and will not be flagged. ADR-028 accepts that hole
 * explicitly: the CSS half needs none of this analysis, so the hole costs only
 * the mirror case, and a rule that guessed at variables would produce false
 * positives on a codebase that uses `cn()` everywhere.
 */

import { createRequire } from 'node:module';
import { splitVariants, stripOpacity, tokens } from './shared-strings.mjs';

const require = createRequire(import.meta.url);

/* ------------------------------------------------------- the role vocabulary */

/**
 * Resolve the light and dark value of every HeroUI role, following aliases, so
 * the rule can ask "does this role move?" instead of trusting a hand-kept list.
 *
 * Falls back to an empty map if the package cannot be resolved — the rule then
 * still runs its structural checks and simply treats no role as invariant,
 * which is the conservative direction.
 */
function loadRoles() {
  let tokensPkg;
  try {
    tokensPkg = require('../../packages/design-tokens/dist/index.js');
  } catch {
    try {
      tokensPkg = require('@injishi/design-tokens');
    } catch {
      return { invariant: new Set(), known: new Set() };
    }
  }

  const { herouiLight, herouiDark, herouiAliases } = tokensPkg;
  const resolve = (table, name, seen = new Set()) => {
    if (name in table) return table[name];
    const target = herouiAliases[name];
    if (!target || seen.has(name)) return undefined;
    seen.add(name);
    return resolve(table, target, seen);
  };

  const names = new Set([...Object.keys(herouiLight), ...Object.keys(herouiAliases)]);
  const invariant = new Set();
  const known = new Set();
  for (const name of names) {
    const kebab = name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    known.add(kebab);
    const light = resolve(herouiLight, name);
    const dark = resolve(herouiDark, name);
    if (light !== undefined && light === dark) invariant.add(kebab);
  }
  return { invariant, known };
}

const { invariant: INVARIANT_ROLES, known: KNOWN_ROLES } = loadRoles();

/** ADR-028 §2. A fixed ground breaks in the opposite theme from its twin. */
const FIXED_GROUNDS = {
  light: new Set(['canvas', 'white', 'surface-tint']),
  dark: new Set(['ink', 'black', 'control-wash']),
};

/** Fixed roles that are foregrounds and must never take a pin selector. */
const FIXED_FOREGROUNDS = new Set(['slate-line', 'placeholder-dim', 'white', 'ink', 'black', 'control-wash']);

const ALL_FIXED = new Set([...FIXED_GROUNDS.light, ...FIXED_GROUNDS.dark, ...FIXED_FOREGROUNDS]);

/**
 * `border-b`, `text-left`, `outline-none`, `ring-2`, `divide-y` — utilities
 * that share a prefix with a colour and carry none.
 *
 * This set is why the rule asks "is the suffix a ROLE?" rather than "does the
 * token start with `text-`?". The first version did the second thing and
 * flagged `hover:bg-white/80 text-left` as a fixed ground stranding a
 * theme-following foreground, which is nonsense: `text-left` is alignment. That
 * is precisely the failure ADR-028 documents from its own first attempt — ten
 * flags, six of them correct code — so the check is now: a token is a
 * foreground only when what follows the prefix is a colour the token package
 * knows, a fixed role, or a raw ramp step.
 */
const NOT_A_GROUND = new Set(['transparent', 'current', 'inherit', 'none', 'auto']);

/** `bg-green-800`, `text-ink-300` — a raw ramp step, which IS a colour. */
const RAMP_STEP = /^(?:ink|green|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}$/;

/** True when this suffix names a colour rather than a width, style or side. */
function isColourRole(role) {
  if (NOT_A_GROUND.has(role)) return false;
  return KNOWN_ROLES.has(role) || ALL_FIXED.has(role) || RAMP_STEP.test(role);
}

/** Everything drawn ON a ground. ADR-028 §1 — not only text. */
const FOREGROUND_PREFIXES = ['text', 'border', 'ring', 'divide', 'fill', 'stroke', 'outline', 'decoration'];

/** A theme variant. Banned outright on a fixed ground by call 5. */
const THEME_VARIANTS = new Set(['dark', 'light']);

function groundHalf(role) {
  if (FIXED_GROUNDS.light.has(role)) return 'light';
  if (FIXED_GROUNDS.dark.has(role)) return 'dark';
  return null;
}

/** Parse one class list into the facts the three checks need. */
function readClassList(value) {
  const seen = { grounds: [], foregrounds: [], groundTheme: false };
  for (const token of tokens(value)) {
    const { variants, base } = splitVariants(token);
    const role = stripOpacity(base);
    if (role === 'ground-theme') {
      seen.groundTheme = true;
      continue;
    }
    if (role.startsWith('bg-')) {
      const name = role.slice(3);
      if (isColourRole(name)) seen.grounds.push({ token, role: name, variants });
      continue;
    }
    const prefix = FOREGROUND_PREFIXES.find((p) => role.startsWith(`${p}-`));
    if (!prefix) continue;
    const name = role.slice(prefix.length + 1);
    if (isColourRole(name)) seen.foregrounds.push({ token, role: name, variants });
  }
  return seen;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Require a ground and its foregrounds to agree on whether they invert. A fixed ground carries fixed foregrounds; a theme-following ground carries theme-following ones.',
    },
    schema: [],
    messages: {
      mirror:
        '`{{fg}}` is a FIXED colour on `{{bg}}`, which follows the theme. In the other theme the ground moves and `{{fg}}` does not, so the pair loses its contrast (ADR-028 §1). Either the ground should be fixed, or the foreground should be a role that moves with it.',
      themeVariant:
        'A `{{variant}}:` variant on the fixed ground `{{token}}` redefines what `{{role}}` MEANS, invisibly, at one call site (ADR-028 §5). If the surface genuinely needs to invert it is not a fixed ground — use `bg-background` or `bg-card`.',
      strandedFlip:
        '`{{token}}` flips to the other fixed half while the pin stays on `{{other}}` (ADR-028 §5a). The pin selector is the BARE class, so `.{{role}}` never matches this token and the theme block stays where it was: a {{half}} panel wearing the other half\'s text, at that variant only.',
      strandedFollowing:
        '`{{token}}` paints a fixed ground in that state only, while `{{fg}}` keeps following the theme (ADR-028 §5a). The pin does not apply to a variant class, so in the other theme this element goes light-on-light or dark-on-dark on {{variant}} alone.',
      groundThemeOnGround:
        '`ground-theme` belongs on a box NESTED inside a fixed ground, never on the ground itself (ADR-028 §4a). Here it hands `{{token}}` the page\'s theme block, so the element paints one unchanging colour and then takes the other theme\'s text — dark on dark on a light page. No CSS can tell this apart from correct use, which is why the rule owns it.',
    },
  },

  create(context) {
    function check(value, node) {
      if (typeof value !== 'string' || !value.trim()) return;
      const { grounds, foregrounds, groundTheme } = readClassList(value);
      if (!grounds.length && !groundTheme) return;

      const bareFixedGrounds = grounds.filter((g) => !g.variants.length && groundHalf(g.role));

      // 4a — `ground-theme` on the ground itself.
      if (groundTheme && bareFixedGrounds.length) {
        context.report({
          node,
          messageId: 'groundThemeOnGround',
          data: { token: bareFixedGrounds[0].token },
        });
      }

      for (const ground of grounds) {
        const half = groundHalf(ground.role);

        // 5 and 5a, in the order 5a establishes.
        //
        // §5 bans a theme variant on a fixed ground; §5a, written after it,
        // says the refusal is *"deliberately NARROWER than 'no variant on a
        // fixed ground'"* and names three shapes that are correct code. The
        // narrowing has to apply to a theme variant too, or the rule refuses
        // `dark:bg-white/10 dark:text-white` — a fixed pair under one variant,
        // §5a's own second allowed shape, and how `theme-pill.tsx` paints its
        // active segment on the first paint rather than after hydration.
        //
        // So the allowances are checked FIRST and the refusals after, most
        // specific message last.
        if (half && ground.variants.length) {
          // Allowed 1: the same half is also present unprefixed — the pin is on
          // the ELEMENT, not on the state, so it holds through every state.
          const sameHalfBare = bareFixedGrounds.some((g) => groundHalf(g.role) === half);
          if (sameHalfBare) continue;

          // Allowed 2: a fixed pair under the SAME variant — the author already
          // did the thing this decision asks for.
          const pairedFixedFg = foregrounds.some(
            (f) => ALL_FIXED.has(f.role) && f.variants.join(':') === ground.variants.join(':'),
          );
          if (pairedFixedFg) continue;

          // Refused, §5: a theme variant redefines what the role MEANS.
          const themeVariant = ground.variants.find((v) => THEME_VARIANTS.has(v));
          if (themeVariant) {
            context.report({
              node,
              messageId: 'themeVariant',
              data: { variant: themeVariant, token: ground.token, role: ground.role },
            });
            continue;
          }

          // Refused, §5a: flips to the other fixed half while the pin stays.
          const other = bareFixedGrounds.find((g) => groundHalf(g.role) !== half);
          if (other) {
            context.report({
              node,
              messageId: 'strandedFlip',
              data: { token: ground.token, other: other.token, role: ground.role, half },
            });
            continue;
          }

          // Refused, §5a: a theme-following foreground still applies in that state.
          const following = foregrounds.find(
            (f) => !ALL_FIXED.has(f.role) && !INVARIANT_ROLES.has(f.role) && !f.variants.length,
          );
          if (following) {
            context.report({
              node,
              messageId: 'strandedFollowing',
              data: {
                token: ground.token,
                fg: following.token,
                variant: ground.variants.join(':'),
              },
            });
          }
          continue;
        }

        // 1 — the mirror case. A fixed foreground on a ground that moves.
        if (half || ground.variants.length) continue;
        if (ALL_FIXED.has(ground.role)) continue;
        // §7: a role carrying the same value in both blocks does not move, so
        // a fixed foreground on it is stable. Read from the tokens, not named.
        if (INVARIANT_ROLES.has(ground.role)) continue;

        for (const fg of foregrounds) {
          if (fg.variants.length) continue;
          if (!FIXED_FOREGROUNDS.has(fg.role)) continue;
          context.report({
            node,
            messageId: 'mirror',
            data: { fg: fg.token, bg: ground.token },
          });
        }
      }
    }

    /** A template literal with no `${}` is as static as a string literal. */
    function staticValue(node) {
      if (!node) return null;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      if (node.type === 'JSXExpressionContainer') return staticValue(node.expression);
      if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis.map((q) => q.value.cooked ?? '').join('');
      }
      return null;
    }

    return {
      JSXAttribute(node) {
        const name = node.name?.name;
        if (name !== 'className' && name !== 'class') return;
        const value = staticValue(node.value);
        if (value !== null) check(value, node);
      },
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee?.type === 'Identifier'
            ? callee.name
            : callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier'
              ? callee.property.name
              : null;
        if (name !== 'cn' && name !== 'clsx' && name !== 'twMerge') return;
        // JOINED, not per-argument. `cn("bg-popover", "text-white")` is one
        // element's class list written in two pieces, and the mirror case is
        // exactly the pair that spans them — checking each argument alone sees
        // a ground with no foreground and then a foreground with no ground, and
        // finds nothing. The dynamic arguments are skipped, not fatal: the rule
        // reads what it can see and ADR-028 §6 accepts the rest as a known hole.
        const parts = node.arguments.map(staticValue).filter((v) => v !== null);
        if (parts.length) check(parts.join(' '), node);
      },
    };
  },
};

export default rule;
