import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the vocabulary contract.
 *
 * Only the filename rule applies. The design rules read class strings, and this
 * package holds none: its strings are component, variant and size NAMES, which
 * is exactly what those rules would misread as classes (`outline`, `ghost`).
 * `typecheck` is the check that matters here, and it runs with skipLibCheck off.
 */
export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { injishi },
    rules: {
      'injishi/kebab-case-filenames': 'error',
      // ADR-074 D-f. A technical package never imports a product, and
      // production code never imports the demo.
      'injishi/product-boundaries': 'error',
      'injishi/no-demo-data': 'error',
    },
  },
];
