#!/usr/bin/env node
/**
 * Fail if anything reaches back into the retired prototype.
 *
 * The stack flip removed the captured HTML, the pre-compiled Tailwind dumps,
 * and the vanilla runtime. This guards the boundary: a stray `/assets/css/`
 * link or a `shared/js/` script tag would quietly reintroduce them.
 *
 * Run by CI through `pnpm lint`, and cheap enough to run by hand.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/..."
// which is not a usable path.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".turbo",
  "dist",
  "scripts",
  "docs",
]);

const FORBIDDEN = [
  { pattern: /\/assets\/css\//, reason: "captured Tailwind dump" },
  { pattern: /shared\/js\//, reason: "prototype vanilla runtime" },
  { pattern: /shared\/vendor\//, reason: "browser Tailwind compiler or Swiper" },
  { pattern: /src-mirror/, reason: "machine-generated capture mirror" },
  { pattern: /\.dc\.html/, reason: "captured HTML" },
  { pattern: /_rwanda_media\//, reason: "pre-migration media path" },
  { pattern: /injishi-cloak/, reason: "FOUC cloak; build-time CSS made it unnecessary" },
];

const CHECKED_EXTENSIONS = /\.(tsx?|jsx?|mjs|css|json|html)$/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (CHECKED_EXTENSIONS.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

const failures = [];

for await (const file of walk(ROOT)) {
  const contents = await readFile(file, "utf8");
  for (const { pattern, reason } of FORBIDDEN) {
    if (pattern.test(contents)) {
      failures.push(`${relative(ROOT, file)}: ${pattern.source} (${reason})`);
    }
  }
}

if (failures.length > 0) {
  console.error("Legacy prototype references found:\n");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error(
    "\nThese paths no longer exist. See docs/adr/0001-regenerate-tailwind-at-build-time.md.",
  );
  process.exit(1);
}

console.warn("No legacy prototype references.");
