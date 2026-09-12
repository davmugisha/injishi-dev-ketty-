/**
 * Receipt rows.
 *
 * A `MoneyLine` is how a price reads to a person, not what the wire carries.
 * That is why it lives here beside `formatPrice` rather than in
 * `@injishi/contracts`: the contracts package owns the shapes the API sends and
 * receives, and a receipt row is neither (ADR-011 call 3).
 *
 * The builder's input is declared here, structurally, rather than imported from
 * `@injishi/contracts`. `MoneyBreakdown` satisfies it field for field, so a
 * caller passes one straight in — but this package keeps zero dependencies,
 * which is what lets the workspace copy resolve from either root.
 */

/** One row of a receipt. A negative amount is a discount. */
export interface MoneyLine {
  label: string;
  amountRwf: number;
}

/**
 * Exactly the fields the builder reads. `MoneyBreakdown` from
 * `@injishi/contracts` satisfies this structurally.
 */
export interface QuoteAmounts {
  nights: number;
  nightlyRateRwf: number;
  accommodationRwf: number;
  nonRefundableDiscountRwf: number;
  serviceFeeRwf: number;
  grossRwf: number;
}

/**
 * The row wording, passed in by the caller.
 *
 * Copy belongs to the surface that shows it, and it is the one thing that
 * differs between a booking preview, a confirmation and an operator's view of
 * the same numbers. Keeping it out of here means this helper never carries an
 * app's sentence.
 */
export interface MoneyLineLabels {
  /** The nights row, e.g. "RWF 120,000 x 3 nights". */
  accommodation: string;
  /** Shown only when a non-refundable discount was applied. */
  nonRefundableDiscount: string;
  serviceFee: string;
}

/**
 * Turn a set of amounts into the rows a receipt shows.
 *
 * The discount row is omitted rather than shown at zero: a line reading
 * "Non-refundable discount RWF 0" tells a guest they got a discount they did
 * not get. It is emitted negative, because that is what it does to the total.
 */
export function buildMoneyLines(
  amounts: QuoteAmounts,
  labels: MoneyLineLabels,
): MoneyLine[] {
  const lines: MoneyLine[] = [
    { label: labels.accommodation, amountRwf: amounts.accommodationRwf },
  ];

  if (amounts.nonRefundableDiscountRwf > 0) {
    lines.push({
      label: labels.nonRefundableDiscount,
      amountRwf: -amounts.nonRefundableDiscountRwf,
    });
  }

  lines.push({ label: labels.serviceFee, amountRwf: amounts.serviceFeeRwf });
  return lines;
}
