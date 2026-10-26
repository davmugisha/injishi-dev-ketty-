import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for the shared auth package.
 *
 * Only the filename rule applies, and that is a judgement rather than an
 * oversight. The other ten rules in the plugin read class strings, and this
 * package holds none: it is Better Auth configuration, an OTP budget and a
 * phone plugin. Its strings are provider names, cookie prefixes and SQL
 * fragments, which the colour and size rules would misread exactly the way
 * `ui-contract` records for component names.
 *
 * ADR-052 AC-2 is what this file exists for: `pnpm -r lint` used to skip this
 * package entirely, because it declared no scripts at all.
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
