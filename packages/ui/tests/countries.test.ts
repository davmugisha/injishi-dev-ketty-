/**
 * Countries: the kit's list is contracts' `COUNTRY_NAMES` (what the API accepts), and Rwanda comes first.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";
import { COUNTRY_NAMES, countryMatches, countryOptions, flagOf } from "../src/countries.ts";

const contracts = createRequire(import.meta.url)("../../contracts/dist/index.js") as {
  COUNTRY_NAMES: Record<string, string>;
};

test("the list is contracts' list", () => {
  assert.deepEqual({ ...COUNTRY_NAMES }, { ...contracts.COUNTRY_NAMES });
});

test("Rwanda first, then the rest by name", () => {
  const options = countryOptions();
  assert.equal(options[0].code, "RW");
  assert.equal(options.length, Object.keys(COUNTRY_NAMES).length);
  const rest = options.slice(1).map((c) => c.name);
  assert.deepEqual(
    rest,
    [...rest].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
  );
  const pinned = countryOptions(undefined, ["RW", "UG", "KE"]);
  assert.deepEqual(
    pinned.slice(0, 3).map((c) => c.code),
    ["RW", "UG", "KE"],
  );
});

test("search by name, accents ignored, or by exact code", () => {
  const aland = { code: "AX", name: "Åland Islands" };
  assert.equal(countryMatches(aland, "aland"), true);
  assert.equal(countryMatches({ code: "UG", name: "Uganda" }, "ug"), true);
  assert.equal(countryMatches({ code: "UG", name: "Uganda" }, "ke"), false);
  assert.equal(countryMatches({ code: "UG", name: "Uganda" }, ""), true);
});

test("flags from codes", () => {
  assert.equal(flagOf("RW"), "\u{1F1F7}\u{1F1FC}");
  assert.equal(flagOf("rw"), "\u{1F1F7}\u{1F1FC}");
  assert.equal(flagOf("RWA"), "");
});
