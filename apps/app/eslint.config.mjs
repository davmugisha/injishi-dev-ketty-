import tsParser from "@typescript-eslint/parser";

import injishi from "../../tools/eslint-rules/index.mjs";

/**
 * Lint for the business app: the project's own rules, beside Biome.
 *
 * Biome (`lint:biome`, the root `biome.json`) is this app's general linter.
 * This config carries only the `injishi` rules, and it exists because before
 * ADR-074 stage 1 none of them reached this app: `no-client-authz` ran in
 * `apps/web` and nowhere a role is resolved more often.
 *
 * Each rule starts at the level this app can hold today, counted on
 * 2026-10-26. A `warn` is a count, not a pardon (the ADR-037 idiom): the lint
 * ratchet holds it, and it flips to `error` when it reaches zero.
 *
 * Six rules are left OFF, and that is a decision owed, not a pardon:
 * `no-arbitrary-type-scale`, `no-arbitrary-width`, `no-arbitrary-motion`,
 * `surface-vocabulary`, `surface-refusals` and `ground-foreground-agreement`.
 * They encode the named steps of `@injishi/design-tokens` (`text-2xs`,
 * `max-w-read`, `duration-quick`), and this app's theme is HeroUI Pro's mouve
 * (ADR-068), which defines none of them, so the fix each one suggests would
 * change what renders: `text-[13px]` to `text-sm` is 14px here. Measured at
 * `warn` they found 1783 hand typed sizes, 98 widths, 2 timings and 1884
 * surface hits (the sizes again, plus 51 deleted corners). Whether the
 * interface takes that vocabulary is the open call PR #64 named; turn them on
 * when it is made, not as a side effect of this.
 */
export default [
  { ignores: [".next/**", ".next-*/**", "node_modules/**", "next-env.d.ts", "public/**"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    // Parse only. These rules read import statements and strings, so a
    // type-aware program would cost seconds for nothing.
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { injishi },
    rules: {
      // ADR-012 AC-4. A client renders capability from the grant the server
      // resolved; it never resolves a permission from a role.
      "injishi/no-client-authz": "error",

      // ADR-074 D-f. This app imports a product only through its `exports`,
      // and never the server, a database driver or a provider SDK.
      "injishi/product-boundaries": "error",

      // ADR-074, Import rules. 643 imports in 357 files read the demo's
      // personas, fixtures and embedded store today. A counted backlog until
      // stage 9 retires them; the demo's own files are exempt by path.
      "injishi/no-demo-data": "warn",

      // code-standards.md, Naming. 191 PascalCase file names came in with the
      // interface. Renaming one is a move (ADR-074 D-o), so it waits for the
      // stage that moves its folder.
      "injishi/kebab-case-filenames": "warn",

      // ADR-036. A component `@injishi/ui` owns is defined there only, and
      // colour comes from a role, never a Tailwind ramp. Zero today.
      "injishi/no-duplicate-shared-component": "error",

      // AGENTS.md, Never a raw hex. One literal today.
      "injishi/no-raw-color-classes": "warn",
    },
  },
];
