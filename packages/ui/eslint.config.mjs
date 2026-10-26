import tsParser from "@typescript-eslint/parser";

import injishi from "../../tools/eslint-rules/index.mjs";

/**
 * Lint for the shared web library: the project's own rules, beside Biome.
 *
 * Biome (`lint:biome`) is this package's general linter. This config carries
 * the `injishi` rules, which reached `packages/web-ui` and not the library
 * ADR-074 D-l names as the one web library, until stage 1.
 *
 * `no-duplicate-shared-component` is not here, for the reason `web-ui`'s config
 * gives: this IS `@injishi/ui`, so every definition here is the canonical one.
 *
 * The design vocabulary rules are left off for the reason `apps/app`'s config
 * records: they encode `@injishi/design-tokens`' named steps and this
 * library's theme is HeroUI Pro's mouve (ADR-068). Measured at `warn` they
 * found 5 hand typed sizes and 1 width, all in `device.tsx`.
 */
export default [
  { ignores: ["node_modules/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { injishi },
    rules: {
      "injishi/kebab-case-filenames": "error",

      // ADR-012 AC-4. A shared component that resolved a permission from a
      // role would put that mistake in every app at once.
      "injishi/no-client-authz": "error",

      // ADR-074 D-f. A technical package never imports a product, and
      // production code never imports the demo.
      "injishi/product-boundaries": "error",
      "injishi/no-demo-data": "error",

      // AGENTS.md, Never a raw hex.
      "injishi/no-raw-color-classes": "error",
    },
  },
];
