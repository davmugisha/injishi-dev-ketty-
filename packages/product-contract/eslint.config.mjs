import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the product contract.
 *
 * The filename rule and the boundary rules. The design rules read class
 * strings, and this package holds none: its strings are product and module
 * IDs, which those rules would misread as classes. `typecheck` is the check
 * that matters here.
 */
export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { injishi },
    rules: {
      'injishi/kebab-case-filenames': 'error',
      // ADR-074 D-f. A technical package never imports a product.
      'injishi/product-boundaries': 'error',
      'injishi/no-demo-data': 'error',
    },
  },
];
