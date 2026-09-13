import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the shared presentation helpers.
 *
 * Only the filename rule applies. `cn` merges class strings but never spells
 * one, and the rest of the package is en-RW money and date formatting plus
 * search-param builders, so the design rules have nothing here to read. The
 * money formatter's strings are currency codes and locale tags.
 *
 * ADR-052 AC-2 is what this file exists for: `pnpm -r lint` used to skip this
 * package entirely, because it declared no scripts at all.
 */
export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { injishi },
    rules: {
      'injishi/kebab-case-filenames': 'error',
    },
  },
];
