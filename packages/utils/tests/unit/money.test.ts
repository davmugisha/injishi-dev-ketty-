import { describe, expect, test } from "vitest";

import { buildMoneyLines, type MoneyLineLabels, type QuoteAmounts } from "../../src/money";

const labels: MoneyLineLabels = {
  accommodation: "RWF 120,000 x 3 nights",
  nonRefundableDiscount: "Non-refundable discount",
  serviceFee: "Service fee",
};

const quote: QuoteAmounts = {
  nights: 3,
  nightlyRateRwf: 120_000,
  accommodationRwf: 360_000,
  nonRefundableDiscountRwf: 36_000,
  serviceFeeRwf: 16_200,
  grossRwf: 340_200,
};

describe("buildMoneyLines", () => {
  test("rows read accommodation, then the discount as a negative amount, then the service fee", () => {
    expect(buildMoneyLines(quote, labels)).toEqual([
      { label: "RWF 120,000 x 3 nights", amountRwf: 360_000 },
      { label: "Non-refundable discount", amountRwf: -36_000 },
      { label: "Service fee", amountRwf: 16_200 },
    ]);
  });

  test("no discount means no discount row, never a row reading RWF 0", () => {
    const lines = buildMoneyLines({ ...quote, nonRefundableDiscountRwf: 0 }, labels);
    expect(lines.map((line) => line.label)).toEqual(["RWF 120,000 x 3 nights", "Service fee"]);
  });

  test("the wording is the caller's: the helper carries no sentence of its own", () => {
    const lines = buildMoneyLines(quote, { accommodation: "A", nonRefundableDiscount: "B", serviceFee: "C" });
    expect(lines.map((line) => line.label)).toEqual(["A", "B", "C"]);
  });
});
