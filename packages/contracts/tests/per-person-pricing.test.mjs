/**
 * A stay is priced per person (owner decision, 2026-09-15).
 *
 * Adding a guest to the booking card used to leave the total where it was, and
 * the server charged the same. The rate is now per guest, per night, through the
 * one `computeBreakdown`, so the card, the checkout and the charge move together.
 * Infants are never in `guests`, so they stay free.
 *
 * And the figure a booking LOCKS is the party's nightly charge, because the night
 * audit, the folio and the EBM receipt re-derive from it with no party of their
 * own. These tests hold both halves so a receipt cannot disagree with a charge.
 *
 * It tests the BUILT module (`dist/`), like `authz.test.mjs`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { computeBreakdown, stayNightlyRateRwf, MAX_INFANTS } = require("../dist/index.js");

describe("per-person pricing", () => {
  test("adding guests multiplies the accommodation and the fee", () => {
    const one = computeBreakdown({ nightlyRateRwf: 164_000, nights: 35, nonRefundable: false, guests: 1 });
    const two = computeBreakdown({ nightlyRateRwf: 164_000, nights: 35, nonRefundable: false, guests: 2 });
    assert.equal(one.accommodationRwf, 5_740_000);
    assert.equal(two.accommodationRwf, 11_480_000);
    assert.equal(two.guests, 2);
    assert.equal(two.serviceFeeRwf, Math.round(11_480_000 * 0.05));
    assert.equal(two.grossRwf, 11_480_000 + 574_000);
  });

  test("no party given means one guest, so existing callers keep their totals", () => {
    const legacy = computeBreakdown({ nightlyRateRwf: 50_000, nights: 3, nonRefundable: false });
    assert.equal(legacy.guests, 1);
    assert.equal(legacy.accommodationRwf, 150_000);
  });

  test("the non-refundable discount applies to the whole party", () => {
    const b = computeBreakdown({ nightlyRateRwf: 100_000, nights: 2, nonRefundable: true, guests: 3 });
    assert.equal(b.accommodationRwf, 600_000);
    assert.equal(b.nonRefundableDiscountRwf, 60_000);
  });

  test("a receipt re-derived from the locked party rate matches the charge", () => {
    const charged = computeBreakdown({ nightlyRateRwf: 164_000, nights: 4, nonRefundable: true, guests: 3 });
    const locked = stayNightlyRateRwf(charged);
    assert.equal(locked, 492_000);
    const receipt = computeBreakdown({ nightlyRateRwf: locked, nights: 4, nonRefundable: true });
    assert.equal(receipt.grossRwf, charged.grossRwf);
  });

  test("infants are capped", () => {
    assert.equal(MAX_INFANTS, 5);
  });
});
