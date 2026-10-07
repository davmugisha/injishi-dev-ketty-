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

const TODAY = "2026-10-07";

describe("navCountsFrom", () => {
  test("counts pending requests, arrivals still to check in, and rooms needing a clean", () => {
    const counts = navCountsFrom(
      {
        reservations: [
          { state: "pending", checkIn: TODAY },
          { state: "confirmed", checkIn: TODAY },
          { state: "pending", checkIn: "2026-10-09" },
          { state: "inhouse", checkIn: TODAY },
          { state: "confirmed", checkIn: TODAY },
          { state: "confirmed", checkIn: "2026-10-08" },
        ],
      },
      { rooms: [{ housekeeping: "dirty" }, { housekeeping: "clean" }, { housekeeping: "inspected" }, { housekeeping: "dirty" }] },
      TODAY,
    );
    assert.deepEqual(counts, { pendingReservations: 2, arrivalsToCheckIn: 2, housekeepingOpen: 2 });
  });

  test("a guest already checked in is not an arrival to check in", () => {
    const counts = navCountsFrom({ reservations: [{ state: "inhouse", checkIn: TODAY }] }, undefined, TODAY);
    assert.equal(counts.arrivalsToCheckIn, 0);
  });

  test("tomorrow's arrival is not today's", () => {
    const counts = navCountsFrom({ reservations: [{ state: "confirmed", checkIn: "2026-10-08" }] }, undefined, TODAY);
    assert.equal(counts.arrivalsToCheckIn, 0);
  });

  test("a read that has not answered is null, not zero", () => {
    assert.deepEqual(navCountsFrom(undefined, undefined, TODAY), {
      pendingReservations: null,
      arrivalsToCheckIn: null,
      housekeepingOpen: null,
    });
  });

  test("an answered read with nothing in it is a real zero", () => {
    assert.deepEqual(navCountsFrom({ reservations: [] }, { rooms: [] }, TODAY), {
      pendingReservations: 0,
      arrivalsToCheckIn: 0,
      housekeepingOpen: 0,
    });
  });
});
