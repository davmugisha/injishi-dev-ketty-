/**
 * What a National ID says about its holder (registration Phase 0).
 *
 * About you fills a blank gender from the card and questions a date of birth
 * whose year the card contradicts. Both read `nationalIdFacts`, so this pins
 * the positions it reads: digits 2 to 5 the year, digit 6 the gender.
 *
 * Run: pnpm --filter @injishi/web test
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { nationalIdFacts } from "../src/lib/rwanda-id.ts";

test("reads the year and a male marker, spaces and all", () => {
  assert.deepEqual(nationalIdFacts("1 1995 8 0012345 12 3"), { birthYear: 1995, gender: "male" });
});

test("reads a female marker", () => {
  assert.deepEqual(nationalIdFacts("1198870012345123"), { birthYear: 1988, gender: "female" });
});

test("names no gender for a marker it does not know", () => {
  assert.equal(nationalIdFacts("1199050012345123")?.gender, null);
});

test("says nothing about a number that is not a National ID", () => {
  assert.equal(nationalIdFacts("119958001234512"), null);
  assert.equal(nationalIdFacts(""), null);
});
