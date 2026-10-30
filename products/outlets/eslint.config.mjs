import tsParser from "@typescript-eslint/parser";

import injishi from "../../tools/eslint-rules/index.mjs";

/**
 * Lint for Injishi Outlets, the third product (ADR-074 stage 5).
 *
 * A product starts clean, so every rule here is at `error` and its lint
 * baseline row is 0. The boundary rules are what make it a product: it never
 * imports an app, another product or server code, and never the demo packages
 * (`@injishi/data`, `@injishi/db`); its data, links and actions come from the
 * app that mounts it.
 *
 * The design vocabulary rules are off for the reason `packages/ui`'s config
 * gives: they encode `@injishi/design-tokens`' named steps, while these views
 * are drawn on HeroUI Pro's mouve theme (ADR-068). That call is owed to
 * `/architect` for the app, `packages/ui` and every product at once.
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

      // ADR-012 AC-4. Capability comes from the server's grant, never a role.
      "injishi/no-client-authz": "error",

      // ADR-074 D-f, and production code never imports the demo.
      "injishi/product-boundaries": "error",
      "injishi/no-demo-data": "error",

      // ADR-036. A product draws with `@injishi/ui`; it never grows its own
      // copy of a component the library owns.
      "injishi/no-duplicate-shared-component": "error",

      // AGENTS.md, Never a raw hex.
      "injishi/no-raw-color-classes": "error",
    },
  },
];
