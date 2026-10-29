/**
 * Rentals (blueprint WP 1.1): the calendar-month rent schedule, raising
 * charges 7 days ahead, and overdue.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

/** A schedule as compact rows: period start, period end, due, amount. */
const rows = (input) => c.rentSchedule(input).map((r) => [r.periodStart, r.periodEnd, r.dueOn, r.amountRwf]);

describe("full calendar months", () => {
  test("a lease from the 1st charges whole months, due on the due day", () => {
    assert.deepEqual(rows({ startDate: "2026-11-01", endDate: "2027-01-31", monthlyRentRwf: 300_000, rentDueDay: 5 }), [
      ["2026-11-01", "2026-11-30", "2026-11-05", 300_000],
      ["2026-12-01", "2026-12-31", "2026-12-05", 300_000],
      ["2027-01-01", "2027-01-31", "2027-01-05", 300_000],
    ]);
  });

  test("a year from the 1st is twelve full months", () => {
    const s = c.rentSchedule({ startDate: "2026-11-01", endDate: "2027-10-31", monthlyRentRwf: 450_000, rentDueDay: 1 });
    assert.equal(s.length, 12);
    assert.equal(s.every((r) => !r.prorated && r.amountRwf === 450_000 && r.dueOn === r.periodStart), true);
    assert.equal(c.scheduledRentTotal(s), 12 * 450_000);
  });
});

describe("partial months", () => {
  test("the first month is prorated by its days and due on the start when the due day has passed", () => {
    assert.deepEqual(rows({ startDate: "2026-11-15", endDate: "2027-02-14", monthlyRentRwf: 300_000, rentDueDay: 5 }), [
      ["2026-11-15", "2026-11-30", "2026-11-15", 160_000],
      ["2026-12-01", "2026-12-31", "2026-12-05", 300_000],
      ["2027-01-01", "2027-01-31", "2027-01-05", 300_000],
      ["2027-02-01", "2027-02-14", "2027-02-05", 150_000],
    ]);
  });

  test("a first month starting before the due day keeps the due day", () => {
    const [first] = c.rentSchedule({ startDate: "2026-11-03", endDate: "2027-11-02", monthlyRentRwf: 300_000, rentDueDay: 5 });
    assert.deepEqual([first.periodStart, first.dueOn, first.amountRwf, first.days, first.daysInMonth], ["2026-11-03", "2026-11-05", 280_000, 28, 30]);
  });

  test("the last month is prorated by its days", () => {
    assert.deepEqual(rows({ startDate: "2026-11-01", endDate: "2026-12-10", monthlyRentRwf: 310_000, rentDueDay: 5 }), [
      ["2026-11-01", "2026-11-30", "2026-11-05", 310_000],
      ["2026-12-01", "2026-12-10", "2026-12-05", 100_000],
    ]);
  });

  test("a last month ending before the due day falls due on the lease's last day", () => {
    const last = c.rentSchedule({ startDate: "2026-11-01", endDate: "2026-12-03", monthlyRentRwf: 310_000, rentDueDay: 5 }).at(-1);
    assert.deepEqual([last.periodStart, last.periodEnd, last.dueOn, last.amountRwf], ["2026-12-01", "2026-12-03", "2026-12-03", 30_000]);
  });

  test("a lease starting on the 31st charges one day, then whole months", () => {
    assert.deepEqual(rows({ startDate: "2027-01-31", endDate: "2027-04-30", monthlyRentRwf: 280_000, rentDueDay: 5 }), [
      ["2027-01-31", "2027-01-31", "2027-01-31", 9_032],
      ["2027-02-01", "2027-02-28", "2027-02-05", 280_000],
      ["2027-03-01", "2027-03-31", "2027-03-05", 280_000],
      ["2027-04-01", "2027-04-30", "2027-04-05", 280_000],
    ]);
  });

  test("February prorates by its own 28 days, or 29 in a leap year", () => {
    const [feb] = c.rentSchedule({ startDate: "2027-02-15", endDate: "2027-05-14", monthlyRentRwf: 280_000, rentDueDay: 1 });
    assert.deepEqual([feb.days, feb.daysInMonth, feb.amountRwf, feb.dueOn], [14, 28, 140_000, "2027-02-15"]);
    assert.deepEqual(rows({ startDate: "2028-02-10", endDate: "2028-05-09", monthlyRentRwf: 290_000, rentDueDay: 10 }), [
      ["2028-02-10", "2028-02-29", "2028-02-10", 200_000],
      ["2028-03-01", "2028-03-31", "2028-03-10", 290_000],
      ["2028-04-01", "2028-04-30", "2028-04-10", 290_000],
      ["2028-05-01", "2028-05-09", "2028-05-09", 84_194],
    ]);
  });

  test("a prorated month rounds to the nearest franc and never charges 0", () => {
    const [first] = c.rentSchedule({ startDate: "2026-12-31", endDate: "2027-01-30", monthlyRentRwf: 10, rentDueDay: 1 });
    assert.equal(first.amountRwf, 1);
  });
});

