import { defineConfig } from "vitest/config";

/**
 * Vitest for the shared web library (2026-10-27), beside the kit's `node --test` suite.
 *
 * The two runners stay apart by folder. `node --test "tests/*.test.ts"` reads only the files directly in
 * `tests/`, and Vitest reads only `tests/unit/`, so no file is run by both. Two projects, chosen by
 * extension, so a test file says what it needs by its name:
 *
 * - `unit`: the `.test.ts` files under `tests/unit/`, in Node. Logic, never a render.
 * - `dom`: the `.test.tsx` files under `tests/unit/`, in jsdom with Testing Library
 *   (`tests/unit/setup-dom.ts`).
 *
 * Tests import the components from `src/`, the same files every app compiles through
 * `transpilePackages`. Only HeroUI's open source package is safe to render here: CI's unit job installs
 * without `HEROUI_AUTH_TOKEN`, so `@heroui-pro/react` is a stub there and a test that renders a Pro
 * component passes on a licensed laptop and fails in CI.
 */
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "dom",
          include: ["tests/unit/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["tests/unit/setup-dom.ts"],
          // A file's first render is cold. apps/app's first ThemeToggle test took 1.1 to 2.3 seconds alone
          // and its second, the same render, 40 to 190 ms (2026-10-27); with both projects starting at once
          // on a loaded machine the first crossed Vitest's default 5 seconds. A hang still fails, later.
          testTimeout: 15_000,
        },
      },
    ],
  },
});
