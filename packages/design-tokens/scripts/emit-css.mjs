/**
 * emit-css.mjs — the CSS emitter for @injishi/design-tokens.
 *
 * Rewritten under ADR-034 task 3. The original lived in the deleted
 * `injishi.managed` repo; its exact output did not, so this script is proved
 * against the three committed stylesheets rather than trusted:
 *
 *   node scripts/emit-css.mjs           # write generated/*.css
 *   node scripts/emit-css.mjs --check   # fail if any file would change
 *
 * `--check` is the second half of `pnpm -F @injishi/design-tokens check`, so a
 * token edited in `src/` without regenerating fails the same way a hand-edited
 * `dist/` does.
 *
 * THE ONE RULE. Nothing here decides a value. Every colour, radius and shadow
 * comes from `../dist` — the package's own build — so a stylesheet cannot drift
 * from the TypeScript that consumers import. The only thing this file owns is
 * the SHAPE of the output: which selectors, in which order, with which
 * comments. That is why a value change is reviewable as a one-line diff in
 * `src/` plus its mechanical consequence here.
 *
 * Three sheets, three audiences:
 *
 *   injishi-ramps.css   the 22 ramp hexes only, for a consumer keeping its own
 *                       semantic layer
 *   injishi-tokens.css  the pre-HeroUI vocabulary — ramps, the ADR-010 role
 *                       set, the theme-following light/dark pair
 *   injishi-heroui.css  the HeroUI 3 vocabulary — the teal theme, its legacy
 *                       aliases, the document scrollbar opt-in
 *
 * A NOTE ON `--radius`. Both sheets emit `--radius: 0.5rem`, and both read it
 * from `herouiRadius`. There is exactly one base corner in the product and
 * ADR-025 moved it once, from 0.75rem to 0.5rem; emitting it from two places
 * would let a later pass move one and not the other. `semantic.radius` is a
 * different thing — the React Native step set, in device pixels — and is not
 * a CSS value. ADR-034 task 6 gives that one owner.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const tokens = require('../dist');

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'generated');

/* ------------------------------------------------------------------ shape */

const NL = '\r\n';

/**
 * `accentText` -> `accent-text`, `chart1` -> `chart-1`. The one naming rule the
 * whole system rests on. A digit run starts a segment the way a capital does,
 * so a numbered role reads as the `chart-1` that `ui-tokens.md` names.
 */
