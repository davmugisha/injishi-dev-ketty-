/**
 * Booking a specific room (2026-10-12).
 *
 * The property card used to sell one room only: the cheapest one the party
 * fit. A guest who wanted the Double room at Umurage Test Lodge could see it
 * listed and could not buy it. `roomToSell` now takes the guest's choice;
 * these pin what it does with one, and without.
 *
 * `src/data/property-rooms.ts` is transpiled and its two imports bound to
 * stand-ins: the contract schema and the API client are not what is under
 * test, and loading them pulls in the whole contracts package.
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

globalThis.__roomsDeps = { PropertyDetail: {}, apiFetchParsed: async () => ({ status: "failed" }) };

const src = readFileSync(resolve(here, "..", "src/data/property-rooms.ts"), "utf8");
let { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
outputText = outputText
  .replace(/import\s*\{([^}]*)\}\s*from\s*"@injishi\/contracts";/, "const {PropertyDetail} = globalThis.__roomsDeps;")
  .replace(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/api";/, "const {apiFetchParsed} = globalThis.__roomsDeps;");
assert.doesNotMatch(outputText, /^\s*import\s/m, "property-rooms imports something this harness does not bind");
const { roomToSell } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const room = (id, capacity, nightlyRateRwf) => ({ id, name: id, capacity, nightlyRateRwf });
// The API's order, cheapest first.
const SINGLE = room("single", 2, 200);
const DOUBLE = room("double", 2, 300);
const FAMILY = room("family", 4, 500);
const sellable = [SINGLE, DOUBLE, FAMILY];

describe("roomToSell", () => {
  test("with no choice, it sells the cheapest room the party fits", () => {
    assert.equal(roomToSell(sellable, null, 2).room, SINGLE);
    assert.equal(roomToSell(sellable, null, 3).room, FAMILY);
  });

  test("a chosen room that fits is the one sold, even when a cheaper one fits", () => {
    const result = roomToSell(sellable, "double", 2);
    assert.equal(result.room, DOUBLE);
    assert.equal(result.chosen, DOUBLE);
    assert.equal(result.chosenTooSmall, false);
  });

  test("a chosen room too small for the party is not swapped for one that fits", () => {
    const result = roomToSell(sellable, "double", 3);
    assert.equal(result.room, null);
    assert.equal(result.chosen, DOUBLE);
    assert.equal(result.chosenTooSmall, true);
  });

  test("a choice that is not on sale here falls back to the best fit", () => {
    const result = roomToSell(sellable, "archived-room", 2);
    assert.equal(result.room, SINGLE);
    assert.equal(result.chosen, null);
    assert.equal(result.chosenTooSmall, false);
  });

  test("a room with no stated capacity takes any party", () => {
    const open = room("open", null, 100);
    assert.equal(roomToSell([open], "open", 9).room, open);
  });
});
