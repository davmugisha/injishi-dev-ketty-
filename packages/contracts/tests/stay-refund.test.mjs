/**
 * The house rules a refund on an in-progress stay is judged against (§6.8).
 *
 * These numbers are what a guest is shown BEFORE they submit and what the
 * property's queue shows when it answers, from one function — so a change here
 * changes what both sides read, which is the whole point of the arrangement and
 * the reason it is pinned rule by rule.
 *
 * It tests the BUILT module (`dist/`), like `authz.test.mjs` and
 * `cancellation.test.mjs`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  REFUND_REFUSAL_LABEL,
  REFUND_REPORTING_WINDOW_HOURS,
  REFUND_SERVICE_FAILURE_NIGHTS,
  StayRefundReason,
  StayRefundRefusalReason,
  stayRefundAssessment,
} = require("../dist/index.js");

/** Three nights at 40,000, two slept, all of it paid, guest still in the room. */
const base = {
  reason: "changed_plans",
  nonRefundable: false,
  tier: "moderate",
  nightsBooked: 3,
  nightsConsumed: 2,
  nightlyRateRwf: 40_000,
  paidRwf: 120_000,
  lifecycle: "open",
  hoursSinceExit: null,
};
const assess = (over) => stayRefundAssessment({ ...base, ...over });

describe("stayRefundAssessment: nothing paid", () => {
  test("owes nothing and refuses nothing, because there is no rule to cite", () => {
    const r = assess({ paidRwf: 0 });
    assert.equal(r.eligible, false);
    assert.equal(r.maxRefundRwf, 0);
    // Deliberately NOT a refusal reason: the rules did not say no, there was
    // simply no money. A desk needs to tell those two apart.
    assert.equal(r.refusalReason, null);
  });

  test("a negative paid total is read as nothing, never as a credit", () => {
    assert.equal(assess({ paidRwf: -50_000 }).maxRefundRwf, 0);
  });
});

describe("stayRefundAssessment: raised too late", () => {
  test(`past ${REFUND_REPORTING_WINDOW_HOURS} hours after checkout the property can no longer check it`, () => {
    const r = assess({
      reason: "cleanliness",
      lifecycle: "closed",
      hoursSinceExit: REFUND_REPORTING_WINDOW_HOURS + 1,
    });
    assert.equal(r.eligible, false);
    assert.equal(r.refusalReason, "not_reported_during_stay");
  });

  test("inside the window a closed stay is assessed normally", () => {
    const r = assess({
      reason: "cleanliness",
      lifecycle: "closed",
      hoursSinceExit: REFUND_REPORTING_WINDOW_HOURS,
    });
    assert.equal(r.refusalReason, null);
    assert.equal(r.eligible, true);
  });

  test("an open stay is never too late, whatever the clock says", () => {
    const r = assess({ reason: "noise", lifecycle: "open", hoursSinceExit: 9_999 });
    assert.notEqual(r.refusalReason, "not_reported_during_stay");
  });
});

describe("stayRefundAssessment: a service complaint", () => {
  const serviceReasons = [
    "service_failure",
    "room_not_as_described",
    "cleanliness",
    "noise",
    "maintenance_unresolved",
  ];

  for (const reason of serviceReasons) {
    test(`${reason} is judged on what happened, so the NON-REFUNDABLE RATE DOES NOT APPLY`, () => {
      // This is the load-bearing one. A non-refundable rate is a rule about
      // changing your mind; it is not a licence to deliver a room nobody could
      // sleep in, and reading it as one is the single most predictable way this
      // engine could be wrong in the property's favour.
      const r = assess({ reason, nonRefundable: true, tier: "firm" });
      assert.equal(r.eligible, true);
      assert.equal(r.refusalReason, null);
      assert.equal(r.maxRefundRwf, 40_000 * REFUND_SERVICE_FAILURE_NIGHTS);
    });
  }

  test("a complaint on a stay with no rate recorded is priced by the property", () => {
    const r = assess({
      reason: "cleanliness",
      nightlyRateRwf: null,
      nightsBooked: 0,
      paidRwf: 30_000,
    });
    assert.equal(r.eligible, false);
    assert.equal(r.maxRefundRwf, 0);
    assert.equal(r.refusalReason, null);
  });

  test("the suggestion never exceeds what was actually paid", () => {
    const r = assess({ reason: "noise", nightlyRateRwf: 500_000, paidRwf: 60_000 });
    assert.equal(r.maxRefundRwf, 60_000);
  });
});

