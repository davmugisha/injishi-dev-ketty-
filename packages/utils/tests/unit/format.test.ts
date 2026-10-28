import { describe, expect, test } from "vitest";

import {
  formatDateRange,
  formatDayMonth,
  formatMarketDateTime,
  formatPrice,
  nightsBetween,
  pluralize,
  toISODate,
} from "../../src/format";

describe("formatPrice", () => {
  test("whole francs, grouped, with the RWF prefix written out", () => {
    expect(formatPrice(175000)).toBe("RWF 175,000");
    expect(formatPrice(0)).toBe("RWF 0");
  });

  test("a fractional amount rounds to the nearest franc, because francs have no minor unit", () => {
    expect(formatPrice(175000.6)).toBe("RWF 175,001");
    expect(formatPrice(175000.4)).toBe("RWF 175,000");
  });

  test("dollars take the currency symbol and no cents", () => {
    expect(formatPrice(1200, "USD")).toBe("$1,200");
  });
});

describe("the Kigali clock", () => {
  test("these tests run in Kigali, UTC+2, as vitest.config.ts pins", () => {
    expect(new Date(2026, 2, 12).getTimezoneOffset()).toBe(-120);
  });

  test("formatMarketDateTime prints an instant in Kigali time", () => {
    // 01:00 UTC is 03:00 in Kigali.
    expect(formatMarketDateTime(new Date("2026-03-12T01:00:00Z"))).toBe("12 Mar, 03:00");
  });

  test("toISODate reads the local day, where toISOString reports the day before", () => {
    const halfPastOne = new Date(2026, 2, 12, 1, 30); // 23:30 UTC on the 11th
    expect(halfPastOne.toISOString().slice(0, 10)).toBe("2026-03-11");
    expect(toISODate(halfPastOne)).toBe("2026-03-12");
  });
});

describe("dates on the listing cards and the booking widget", () => {
  test("a day is the date then the short month", () => {
    expect(formatDayMonth(new Date(2026, 2, 12))).toBe("12 Mar");
  });

  test("a range inside one month names the month once", () => {
    expect(formatDateRange(new Date(2026, 2, 12), new Date(2026, 2, 18))).toBe("12 – 18 Mar");
  });

  test("a range across a month end names both months", () => {
    expect(formatDateRange(new Date(2026, 1, 28), new Date(2026, 2, 3))).toBe("28 Feb – 3 Mar");
  });
});

describe("nightsBetween", () => {
  test("counts calendar nights, whatever the time of day", () => {
    expect(nightsBetween(new Date(2026, 2, 12, 23, 0), new Date(2026, 2, 13, 1, 0))).toBe(1);
    expect(nightsBetween(new Date(2026, 2, 12, 9, 0), new Date(2026, 2, 12, 22, 0))).toBe(0);
    expect(nightsBetween(new Date(2026, 1, 28), new Date(2026, 2, 3))).toBe(3);
  });

  test("a check out before the check in is zero nights, never a negative count", () => {
    expect(nightsBetween(new Date(2026, 2, 15), new Date(2026, 2, 12))).toBe(0);
  });
});

describe("pluralize", () => {
  test("one is singular, anything else takes the plural", () => {
    expect(pluralize(1, "night")).toBe("1 night");
    expect(pluralize(2, "night")).toBe("2 nights");
    expect(pluralize(0, "night")).toBe("0 nights");
  });

  test("an irregular plural is passed in", () => {
    expect(pluralize(3, "person", "people")).toBe("3 people");
  });
});
