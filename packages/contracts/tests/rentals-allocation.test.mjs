/**
 * Rentals (blueprint WP 1.1): which charges a payment pays, and credit.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

const charge = (id, dueOn, amountRwf, paidRwf = 0, status = "open", extra = {}) => ({
  id,
  dueOn,
  amountRwf,
  paidRwf,
  status,
  kind: "rent",
  periodStart: `${dueOn.slice(0, 7)}-01`,
  ...extra,
});

const CHARGES = [
  charge("oct", "2026-10-05", 300_000, 100_000),
  charge("sep", "2026-09-05", 300_000),
  charge("nov", "2026-11-05", 300_000),
  charge("aug", "2026-08-05", 300_000, 300_000, "paid"),
  charge("jul", "2026-07-05", 300_000, 0, "waived"),
];

const pairs = (r) => r.allocations.map((a) => [a.chargeId, a.amountRwf]);

describe("paying the oldest first", () => {
  test("an exact payment clears the oldest charges", () => {
    const r = c.allocatePayment(500_000, CHARGES);
    assert.deepEqual(pairs(r), [["sep", 300_000], ["oct", 200_000]]);
    assert.equal(r.allocatedRwf, 500_000);
    assert.equal(r.creditRwf, 0);
  });

  test("a part payment goes to the oldest charge", () => {
    const r = c.allocatePayment(120_000, CHARGES);
    assert.deepEqual(pairs(r), [["sep", 120_000]]);
    assert.equal(r.creditRwf, 0);
  });

  test("an overpayment clears everything and the rest is credit", () => {
    const r = c.allocatePayment(1_000_000, CHARGES);
    assert.deepEqual(pairs(r), [["sep", 300_000], ["oct", 200_000], ["nov", 300_000]]);
    assert.equal(r.allocatedRwf, 800_000);
    assert.equal(r.creditRwf, 200_000);
  });

  test("paid and waived charges take nothing", () => {
    const r = c.allocatePayment(5_000_000, CHARGES);
    assert.equal(r.allocations.some((a) => a.chargeId === "aug" || a.chargeId === "jul"), false);
  });

  test("with nothing owing, the whole payment is credit", () => {
    const r = c.allocatePayment(50_000, [charge("aug", "2026-08-05", 300_000, 300_000, "paid")]);
    assert.deepEqual(r.allocations, []);
    assert.equal(r.creditRwf, 50_000);
  });

  test("on the same due day the deposit is paid before rent", () => {
    const sameDay = [
      charge("rent", "2026-11-01", 300_000),
      charge("deposit", "2026-11-01", 600_000, 0, "open", { kind: "deposit", periodStart: null }),
    ];
    assert.deepEqual(pairs(c.allocatePayment(700_000, sameDay)), [["deposit", 600_000], ["rent", 100_000]]);
  });
});

describe("paying the charges the landlord picked", () => {
  test("only the chosen charges, oldest first among them", () => {
    assert.deepEqual(pairs(c.allocatePayment(300_000, CHARGES, { chargeIds: ["nov"] })), [["nov", 300_000]]);
    const r = c.allocatePayment(400_000, CHARGES, { chargeIds: ["nov", "sep"] });
    assert.deepEqual(pairs(r), [["sep", 300_000], ["nov", 100_000]]);
    assert.equal(r.creditRwf, 0);
  });

  test("more than the chosen charges owe is credit", () => {
    const r = c.allocatePayment(250_000, CHARGES, { chargeIds: ["oct"] });
    assert.deepEqual(pairs(r), [["oct", 200_000]]);
    assert.equal(r.creditRwf, 50_000);
  });

  test("a charge that is not on the lease, or has nothing owing, is refused", () => {
    assert.throws(() => c.allocatePayment(1, CHARGES, { chargeIds: ["dec"] }), (e) => e instanceof c.AllocationError && e.code === "unknown_charge");
    assert.throws(() => c.allocatePayment(1, CHARGES, { chargeIds: ["aug"] }), (e) => e.code === "charge_not_open");
    assert.throws(() => c.allocatePayment(1, CHARGES, { chargeIds: ["jul"] }), (e) => e.code === "charge_not_open");
  });
});

describe("credit is used on the next charge", () => {
  test("an overpayment's credit pays the charge raised next", () => {
    const first = c.allocatePayment(1_000_000, CHARGES);
    assert.equal(first.creditRwf, 200_000);
    const dec = charge("dec", "2026-12-05", 300_000);
    const r = c.applyCredit([{ paymentId: "p1", amountRwf: first.creditRwf }], [dec]);
    assert.deepEqual(r.allocations, [{ paymentId: "p1", chargeId: "dec", amountRwf: 200_000 }]);
    assert.deepEqual(r.remaining, [{ paymentId: "p1", amountRwf: 0 }]);
    const [after] = c.applyAllocations([dec], r.allocations);
    assert.deepEqual([after.paidRwf, after.status], [200_000, "open"]);
  });

  test("the oldest credit is used first, across payments", () => {
    const dec = charge("dec", "2026-12-05", 300_000);
    const r = c.applyCredit(
      [
        { paymentId: "p1", amountRwf: 50_000 },
        { paymentId: "p2", amountRwf: 400_000 },
      ],
      [dec],
    );
    assert.deepEqual(r.allocations, [
      { paymentId: "p1", chargeId: "dec", amountRwf: 50_000 },
      { paymentId: "p2", chargeId: "dec", amountRwf: 250_000 },
    ]);
    assert.deepEqual(r.remaining, [
      { paymentId: "p1", amountRwf: 0 },
      { paymentId: "p2", amountRwf: 150_000 },
    ]);
  });

  test("credit spreads over several open charges, oldest first", () => {
    const r = c.applyCredit([{ paymentId: "p1", amountRwf: 450_000 }], CHARGES);
    assert.deepEqual(
      r.allocations.map((a) => [a.chargeId, a.amountRwf]),
      [["sep", 300_000], ["oct", 150_000]],
    );
  });

  test("a payment's credit is what its allocations left", () => {
    assert.equal(c.paymentCreditRwf(500_000, [200_000, 100_000]), 200_000);
    assert.equal(c.paymentCreditRwf(500_000, []), 500_000);
    assert.throws(() => c.paymentCreditRwf(500_000, [400_000, 200_000]), c.AllocationError);
  });
});

describe("the invariants", () => {
  test("a payment is whole francs above 0", () => {
    for (const bad of [0, -5, 1.5, Number.NaN, 10_000_000_001]) {
      assert.throws(() => c.allocatePayment(bad, CHARGES), (e) => e.code === "bad_amount", String(bad));
    }
  });

  test("a charge with impossible amounts is refused", () => {
    assert.throws(() => c.allocatePayment(1, [charge("x", "2026-11-05", 100, 101)]), (e) => e.code === "bad_charge");
    assert.throws(() => c.allocatePayment(1, [charge("x", "2026-11-05", 0)]), (e) => e.code === "bad_charge");
  });

  test("applying allocations marks a charge paid exactly when it is fully paid, and never overpays", () => {
    const [sep] = c.applyAllocations([charge("sep", "2026-09-05", 300_000)], [{ chargeId: "sep", amountRwf: 300_000 }]);
    assert.deepEqual([sep.paidRwf, sep.status], [300_000, "paid"]);
    assert.throws(() => c.applyAllocations([charge("sep", "2026-09-05", 300_000)], [{ chargeId: "sep", amountRwf: 300_001 }]), c.AllocationError);
    assert.throws(() => c.applyAllocations(CHARGES, [{ chargeId: "zzz", amountRwf: 1 }]), (e) => e.code === "unknown_charge");
    assert.throws(() => c.applyAllocations(CHARGES, [{ chargeId: "sep", amountRwf: 0 }]), (e) => e.code === "bad_amount");
  });

  test("on many random ledgers: never more than owed, never negative, and every franc accounted for", () => {
    // mulberry32: a small seeded generator, so a failure is reproducible.
    let seed = 42;
    const rand = (n) => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) % n;
    };
    for (let round = 0; round < 500; round++) {
      const charges = Array.from({ length: 1 + rand(6) }, (_, i) => {
        const amount = 1 + rand(500_000);
        const status = ["open", "open", "open", "paid", "waived"][rand(5)];
        const paid = status === "paid" ? amount : status === "waived" ? 0 : rand(amount);
        return charge(`c${i}`, `2026-${String(1 + rand(12)).padStart(2, "0")}-05`, amount, paid, status);
      });
      const amount = 1 + rand(2_000_000);
      const r = c.allocatePayment(amount, charges);
      const owed = new Map(charges.map((ch) => [ch.id, c.outstandingRwf(ch)]));
      for (const a of r.allocations) {
        assert.ok(Number.isInteger(a.amountRwf) && a.amountRwf > 0);
        assert.ok(a.amountRwf <= owed.get(a.chargeId));
      }
      assert.ok(r.creditRwf >= 0);
      assert.equal(r.allocations.reduce((s, a) => s + a.amountRwf, 0) + r.creditRwf, amount);
      const totalOwed = [...owed.values()].reduce((s, v) => s + v, 0);
      assert.equal(r.creditRwf, Math.max(0, amount - totalOwed));
      for (const ch of c.applyAllocations(charges, r.allocations)) {
        assert.ok(ch.paidRwf <= ch.amountRwf);
        assert.equal(ch.status === "paid", ch.status !== "waived" && ch.paidRwf === ch.amountRwf);
      }
    }
  });
});
