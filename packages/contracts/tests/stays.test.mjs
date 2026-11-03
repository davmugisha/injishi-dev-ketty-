/**
 * Short stays (2026-10-29): how a business is run by its size, the nightly rate a stay is charged at
 * (day prices averaged, less a weekly or monthly discount), the longest stay a room type takes, and the
 * nights a period sold.
 *
 * Run: pnpm --filter @injishi/contracts test
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { maxNightsFor, nightsSold, staySize, stayNightlyRate, stayUnitWords } from "../dist/index.js";

describe("how a stay business is run", () => {
  test("up to twelve rooms is compact, more is full, whatever the kind", () => {
    assert.equal(staySize(5), "compact");
    assert.equal(staySize(12), "compact");
    assert.equal(staySize(13), "full");
  });
  test("apartments, tents and villas are called what they are", () => {
    assert.deepEqual(stayUnitWords("apartment"), { one: "apartment", many: "apartments" });
    assert.deepEqual(stayUnitWords("tented_camp"), { one: "tent", many: "tents" });
    assert.deepEqual(stayUnitWords("lodge"), { one: "room", many: "rooms" });
  });
});

describe("the nightly rate of a stay", () => {
  test("each night at its own price when it has one, averaged", () => {
    const r = stayNightlyRate({ baseRwf: 40_000, dayRatesRwf: [null, 60_000, null] });
    assert.deepEqual(r, { nightlyRwf: 46_667, discountPct: 0 });
  });
  test("a week takes the weekly discount, four weeks the monthly one", () => {
    const week = stayNightlyRate({ baseRwf: 50_000, dayRatesRwf: Array(7).fill(null), weeklyDiscountPct: 10, monthlyDiscountPct: 30 });
    assert.deepEqual(week, { nightlyRwf: 45_000, discountPct: 10 });
    const month = stayNightlyRate({ baseRwf: 50_000, dayRatesRwf: Array(28).fill(null), weeklyDiscountPct: 10, monthlyDiscountPct: 30 });
    assert.deepEqual(month, { nightlyRwf: 35_000, discountPct: 30 });
  });
  test("six nights take no discount", () => {
    assert.equal(stayNightlyRate({ baseRwf: 50_000, dayRatesRwf: Array(6).fill(null), weeklyDiscountPct: 10 }).discountPct, 0);
  });
});

describe("the longest stay", () => {
  test("ninety nights unless the room type allows longer, up to a year", () => {
    assert.equal(maxNightsFor(null), 90);
    assert.equal(maxNightsFor(30), 90);
    assert.equal(maxNightsFor(180), 180);
    assert.equal(maxNightsFor(900), 365);
  });
});

describe("nights sold", () => {
  test("a stay counts from its first night to the night before it leaves; requests and cancellations do not", () => {
    const stay = (checkIn, checkOut, status = "confirmed") => ({ id: checkIn, source: "booking", reference: null, guestName: "G", roomTypeName: "R", roomLabel: null, checkIn, checkOut, status, channel: null, nightlyRwf: 1, totalRwf: 1 });
    const days = ["2026-11-01", "2026-11-02", "2026-11-03"];
    const sold = nightsSold(
      [stay("2026-11-01", "2026-11-03"), stay("2026-11-02", "2026-11-04", "requested"), stay("2026-11-03", "2026-11-05", "cancelled")],
      days,
    );
    assert.deepEqual(sold, [1, 1, 0]);
  });
});
