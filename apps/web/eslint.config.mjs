import next from '@next/eslint-plugin-next';
import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the public web app.
 *
 * The same narrow shape as `apps/app`: the project's own rules and nothing
 * else. `apps/web` imports `@injishi/contracts` too, so the ban has to hold
 * here or it only half exists (ADR-012, AC-4 says "no client", not "not PMS").
 *
 * Widen it when someone decides to, not as a side effect of this.
 */
export default [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**'] },
  {
    // The Next rule set is registered but not run here, so this config cannot
    // honestly judge whether a `@next/next/...` disable comment is still
    // needed. Turn this back on the day those rules are enabled.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    // Parse only. No type-aware program is loaded: the rule reads import
    // statements, so a full type check here would cost seconds for nothing.
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { injishi, '@next/next': next },
    rules: {
      // ADR-012, AC-4. A client renders capability from the server-resolved
      // array; it never resolves a permission from a role.
      // code-standards.md, Naming. One convention for every source file: a
      // case-only difference resolves on Windows and 404s on Linux CI.
      'injishi/kebab-case-filenames': 'error',
      'injishi/no-client-authz': 'error',
      // ADR-036 calls 1 and 12. A component `@injishi/ui` owns is defined
      // there and nowhere else, and colour comes from a role rather than a
      // Tailwind ramp. This app is where the proof came from: its copy of
      // `button.tsx` had a HeroUI bug the package had already fixed.
      'injishi/no-duplicate-shared-component': 'error',
      // ADR-037 call 7. Three corners, a named type step, the shared Button
      // and Badge, and a ground that agrees with its theme. Corners and sizes
      // are a count today rather than a pardon; the legacy class and the
      // refused ground render wrong on screen and are the reason it exists.
      'injishi/surface-vocabulary': 'warn',
      'injishi/surface-refusals': 'error',

      // ADR-027 §8 and ADR-028 §6, restored by ADR-034 task 5. These four were
      // written for THIS app and never reached it: they lived in the deleted
      // `injishi.managed` repo, so `ui-rules.md` and `progress-tracker.md` both
      // described a build that failed on a raw colour class while nothing here
      // checked. The migration those rules were written to protect ran in the
      // same change that turned them on — 164 hand-typed type sizes, 51 unnamed
      // widths and 27 colour call sites — because ADR-027's rollout is explicit
      // that a half-migrated palette looks worse than either end of it.
      // One hex file: the Explore map's basemap palette. MapLibre paints the
      // map in WebGL from literal colours and cannot read CSS variables, the
      // same reason apps/app and apps/mobile carve out their data palettes.
      'injishi/no-raw-color-classes': [
        'error',
        { allowHexIn: ['/components/explore/explore-map-style.ts', '/components/home/journey-map.tsx'] },
      ],
      'injishi/no-arbitrary-type-scale': ['error', { mobile: false }],
      'injishi/no-arbitrary-width': 'error',
      'injishi/ground-foreground-agreement': 'error',

      // ADR-046, the motion scale. A count, not a pardon: this app was written
      // against stock timings for two years of commits and the migration is a
      // visual change on every band and card, so it gets its own pass rather
      // than riding along with the record that added the vocabulary. It flips
      // to `error` when the count reaches zero, the way the corner count did.
      'injishi/no-arbitrary-motion': ['warn', { mobile: false }],
    },
  },
];
