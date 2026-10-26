import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the API transport.
 *
 * The filename rule and the boundary rules. The design rules read class
 * strings, and this package holds none: its strings are header names and
 * error codes.
 */
export default [
  { ignores: ['node_modules/**'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { parser: tsParser },
    plugins: { injishi },
    rules: {
      'injishi/kebab-case-filenames': 'error',
      'injishi/no-client-authz': 'error',
      // ADR-074 D-f. A technical package never imports a product, and the
      // transport never imports the server it talks to.
      'injishi/product-boundaries': 'error',
      'injishi/no-demo-data': 'error',
    },
  },
];