describe("a tenancy brought in mid way", () => {
  test("billing starts on billing_starts_on, prorated, and nothing before it is charged", () => {
    const s = c.rentSchedule({
      startDate: "2026-06-01",
      endDate: "2027-05-31",
      monthlyRentRwf: 310_000,
      rentDueDay: 1,
      billingStartsOn: "2026-10-15",
    });
    assert.equal(s.length, 8);
    assert.deepEqual([s[0].periodStart, s[0].periodEnd, s[0].dueOn, s[0].amountRwf], ["2026-10-15", "2026-10-31", "2026-10-15", 170_000]);
    assert.deepEqual([s[1].periodStart, s[1].dueOn, s[1].amountRwf], ["2026-11-01", "2026-11-01", 310_000]);
    assert.equal(s.at(-1).periodEnd, "2027-05-31");
  });

  test("billing starting on the 1st charges whole months from there", () => {
    const s = c.rentSchedule({ startDate: "2026-06-10", endDate: "2027-06-09", monthlyRentRwf: 300_000, rentDueDay: 5, billingStartsOn: "2026-11-01" });
    assert.deepEqual([s[0].periodStart, s[0].dueOn, s[0].amountRwf], ["2026-11-01", "2026-11-05", 300_000]);
  });

  test("billing starts inside the lease", () => {
    const lease = { startDate: "2026-06-01", endDate: "2027-05-31", monthlyRentRwf: 310_000, rentDueDay: 1 };
    assert.throws(() => c.rentSchedule({ ...lease, billingStartsOn: "2026-05-31" }), RangeError);
    assert.throws(() => c.rentSchedule({ ...lease, billingStartsOn: "2027-06-01" }), RangeError);
  });
});

describe("refusing a schedule that cannot exist", () => {
  const lease = { startDate: "2026-11-01", endDate: "2027-10-31", monthlyRentRwf: 300_000, rentDueDay: 5 };
  test("bad inputs throw", () => {
    assert.throws(() => c.rentSchedule({ ...lease, rentDueDay: 29 }), RangeError);
    assert.throws(() => c.rentSchedule({ ...lease, rentDueDay: 0 }), RangeError);
    assert.throws(() => c.rentSchedule({ ...lease, monthlyRentRwf: 0 }), RangeError);
    assert.throws(() => c.rentSchedule({ ...lease, monthlyRentRwf: 100.5 }), RangeError);
    assert.throws(() => c.rentSchedule({ ...lease, endDate: "2026-10-31" }), RangeError);
    assert.throws(() => c.rentSchedule({ ...lease, startDate: "2026-02-30" }), RangeError);
  });
});

describe("raising charges 7 days ahead", () => {
  const schedule = c.rentSchedule({ startDate: "2026-11-01", endDate: "2027-01-31", monthlyRentRwf: 300_000, rentDueDay: 5 });
  const periods = (list) => list.map((r) => r.periodStart);

  test("a charge is raised 7 days before it falls due", () => {
    assert.equal(c.RENT_RAISE_DAYS_AHEAD, 7);
    assert.equal(c.raiseOn(schedule[0]), "2026-10-29");
    assert.deepEqual(periods(c.rentChargesToRaise(schedule, "2026-10-28")), []);
    assert.deepEqual(periods(c.rentChargesToRaise(schedule, "2026-10-29")), ["2026-11-01"]);
  });

  test("what was raised is not raised again", () => {
    assert.deepEqual(periods(c.rentChargesToRaise(schedule, "2026-11-28", ["2026-11-01"])), ["2026-12-01"]);
    assert.deepEqual(periods(c.rentChargesToRaise(schedule, "2026-11-27", ["2026-11-01"])), []);
  });

  test("a run that missed days catches up", () => {
    assert.deepEqual(periods(c.rentChargesToRaise(schedule, "2026-12-29")), ["2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  test("a lease starting within the week raises its first month at once", () => {
    const s = c.rentSchedule({ startDate: "2026-10-27", endDate: "2027-10-26", monthlyRentRwf: 310_000, rentDueDay: 27 });
    assert.deepEqual(periods(c.rentChargesToRaise(s, "2026-10-24")), ["2026-10-27"]);
  });

  test("the charge covering a day", () => {
    assert.equal(c.scheduledChargeOn(schedule, "2026-12-15").periodStart, "2026-12-01");
    assert.equal(c.scheduledChargeOn(schedule, "2027-02-01"), null);
  });
});

describe("the deposit charge", () => {
  test("due on the start date, and none when the lease takes no deposit", () => {
    assert.deepEqual(c.depositCharge({ startDate: "2026-11-01", depositRwf: 600_000 }), { dueOn: "2026-11-01", amountRwf: 600_000 });
    assert.equal(c.depositCharge({ startDate: "2026-11-01", depositRwf: 0 }), null);
  });
});

describe("overdue", () => {
  const open = { status: "open", dueOn: "2026-11-05" };

  test("open and past the due day plus the grace days", () => {
    assert.equal(c.isChargeOverdue(open, 5, "2026-11-10"), false);
    assert.equal(c.isChargeOverdue(open, 5, "2026-11-11"), true);
    assert.equal(c.overdueFrom("2026-11-05", 5), "2026-11-11");
    assert.equal(c.isChargeOverdue(open, 0, "2026-11-05"), false);
    assert.equal(c.isChargeOverdue(open, 0, "2026-11-06"), true);
  });

  test("a paid or waived charge is never overdue", () => {
    assert.equal(c.isChargeOverdue({ ...open, status: "paid" }, 0, "2027-01-01"), false);
    assert.equal(c.isChargeOverdue({ ...open, status: "waived" }, 0, "2027-01-01"), false);
  });

  test("days past due, and the ageing bands", () => {
    assert.equal(c.daysOverdue(open, 5, "2026-11-10"), 0);
    assert.equal(c.daysOverdue(open, 5, "2026-11-11"), 6);
    assert.deepEqual(
      [0, 1, 15, 16, 30, 31, 60, 61, 400].map((d) => c.arrearsBand(d)),
      [null, "1_15", "1_15", "16_30", "16_30", "31_60", "31_60", "61_plus", "61_plus"],
    );
  });
});