const kebab = (name) =>
  name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`).replace(/([a-z])(\d)/g, '$1-$2');

const HEADER = [
  '/* AUTO-GENERATED from @injishi/design-tokens — do not edit by hand.',
  ' * Regenerate: pnpm --filter @injishi/design-tokens generate:css',
  ' * Single source: packages/design-tokens/src/{ramps,semantic,heroui}.ts */',
  '',
];

/** `--name: value;` at one indent. */
const decl = (name, value) => `  --${name}: ${value};`;

/** A role map, in declaration order, as `--kebab: value;` lines. */
const roles = (map) => Object.entries(map).map(([k, v]) => decl(kebab(k), v));

/** An alias map: the right-hand side is a ROLE NAME, so it is wrapped in var(). */
const aliasDecls = (map) => Object.entries(map).map(([k, v]) => decl(kebab(k), `var(--${kebab(v)})`));

/** Both ramps, `--ink-50` through `--green-950`, in one run with no break. */
const ramps = () => [
  ...Object.entries(tokens.ink).map(([step, hex]) => decl(`ink-${step}`, hex)),
  ...Object.entries(tokens.green).map(([step, hex]) => decl(`green-${step}`, hex)),
];

/** `--color-x: var(--x);` — one Tailwind v4 utility per role. */
const themeKeys = (names) => names.map((n) => decl(`color-${n}`, `var(--${n})`));

/**
 * ADR-027's layout scale, as a plain `@theme` block.
 *
 * NOT `@theme inline`. The colour block above is `inline` because every one of
 * its keys is `var(--role)` — an alias whose value must resolve at use, not at
 * definition. These are literal lengths with no role behind them, so a plain
 * `@theme` is both correct and the thing that emits `--container-page` as a
 * readable `:root` variable a debugger can show you.
 *
 * The two-dash `--line-height` spelling is written here, once, for all four
 * steps: one dash registers an unrelated token and the size ships with no
 * leading, silently. That failure is why the pairing is generated rather than
 * hand-written at each declaration.
 */
function layoutTheme() {
  const { typeSteps, containers, rhythm } = tokens;
  return [
    '/* ADR-027 layout scale: eleven named type steps (four authored here, seven',
    "   Tailwind's), six page widths, three spacing rhythms. A plain @theme, not",
    '   @theme inline: these are literal lengths, not aliases of a role. */',
    '@theme {',
    ...Object.entries(typeSteps).flatMap(([name, step]) => [
      decl(`text-${name}`, step.size),
      decl(`text-${name}--line-height`, step.lineHeight),
    ]),
    '',
    ...Object.entries(containers).map(([name, width]) => decl(`container-${name}`, width)),
    '',
    ...Object.entries(rhythm).map(([name, step]) => decl(`spacing-${name}`, step)),
    '}',
    '',
  ];
}

/**
 * The motion scale (`src/motion.ts`), as a plain `@theme` block.
 *
 * Both halves land in a Tailwind namespace, so each is an ordinary utility:
 * `--transition-duration-settle` is what `duration-settle` reads, and
 * `--ease-settle` is what `ease-settle` reads. The names were chosen not to
 * collide with Tailwind's `ease-in`/`ease-out` or HeroUI's `--ease-out-*`.
 *
 * The two `--default-transition-*` keys are the lever that matters most: they
 * move every bare `transition` / `transition-colors` in the three apps onto the
 * scale at once, instead of Tailwind's stock 150ms and Material curve.
 */
function motionTheme() {
  const { motionMs, easingCurves } = tokens;
  const bezier = (c) => `cubic-bezier(${c.join(', ')})`;
  return [
    '/* Motion scale (motion.ts): five durations named for what they are for,',
    '   four curves named for how a thing moves. duration-settle, ease-settle. */',
    '@theme {',
    ...Object.entries(motionMs).map(([name, ms]) => decl(`transition-duration-${name}`, `${ms}ms`)),
    '',
    ...Object.entries(easingCurves).map(([name, curve]) => decl(`ease-${name}`, bezier(curve))),
    '',
    decl('default-transition-duration', `${motionMs.quick}ms`),
    decl('default-transition-timing-function', bezier(easingCurves.settle)),
    '}',
    '',
  ];
}

/**
 * ADR-028: a fixed ground re-pins the theme block inside itself.
 *
 * THIS BLOCK WAS NOT GENERATED UNTIL NOW, and that is the defect ADR-046
 * recorded without fixing. It was hand-added to `generated/injishi-tokens.css`
 * after the emitter was written, so `--check` reported that sheet STALE on every
 * run and the documented `generate:css` DELETED 143 live lines — the whole
 * ground/foreground agreement mechanism — the moment anybody followed the
 * instruction the failure prints. A generator that loses part of its own output
 * is worse than no generator: it fails closed the first time it is trusted.
 *
 * What the block does is the reason it cannot simply be dropped. `bg-canvas`,
 * `bg-ink` and the rest are FIXED grounds (semantic.ts `fixed`): they hold one
 * value in both themes. A theme-following text role inside one of them is tuned
 * for the PAGE, not for the ground it actually landed on, so `text-foreground`
 * on `bg-ink` is navy on navy in light theme. Re-declaring the whole role set
 * inside each fixed ground is what makes the foreground agree with the ground —
 * the invariant `injishi/ground-foreground-agreement` lints for.
 *
 * `.ground-theme` is the one opt-out: an island inside a fixed ground that
 * should follow the page again. It is scoped under each theme selector rather
 * than declared bare, because it has to WIN over the fixed-ground block above
 * it, and `:where()` on the light branch keeps that selector at the same
 * specificity as the dark one so the two cannot fight by accident.
 *
 * IT IS EMITTED INTO BOTH SHEETS, and until 2026-09-12 it was in
 * `injishi-tokens.css` alone — the one sheet NO app imports. Every app reads
 * `injishi-heroui.css`, so the mechanism shipped nowhere and every fixed light
 * ground rendered near-white text on near-white in dark theme: the marketplace
 * home band and the promo pair were unreadable, measured at 1.05:1. The two
 * sheets carry different vocabularies (`semantic.ts` roles against the HeroUI
 * roles plus their legacy aliases), so the palettes are arguments rather than
 * a closed-over constant; the selectors and the structure are shared, because
 * which classes are a fixed ground is one fact.
 */
function groundPins({ light, dark, aliases, grounds }) {
  const pin = (selectors, scheme, palette) => [
    ...selectors,
    '  color-scheme: ' + scheme + ';',
    ...roles(palette),
    ...aliasDecls(aliases),
    '}',
    '',
  ];

  /* `['canvas','white','surfaceTint']` -> `.bg-canvas,` `.bg-white,` `.bg-surface-tint {`.
   * The list comes from the palette's own `fixedGrounds` register rather than
   * being typed here, so adding a fixed ground is one edit in `src/` and both
   * sheets pick it up. The selector is the BARE class on purpose: `.bg-ink`
   * must not match `md:bg-ink`, because a variant paints a new ground under a
   * condition the pin cannot see (ui-rules.md § Ground and foreground). */
  const groundSelectors = (names) =>
    names.map((n, i) => `.bg-${kebab(n)}${i === names.length - 1 ? ' {' : ','}`);

  return [
    '/* ── ADR-028: fixed grounds re-pin the theme block inside themselves ─────── */',
    ...pin(groundSelectors(grounds.light), 'light', light),
    ...pin(groundSelectors(grounds.dark), 'dark', dark),
    '/* The one opt-out: follow the PAGE again, inside a fixed ground. */',
    ...pin(
      ['.dark .ground-theme,', '[data-theme="dark"] .ground-theme,', '.th-dark .ground-theme {'],
      'dark',
      dark,
    ),
    ...pin(
      [
        ':where(:root:not(.dark)) .ground-theme,',
        '.light .ground-theme,',
        '[data-theme="light"] .ground-theme,',
        '.th-light .ground-theme {',
      ],
      'light',
      light,
    ),
  ];
}

/**
 * The radius scale every sheet shares. Each step is base ±4px so that a corner
 * anywhere in the product is one move away from every other corner.
 */
const radiusScale = () => [
  decl('radius-sm', 'calc(var(--radius) - 4px)'),
  decl('radius-md', 'calc(var(--radius) - 2px)'),
  decl('radius-lg', 'var(--radius)'),
  decl('radius-xl', 'calc(var(--radius) + 4px)'),
  decl('radius-2xl', 'calc(var(--radius) + 8px)'),
  decl('radius-3xl', 'calc(var(--radius) + 16px)'),
];

/**
 * Why the document scrollbar is opted in here rather than by a utility. Kept
 * verbatim: it is the only rule in these sheets that is not a token, and the
 * reason it exists is the only thing that stops someone deleting it.
 */
const SCROLLBAR_NOTE = [
  "/* The DOCUMENT's own scrollbar.",
  ' *',
  " * HeroUI ships a complete scrollbar system - the 'scrollbar', 'scrollbar-thin'",
  ' * and \'scrollbar-none\' utilities, and the [data-scrollbar] ancestor modes - but',
  ' * it applies NONE of it globally: base/base.css carries the universal rule',
  " * commented out, because '*' also matched .modal__backdrop and swallowed the",
  ' * click that closes an overlay. Its own note says each scroll container is',
  ' * expected to opt in with an @apply of that utility, and every container in',
  ' * this workspace now does.',
  ' *',
  ' * A page cannot: nothing in an app renders <html>, so the one bar a reader sees',
  " * on every screen would have stayed the platform's. This rule is that opt-in,",
  " * scoped to the document element alone rather than to '*', so it cannot reach a",
  ' * backdrop and cannot reintroduce the bug HeroUI disabled the rule for.',
  ' *',
  " * The three declarations are the 'scrollbar' utility verbatim. They are written",
  ' * out rather than @applied because this sheet is also inlined by consumers that',
  ' * paste it in ahead of the Tailwind entry, where an @apply has no utility to',
  " * resolve. The VALUES stay HeroUI's own variables, so there is still one",
  ' * source: retheme the bar by moving the token, never by editing this rule. */',
].join(NL);

/* ------------------------------------------------------------ the sheets */

function rampsSheet() {
  return [...HEADER, ':root {', ...ramps(), '}', ''].join(NL);
}

function tokensSheet() {
  const { fixed, light, dark, aliases, fixedGrounds, radiusCard, shadowControl, herouiRadius } = tokens;
  return [
    ...HEADER,
    ':root {',
    ...ramps(),
    '',
    '  /* fixed — one value in both themes (ADR-010 call 2) */',
    ...roles(fixed),
    '',
    '  /* semantic (light) */',
    ...roles(light),
    '',
    '  /* aliases */',
    ...aliasDecls(aliases),
    '',
    '  /* non-color */',
    decl('radius', herouiRadius),
    '}',
    '',
    ':root.dark,',
    '.dark {',
    '  /* fixed — repeated verbatim so a dark scope cannot invert them */',
    ...roles(fixed),
    '',
    '  /* semantic (dark) — inverted-card */',
    ...roles(dark),
    '',
    '  /* aliases */',
    ...aliasDecls(aliases),
    '}',
    '',
    ...groundPins({ light, dark, aliases, grounds: fixedGrounds }),
    '/* Tailwind v4: map every token to a utility (bg-primary, text-muted-foreground,',
    '   bg-ink, border-slate-line, rounded-card, shadow-control, ...) */',
    '@theme inline {',
    ...themeKeys([
      ...Object.keys(fixed).map(kebab),
      ...Object.keys(light).map(kebab),
      ...Object.keys(aliases).map(kebab),
      ...Object.keys(tokens.ink).map((s) => `ink-${s}`),
      ...Object.keys(tokens.green).map((s) => `green-${s}`),
    ]),
    ...radiusScale(),
    '  /* Literal, not a var() pointing at the same name: a theme key whose value',
    '     references itself is circular. Tailwind emits the :root variable here. */',
    decl('radius-card', radiusCard),
    decl('shadow-control', shadowControl),
    '}',
    '',
  ].join(NL);
}

function herouiSheet() {
  const {
    herouiFixed,
    herouiLight,
    herouiDark,
    herouiAliases,
    herouiFixedGrounds,
    herouiRadius,
    herouiFieldRadius,
    radiusCard,
    shadowControl,
  } = tokens;
  return [
    ...HEADER,
    ':root,',
    '.light,',
    '.default,',
    '[data-theme="light"],',
    '[data-theme="default"] {',
    '  /* fixed - one value in both themes (ADR-010 call 2) */',
    ...roles(herouiFixed),
    '',
    '  /* HeroUI roles (light) */',
    ...roles(herouiLight),
    '',
    '  /* legacy Injishi role names, aliased onto the HeroUI roles */',
    ...aliasDecls(herouiAliases),
    '',
    '  /* non-color */',
    decl('radius', herouiRadius),
    decl('field-radius', herouiFieldRadius),
    '}',
    '',
    '.dark,',
    '[data-theme="dark"] {',
    '  color-scheme: dark;',
    '',
    '  /* fixed - repeated verbatim so a dark scope cannot invert them */',
    ...roles(herouiFixed),
    '',
    '  /* HeroUI roles (dark) */',
    ...roles(herouiDark),
    '',
    '  /* legacy Injishi role names, aliased onto the HeroUI roles */',
    ...aliasDecls(herouiAliases),
    '}',
    '',
    // After the two theme blocks, never before: `.bg-canvas` and `.dark` are
    // the same specificity, so on the rare element that carries both, source
    // order is the whole of the answer.
    ...groundPins({
      light: herouiLight,
      dark: herouiDark,
      aliases: herouiAliases,
      grounds: herouiFixedGrounds,
    }),
    SCROLLBAR_NOTE,
    'html {',
    '  scrollbar-width: var(--scrollbar-width);',
    '  scrollbar-color: var(--scrollbar-color);',
    '  scrollbar-gutter: var(--scrollbar-gutter);',
    '}',
    '',
    '/* Tailwind v4: one utility per role, so bg-surface, text-muted,',
    '   border-separator and the legacy text-muted-foreground all compile. */',
    '@theme inline {',
    ...themeKeys([
      ...Object.keys(herouiFixed).map(kebab),
      ...Object.keys(herouiLight).map(kebab),
      ...Object.keys(herouiAliases).map(kebab),
    ]),
    ...radiusScale(),
    decl('radius-field', herouiFieldRadius),
    decl('radius-card', radiusCard),
    decl('shadow-control', shadowControl),
    '}',
    '',
    ...layoutTheme(),
    ...motionTheme(),
  ].join(NL);
}

/* ------------------------------------------------------------------- run */

const SHEETS = {
  'injishi-ramps.css': rampsSheet(),
  'injishi-tokens.css': tokensSheet(),
  'injishi-heroui.css': herouiSheet(),
};

const check = process.argv.includes('--check');
let stale = 0;

for (const [name, body] of Object.entries(SHEETS)) {
  const path = join(OUT, name);
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : null;
  // Compare without line endings. The sheets are emitted with CRLF, git stores
  // them with LF, and a Linux checkout (CI) keeps LF, so a byte comparison
  // reported every sheet STALE there while nothing had moved.
  if (existing !== null && existing.replace(/\r\n/g, '\n') === body.replace(/\r\n/g, '\n')) {
    console.log(`ok    generated/${name} up to date`);
    continue;
  }
  if (check) {
    console.error(`FAIL  generated/${name} is STALE`);
    stale += 1;
    continue;
  }
  writeFileSync(path, body);
  console.log(`ok    wrote generated/${name}`);
}

if (stale) {
  console.error('');
  console.error('      A token in src/ moved without regenerating the stylesheets. Run:');
  console.error('');
  console.error('        pnpm -F @injishi/design-tokens generate:css');
  console.error('');
  process.exit(1);
}
