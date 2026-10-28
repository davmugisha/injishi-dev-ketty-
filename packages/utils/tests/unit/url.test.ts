import { describe, expect, test } from "vitest";

import { buildQuery, readIntParam, withQuery } from "../../src/url";

describe("buildQuery", () => {
  test("a cleared filter leaves no trace: null, undefined, empty text and false are dropped", () => {
    expect(buildQuery({ q: "kigali", guests: 2, page: null, sort: undefined, area: "", pets: false })).toBe(
      "?q=kigali&guests=2",
    );
  });

  test("nothing left to send is no query string at all, not a bare question mark", () => {
    expect(buildQuery({})).toBe("");
    expect(buildQuery({ q: "" })).toBe("");
  });

  test("values are encoded, so text a guest types cannot break the url", () => {
    expect(buildQuery({ q: "Lake Kivu & co", instant: true })).toBe("?q=Lake+Kivu+%26+co&instant=true");
  });
});

describe("withQuery", () => {
  test("appends the query to the path, or nothing when it is empty", () => {
    expect(withQuery("/explore", { q: "kigali", guests: 2 })).toBe("/explore?q=kigali&guests=2");
    expect(withQuery("/explore", { q: "" })).toBe("/explore");
  });
});

describe("readIntParam", () => {
  const params = new URLSearchParams("guests=3&rooms=0&nights=-2&page=abc");

  test("reads a positive whole number", () => {
    expect(readIntParam(params, "guests", 1)).toBe(3);
  });

  test("falls back when the param is absent, zero, negative or not a number", () => {
    expect(readIntParam(params, "missing", 1)).toBe(1);
    expect(readIntParam(params, "rooms", 1)).toBe(1);
    expect(readIntParam(params, "nights", 1)).toBe(1);
    expect(readIntParam(params, "page", 1)).toBe(1);
  });
});
