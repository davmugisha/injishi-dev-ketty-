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
 * A ROLE THAT DOES NOT MOVE IS NOT A VIOLATION, and this is read from the
 * tokens rather than hardcoded. Some theme-following roles carry the same value
 * in both blocks — `success` and `danger-foreground` do — so
 * `bg-success text-ink` is stable while `bg-primary text-white` is a genuine
 * failure. `accent` used to be the example: it held one value in both blocks
 * until the 2026-10-26 re-sync of ADR-068 gave dark its own lighter accent with
 * a dark label, and `bg-accent text-white` became a failure the same day with
 * no edit here. The rule resolves each
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
 *
 * THE `native` HALF (mobile spec 0002, D-z) asks a narrower question with a
 * wider reach, because the phone has neither of the things the web half leans
 * on. It has no fixed grounds: every role follows the theme, so the mirror case
 * cannot happen. And it has NO CASCADE: a `text-*` class on a `View` colours
 * nothing, so the colour of every word and icon is named on the word or the
 * icon itself, usually one element below the ground it sits on. So the native
 * half checks that each ground carries its PAIR, the text role the palette
 * measured against it (D-c): `bg-accent` carries `text-accent-foreground`,
 * `bg-success-soft` carries `text-success-soft-foreground`, and a neutral
 * ground (one whose pair is the page's `foreground`, read from the palette)
 * also carries the kit's tones, whose text roles D-l chose because they clear
 * 4.5:1 there. It reads the pair in three places:
 *
 *   1. One class list, as the web half does: `bg-accent text-foreground`,
 *      a variant ground against its own variant's text.
 *   2. Down the JSX from an element that paints a ground, to the text and
 *      icons inside it: a `className` colour, the kit `Text` and `Icon`'s
 *      `tone` (absent, it is `default`, which is `foreground`), a `Glyph`'s
 *      `role`. The walk passes through React Native's own boxes and the kit's
 *      `PressArea` only, and stops at any other component, at a class it
 *      cannot read, and at a nested ground, because each of those may paint a
 *      ground of its own.
 *   3. A class map that pairs a ground with a label in one object
 *      (`{ root: "bg-info-soft", label: "text-info-soft-foreground" }`), the
 *      shape the kit's chips use.
 *
 * A class that switches is read STATE BY STATE, because the old screens switch
 * a ground and its label on one condition (`on ? "bg-accent" : "bg-default"`
 * over `on ? "text-accent-foreground" : "text-foreground"`), and reading the
 * two as one list pairs each ground with the other's label: the first draft
 * of this half flagged seven such sites, all correct. So a mismatch counts only
 * where it holds in every state, a ground that switches is not followed into
 * its children, and a child that paints any background of its own, a role or
 * not, ends the walk.
 *
 * What it allows is read in `native-vocabulary.mjs`, from the palette's hex: a
 * role drawing the same colour as the pair in both themes is the pair.
 */

import { createRequire } from 'node:module';
import {
  GROUND_PAIRS,
  TONE_ROLES,
  agreesWith,
  backgroundColourOf,
  filenameOf,
  isTextColour,
  textAllowedOn,
} from './native-vocabulary.mjs';
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
    schema: [
      {
        type: 'object',
        properties: { native: { type: 'boolean' } },
        additionalProperties: false,
      },
    ],
    messages: {
      nativePair:
        '{{fg}} draws on `{{bg}}`, which carries {{allowed}}. React Native has no cascade, so every word and icon names its colour, and on a ground that colour is the pair the palette measured against it (mobile spec 0002, D-c, D-z).',
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
    if (context.options[0]?.native === true) return nativeListeners(context);

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

/* --------------------------------------------------------- the native half */

/** The class-joining helpers whose arguments are one element's class list. */
const CLASS_JOINERS = new Set(['cn', 'clsx', 'twMerge']);

/**
 * Elements a ground reaches the text inside through: React Native's own boxes
 * and the kit's `PressArea`, which paints only the `pressed` layer. Any other
 * component may paint a ground of its own, so the walk stops at it.
 */
const PASS_THROUGH = new Set([
  'View',
  'ScrollView',
  'Pressable',
  'SafeAreaView',
  'KeyboardAvoidingView',
  'Fragment',
  'React.Fragment',
  'Animated.View',
  'Animated.ScrollView',
  'PressArea',
]);

/** HeroUI's text parts (`Button.Label`, `Card.Title`): text, coloured by their own class. */
const TEXT_PART = /\.(?:Label|Title|Description|Text)$/;

function elementName(node) {
  const name = node.openingElement?.name ?? node.name;
  if (name?.type === 'JSXIdentifier') return name.name;
  if (name?.type === 'JSXMemberExpression') {
    const parts = [];
    for (let n = name; n; n = n.type === 'JSXMemberExpression' ? n.object : null) {
      parts.unshift(n.type === 'JSXMemberExpression' ? n.property.name : n.name);
    }
    return parts.join('.');
  }
  return null;
}

function attributeOf(element, name) {
  return element.openingElement.attributes.find((a) => a.type === 'JSXAttribute' && a.name?.name === name);
}

/** An attribute's string: undefined when absent, null when it is not a literal. */
function literalAttribute(element, name) {
  const attr = attributeOf(element, name);
  if (!attr) {
    // A spread may carry it.
    return element.openingElement.attributes.some((a) => a.type === 'JSXSpreadAttribute') ? null : undefined;
  }
  const value = attr.value?.type === 'JSXExpressionContainer' ? attr.value.expression : attr.value;
  return value?.type === 'Literal' && typeof value.value === 'string' ? value.value : null;
}

/** Past this many states a class list is read as far as it got. */
const MAX_STATES = 16;

/**
 * The class lists a `className` value can produce, one per STATE, and whether
 * all of it was readable. `${on ? "bg-accent" : "bg-default"}` is two states,
 * each a ground of its own; reading it as one list would pair `bg-default`
 * with the accent label meant for the other state.
 */
function classStates(node) {
  if (!node) return { states: [''], complete: true };
  switch (node.type) {
    case 'JSXAttribute':
      return classStates(node.value);
    case 'JSXExpressionContainer':
      return classStates(node.expression);
    case 'Literal':
      return typeof node.value === 'string' ? { states: [node.value], complete: true } : unreadable();
    case 'TemplateLiteral': {
      const pieces = [];
      node.quasis.forEach((q, i) => {
        pieces.push({ states: [q.value.cooked ?? ''], complete: true });
        if (node.expressions[i]) pieces.push(classStates(node.expressions[i]));
      });
      return product(pieces);
    }
    case 'ConditionalExpression':
      return either([classStates(node.consequent), classStates(node.alternate)]);
    case 'LogicalExpression':
      return node.operator === '&&'
        ? either([{ states: [''], complete: true }, classStates(node.right)])
        : either([classStates(node.left), classStates(node.right)]);
    case 'ArrayExpression':
      return product(node.elements.map(classStates));
    case 'CallExpression': {
      const callee = node.callee;
      if (callee?.type === 'Identifier' && CLASS_JOINERS.has(callee.name)) return product(node.arguments.map(classStates));
      // `[a, b].filter(Boolean).join(" ")`
      if (callee?.type === 'MemberExpression' && ['join', 'filter'].includes(callee.property?.name)) {
        return classStates(callee.object);
      }
      return unreadable();
    }
    default:
      return unreadable();
  }
}

function unreadable() {
  return { states: [''], complete: false };
}

function either(options) {
  return {
    states: [...new Set(options.flatMap((o) => o.states))].slice(0, MAX_STATES),
    complete: options.every((o) => o.complete),
  };
}

function product(pieces) {
  let states = [''];
  for (const piece of pieces) {
    states = states.flatMap((a) => piece.states.map((b) => `${a} ${b}`)).slice(0, MAX_STATES);
  }
  return { states, complete: pieces.every((p) => p.complete) };
}

/** A class list's grounds and text colours, each with its variants. Grounds at an opacity are surface-vocabulary's. */
function readNative(value) {
  const grounds = [];
  const marks = [];
  for (const token of tokens(value)) {
    const { variants, base } = splitVariants(token);
    const solid = stripOpacity(base);
    if (solid.startsWith('bg-')) {
      if (solid === base && GROUND_PAIRS.has(solid.slice(3))) grounds.push({ role: solid.slice(3), token, variants });
    } else if (solid.startsWith('text-') && isTextColour(solid.slice(5))) {
      marks.push({ role: solid.slice(5), label: `\`${token}\``, variants });
    }
  }
  return { grounds, marks };
}

const sameVariants = (a, b) => a.join(':') === b.join(':');

/** The last bare ground in a class list: the one an element paints in its resting state. */
function restingGround(value) {
  const bare = readNative(value).grounds.filter((g) => !g.variants.length);
  return bare.length ? bare[bare.length - 1] : null;
}

/** True when any state paints any background at rest: a role, a raw colour, a translucent fill. */
function paintsBackground(states) {
  return states.some((state) =>
    tokens(state).some((token) => {
      const { variants, base } = splitVariants(token);
      return !variants.length && base.startsWith('bg-') && backgroundColourOf(stripOpacity(base).slice(3)) !== null;
    }),
  );
}

/**
 * The one ground an element paints in every state that paints one, or null.
 * Two different grounds across states is a switch the rule cannot follow into
 * the children, whose colours usually switch with it.
 */
function singleGround(states) {
  const grounds = states.map(restingGround).filter(Boolean);
  const roles = new Set(grounds.map((g) => g.role));
  return roles.size === 1 ? grounds[0] : null;
}

/** Marks present in EVERY state: a colour that switches is read only where it is always wrong. */
function steadyMarks(perState) {
  if (!perState.length) return [];
  const [first, ...rest] = perState;
  return first.filter((m) => rest.every((marks) => marks.some((o) => o.role === m.role && sameVariants(o.variants, m.variants))));
}

function allowedText(ground) {
  return (textAllowedOn(ground) ?? []).map((r) => `\`text-${r}\``).join(', ');
}

function nativeListeners(context) {
  const filename = filenameOf(context);
  const inKit = filename.includes('/components/ui/');
  /** local name -> { kind, imported } */
  const imports = new Map();

  function sourceKind(source) {
    if (/^@\/components\/ui(?:\/.*)?$/.test(source)) return 'kit';
    if (inKit && /^\.\/(?:text|icon|index)?$/.test(source)) return 'kit';
    if (source === '@/components/icon' || (!inKit && /^\.\.?\/(?:.*\/)?icon$/.test(source))) return 'shim';
    if (source === 'react-native' || source === 'react-native-reanimated') return 'rn';
    return null;
  }

  /** What kind of text an element is, or null when it is not text. */
  function textKind(element) {
    const name = elementName(element);
    if (!name) return null;
    if (name === 'Animated.Text') return 'plain';
    const binding = imports.get(name);
    const imported = binding?.imported ?? name;
    if (binding?.kind === 'kit' && imported === 'Text') return 'kitText';
    if (binding?.kind === 'kit' && imported === 'Icon') return 'kitIcon';
    if (binding?.kind === 'kit' && imported === 'Glyph') return 'glyph';
    if (binding?.kind === 'shim' && imported === 'Icon') return 'shimIcon';
    if (binding?.kind === 'rn' && imported === 'Text') return 'plain';
    // Inside the kit, `Text`, `Icon` and `Glyph` are the files' own.
    if (!binding && inKit && name === 'Text') return 'kitText';
    if (!binding && inKit && name === 'Icon') return 'kitIcon';
    if (!binding && inKit && name === 'Glyph') return 'glyph';
    if (TEXT_PART.test(name)) return 'plain';
    return null;
  }

  /**
   * The colours an element draws in one state: its class's, else its tone's, its role's,
   * or the default. A class the rule cannot read may hold the colour, so then only what
   * the class shows counts.
   */
  function marksIn(element, kind, state, complete) {
    const marks = readNative(state).marks;
    if (marks.length || !complete) return marks;
    return toneMarks(element, kind);
  }

  /** The colours an element draws in every one of its states. */
  function marksOf(element, kind, { states, complete }) {
    return steadyMarks(states.map((state) => marksIn(element, kind, state, complete)));
  }

  function toneMarks(element, kind) {
    if (kind === 'kitText' || kind === 'kitIcon') {
      const tone = literalAttribute(element, 'tone');
      if (tone === undefined) return [{ role: TONE_ROLES.default, label: 'The default tone (`text-foreground`)', variants: [] }];
      const role = tone && TONE_ROLES[tone];
      return role ? [{ role, label: `\`tone="${tone}"\` (\`text-${role}\`)`, variants: [] }] : [];
    }
    if (kind === 'glyph') {
      const role = literalAttribute(element, 'role');
      return role ? [{ role, label: `\`role="${role}"\``, variants: [] }] : [];
    }
    if (kind === 'shimIcon') {
      if (attributeOf(element, 'color')) return [];
      const tone = literalAttribute(element, 'tone');
      if (tone === undefined) return [{ role: 'foreground', label: 'The icon\'s default tone (`foreground`)', variants: [] }];
      return tone ? [{ role: tone, label: `\`tone="${tone}"\``, variants: [] }] : [];
    }
    return [];
  }

  function report(node, ground, mark) {
    context.report({
      node,
      messageId: 'nativePair',
      data: { fg: mark.label, bg: ground.token, allowed: allowedText(ground.role) },
    });
  }

  /** A ground's text: the marks under its own variants, else (for a variant ground) the resting ones. */
  function marksFor(ground, marks) {
    const own = marks.filter((m) => sameVariants(m.variants, ground.variants));
    return own.length || !ground.variants.length ? own : marks.filter((m) => !m.variants.length);
  }

  /**
   * 1. A class list against itself, state by state. A mismatch is reported only when
   * every state that paints the ground has it: two ternaries on one condition
   * (`${on ? "bg-accent" : ""} ${on ? "text-accent-foreground" : ""}`) produce states
   * that never render, and those must not be read as a defect.
   */
  function checkStates(node, perState) {
    const statesWith = new Map();
    const wrong = new Map();
    for (const { grounds, marks } of perState) {
      const seen = new Set();
      for (const ground of grounds) {
        if (!seen.has(ground.token)) statesWith.set(ground.token, (statesWith.get(ground.token) ?? 0) + 1);
        seen.add(ground.token);
        for (const mark of marksFor(ground, marks)) {
          const key = `${ground.token}|${mark.label}`;
          if (seen.has(key) || agreesWith(ground.role, mark.role)) continue;
          seen.add(key);
          const entry = wrong.get(key) ?? { ground, mark, count: 0 };
          entry.count += 1;
          wrong.set(key, entry);
        }
      }
    }
    for (const { ground, mark, count } of wrong.values()) {
      if (count === statesWith.get(ground.token)) report(node, ground, mark);
    }
  }

  function jsxIn(expression) {
    if (!expression) return [];
    switch (expression.type) {
      case 'JSXElement':
      case 'JSXFragment':
        return [expression];
      case 'ConditionalExpression':
        return [...jsxIn(expression.consequent), ...jsxIn(expression.alternate)];
      case 'LogicalExpression':
        return expression.operator === '&&'
          ? jsxIn(expression.right)
          : [...jsxIn(expression.left), ...jsxIn(expression.right)];
      case 'CallExpression': {
        const fn = expression.arguments[0];
        const isMap = ['map', 'flatMap'].includes(expression.callee?.property?.name);
        if (!isMap || !fn || !/FunctionExpression$/.test(fn.type)) return [];
        if (fn.body.type !== 'BlockStatement') return jsxIn(fn.body);
        return fn.body.body.filter((s) => s.type === 'ReturnStatement').flatMap((s) => jsxIn(s.argument));
      }
      default:
        return [];
    }
  }

  /** 2. Down from a ground to the text and icons drawn on it. */
  function walk(children, ground) {
    for (const child of children) {
      if (child.type === 'JSXExpressionContainer') {
        walk(jsxIn(child.expression), ground);
        continue;
      }
      if (child.type === 'JSXFragment') {
        walk(child.children, ground);
        continue;
      }
      if (child.type !== 'JSXElement') continue;
      const parts = classStates(attributeOf(child, 'className'));
      // A child that paints a background is a ground of its own, checked when it is visited
      // if it is a role, and surface-vocabulary's if it is not.
      if (paintsBackground(parts.states)) continue;
      const kind = textKind(child);
      if (kind) {
        for (const mark of marksOf(child, kind, parts).filter((m) => !m.variants.length)) {
          if (!agreesWith(ground.role, mark.role)) report(child.openingElement, ground, mark);
        }
        continue;
      }
      if (!PASS_THROUGH.has(elementName(child)) || !parts.complete) continue;
      walk(child.children, ground);
    }
  }

  /** Strings that sit inside a `className` or a class joiner are read with the whole list. */
  function insideClassList(node) {
    for (let up = node.parent; up; up = up.parent) {
      if (up.type === 'JSXAttribute') return up.name?.name === 'className';
      if (up.type === 'CallExpression' && up.callee?.type === 'Identifier' && CLASS_JOINERS.has(up.callee.name)) return true;
      if (up.type === 'JSXElement' || up.type === 'Program') return false;
    }
    return false;
  }

  function checkString(node, value) {
    if (typeof value !== 'string' || !value.includes('bg-')) return;
    checkStates(node, [readNative(value)]);
  }

  return {
    ImportDeclaration(node) {
      const kind = sourceKind(node.source.value);
      if (!kind) return;
      for (const spec of node.specifiers) {
        const imported = spec.type === 'ImportSpecifier' ? (spec.imported.name ?? spec.imported.value) : spec.local.name;
        imports.set(spec.local.name, { kind, imported });
      }
    },

    JSXElement(node) {
      const { states, complete } = classStates(attributeOf(node, 'className'));
      const kind = textKind(node);
      const perState = states.map((state) => {
        const { grounds, marks } = readNative(state);
        return { grounds, marks: kind ? marksIn(node, kind, state, complete) : marks };
      });
      if (!perState.some((s) => s.grounds.length)) return;
      checkStates(node.openingElement, perState);
      const ground = singleGround(states);
      if (ground) walk(node.children, ground);
    },

    Literal(node) {
      if (!insideClassList(node)) checkString(node, node.value);
    },

    TemplateLiteral(node) {
      if (insideClassList(node)) return;
      checkString(node, node.quasis.map((q) => q.value.cooked ?? '').join(' '));
    },

    CallExpression(node) {
      if (node.callee?.type !== 'Identifier' || !CLASS_JOINERS.has(node.callee.name) || insideClassList(node)) return;
      checkStates(node, classStates(node).states.map(readNative));
    },

    /** 3. A class map pairing one ground with a label: `{ root: "bg-x", label: "text-y" }`. */
    ObjectExpression(node) {
      const values = node.properties
        .filter((p) => p.type === 'Property' && p.value?.type === 'Literal' && typeof p.value.value === 'string')
        .map((p) => ({ node: p.value, ...readNative(p.value.value) }));
      const withGround = values.filter((v) => v.grounds.length);
      // More than one ground is a map of alternatives (one per tone), not one element's parts.
      if (withGround.length !== 1) return;
      const [holder] = withGround;
      for (const v of values) {
        if (v === holder || v.grounds.length || !v.marks.length) continue;
        checkStates(v.node, [{ grounds: holder.grounds, marks: v.marks }]);
      }
    },
  };
}

export default rule;
