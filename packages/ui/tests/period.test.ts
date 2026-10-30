/**
 * Periods on Kigali days: presets are whole calendar periods, custom ranges keep to the rules.
 *
 *   pnpm --filter @injishi/ui test
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addDays,
  addMonths,
  clampTo,
  daysInRange,
  isDay,
  isMonth,
  lastDayOfMonth,
  latestDay,
  monthDiff,
  periodFromRange,
  presetPeriod,
  rangeProblem,
  withinSpan,
} from "../src/period.ts";

const today = "2026-10-24";

test("day and month arithmetic", () => {
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addMonths("2026-11", 2), "2027-01");
  assert.equal(addMonths("2026-01", -1), "2025-12");
  assert.equal(monthDiff("2025-11", "2026-02"), 3);
  assert.equal(lastDayOfMonth("2026-02"), "2026-02-28");
  assert.equal(lastDayOfMonth("2028-02"), "2028-02-29");
  assert.equal(daysInRange("2026-10-01", "2026-10-31"), 31);
  assert.equal(isDay("2026-02-30"), false);
  assert.equal(isDay("2026-02-28"), true);
  assert.equal(isMonth("2026-13"), false);
  assert.equal(isMonth("2026-12"), true);
  assert.equal(clampTo("2026-12", "2026-01", "2026-10"), "2026-10");
});

test("presets are whole calendar periods", () => {
  assert.deepEqual(presetPeriod("this_month", today), { preset: "this_month", start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(presetPeriod("last_3_months", today), {
    preset: "last_3_months",
    start: "2026-08-01",
    end: "2026-10-31",
  });
  assert.deepEqual(presetPeriod("this_year", today), { preset: "this_year", start: "2026-01-01", end: "2026-12-31" });
  assert.deepEqual(presetPeriod("last_year", today), { preset: "last_year", start: "2025-01-01", end: "2025-12-31" });
  assert.deepEqual(presetPeriod("last_3_months", "2026-02-10").start, "2025-12-01");
});

test("a pair of days reads back as its preset, else custom", () => {
  assert.equal(periodFromRange("2026-10-01", "2026-10-31", today).preset, "this_month");
  assert.equal(periodFromRange("2025-01-01", "2025-12-31", today).preset, "last_year");
  assert.equal(periodFromRange("2026-10-02", "2026-10-31", today).preset, "custom");
});

test("custom ranges: order, no future unless allowed, earliest day, longest span", () => {
  assert.deepEqual(rangeProblem("2026-10-10", "2026-10-01", { today }), { code: "order" });
  assert.deepEqual(rangeProblem("2026-10-10", "2026-10-25", { today }), { code: "future", latest: today });
  assert.equal(rangeProblem("2026-10-10", "2026-10-25", { today, allowFuture: true }), null);
  assert.deepEqual(rangeProblem("2026-10-10", "2026-12-25", { today, allowFuture: true, maxDay: "2026-12-01" }), {
    code: "future",
    latest: "2026-12-01",
  });
  assert.deepEqual(rangeProblem("2026-01-01", "2026-02-01", { today, minDay: "2026-01-15" }), {
    code: "too_early",
    earliest: "2026-01-15",
  });
  assert.deepEqual(rangeProblem("2026-01-01", "2026-02-01", { today, maxDays: 31 }), { code: "too_long", maxDays: 31 });
  assert.equal(rangeProblem("2026-01-01", "2026-01-31", { today, maxDays: 31 }), null);
  assert.equal(latestDay({ today, allowFuture: true }), null);
  assert.equal(latestDay({ today, maxDay: "2026-10-01" }), "2026-10-01");
});

test("while picking, days beyond the span from the first day are out", () => {
  assert.equal(withinSpan("2026-01-31", "2026-01-01", 31), true);
  assert.equal(withinSpan("2026-02-01", "2026-01-01", 31), false);
  assert.equal(withinSpan("2025-12-02", "2026-01-01", 31), true);
  assert.equal(withinSpan("2025-12-01", "2026-01-01", 31), false);
});
