// The booking flow's calendar days (proto-ui, guest dates sheet), under `node --test`.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  addDays,
  countdownWords,
  daysBetween,
  monthWeeks,
  rangeWords,
  shiftMonth,
  shortRange,
} from "./dates.ts";

describe("monthWeeks", () => {
  test("October 2026 starts on a Thursday, Monday first", () => {
    const weeks = monthWeeks({ year: 2026, month: 9 });
    assert.deepEqual(weeks[0], [null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    assert.equal(weeks.length, 5);
    assert.ok(weeks.every((w) => w.length === 7));
    assert.equal(weeks.flat().filter(Boolean).length, 31);
  });

  test("a month that starts on a Monday has no blank before it", () => {
    assert.equal(monthWeeks({ year: 2026, month: 5 })[0]?.[0], "2026-06-01");
  });
});

describe("days", () => {
  test("across a month and a year", () => {
    assert.equal(addDays("2026-10-30", 3), "2026-11-02");
    assert.equal(addDays("2026-10-14", -7), "2026-10-07");
    assert.equal(daysBetween("2026-10-14", "2026-10-16"), 2);
    assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  });

  test("a stay's words", () => {
    assert.equal(rangeWords("2026-10-14", "2026-10-16"), "Wed 14 – Fri 16 Oct");
    assert.equal(rangeWords("2026-10-30", "2026-11-01"), "Fri 30 Oct – Sun 1 Nov");
    assert.equal(shortRange("2026-10-14", "2026-10-16"), "14–16 Oct");
    assert.equal(countdownWords("2026-10-12", "2026-10-14"), "In 2 days");
    assert.equal(countdownWords("2026-10-13", "2026-10-14"), "Tomorrow");
  });
});
