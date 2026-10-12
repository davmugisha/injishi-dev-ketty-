/**
 * The "Where to?" ranking, with the stays businesses published.
 *
 * Found testing Explore: typing "umura" answered "Nothing matches" while
 * Umurage Guesthouse sat in the results underneath. The field only ranked the
 * code's fixed list, so no stay published from the operator app could be found
 * by name. `rankDestinations` now takes those stays as `extra`; these pin that
 * they are found. The fixed list holds places only (2026-10-08): every named
 * stay comes from the database.
 *
 * `src/lib/destination-search.ts` is transpiled and its one import, the fixed
 * destination list, is bound to a small stand-in: the real list pulls in the
 * whole place list, and what is under test is the ranking, not the places.
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

const KIGALI = { id: "d-kigali", label: "Kigali", context: "City", kind: "district", district: "kigali" };
globalThis.__destinations = {
  DESTINATIONS: [KIGALI],
  POPULAR_DESTINATIONS: [KIGALI],
};

const src = readFileSync(resolve(here, "..", "src/lib/destination-search.ts"), "utf8");
let { outputText } = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
outputText = outputText.replace(
  /import\s*\{([^}]*)\}\s*from\s*"@\/data\/destinations";/,
  "const {$1} = globalThis.__destinations;",
);
assert.doesNotMatch(outputText, /^\s*import\s/m, "destination-search imports something this harness does not bind");
const { rankDestinations } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const published = [
  { id: "s-umurage-guesthouse", label: "Umurage Guesthouse", context: "Gasabo", kind: "stay", slug: "umurage-guesthouse" },
  { id: "s-kivu-crest-hotel", label: "Kivu Crest Hotel", context: "Rubavu", kind: "stay", slug: "kivu-crest-hotel" },
];
const labels = (hits) => hits.map((hit) => hit.destination.label);

describe("rankDestinations with published stays", () => {
  test("a published stay was not findable from the fixed list alone", () => {
    assert.deepEqual(labels(rankDestinations("umura")), []);
  });

  test("a published stay is found by the start of its name", () => {
    assert.deepEqual(labels(rankDestinations("umura", 7, published)), ["Umurage Guesthouse"]);
  });

  test("a stay is found by a later word of its name", () => {
    assert.deepEqual(labels(rankDestinations("crest", 7, published)), ["Kivu Crest Hotel"]);
  });

  test("an empty query still opens on the popular places, not the published stays", () => {
    assert.deepEqual(labels(rankDestinations("", 7, published)), ["Kigali"]);
  });
});
