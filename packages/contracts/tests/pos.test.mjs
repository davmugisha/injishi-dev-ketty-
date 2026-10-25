/**
 * The point of sale's money (POS spec §21, calculation tests): line and order
 * amounts in both tax modes, rounding, discount sharing and approval, the
 * settlement a bill derives from its payments, the payment rule, and the
 * cashier's expected cash.
 *
 * Tests the built module (`dist/`), like every test in this folder.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  allocate,
  canMovePayment,
  canMoveTicket,
  cashVariance,
  checkPayment,
  CreatePosOrderRequest,
  demoPaymentReference,
  discountNeedsApproval,
  divRoundHalfUp,
  expectedCash,
  lineAmounts,
  orderAmounts,
  rateToBps,
  settlementOf,
  TakePosPaymentRequest,
} = require("../dist/index.js");

const VAT = 1800;

describe("rounding", () => {
  test("half up, in integers", () => {
    assert.equal(divRoundHalfUp(5, 10), 1);
    assert.equal(divRoundHalfUp(4, 10), 0);
    assert.equal(divRoundHalfUp(15, 10), 2);
    assert.equal(divRoundHalfUp(-15, 10), -2);
  });

  test("a decimal rate becomes whole basis points once", () => {
    assert.equal(rateToBps(0.18), 1800);
    assert.equal(rateToBps(0), 0);
    assert.throws(() => rateToBps(1.2));
  });
});

describe("a line", () => {
  test("exclusive: the tax is added on top", () => {
    assert.deepEqual(lineAmounts({ unitPriceRwf: 2500, quantity: 2, discountRwf: 0, taxRateBps: VAT }, "exclusive"), {
      grossRwf: 5000,
      discountRwf: 0,
      netRwf: 5000,
      taxRwf: 900,
      totalRwf: 5900,
    });
  });

  test("inclusive: RWF 11,800 at 18% carries RWF 1,800 of tax on RWF 10,000", () => {
    const line = lineAmounts({ unitPriceRwf: 11800, quantity: 1, discountRwf: 0, taxRateBps: VAT }, "inclusive");
    assert.equal(line.totalRwf, 11800);
    assert.equal(line.taxRwf, 1800);
    assert.equal(line.netRwf - line.taxRwf, 10000);
  });

  test("an inclusive price that does not divide evenly rounds half up", () => {
    // 1,000 x 1800 / 11800 = 152.54 -> 153
    assert.equal(lineAmounts({ unitPriceRwf: 1000, quantity: 1, discountRwf: 0, taxRateBps: VAT }, "inclusive").taxRwf, 153);
    // 1,500 x 0.18 = 270 exactly
    assert.equal(lineAmounts({ unitPriceRwf: 1500, quantity: 1, discountRwf: 0, taxRateBps: VAT }, "exclusive").taxRwf, 270);
    // 2,525 x 0.18 = 454.5 -> 455
    assert.equal(lineAmounts({ unitPriceRwf: 2525, quantity: 1, discountRwf: 0, taxRateBps: VAT }, "exclusive").taxRwf, 455);
  });

  test("a modifier is priced into the unit, times the quantity", () => {
    // Brochette 3,000 + extra chips 500, three of them
    const line = lineAmounts({ unitPriceRwf: 3500, quantity: 3, discountRwf: 0, taxRateBps: VAT }, "inclusive");
    assert.equal(line.grossRwf, 10500);
    assert.equal(line.totalRwf, 10500);
  });

  test("a discount comes off before tax", () => {
    const line = lineAmounts({ unitPriceRwf: 10000, quantity: 1, discountRwf: 1000, taxRateBps: VAT }, "exclusive");
    assert.equal(line.netRwf, 9000);
    assert.equal(line.taxRwf, 1620);
    assert.equal(line.totalRwf, 10620);
  });

  test("an exempt line carries no tax", () => {
    assert.equal(lineAmounts({ unitPriceRwf: 800, quantity: 4, discountRwf: 0, taxRateBps: 0 }, "exclusive").taxRwf, 0);
  });

  test("refuses fractions, negatives and a discount larger than the line", () => {
    assert.throws(() => lineAmounts({ unitPriceRwf: 10.5, quantity: 1, discountRwf: 0, taxRateBps: VAT }, "exclusive"));
    assert.throws(() => lineAmounts({ unitPriceRwf: 1000, quantity: 0, discountRwf: 0, taxRateBps: VAT }, "exclusive"));
    assert.throws(() => lineAmounts({ unitPriceRwf: 1000, quantity: 1, discountRwf: 1001, taxRateBps: VAT }, "exclusive"));
  });
});

describe("sharing an order discount", () => {
  test("the shares add up to exactly the discount", () => {
    const shares = allocate(1000, [3000, 3000, 3000]);
    assert.deepEqual(shares, [334, 333, 333]);
    assert.equal(shares.reduce((a, b) => a + b, 0), 1000);
  });

  test("in proportion to what each line sells for", () => {
    assert.deepEqual(allocate(600, [1000, 2000]), [200, 400]);
  });

  test("refuses to share more than there is", () => {
    assert.throws(() => allocate(5000, [1000, 2000]));
  });
});

describe("the bill", () => {
  const lines = [
    { unitPriceRwf: 3000, quantity: 2, lineDiscountRwf: 0, taxRateBps: VAT }, // brochettes
    { unitPriceRwf: 1500, quantity: 3, lineDiscountRwf: 0, taxRateBps: VAT }, // Primus
    { unitPriceRwf: 1000, quantity: 1, lineDiscountRwf: 0, taxRateBps: 0 }, // water, exempt
  ];

  test("inclusive totals are the menu prices", () => {
    const bill = orderAmounts(lines, 0, "inclusive");
    assert.equal(bill.grossRwf, 11500);
    assert.equal(bill.totalRwf, 11500);
    assert.equal(bill.taxRwf, divRoundHalfUp(6000 * VAT, 11800) + divRoundHalfUp(4500 * VAT, 11800));
  });

  test("exclusive totals add the tax", () => {
    const bill = orderAmounts(lines, 0, "exclusive");
    assert.equal(bill.taxRwf, 1080 + 810);
    assert.equal(bill.totalRwf, 11500 + 1890);
  });

  test("an order discount is shared, then taxed", () => {
    const bill = orderAmounts(lines, 1150, "exclusive");
    assert.equal(bill.discountRwf, 1150);
    assert.equal(bill.netRwf, 10350);
    assert.deepEqual(
      bill.lines.map((l) => l.orderDiscountShareRwf),
      [600, 450, 100],
    );
    assert.equal(bill.taxRwf, 972 + 729);
  });

  test("the lines always add up to the bill", () => {
    const bill = orderAmounts(lines, 777, "inclusive");
    assert.equal(bill.lines.reduce((a, l) => a + l.totalRwf, 0), bill.totalRwf);
    assert.equal(bill.lines.reduce((a, l) => a + l.taxRwf, 0), bill.taxRwf);
  });
});

describe("discount approval", () => {
  test("within the limit needs no one", () => {
    assert.equal(discountNeedsApproval(1000, 10000, 1000), false);
  });
  test("over the limit waits for an override", () => {
    assert.equal(discountNeedsApproval(1001, 10000, 1000), true);
  });
  test("a limit of zero sends every discount for approval", () => {
    assert.equal(discountNeedsApproval(1, 10000, 0), true);
  });
});

describe("settlement", () => {
  const pay = (amountRwf, status, refundedRwf = 0) => ({ amountRwf, status, refundedRwf });

  test("an unpaid bill", () => {
    const s = settlementOf(11800, []);
    assert.equal(s.state, "unpaid");
    assert.equal(s.outstandingRwf, 11800);
    assert.equal(s.settled, false);
  });

  test("split across cash and simulated mobile money", () => {
    const s = settlementOf(11800, [pay(5000, "successful"), pay(6800, "successful")]);
    assert.equal(s.state, "paid");
    assert.equal(s.outstandingRwf, 0);
    assert.equal(s.settled, true);
  });

  test("a pending payment is not collected, and not payable twice", () => {
    const s = settlementOf(11800, [pay(5000, "successful"), pay(6800, "pending")]);
    assert.equal(s.state, "partially_paid");
    assert.equal(s.outstandingRwf, 6800);
    assert.equal(s.payableRwf, 0);
    assert.equal(s.settled, false);
  });

  test("a failed payment counts for nothing", () => {
    const s = settlementOf(11800, [pay(11800, "failed")]);
    assert.equal(s.state, "unpaid");
    assert.equal(s.payableRwf, 11800);
  });

  test("a refund is a correction, never a new debt", () => {
    const s = settlementOf(11800, [pay(11800, "successful", 3000)]);
    assert.equal(s.collectedRwf, 11800);
    assert.equal(s.refundedRwf, 3000);
    assert.equal(s.outstandingRwf, 0);
    assert.equal(s.state, "paid");
    assert.equal(s.settled, true);
  });

  test("a fully refunded payment still settled the bill it paid", () => {
    const s = settlementOf(5000, [pay(5000, "refunded", 5000)]);
    assert.equal(s.refundedRwf, 5000);
    assert.equal(s.outstandingRwf, 0);
  });
});

describe("taking a payment", () => {
  const open = settlementOf(11800, []);

  test("cash gives change", () => {
    assert.deepEqual(checkPayment(open, "cash", 11800, 15000), { ok: true, changeRwf: 3200 });
  });

  test("cash handed over must cover the amount", () => {
    assert.equal(checkPayment(open, "cash", 11800, 10000).ok, false);
  });

  test("only cash gives change", () => {
    assert.equal(checkPayment(open, "mtn_momo", 11800, 15000).ok, false);
  });

  test("nothing pays more than is payable", () => {
    assert.equal(checkPayment(open, "card", 11801, null).ok, false);
    const inFlight = settlementOf(11800, [{ amountRwf: 6800, status: "pending", refundedRwf: 0 }]);
    assert.equal(checkPayment(inFlight, "cash", 5000, null).ok, true);
    assert.equal(checkPayment(inFlight, "cash", 5001, null).ok, false);
  });

  test("a settled bill takes nothing", () => {
    const paid = settlementOf(11800, [{ amountRwf: 11800, status: "successful", refundedRwf: 0 }]);
    assert.equal(checkPayment(paid, "cash", 1, null).ok, false);
  });
});

describe("the cashier's drawer", () => {
  test("expected cash and variance", () => {
    const expected = expectedCash({
      openingFloatRwf: 20000,
      cashSalesRwf: 154500,
      cashRefundsRwf: 3000,
      paidInRwf: 5000,
      paidOutRwf: 12000,
    });
    assert.equal(expected, 164500);
    assert.equal(cashVariance(162500, expected), -2000);
    assert.equal(cashVariance(164500, expected), 0);
  });
});

describe("statuses", () => {
  test("tickets move forward only", () => {
    assert.equal(canMoveTicket("queued", "preparing"), true);
    assert.equal(canMoveTicket("queued", "ready"), true);
    assert.equal(canMoveTicket("ready", "served"), true);
    assert.equal(canMoveTicket("served", "queued"), false);
    assert.equal(canMoveTicket("ready", "cancelled"), false);
  });

  test("a payment's answer is final", () => {
    assert.equal(canMovePayment("pending", "successful"), true);
    assert.equal(canMovePayment("failed", "successful"), false);
    assert.equal(canMovePayment("successful", "refunded"), true);
  });
});

describe("requests", () => {
  const id = "3f1d2c4b-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

  test("a dine in order needs a table, a takeaway must not have one", () => {
    assert.equal(CreatePosOrderRequest.safeParse({ outletId: id, orderType: "dine_in" }).success, false);
    assert.equal(CreatePosOrderRequest.safeParse({ outletId: id, orderType: "dine_in", tableSessionId: id }).success, true);
    assert.equal(CreatePosOrderRequest.safeParse({ outletId: id, orderType: "takeaway", tableSessionId: id }).success, false);
  });

  test("a payment carries an idempotency key and defaults to a successful simulation", () => {
    const parsed = TakePosPaymentRequest.parse({ method: "mtn_momo", amountRwf: 5000, idempotencyKey: "press-0001" });
    assert.equal(parsed.simulate, "success");
    assert.equal(parsed.tipRwf, 0);
    assert.equal(TakePosPaymentRequest.safeParse({ method: "cash", amountRwf: 5000 }).success, false);
  });

  test("a demo reference cannot be mistaken for a provider's", () => {
    assert.match(demoPaymentReference("mtn_momo", "7f3k2q9x"), /^DEMO-MOMO-7F3K2Q9X$/);
  });
});
