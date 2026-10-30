import tsParser from '@typescript-eslint/parser';

import injishi from '../../tools/eslint-rules/index.mjs';

/**
 * Lint for Injishi Mock APIs.
 *
 * The filename rule and the boundary rules. It is a server, so it may not
 * import a product or the demo fixtures, and it never imports the API it
 * stands in front of: the two meet only over HTTP, which is the whole point
 * of the sandbox seam. The design rules read class strings, and the console's
 * markup here uses system colours, never a palette class.
 */
export default [
  { ignores: ['node_modules/**', '.data/**'] },
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
