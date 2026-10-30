/**
 * The Reservations search matches a guest's name or a booking reference the
 * way a desk types them.
 *
 * Runs the real function: the source is read, transpiled and evaluated, the
 * way `walk-in-body.test.mjs` does. The module has no imports to strip.
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
  const src = readFileSync(resolve(here, "booking-search.ts"), "utf8");
  assert.ok(!/^import /m.test(src), "booking-search.ts grew an import; strip it in this loader");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { matchesBookingQuery, referenceKey } = await load();

describe("matchesBookingQuery", () => {
  test("an empty or blank query matches every booking", () => {
    assert.equal(matchesBookingQuery("Aline Uwase", "BKG-4467", ""), true);
    assert.equal(matchesBookingQuery("Aline Uwase", "BKG-4467", "   "), true);
  });

  test("a name matches whatever the case, the accents or the word order", () => {
    assert.equal(matchesBookingQuery("Immaculée Nyirahabimana", "BKG-4481", "immaculee"), true);
    assert.equal(matchesBookingQuery("Aline Uwase", "BKG-4467", "UWASE aline"), true);
    assert.equal(matchesBookingQuery("Aline Uwase", "BKG-4467", "ali"), true);
  });

  test("every word must appear in the name", () => {
    assert.equal(matchesBookingQuery("Aline Uwase", "BKG-4467", "aline mutoni"), false);
  });

  test("a reference matches on its letters and digits alone", () => {
    assert.equal(matchesBookingQuery("Chantal Mutoni", "BKG-4469", "bkg 4469"), true);
    assert.equal(matchesBookingQuery("Chantal Mutoni", "BKG-4469", "BKG4469"), true);
    assert.equal(matchesBookingQuery("Chantal Mutoni", "BKG-4469", "4469"), true);
    assert.equal(matchesBookingQuery("Chantal Mutoni", "BKG-4469", "4470"), false);
  });

  test("punctuation alone matches nothing rather than everything", () => {
    assert.equal(referenceKey(" - "), "");
    assert.equal(matchesBookingQuery("Chantal Mutoni", "BKG-4469", "-"), false);
  });
});
