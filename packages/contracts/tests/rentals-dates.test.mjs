/**
 * Rentals (blueprint WP 1.1): Kigali days and the calendar rules of a tenancy.
 *
 *   pnpm --filter @injishi/contracts test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const c = require("../dist/index.js");

describe("Kigali days", () => {
  test("Kigali is two hours ahead of UTC all year", () => {
    assert.equal(c.kigaliToday(new Date("2026-10-24T21:59:59Z")), "2026-10-24");
    assert.equal(c.kigaliToday(new Date("2026-10-24T22:00:00Z")), "2026-10-25");
    assert.equal(c.kigaliToday(new Date("2026-06-30T22:30:00Z")), "2026-07-01");
    assert.equal(c.kigaliDateOf("2026-12-31T23:00:00Z"), "2027-01-01");
    assert.match(c.kigaliToday(), /^\d{4}-\d{2}-\d{2}$/);
    assert.throws(() => c.kigaliDateOf("not a time"), RangeError);
  });

  test("a date is a real calendar day", () => {
    assert.equal(c.isIsoDate("2026-10-24"), true);
    assert.equal(c.isIsoDate("2028-02-29"), true);
    assert.equal(c.isIsoDate("2027-02-29"), false);
    assert.equal(c.isIsoDate("2026-02-30"), false);
    assert.equal(c.isIsoDate("2026-13-01"), false);
    assert.equal(c.isIsoDate("26-10-24"), false);
    assert.equal(c.isIsoDate(null), false);
    assert.equal(c.CalendarDay.safeParse(" 2026-10-24 ").data, "2026-10-24");
    assert.equal(c.CalendarDay.safeParse("2026-02-30").success, false);
  });

  test("adding days crosses months and years", () => {
    assert.equal(c.addDays("2026-10-24", 15), "2026-11-08");
    assert.equal(c.addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(c.addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(c.addDays("2028-03-01", -1), "2028-02-29");
    assert.throws(() => c.addDays("2026-02-30", 1), RangeError);
  });

  test("adding months keeps the day, or takes the month's last", () => {
    assert.equal(c.addMonths("2026-12-15", 1), "2027-01-15");
    assert.equal(c.addMonths("2027-01-31", 1), "2027-02-28");
    assert.equal(c.addMonths("2028-01-31", 1), "2028-02-29");
    assert.equal(c.addMonths("2026-03-31", -1), "2026-02-28");
    assert.equal(c.addMonths("2026-01-15", -1), "2025-12-15");
    assert.equal(c.addMonths("2026-11-01", 12), "2027-11-01");
  });

  test("month boundaries and days between", () => {
    assert.equal(c.startOfMonth("2026-10-24"), "2026-10-01");
    assert.equal(c.endOfMonth("2026-10-24"), "2026-10-31");
    assert.equal(c.endOfMonth("2028-02-10"), "2028-02-29");
    assert.equal(c.endOfMonth("2027-02-10"), "2027-02-28");
    assert.equal(c.daysInMonth(2026, 4), 30);
    assert.equal(c.daysInMonthOf("2026-12-03"), 31);
    assert.equal(c.daysBetween("2026-10-24", "2026-11-08"), 15);
    assert.equal(c.daysBetween("2026-11-08", "2026-10-24"), -15);
    assert.equal(c.daysBetween("2026-12-31", "2027-01-01"), 1);
    assert.equal(c.monthKey("2026-10-24"), "2026-10");
    assert.equal(c.dayOfMonth("2027-02-10", 31), "2027-02-28");
    assert.equal(c.minDate("2026-01-02", "2026-01-01"), "2026-01-01");
    assert.equal(c.maxDate("2026-01-02", "2026-01-01"), "2026-01-02");
  });

  test("dates read the same on every runtime", () => {
    assert.equal(c.longDate("2026-11-01"), "1 November 2026");
    assert.equal(c.longDate("2027-02-28"), "28 February 2027");
    assert.deepEqual(
      [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 28].map((d) => c.ordinal(d)),
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "28th"],
    );
  });
});

describe("lease dates", () => {
  const TODAY = "2026-10-24";

  test("a lease ends after it starts and runs at least a month", () => {
    assert.equal(c.leaseDatesProblem({ startDate: "2026-11-01", endDate: "2027-10-31" }, TODAY), null);
    assert.deepEqual(c.leaseDatesProblem({ startDate: "2026-11-01", endDate: "2026-11-01" }, TODAY), {
      path: "endDate",
      message: "The lease has to end after it starts.",
    });
    assert.deepEqual(c.leaseDatesProblem({ startDate: "2026-11-01", endDate: "2026-11-29" }, TODAY), {
      path: "endDate",
      message: "A lease runs for at least one month.",
    });
    assert.equal(c.leaseDatesProblem({ startDate: "2026-11-01", endDate: "2026-11-30" }, TODAY), null);
  });

  test("the shortest lease is one month, whatever the start day", () => {
    assert.equal(c.shortestLeaseEnd("2026-11-01"), "2026-11-30");
    assert.equal(c.shortestLeaseEnd("2026-11-15"), "2026-12-14");
    assert.equal(c.shortestLeaseEnd("2027-01-31"), "2027-02-28");
    assert.equal(c.shortestLeaseEnd("2028-01-31"), "2028-02-29");
    assert.equal(c.shortestLeaseEnd("2026-12-31"), "2027-01-30");
  });

  test("a lease starts no more than 30 days ago", () => {
    assert.deepEqual(c.leaseDatesProblem({ startDate: "2026-09-23", endDate: "2027-09-22" }, TODAY), {
      path: "startDate",
      message: "Pick a start date no more than 30 days ago.",
    });
    assert.equal(c.leaseDatesProblem({ startDate: "2026-09-24", endDate: "2027-09-23" }, TODAY), null);
    assert.equal(c.earliestLeaseStart(TODAY), "2026-09-24");
  });

  test("a lease runs at most ten years", () => {
    assert.equal(c.leaseDatesProblem({ startDate: "2026-11-01", endDate: "2036-10-31" }, TODAY), null);
    assert.equal(c.leaseDatesProblem({ startDate: "2026-11-01", endDate: "2036-11-01" }, TODAY).path, "endDate");
  });

  test("an existing tenancy brought in may have started long ago; billing starts inside the last 30 days", () => {
    const brought = { startDate: "2025-01-01", endDate: "2027-12-31" };
    assert.equal(c.leaseDatesProblem({ ...brought, billingStartsOn: "2026-10-01" }, TODAY), null);
    assert.equal(c.leaseDatesProblem({ ...brought, billingStartsOn: "2026-09-24" }, TODAY), null);
    assert.deepEqual(c.leaseDatesProblem({ ...brought, billingStartsOn: "2026-09-23" }, TODAY), {
      path: "billingStartsOn",
      message: "Pick a billing start no more than 30 days ago.",
    });
    assert.equal(c.leaseDatesProblem({ ...brought, billingStartsOn: "2024-12-31" }, TODAY).path, "billingStartsOn");
    assert.equal(c.leaseDatesProblem({ ...brought, billingStartsOn: "2027-12-31" }, TODAY).path, "billingStartsOn");
    assert.equal(c.leaseDatesProblem({ startDate: "2025-01-01", endDate: "2027-12-31" }, TODAY).path, "startDate");
  });
});

describe("the notice window", () => {
  const TODAY = "2026-10-23";
  const LEASE = { startDate: "2026-01-01", endDate: "2027-06-30" };

  test("14 days away is too soon; 15 days is the first day a notice may name", () => {
    assert.equal(c.LEASE_NOTICE_MIN_DAYS, 15);
    assert.equal(c.noticeWindow(LEASE, TODAY).min, "2026-11-07");
    assert.equal(c.noticeDateProblem("2026-11-06", LEASE, TODAY), "Pick a date at least 15 days away.");
    assert.equal(c.noticeDateProblem("2026-11-07", LEASE, TODAY), null);
  });

  test("a notice never names a day after the lease ends", () => {
    assert.equal(c.noticeWindow(LEASE, TODAY).max, "2027-06-30");
    assert.equal(c.noticeDateProblem("2027-06-30", LEASE, TODAY), null);
    assert.equal(c.noticeDateProblem("2027-07-01", LEASE, TODAY), "Pick the lease's last day or earlier.");
  });

  test("a lease that asks for more notice gets it, and never less than 15", () => {
    const thirty = { ...LEASE, noticeDays: 30 };
    assert.equal(c.noticeWindow(thirty, TODAY).min, "2026-11-22");
    assert.equal(c.noticeDateProblem("2026-11-21", thirty, TODAY), "Pick a date at least 30 days away.");
    assert.equal(c.noticeDateProblem("2026-11-22", thirty, TODAY), null);
    assert.equal(c.noticeWindow({ ...LEASE, noticeDays: 10 }, TODAY).min, "2026-11-07");
  });

  test("a lease ending within 15 days needs no notice: it simply ends", () => {
    const endsIn14 = { startDate: "2026-01-01", endDate: "2026-11-06" };
    assert.equal(c.noticeNotNeeded(endsIn14, TODAY), true);
    assert.match(c.noticeDateProblem("2026-11-06", endsIn14, TODAY), /No notice is needed/);
    const endsIn15 = { startDate: "2026-01-01", endDate: "2026-11-07" };
    assert.equal(c.noticeNotNeeded(endsIn15, TODAY), false);
    assert.equal(c.noticeDateProblem("2026-11-07", endsIn15, TODAY), null);
    assert.equal(c.noticeNotNeeded(LEASE, TODAY), false);
  });

  test("a notice on a lease that has not started names a day after the start", () => {
    const future = { startDate: "2026-12-01", endDate: "2027-12-01" };
    assert.equal(c.noticeWindow(future, TODAY).min, "2026-12-02");
    assert.equal(c.noticeDateProblem("2026-12-01", future, TODAY), "Pick a date after the lease starts.");
    assert.equal(c.noticeDateProblem("2026-12-02", future, TODAY), null);
  });
});

describe("moving out", () => {
  const TODAY = "2026-10-23";
  const LEASE = { startDate: "2026-01-01", endDate: "2027-06-30" };

  test("moved out is today or earlier, and not before the lease started", () => {
    assert.deepEqual(c.movedOutWindow(LEASE, TODAY), { min: "2026-01-01", max: TODAY });
    assert.equal(c.movedOutProblem(TODAY, LEASE, TODAY), null);
    assert.equal(c.movedOutProblem("2026-01-01", LEASE, TODAY), null);
    assert.equal(c.movedOutProblem("2026-10-24", LEASE, TODAY), "Pick today or an earlier day.");
    assert.equal(c.movedOutProblem("2025-12-31", LEASE, TODAY), "Pick a day on or after the lease started.");
    assert.equal(c.movedOutProblem("2026-02-30", LEASE, TODAY), "Pick a date.");
  });
});

describe("a guest's stay", () => {
  const TODAY = "2026-10-24";
  const LEASE = { start: "2026-01-01", end: "2027-06-30" };
  const stay = (arrivalOn, departureOn, window = LEASE) => c.guestStayProblem({ arrivalOn, departureOn, today: TODAY, window });

  test("arrival is today or later", () => {
    assert.equal(stay("2026-10-23", "2026-10-25").path, "arrivalOn");
    assert.equal(stay(TODAY, "2026-10-25"), null);
  });

  test("departure is on or after arrival", () => {
    assert.equal(stay("2026-10-26", "2026-10-26"), null);
    assert.deepEqual(stay("2026-10-26", "2026-10-25"), {
      path: "departureOn",
      message: "The departure date can't be before arrival.",
    });
  });

  test("a stay is at most 90 days", () => {
    assert.equal(c.MAX_GUEST_STAY_DAYS, 90);
    assert.equal(stay("2026-10-24", "2027-01-22"), null);
    assert.deepEqual(stay("2026-10-24", "2027-01-23"), { path: "departureOn", message: "A stay can be at most 90 days." });
  });

  test("a tenant's guest stays inside the lease", () => {
    const endsSoon = { start: "2026-01-01", end: "2026-11-10" };
    assert.deepEqual(stay("2026-11-01", "2026-11-11", endsSoon), { path: "departureOn", message: "Pick a departure inside the lease." });
    assert.equal(stay("2026-11-01", "2026-11-10", endsSoon), null);
    assert.equal(stay("2026-11-11", "2026-11-12", endsSoon).path, "arrivalOn");
    const notStarted = { start: "2026-12-01", end: "2027-12-01" };
    assert.equal(stay("2026-11-20", "2026-12-05", notStarted).path, "arrivalOn");
    assert.equal(c.guestArrivalMin(TODAY, notStarted), "2026-12-01");
    assert.equal(c.guestDepartureMax("2026-11-01", endsSoon), "2026-11-10");
    assert.equal(c.guestDepartureMax("2026-11-01"), "2027-01-30");
  });

  test("a landlord's guest has no lease to stay inside", () => {
    assert.equal(c.guestStayProblem({ arrivalOn: "2027-08-01", departureOn: "2027-08-03", today: TODAY }), null);
  });

  test("where a stay is today", () => {
    assert.equal(c.guestStayPhase(TODAY, "2026-10-25", "2026-10-30"), "arriving");
    assert.equal(c.guestStayPhase(TODAY, "2026-10-24", "2026-10-30"), "staying");
    assert.equal(c.guestStayPhase(TODAY, "2026-10-20", "2026-10-24"), "staying");
    assert.equal(c.guestStayPhase(TODAY, "2026-10-20", "2026-10-23"), "left");
  });
});

describe("days that already happened", () => {
  const TODAY = "2026-10-24";

  test("an expense or a fault is dated today or earlier, from 2000 on", () => {
    assert.equal(c.pastDateProblem(TODAY, { today: TODAY }), null);
    assert.equal(c.pastDateProblem("2000-01-01", { today: TODAY }), null);
    assert.equal(c.pastDateProblem("2026-10-25", { today: TODAY }), "That date hasn't happened yet.");
    assert.equal(c.pastDateProblem("1999-12-31", { today: TODAY }), "Pick a date from 2000 on.");
    assert.equal(c.pastDateProblem("2026-02-30", { today: TODAY }), "Pick a date.");
    assert.equal(
      c.pastDateProblem("2026-10-01", { today: TODAY, notBefore: "2026-10-05", notBeforeLabel: "That's before it was reported." }),
      "That's before it was reported.",
    );
  });

  test("the schema refuses a day still to come", () => {
    assert.equal(c.PastCalendarDay.safeParse(c.kigaliToday()).success, true);
    assert.equal(c.PastCalendarDay.safeParse(c.addDays(c.kigaliToday(), 1)).success, false);
  });
});
