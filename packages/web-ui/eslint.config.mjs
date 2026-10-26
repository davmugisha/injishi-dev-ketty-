import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the shared component package.
 *
 * This package had no config and no `lint` or `typecheck` script, so it was the
 * only code in the repo that BOTH `pnpm -r lint` and `pnpm -r typecheck`
 * skipped — while every app consuming it was checked. The one place a design
 * rule matters most was the one place no design rule ran.
 *
 * The rule set is deliberately narrower than an app's, because one of the app
 * rules asks a question that does not apply here:
 *
 *   - `no-duplicate-shared-component` asks whether a component `@injishi/ui`
 *     owns is redefined outside it. This IS `@injishi/ui`; every definition
 *     here is the canonical one, so the rule would flag the source of truth.
 *
 * `no-client-authz` used to be left out too, because this package imported no
 * contracts. The list framework (ADR-058, 058-list-framework) reads the one list
 * spec from `@injishi/contracts`, so the rule is on: a shared component that
 * resolved a permission from a role would put that mistake in every app.
 *
 * What does apply is the whole design vocabulary. A raw colour class or a hand
 * typed size that ships from here lands in all three apps at once.
 */
export default [
  { ignores: ['node_modules/**', 'dist/**', 'storybook-static/**'] },
  {
    // Stories and the Storybook config are held to the same vocabulary as the
    // components (ADR-045): a story that reaches for a raw colour or a hand
    // typed size is an endorsement of it.
    files: ['src/**/*.{ts,tsx}'],
    // Parse only, like the apps. These rules read strings and import
    // statements, so a type-aware program would cost seconds for nothing.
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { injishi },
    rules: {
      // code-standards.md, Naming. One convention for every source file.
      'injishi/kebab-case-filenames': 'error',

      // ADR-012 AC-4. Never `can` or `permissionsForRole` in a browser.
      'injishi/no-client-authz': 'error',

      // ADR-074 D-f. A technical package never imports a product, and
      // production code never imports the demo.
      'injishi/product-boundaries': 'error',
      'injishi/no-demo-data': 'error',

      // ADR-027 section 8 and ADR-028 section 6. Colour comes from a role, a
      // size from a named step, a width from a named token, and a ground
      // agrees with its foreground.
      'injishi/no-raw-color-classes': 'error',
      'injishi/no-arbitrary-type-scale': ['error', { mobile: false }],
      'injishi/no-arbitrary-width': 'error',
      'injishi/ground-foreground-agreement': 'error',

      // ADR-037 call 7. Three corner names and no legacy `.btn` / `.badge`.
      // ADR-037 recorded that this package itself still used the corner classes
      // ADR-027 deleted, which is exactly the drift an unlinted package grows.
      'injishi/surface-vocabulary': 'warn',
      'injishi/surface-refusals': 'error',

      // ADR-046. Five named durations, four named curves. `error` here, and
      // the count that earns it is zero: the seven stock timings this package
      // shipped were migrated in the same change that added the rule, because
      // they are the ones every app inherits. `Sheet` is the one to look at —
      // it opened over half a second and closed in 300ms on one symmetric
      // curve; it is `travel` in on `settle` and `quick` out on `leave` now,
      // which is the scale's rule that a thing leaves faster than it arrived.
      'injishi/no-arbitrary-motion': ['error', { mobile: false }],
    },
  },
];
