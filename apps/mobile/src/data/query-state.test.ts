// QueryView's state choice (mobile spec 0003, AC-10 and AC-11; spec 0005, AC-8), under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { type QueryStateInput, queryState } from "./query-state.ts";

const base: QueryStateInput = {
  hasData: false,
  hasCopy: false,
  canShowOutOfDate: false,
  fetchStatus: "fetching",
  hasError: false,
};

describe("queryState", () => {
  test("a first load shows the skeleton", () => {
    assert.equal(queryState(base), "loading");
  });

  test("a first load paused with no signal says Can't connect, not a skeleton forever (AC-8)", () => {
    assert.equal(queryState({ ...base, fetchStatus: "paused" }), "offline");
  });

  test("an error wins over the pause, so a refusal is worded by its cause", () => {
    assert.equal(queryState({ ...base, fetchStatus: "paused", hasError: true }), "error");
    assert.equal(queryState({ ...base, fetchStatus: "idle", hasError: true }), "error");
  });

  test("data on screen stays while paused or after a failed refresh", () => {
    assert.equal(queryState({ ...base, hasData: true, hasCopy: true, fetchStatus: "paused" }), "data");
    assert.equal(queryState({ ...base, hasData: true, hasCopy: true, hasError: true, fetchStatus: "idle" }), "data");
  });

  test("a copy from an earlier day shows its view, or the skeleton while it refreshes", () => {
    const copy = { ...base, hasCopy: true, canShowOutOfDate: true };
    assert.equal(queryState({ ...copy, fetchStatus: "fetching" }), "loading");
    assert.equal(queryState({ ...copy, fetchStatus: "paused" }), "outOfDate");
    assert.equal(queryState({ ...copy, fetchStatus: "idle" }), "outOfDate");
  });
});
