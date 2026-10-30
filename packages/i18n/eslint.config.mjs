import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the message catalogs.
 *
 * The filename rule and the boundary rules. The design rules read class
 * strings, and the strings here will be sentences.
 */
export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { injishi },
    rules: {
      'injishi/kebab-case-filenames': 'error',
      'injishi/product-boundaries': 'error',
      'injishi/no-demo-data': 'error',
    },
  },
];
