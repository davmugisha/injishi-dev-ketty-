/**
 * An offer's conditions, pinned (§6.8).
 *
 * Every condition on an offer is a price: "in-house guests only" is the
 * difference between a hotel discounting its restaurant to fill it and a hotel
 * discounting its restaurant to the street. This function is the only place
 * they are read, on both sides of the wire, so each one is held here.
 *
 * It tests the BUILT module (`dist/`), like the other contract tests.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { offerDiscountRwf, offerEligibility } = require("../dist/index.js");

/** 15% off, running all September, for anybody, with no conditions. */
const offer = {
  status: "active",
  discountKind: "percentage",
  discountValue: 15,
  scope: "folio",
  audience: "anyone",
  code: null,
  startsOn: "2026-09-01",
  endsOn: "2026-09-30",
  minNights: null,
  minSpendRwf: null,
  maxRedemptions: null,
};

/** A guest in the building on the 15th with 100,000 on the bill. */
const ctx = {
  today: "2026-09-15",
  inHouse: true,
  nights: 3,
  baseRwf: 100_000,
  code: null,
  alreadyRedeemed: false,
  redemptionsSoFar: 0,
};

const check = (o = {}, c = {}) =>
  offerEligibility({ ...offer, ...o }, { ...ctx, ...c });

describe("offerEligibility: the plain case", () => {
  test("an active offer inside its window takes its percentage off the base", () => {
    const r = check();
    assert.equal(r.eligible, true);
    assert.equal(r.discountRwf, 15_000);
    assert.equal(r.reason, null);
  });
});

describe("offerEligibility: status and window", () => {
  for (const status of ["draft", "archived"]) {
    test(`a ${status} offer is not running`, () => {
      const r = check({ status });
      assert.equal(r.eligible, false);
      assert.equal(r.discountRwf, 0);
    });
  }

  test("before it opens, and on the day it opens", () => {
    assert.equal(check({}, { today: "2026-08-31" }).eligible, false);
    assert.equal(check({}, { today: "2026-09-01" }).eligible, true);
  });

  test("on the day it closes, and after", () => {
    assert.equal(check({}, { today: "2026-09-30" }).eligible, true);
    assert.equal(check({}, { today: "2026-10-01" }).eligible, false);
  });

  test("no end date means it stays open", () => {
    assert.equal(check({ endsOn: null }, { today: "2031-01-01" }).eligible, true);
  });
});

describe("offerEligibility: who it is for", () => {
  test("an in-house offer refuses somebody who is not staying there", () => {
    const r = check({ audience: "in_house" }, { inHouse: false });
    assert.equal(r.eligible, false);
    assert.match(r.reason, /staying at the property/i);
  });

  test("an `anyone` offer does not care", () => {
    assert.equal(check({}, { inHouse: false, baseRwf: 100_000 }).eligible, true);
  });
});

describe("offerEligibility: the code", () => {
  test("an offer with a code refuses an empty one", () => {
    assert.equal(check({ code: "SEPT15" }, { code: null }).eligible, false);
    assert.equal(check({ code: "SEPT15" }, { code: "   " }).eligible, false);
  });

  test("a wrong code is refused as a wrong code, not as a missing offer", () => {
    const r = check({ code: "SEPT15" }, { code: "SEPT50" });
    assert.equal(r.eligible, false);
    assert.match(r.reason, /does not match/i);
  });

  test("matching is case and whitespace insensitive, because people type", () => {
    assert.equal(check({ code: "SEPT15" }, { code: " sept15 " }).eligible, true);
  });
});

describe("offerEligibility: the conditions", () => {
  test("a minimum nights offer refuses a shorter stay", () => {
    assert.equal(check({ minNights: 3 }, { nights: 2 }).eligible, false);
    assert.equal(check({ minNights: 3 }, { nights: 3 }).eligible, true);
  });

  test("an open-ended stay fails a minimum nights offer rather than passing it", () => {
    // Nobody has agreed a length, so "2 nights or more" is not satisfied. The
    // other reading — treat unknown as enough — hands the discount away on
    // every walk in who never said when they are leaving.
    const r = check({ minNights: 2 }, { nights: null });
    assert.equal(r.eligible, false);
    assert.match(r.reason, /no end date/i);
  });

  test("a minimum spend offer refuses a smaller bill", () => {
    assert.equal(check({ minSpendRwf: 50_000 }, { baseRwf: 49_999 }).eligible, false);
    assert.equal(check({ minSpendRwf: 50_000 }, { baseRwf: 50_000 }).eligible, true);
  });

  test("a stay that already took it cannot take it again", () => {
    const r = check({}, { alreadyRedeemed: true });
    assert.equal(r.eligible, false);
    assert.match(r.reason, /already used/i);
  });

  test("a capped offer closes when the cap is reached", () => {
    assert.equal(check({ maxRedemptions: 10 }, { redemptionsSoFar: 9 }).eligible, true);
    assert.equal(check({ maxRedemptions: 10 }, { redemptionsSoFar: 10 }).eligible, false);
    assert.equal(check({ maxRedemptions: 10 }, { redemptionsSoFar: 11 }).eligible, false);
  });

  test("nothing on the bill means nothing to come off", () => {
    assert.equal(check({}, { baseRwf: 0 }).eligible, false);
    assert.equal(check({}, { baseRwf: -1 }).eligible, false);
  });

  test("a percentage that works out at zero francs is not an offer", () => {
    // 1% of 50 is 0 after flooring. Reporting this as available would let a
    // guest spend their one redemption of the offer on nothing.
    const r = check({ discountValue: 1 }, { baseRwf: 50 });
    assert.equal(r.eligible, false);
    assert.equal(r.discountRwf, 0);
  });
});

describe("offerEligibility: the order the reasons are reported in", () => {
  test("the most structural failure wins, so a guest is not sent round a loop", () => {
    // Not running, wrong audience, too few nights and too small a bill, all at
    // once. Telling them "2 nights minimum" first would have them extend their
    // stay for an offer that is not running.
    const r = check(
      { status: "draft", audience: "in_house", minNights: 5, minSpendRwf: 1_000_000 },
      { inHouse: false, nights: 1, baseRwf: 10 },
    );
    assert.match(r.reason, /not running/i);
  });
});

describe("offerDiscountRwf", () => {
  test("a percentage floors to the franc", () => {
    assert.equal(offerDiscountRwf({ discountKind: "percentage", discountValue: 15 }, 99_999), 14_999);
  });

  test("a fixed amount is taken as it stands", () => {
    assert.equal(offerDiscountRwf({ discountKind: "fixed_amount", discountValue: 5_000 }, 99_999), 5_000);
  });

  test("a fixed amount bigger than the bill stops at the bill", () => {
    // It takes the balance to zero and no further. A discount that could exceed
    // the charge would turn a credit into a payout, which is a different act
    // with a different permission.
    assert.equal(offerDiscountRwf({ discountKind: "fixed_amount", discountValue: 500_000 }, 20_000), 20_000);
  });

  test("100% takes the whole bill and never more", () => {
    assert.equal(offerDiscountRwf({ discountKind: "percentage", discountValue: 100 }, 20_000), 20_000);
  });

  test("a negative base is read as nothing", () => {
    assert.equal(offerDiscountRwf({ discountKind: "fixed_amount", discountValue: 5_000 }, -20_000), 0);
  });
});
