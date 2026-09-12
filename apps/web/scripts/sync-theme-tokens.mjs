// Syncs the ramp primitives inside public/shared/js/injishi-theme.js from the
// single design-token source (@injishi/design-tokens). The web runtime script
// has no bundler, so instead of importing at runtime we regenerate the marked
// ramp block at build/author time — runtime output stays byte-identical, but
// the hex values live in exactly one place (the package), not hand-maintained
// here. Run: pnpm --filter @injishi/web tokens:sync
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { ink, green } from "@injishi/design-tokens";

const START = "injishi-tokens:ramps:start";
const END = "injishi-tokens:ramps:end";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../public/shared/js/injishi-theme.js");

const toLines = (name, ramp) =>
  Object.entries(ramp).map(([step, hex]) => `    '  --${name}-${step}: ${hex};',`);

const block = [
  `    '  /* ${START} (generated from @injishi/design-tokens — run \`pnpm --filter @injishi/web tokens:sync\`; do not hand-edit) */',`,
  ...toLines("ink", ink),
  ...toLines("green", green),
  `    '  /* ${END} */',`,
].join("\n");

const src = readFileSync(target, "utf8");
const re = /[^\n]*injishi-tokens:ramps:start[\s\S]*?injishi-tokens:ramps:end[^\n]*/;
if (!re.test(src)) {
  console.error(`sync-theme-tokens: markers not found in ${target}`);
  process.exit(1);
}
const next = src.replace(re, block);
if (next === src) {
  console.log("sync-theme-tokens: already up to date");
} else {
  writeFileSync(target, next, "utf8");
  console.log("sync-theme-tokens: updated injishi-theme.js ramp block");
}
