import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the shared contracts.
 *
 * Only the filename rule applies. This package is Zod schemas and the types
 * inferred from them, so its strings are field names, enum members and the
 * permission and role vocabulary in `authz.ts`. Those are exactly the shape the
 * design rules misread as classes, which is the reason `ui-contract` records
 * for the same call.
 *
 * `no-client-authz` is deliberately absent too. It fails an app that IMPORTS
 * `can` or `permissionsForRole`; this package is where both are defined, so
 * enabling it here would fail the definition rather than a misuse.
 *
 * ADR-052 AC-2 is what this file exists for: the package declared `typecheck`
 * and `test` but no `lint`, so `pnpm -r lint` skipped it.
 */
export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { injishi },
    rules: {
      'injishi/kebab-case-filenames': 'error',
    },
  },
];
