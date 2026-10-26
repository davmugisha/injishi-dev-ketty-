import tsParser from "@typescript-eslint/parser";

import injishi from "../../tools/eslint-rules/index.mjs";

/**
 * Lint for the demo's personas and fixtures: the project's own rules, beside
 * Biome.
 *
 * This package IS the demo, so `no-demo-data` has nothing to say here; it is
 * what that rule keeps out of production code. What applies is the filename
 * rule and the boundary rule: a technical package never imports a product.
 * The design rules read class strings, and the strings here are fixture data.
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
