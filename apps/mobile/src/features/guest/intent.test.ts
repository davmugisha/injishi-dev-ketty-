// The search intent in the route's params (mobile spec 0005), under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { EMPTY_INTENT, intentFrom, intentParams, isNarrowed, searchKey, searchPath } from "./intent.ts";

describe("intentFrom", () => {
  test("no params is the default search", () => {
    assert.deepEqual(intentFrom({}), EMPTY_INTENT);
  });

  test("reads a picked place with its label", () => {
    const intent = intentFrom({ place: "sector:10201", placeLabel: "Gisenyi", sort: "price_asc" });
    assert.equal(intent.place, "sector:10201");
    assert.equal(intent.placeLabel, "Gisenyi");
    assert.equal(intent.sort, "price_asc");
  });

  test("anything unreadable falls back, never throws", () => {
    const intent = intentFrom({ mode: "castles", sort: "random", place: "city:1", placeLabel: "x" });
    assert.equal(intent.mode, "stays");
    assert.equal(intent.sort, "top_rated");
    assert.equal(intent.place, null);
    assert.equal(intent.placeLabel, null);
  });
});

describe("round trip", () => {
  test("params carry the intent and leave defaults out", () => {
    assert.deepEqual(intentParams(EMPTY_INTENT), {});
    const intent = { ...EMPTY_INTENT, mode: "homes" as const, q: " kivu ", sort: "price_desc" as const };
    assert.deepEqual(intentParams(intent), { mode: "homes", q: "kivu", sort: "price_desc" });
    assert.deepEqual(intentFrom(intentParams(intent)), { ...intent, q: "kivu" });
  });
});

describe("what the API is asked", () => {
  test("a picked place wins over the words, and its label is not sent", () => {
    const intent = { ...EMPTY_INTENT, q: "gis", place: "sector:10201", placeLabel: "Gisenyi" };
    assert.deepEqual(searchKey(intent), { mode: "stays", place: "sector:10201", q: "", sort: "top_rated" });
    assert.equal(searchPath(intent, null), "/api/v1/explore/search?mode=stays&sort=top_rated&place=sector%3A10201");
  });

  test("words and a cursor", () => {
    assert.equal(
      searchPath({ ...EMPTY_INTENT, q: "lake kivu" }, "abc"),
      "/api/v1/explore/search?mode=stays&sort=top_rated&q=lake+kivu&cursor=abc",
    );
  });

  test("narrowed only by a place or words", () => {
    assert.equal(isNarrowed(EMPTY_INTENT), false);
    assert.equal(isNarrowed({ ...EMPTY_INTENT, sort: "price_asc" }), false);
    assert.equal(isNarrowed({ ...EMPTY_INTENT, q: "x" }), true);
  });
});
