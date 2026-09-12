import next from '@next/eslint-plugin-next';
import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the operator app.
 *
 * Deliberately narrow: the project's own rules and nothing else. A broad
 * recommended set would fail this app on a hundred unrelated style findings the
 * day it landed, and a lint step that always fails is a lint step everyone
 * skips — which would take the one rule that matters down with it.
 *
 * Widen it when someone decides to, not as a side effect of this.
 */
export default [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
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
    // Registered, not enabled. The app already carries a few
    // `eslint-disable @next/next/...` comments, and ESLint errors on a disable
    // for a rule it has never heard of. Registering the plugin makes those
    // comments resolve without turning a second rule set on here.
    plugins: { injishi, '@next/next': next },
    rules: {
      // ADR-012, AC-4. A client renders capability from the server-resolved
      // array; it never resolves a permission from a role.
      // code-standards.md, Naming. One convention for every source file: a
      // case-only difference resolves on Windows and 404s on Linux CI.
      'injishi/kebab-case-filenames': 'error',
      'injishi/no-client-authz': 'error',
      // ADR-036 calls 1 and 12. This app kept ten local components with twins
      // in `@injishi/ui`; the folder is gone and this is what keeps it gone.
      'injishi/no-duplicate-shared-component': 'error',
      // ADR-037 call 7. Same rule as apps/web; this app opens at 170 hand
      // typed sizes, which is the count the type scale decision is owed on.
      'injishi/surface-vocabulary': 'warn',
      'injishi/surface-refusals': 'error',

      // ADR-028's rule, RE-WIRED. The comment that used to sit here recorded a
      // worse failure than the one it described: ESLint aborts the whole run on
      // a rule it cannot find, so the missing rule was not merely absent — it
      // took `no-client-authz` above down with it, and this app enforced
      // NEITHER. ADR-034 task 5 puts the rule in the repo; this line is what
      // makes both of them run again.
      'injishi/ground-foreground-agreement': 'error',

      // ADR-027 §8. `classes: false` is not a weakening: this app writes its
      // colours through inline styles rather than utilities, so the class half
      // has nothing to check and the `var(--ink-*)` half has everything. The
      // two fixture directories hold IDENTITY colours — a workspace's own
      // square, a government officer's seal — which belong to the entity rather
      // than to the theme and must not move when it does. Same category as the
      // brand marks ADR-027 exempts by name; in production these arrive from
      // the API as data.
      'injishi/no-raw-color-classes': [
        'error',
        { allowHexIn: ['/pms/data/', '/oversight/data/'] },
      ],

      'injishi/no-arbitrary-width': 'error',

      // ADR-046, the motion scale. `error` from the day it was wired, at a
      // count of ZERO — and that zero is real, not a misconfigured rule: a
      // planted `duration-300 ease-in-out` on `today.tsx` produced both
      // warnings and was reverted.
      //
      // It is zero because this app's motion is CSS keyframes in
      // `pms-tokens.css` (`.pms-enter`, `.pms-pop`, `.pms-drawer`, the sidebar
      // transform) rather than Tailwind utilities, and no lint rule reads a
      // stylesheet. So the rule holds the line for new work while the real
      // migration — that sheet's five hand-typed durations onto the scale — is
      // still owed. Do not read this `error` as "this app is on the scale".
      'injishi/no-arbitrary-motion': ['error', { mobile: false }],

      // ADR-027 scoped itself to `apps/web` and left this app *"to that app's
      // own pass"*. The class half of the type rule has run here — 167 sizes
      // and 15 widths migrated in the same change as the rules — but the
      // `mobile` half reads a numeric `fontSize` property, and this app carries
      // **271** of those in React inline styles. Migrating them is a real
      // layout pass rather than a rename, so it is deferred with its number
      // recorded rather than deferred in silence. Turn this on when it lands.
      'injishi/no-arbitrary-type-scale': ['error', { mobile: false }],
    },
  },
];
