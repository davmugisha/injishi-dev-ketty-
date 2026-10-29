// palette:check (mobile spec 0002, D-f, AC-5). Run with `pnpm --filter @injishi/mobile test`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { globalCssProblems, PALETTE_IMPORT } from "./palette-check.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "palette-check.mjs");
const GLOBAL_CSS = readFileSync(path.join(HERE, "..", "src", "global.css"), "utf8");

const sheet = (...lines) =>
  [
    '@import "tailwindcss";',
    '@import "uniwind";',
    '@import "heroui-native/styles";',
    '@import "heroui-native/styles/vibrant";',
    ...lines,
  ].join("\n");

test("AC-5: the app's own global.css passes", () => {
  assert.deepEqual(globalCssProblems(GLOBAL_CSS), []);
});

test("AC-5: palette:check runs green on the app, the package's staleness checks included", () => {
  const { status, stdout, stderr } = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(status, 0, stderr);
  assert.match(stdout, /declares no colour/);
});

test("AC-5: a missing palette import fails", () => {
  assert.match(globalCssProblems(sheet()).join("\n"), /is missing/);
});

test("AC-5: a doubled palette import fails", () => {
  const problems = globalCssProblems(sheet(`@import "${PALETTE_IMPORT}";`, `@import "${PALETTE_IMPORT}";`));
  assert.match(problems.join("\n"), /imported 2 times/);
});

test("AC-5: the palette imported before HeroUI's vibrant sheet fails", () => {
  const css = [
    '@import "heroui-native/styles";',
    `@import "${PALETTE_IMPORT}";`,
    '@import "heroui-native/styles/vibrant";',
  ].join("\n");
  assert.match(globalCssProblems(css).join("\n"), /before heroui-native\/styles\/vibrant/);
});

for (const literal of [
  "#006B55",
  "#fff",
  "#00000080",
  "oklch(47% 0.09 172)",
  "rgb(0 0 0)",
  "rgba(0,0,0,.5)",
  "hsl(0 0% 0%)",
]) {
  test(`AC-5: a colour in global.css fails (${literal})`, () => {
    const problems = globalCssProblems(sheet(`@import "${PALETTE_IMPORT}";`, `@theme { --brand: ${literal}; }`));
    assert.match(problems.join("\n"), /a colour is declared here/);
  });
}

test("AC-5: a theme block of its own fails, light or dark", () => {
  for (const theme of ["light", "dark"]) {
    const css = sheet(`@import "${PALETTE_IMPORT}";`, `@layer theme { :root { @variant ${theme} { --x: 1px; } } }`);
    assert.match(globalCssProblems(css).join("\n"), /a theme block is declared here/);
  }
});

test("AC-5: a colour inside a comment does not count", () => {
  const css = sheet(`@import "${PALETTE_IMPORT}";`, "/* the accent is #006B55, oklch(47% 0.09 172); @variant dark */");
  assert.deepEqual(globalCssProblems(css), []);
});
