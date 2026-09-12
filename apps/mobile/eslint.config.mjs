import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the Expo app.
 *
 * This app had no ESLint config at all, which is why `AGENTS.md` had to say the
 * kebab-case rule "cannot reach `apps/admin` or `apps/mobile` because neither
 * has an ESLint config". A naming standard that is enforced in two of the four
 * apps is a naming standard that drifts in the other two, and a case-only
 * difference resolves on Windows and 404s on Linux CI — so the gap was the kind
 * of silent failure the rule exists for.
 *
 * Narrower than `apps/web` on purpose:
 *
 *   - No `@next/eslint-plugin-next`. This is React Native, not Next.
 *   - No `injishi/no-client-authz`. That rule bans resolving a permission from
 *     a role in a browser; this app does not import `@injishi/contracts` at
 *     all yet. Add it the day it does, not before — a rule with nothing to
 *     check is a rule nobody has proven.
 *
 * ADR-034 task 5 added the two design rules that have a React Native shape.
 * This is the first time any design rule has reached this app: the four were
 * written against `apps/web` in a repository that was deleted, and
 * `parity.md` §5 measured what that cost here — 757 hand-typed type sizes and
 * 27 hex literals, with nothing to stop either.
 *
 * Both source roots are linted. `app/` is Expo Router's file-based routing and
 * `src/` is everything else; the rule's bracket exemption is what lets `app/`
 * keep its `[id].tsx` route files.
 */
export default [
  { ignores: ['node_modules/**', '.expo/**', 'expo-env.d.ts', 'babel.config.js', 'metro.config.js'] },
  {
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    // Parse only, no type-aware program: the rule reads the file name, so
    // loading a full TypeScript program here would cost seconds for nothing.
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { injishi },
    rules: {
      // code-standards.md, Naming. One convention for every source file.
      'injishi/kebab-case-filenames': 'error',

      // ADR-034 task 5. The two design rules that have a React Native shape.
      //
      // `no-arbitrary-width` and `ground-foreground-agreement` are NOT wired
      // here and that is deliberate rather than an omission: both read Tailwind
      // class names, and this app has none. A rule with nothing to check is a
      // rule nobody has proven, which is the same reason
      // `require-permission-on-guarded-route` waited for its first guarded
      // command.
      //
      // The type rule is what the `Text` API change bought. Before it, `size`
      // took a number and defaulted to 15 — not a step on the app's own scale —
      // and 757 call sites had typed one. There was no name to refuse a number
      // in favour of, so there was nothing for a rule to say.
      'injishi/no-arbitrary-type-scale': ['error', { web: false }],

      // Colour, the RN shape: a hex literal is the mobile form of a raw colour
      // class. Two directories are exempt and each earns it at its own
      // declaration — `src/theme/` holds the generated palette and the
      // photographic scrims (a photograph does not invert, so a scrim over one
      // is a FIXED ground and owes fixed foregrounds), and `src/data/photos.ts`
      // holds each photograph's own average colour, sampled at import. That
      // last one is data: it is derived from the image and could not come from
      // the palette if it tried.
      'injishi/no-raw-color-classes': [
        'error',
        { classes: false, allowHexIn: ['/src/theme/', '/src/data/photos.ts'] },
      ],
    },
  },
];
