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
 * The five design vocabulary rules run with their `native` halves (mobile spec
 * 0002, D-z, AC-18), written for this app's kit on 2026-10-29: the type table
 * in `src/components/ui/text.tsx`, the sizes in `metrics.ts` and `rnSpace`,
 * the motion in `@injishi/design-tokens`' `motion.ts`, and the grounds
 * HeroUI Native and `injishi-native.json` define, each with its pair. Each
 * rule's own comment says what its native half reads. They are `error` on the
 * kit and the design system screen, which are built on that vocabulary, and a
 * counted `warn` on the screens built before it (D-y), which keep their hand
 * typed sizes until their slice rebuilds them. Counted on 2026-10-29, all in
 * the old screens and `components/phone.tsx`, none in the kit or the dev screen:
 *
 *   no-arbitrary-type-scale       403  (160 `text-[Npx]`, 243 Tailwind steps)
 *   no-arbitrary-width             44  (bracket sizes and style numbers)
 *   ground-foreground-agreement     8  (a solid status colour or `text-foreground`
 *                                       on a soft ground, `text-danger` on the page)
 *   surface-vocabulary              3  (`bg-foreground`, `bg-foreground/75`)
 *   no-arbitrary-motion             0
 */

/** The five design rules at one level, each on its native half. */
const designRules = (level) => ({
  "injishi/no-arbitrary-type-scale": [level, { native: true }],
  "injishi/no-arbitrary-motion": [level, { native: true }],
  "injishi/no-arbitrary-width": [level, { native: true }],
  "injishi/surface-vocabulary": [level, { native: true }],
  "injishi/ground-foreground-agreement": [level, { native: true }],
});

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

      // D-z. The screens built before the kit: a counted backlog (header).
      ...designRules("warn"),
    },
  },
  {
    // D-z. The kit and the design system screen are the vocabulary; they hold it.
    files: ["src/components/ui/**/*.{ts,tsx}", "src/features/dev/**/*.{ts,tsx}", "src/app/dev/**/*.{ts,tsx}"],
    rules: designRules("error"),
  },
];
