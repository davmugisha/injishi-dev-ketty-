import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the token source.
 *
 * Only the filename rule applies, and here that is not a convenience: this
 * package is the ONE place a raw colour is allowed to be written down. Every
 * `oklch(...)` in `ramps.ts`, every named step in `layout.ts` and every
 * duration in `motion.ts` is the definition the other rules point at. Turning
 * `no-raw-color-classes`, `no-arbitrary-type-scale`, `no-arbitrary-width` or
 * `no-arbitrary-motion` on here would fail the source for being the source.
 *
 * `generated/` is not linted either. It is build output, and
 * `pnpm -F @injishi/design-tokens check` is what guards it against drift.
 *
 * ADR-048 AC-2 is what this file exists for: the package declared `typecheck`
 * and `check` but no `lint`, so `pnpm -r lint` skipped it.
 */
export default [
  { ignores: ['node_modules/**', 'dist/**', 'generated/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { injishi },
    rules: {
      'injishi/kebab-case-filenames': 'error',
    },
  },
];
