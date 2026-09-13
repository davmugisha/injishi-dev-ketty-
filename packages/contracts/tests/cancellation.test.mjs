/**
 * The cancellation refund tiers, pinned (F-B11, ADR-051).
 *
 * The percentages were first promised to guests as checkout copy, so they are
 * the policy; these tests hold the one function that computes a refund to that
 * copy, rule by rule, including the edges where a franc can go missing.
 *
 * It tests the BUILT module (`dist/`), like `authz.test.mjs`.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { cancellationRefund, CANCELLATION_TIERS } = require("../dist/index.js");

const base = {
  party: "guest",
  status: "confirmed",
  tier: "flexible",
  nonRefundable: false,
  grossRwf: 94_500,
  hoursBeforeCheckIn: 100,
};
const refund = (over) => cancellationRefund({ ...base, ...over });

describe("cancellationRefund", () => {
  test("the host cancelling refunds in full, whatever the rate or tier", () => {
    assert.equal(refund({ party: "host", nonRefundable: true, tier: "firm", hoursBeforeCheckIn: 0 }).percent, 100);
  });

  test("a request never accepted refunds in full, even on the non-refundable rate", () => {
    assert.equal(refund({ status: "pending_approval", nonRefundable: true }).refundRwf, 94_500);
  });

  test("the non-refundable rate forfeits everything, whatever the tier", () => {
    const r = refund({ nonRefundable: true, hoursBeforeCheckIn: 10_000 });
    assert.deepEqual([r.percent, r.refundRwf, r.forfeitRwf], [0, 0, 94_500]);
  });

  const table = [
    ["flexible", 24, 100, 0],
    ["moderate", 120, 100, 50],
    ["limited", 168, 50, 0],
    ["firm", 720, 50, 0],
    ["strict_extended_stay", 720, 50, 0],
  ];
  for (const [tier, hours, before, after] of table) {
    test(`${tier}: ${before}% at ${hours}h or more before check-in, ${after}% inside it`, () => {
      assert.deepEqual(CANCELLATION_TIERS[tier], { windowHours: hours, beforePercent: before, afterPercent: after });
      assert.equal(refund({ tier, hoursBeforeCheckIn: hours }).percent, before);
      assert.equal(refund({ tier, hoursBeforeCheckIn: hours - 0.01 }).percent, after);
    });
  }

  test("a booking with no locked tier is read as flexible", () => {
    assert.equal(refund({ tier: null, hoursBeforeCheckIn: 30 }).percent, 100);
    assert.equal(refund({ tier: null, hoursBeforeCheckIn: 2 }).percent, 0);
  });

  test("a partial refund rounds down, and refund plus forfeit is exactly what was captured", () => {
    const r = refund({ tier: "moderate", grossRwf: 94_501, hoursBeforeCheckIn: 1 });
    assert.equal(r.refundRwf, 47_250);
    assert.equal(r.refundRwf + r.forfeitRwf, 94_501);
  });
});
