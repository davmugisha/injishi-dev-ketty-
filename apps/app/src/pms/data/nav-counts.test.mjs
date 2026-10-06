/**
 * The sidebar pills count what a live read returned, and say nothing for a
 * read that has not answered: an absent count is no pill, never a zero.
 *
 * Runs the real function: the source is read, its imports are dropped (the
 * hooks they bring are not called here), and the TypeScript is transpiled and
 * evaluated, the way `lib/walk-in-body.test.mjs` does.
 *
 * Run: pnpm --filter @injishi/app test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ts = require("typescript");

async function load() {
  let src = readFileSync(resolve(here, "nav-counts.ts"), "utf8");
  const imports = /^import[^;]+;\s*$/gm;
  assert.ok(src.match(imports)?.length, "nav-counts.ts has no imports to strip; update this loader");
  src = src.replace(imports, "");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { navCountsFrom } = await load();

describe("navCountsFrom", () => {
  test("counts pending requests and rooms needing a clean", () => {
    const counts = navCountsFrom(
      { reservations: [{ state: "pending" }, { state: "confirmed" }, { state: "pending" }, { state: "inhouse" }] },
      { rooms: [{ housekeeping: "dirty" }, { housekeeping: "clean" }, { housekeeping: "inspected" }, { housekeeping: "dirty" }] },
    );
    assert.deepEqual(counts, { pendingReservations: 2, housekeepingOpen: 2 });
  });

  test("a read that has not answered is null, not zero", () => {
    assert.deepEqual(navCountsFrom(undefined, undefined), { pendingReservations: null, housekeepingOpen: null });
  });

  test("an answered read with nothing in it is a real zero", () => {
    assert.deepEqual(navCountsFrom({ reservations: [] }, { rooms: [] }), { pendingReservations: 0, housekeepingOpen: 0 });
  });
});
