import assert from "node:assert/strict";
import { test } from "node:test";
import { specialRanges } from "../dist/index.js";

const day = (roomTypeId, d, priceRwf, closed = false, minNights = null) => ({
  roomTypeId,
  roomTypeName: roomTypeId === "a" ? "Double" : "Twin",
  day: d,
  priceRwf,
  closed,
  minNights,
});

test("days in a row with the same settings make one run", () => {
  const runs = specialRanges([
    day("a", "2026-12-24", 90000),
    day("a", "2026-12-25", 90000),
    day("a", "2026-12-26", 90000),
    day("a", "2026-12-31", null, true),
    day("b", "2026-12-25", 90000),
  ]);
  assert.deepEqual(
    runs.map((r) => [r.roomTypeId, r.from, r.to, r.priceRwf, r.closed]),
    [
      ["a", "2026-12-24", "2026-12-26", 90000, false],
      ["a", "2026-12-31", "2026-12-31", null, true],
      ["b", "2026-12-25", "2026-12-25", 90000, false],
    ],
  );
});

test("a change of price, a gap or a month end splits or joins a run correctly", () => {
  const runs = specialRanges([
    day("a", "2026-11-30", 50000),
    day("a", "2026-12-01", 50000),
    day("a", "2026-12-02", 60000),
    day("a", "2026-12-04", 60000),
  ]);
  assert.deepEqual(
    runs.map((r) => [r.from, r.to, r.priceRwf]),
    [
      ["2026-11-30", "2026-12-01", 50000],
      ["2026-12-02", "2026-12-02", 60000],
      ["2026-12-04", "2026-12-04", 60000],
    ],
  );
});
