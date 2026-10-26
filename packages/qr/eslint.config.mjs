import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the QR encoder.
 *
 * Only the filename rule applies. The package is one byte-level encoder with no
 * markup and no class strings, so the design rules have nothing to read and
 * would only misread its mode and error-correction tables.
 *
 * It exists for ADR-052 AC-2: every workspace member declares typecheck, lint
 * and test, or `pnpm -r` passes over it in silence.
 */
export default [
  { ignores: ['node_modules/**', 'dist/**'] },
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
