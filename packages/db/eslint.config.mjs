import tsParser from "@typescript-eslint/parser";

import injishi from "../../tools/eslint-rules/index.mjs";

/**
 * Lint for the demo's embedded document store: the project's own rules,
 * beside Biome.
 *
 * Like `@injishi/data`, this package IS the demo, so `no-demo-data` is not
 * here. Its SQLite driver is the demo's own and is not a server database
 * driver, which is why `product-boundaries` does not refuse it: a package is
 * not client code, and the rule's driver list is the server's.
 */
export default [
  { ignores: ["node_modules/**"] },
  {
    files: ["src/**/*.ts"],
    languageOptions: { parser: tsParser },
    plugins: { injishi },
    rules: {
      "injishi/kebab-case-filenames": "error",
      "injishi/product-boundaries": "error",
    },
  },
];