describe("stayRefundAssessment: a billing query", () => {
  test("the ceiling is everything paid, because the engine cannot see the line", () => {
    const r = assess({ reason: "overcharged", nonRefundable: true });
    assert.equal(r.eligible, true);
    assert.equal(r.maxRefundRwf, 120_000);
    assert.equal(r.refusalReason, null);
  });
});

describe("stayRefundAssessment: changing plans, and leaving early", () => {
  for (const reason of ["changed_plans", "early_departure"]) {
    test(`${reason} on the non-refundable rate refuses, citing the rate`, () => {
      const r = assess({ reason, nonRefundable: true });
      assert.equal(r.eligible, false);
      assert.equal(r.maxRefundRwf, 0);
      assert.equal(r.refusalReason, "non_refundable_rate");
      assert.equal(r.rule, REFUND_REFUSAL_LABEL.non_refundable_rate);
    });

    test(`${reason} with every night slept refuses, citing the nights`, () => {
      const r = assess({ reason, nightsConsumed: 3 });
      assert.equal(r.refusalReason, "nights_already_consumed");
      assert.equal(r.maxRefundRwf, 0);
    });

    test(`${reason} never prices a night already slept`, () => {
      // Two of three nights slept: only the third can be worth anything, and
      // at moderate's 50% after check-in that is 20,000, not 60,000.
      assert.equal(assess({ reason }).maxRefundRwf, 20_000);
    });
  }

  test("the tier applied is the AFTER-check-in one, because check-in has passed", () => {
    // flexible refunds 100% up to 24h before check-in and nothing after. A
    // guest who is already in the room is, by definition, after it — so the
    // most generous tier in the table owes nothing here, and saying otherwise
    // would be this engine quietly overriding what the guest agreed to.
    const r = assess({ tier: "flexible" });
    assert.equal(r.eligible, false);
    assert.equal(r.refusalReason, "outside_cancellation_window");
    assert.equal(r.maxRefundRwf, 0);
  });

  test("a stay that locked no tier is read as flexible, not as unlimited", () => {
    assert.equal(assess({ tier: null }).maxRefundRwf, 0);
  });

  test("a walk in with no rate prices its unused nights from what it paid", () => {
    // 90,000 over 3 nights is 30,000 a night; one unused, at moderate's 50%.
    const r = assess({
      nightlyRateRwf: null,
      paidRwf: 90_000,
      nightsBooked: 3,
      nightsConsumed: 2,
    });
    assert.equal(r.maxRefundRwf, 15_000);
  });

  test("a walk in with no agreed length has no unused nights to price", () => {
    const r = assess({ nightsBooked: 0, nightsConsumed: 0, nightlyRateRwf: null });
    assert.equal(r.refusalReason, "nights_already_consumed");
  });

  test("the ceiling never exceeds what was paid, however many nights are unused", () => {
    const r = assess({
      nightsBooked: 30,
      nightsConsumed: 1,
      nightlyRateRwf: 40_000,
      paidRwf: 40_000,
    });
    assert.equal(r.maxRefundRwf, 40_000);
  });
});

describe("stayRefundAssessment: anything else", () => {
  test("`other` owes nothing AND refuses nothing, so a person has to read it", () => {
    const r = assess({ reason: "other" });
    assert.equal(r.eligible, false);
    assert.equal(r.maxRefundRwf, 0);
    assert.equal(r.refusalReason, null);
  });
});

describe("the shape of the answer", () => {
  test("every reason in the contract produces a whole assessment", () => {
    for (const reason of StayRefundReason.options) {
      const r = assess({ reason });
      assert.equal(typeof r.eligible, "boolean");
      assert.ok(Number.isInteger(r.maxRefundRwf) && r.maxRefundRwf >= 0, reason);
      assert.ok(r.rule.trim().length > 0, reason);
      if (r.refusalReason !== null) {
        assert.ok(StayRefundRefusalReason.options.includes(r.refusalReason), reason);
      }
    }
  });

  test("an ineligible assessment always offers zero", () => {
    for (const reason of StayRefundReason.options) {
      const r = assess({ reason, nonRefundable: true, nightsConsumed: 3 });
      if (!r.eligible) assert.equal(r.maxRefundRwf, 0, reason);
    }
  });

  test("every refusal reason has a sentence a guest can act on", () => {
    assert.deepEqual(
      Object.keys(REFUND_REFUSAL_LABEL).sort(),
      [...StayRefundRefusalReason.options].sort(),
    );
    for (const reason of StayRefundRefusalReason.options) {
      assert.ok(REFUND_REFUSAL_LABEL[reason].trim().length > 10, reason);
    }
  });
});
