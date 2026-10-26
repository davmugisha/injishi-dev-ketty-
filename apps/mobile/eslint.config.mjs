import tsParser from "@typescript-eslint/parser";

import injishi from "../../tools/eslint-rules/index.mjs";

/**
 * Lint for the Expo app: the project's own rules, beside Biome.
 *
 * Biome (`lint:biome`, the root `biome.json`) is this app's general linter.
 * This config carries only the `injishi` rules, which reached the app it
 * replaced and not this one until ADR-074 stage 1.
 *
 * Each rule starts at the level this app can hold today, counted on
 * 2026-10-26. A `warn` is a count, not a pardon (the ADR-037 idiom).
 *
 * `no-duplicate-shared-component` is not here: this app renders no DOM and
 * shares the tokens with the web, never the components.
 *
 * The design vocabulary rules are left off for the reason `apps/app`'s config
 * records: they encode `@injishi/design-tokens`' named steps, and their mobile
 * halves were written against the app this one replaced
 * (`src/theme/tokens.ts`, which does not exist here). Measured at `warn` they
 * found 160 hand typed sizes, 2 widths and 191 surface hits. Whether this
 * app's theme takes that vocabulary is a decision still owed.
 */
export default [
  { ignores: ["node_modules/**", "dist-*/**", ".expo/**", "src/uniwind-types.d.ts"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { injishi },
    rules: {
      // ADR-012 AC-4. Never `can` or `permissionsForRole` on a phone.
      "injishi/no-client-authz": "error",

      // ADR-074 D-f. Never the server, a server database driver or a provider
      // SDK. The demo's on-device SQLite store is `no-demo-data`'s to retire.
      "injishi/product-boundaries": "error",

      // ADR-074, Import rules. 62 imports in 34 files read the demo today; a
      // counted backlog until stage 9.
      "injishi/no-demo-data": "warn",

      // code-standards.md, Naming. One file today, `components/AppShell.tsx`;
      // renaming it is a move (ADR-074 D-o). Expo Router's bracketed
      // parameter files (`[id].tsx`) are allowed by the rule.
      "injishi/kebab-case-filenames": "warn",

      // AGENTS.md, Never a raw hex. Zero today.
      "injishi/no-raw-color-classes": "error",
    },
  },
];
