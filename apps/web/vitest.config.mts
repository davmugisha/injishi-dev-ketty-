import { defineConfig } from "vitest/config";

/**
 * Vitest for the marketplace (2026-10-27), beside the `node --test` suite.
 *
 * `tests/*.test.mjs` runs on plain Node, which reads neither TypeScript nor the `@/` alias, so those files
 * check a module's source text or transpile it by hand, and cannot replace a module the code imports.
 * Vitest imports the module, resolves `@/`, and can stand in for an import with `vi.mock`. The two
 * runners stay apart by folder: `node --test "tests/*.test.mjs"` reads only the files directly in
 * `tests/`, and Vitest reads only `tests/unit/`. Two projects, chosen by extension, so a test file says
 * what it needs by its name:
 *
 * - `unit`: the `.test.ts` files under `tests/unit/`, in Node. Logic, never a render.
 * - `dom`: the `.test.tsx` files under `tests/unit/`, in jsdom with Testing Library
 *   (`tests/unit/setup-dom.ts`).
 *
 * `@/` resolves from tsconfig.json's own `paths`, so the alias keeps one definition. JSX is compiled with
 * React's automatic runtime, pinned here rather than read from tsconfig.json: that file's `jsx` is Next's
 * setting (`preserve` when this was written, `react-jsx` since main's Next 16 move), and a component left
 * as JSX cannot run. Vitest renders client components only: an `async` Server Component is a browser
 * test's job.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  oxc: { jsx: { runtime: "automatic" } },
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
