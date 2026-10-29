#!/usr/bin/env node
/**
 * `palette:check` (mobile spec 0002, D-f, AC-5): the phone's colours come from
 * @injishi/design-tokens, and nowhere else.
 *
 * `src/global.css` declares no colour. It imports the package's native sheet
 * (`@injishi/design-tokens/native.css`) once, after HeroUI Native's own sheets,
 * so the Injishi palette overrides HeroUI's. After CSS comments are stripped,
 * this fails on:
 *
 *  - the palette import missing, doubled, or placed before a HeroUI sheet;
 *  - a colour literal in `global.css`: a hex (`#` then 3, 4, 6 or 8 hex
 *    digits), `oklch(`, `rgb(`, `rgba(`, `hsl(` or `hsla(`;
 *  - a `@variant light` or `@variant dark` block in `global.css` (a theme
 *    block of its own, which is how the phone drew HeroUI's blue until
 *    2026-10-28: Uniwind drops variants declared outside `:root`);
 *  - the package's native sheet stale against `src/heroui.ts`: its own
 *    `check-dist.mjs` and `emit-css.mjs --check`, which also refuse a palette
 *    under its contrast floors.
 *
 *   node scripts/palette-check.mjs
 *
 * Run by `check:ci`, step 3. It replaced the placeholder `palette-pending.mjs`.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const PALETTE_IMPORT = "@injishi/design-tokens/native.css";
const HEROUI_SHEETS = ["heroui-native/styles", "heroui-native/styles/vibrant"];

/** Every problem with a `global.css` source, as sentences. Empty means it passes. */
export function globalCssProblems(source) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const problems = [];

  const imports = [...css.matchAll(/@import\s+["']([^"']+)["']/g)].map(([, target]) => target);
  const palette = imports.filter((target) => target === PALETTE_IMPORT).length;
  if (palette === 0) problems.push(`the import of ${PALETTE_IMPORT} is missing`);
  if (palette > 1) problems.push(`${PALETTE_IMPORT} is imported ${palette} times`);
  if (palette === 1) {
    const at = imports.indexOf(PALETTE_IMPORT);
    for (const sheet of HEROUI_SHEETS) {
      const index = imports.indexOf(sheet);
      if (index === -1) problems.push(`the import of ${sheet} is missing`);
      else if (index > at) problems.push(`${PALETTE_IMPORT} is imported before ${sheet}, which would override it`);
    }
  }

  for (const [literal] of css.matchAll(
    /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\b(?:oklch|rgba?|hsla?)\(/gi,
  )) {
    problems.push(`a colour is declared here (${literal}); colours come from ${PALETTE_IMPORT}`);
  }
  for (const [block] of css.matchAll(/@variant\s+(?:light|dark)\b/g)) {
    problems.push(`a theme block is declared here (${block}); the themes come from ${PALETTE_IMPORT}`);
  }
  return problems;
}

/** The package's own staleness checks, run where the package lives. */
function staleProblems() {
  const require = createRequire(import.meta.url);
  const tokensDir = path.dirname(path.dirname(require.resolve("@injishi/design-tokens")));
  const problems = [];
  for (const args of [["scripts/check-dist.mjs"], ["scripts/emit-css.mjs", "--check"]]) {
    const run = spawnSync(process.execPath, args, { cwd: tokensDir, encoding: "utf8" });
    if (run.status !== 0) {
      problems.push(`@injishi/design-tokens ${args.join(" ")} failed:\n${(run.stderr || run.stdout).trim()}`);
    }
  }
  return problems;
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.join(here, "..", "src", "global.css");
  const problems = [...globalCssProblems(readFileSync(file, "utf8")), ...staleProblems()];
  if (problems.length > 0) {
    console.error("palette:check failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      "\nThe phone's colours live in packages/design-tokens/src/heroui.ts. Change them there, run\n" +
        "`pnpm --filter @injishi/design-tokens build` and `generate:css`, and keep src/global.css to its imports.",
    );
    process.exit(1);
  }
  console.log(
    `palette:check: src/global.css imports ${PALETTE_IMPORT} once and declares no colour; the sheet is current.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
