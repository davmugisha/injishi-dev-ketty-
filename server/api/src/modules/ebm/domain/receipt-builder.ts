import {
  EBM_VAT_LABEL,
  EBM_VAT_RATE_PERCENT,
  ebmTaxIncludedIn,
  type EbmReceipt,
  type EbmReceiptItem,
  type EbmSeller,
  type EbmTaxLabel,
  type EbmTaxLine,
  type MoneyBreakdown,
} from '@injishi/contracts';

import type { VsdcSignature } from './vsdc-port';

/**
 * Turning a stay into the receipt clause 13.1 prescribes.
 *
 * Pure, and deliberately so: everything here is arithmetic and layout, the two
 * things a tax authority checks and the two things nobody wants to reach a
 * database to test. What is sold, at what rate, carrying how much tax, adding
 * up to what — all of it is decided in this file and pinned by its spec.
 *
 * The one rule that outranks every other in here: `TOTAL` is what the guest was
 * actually charged. A receipt is a statement about money that already moved. If
 * the lines cannot be made to add up to the charge, this file refuses to build
 * a receipt rather than print a total that is merely close.
 */

/**
 * The rates this CIS is programmed with (7.21.5).
 *
 * Only `B` is programmed above zero, so only `B` has to print on every receipt
 * (7.22); `A` is the exempt band and prints only when something exempt is sold
 * (7.23). `C` and `D` are not programmed at all, which is why they are absent
 * rather than present with a zero — a zero would claim they exist.
 */
const RATE_BY_LABEL: Partial<Record<EbmTaxLabel, number>> = {
  A: 0,
  B: EBM_VAT_RATE_PERCENT,
};

/**
 * The commercial messages (13.1, first and last blocks).
 *
 * Platform defaults, because nothing stores a per-taxpayer message yet: `orgs`
 * has no column for one. A real CIS lets the taxpayer program these (7.21), and
 * the day that column exists these become its fallback rather than its value.
 */
const COMMERCIAL_MESSAGE = 'Murakaza neza / Welcome';
const CLOSING_MESSAGE = ['MURAKOZE / THANK YOU', 'COME BACK AGAIN'];

/** Raised when the lines cannot be made to agree with what was charged. */
export class ReceiptArithmeticError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReceiptArithmeticError';
  }
}

/** Everything the receipt needs about the stay being invoiced. */
export interface StayForReceipt {
  bookingReference: string;
  seller: EbmSeller;
  propertyName: string;
  roomTypeName: string;
  /** `yyyy-mm-dd`, as the booking stores them. */
  checkIn: string;
  checkOut: string;
  /**
   * The server's own price breakdown, re-derived from the LOCKED nightly rate
   * with the same `computeBreakdown` the charge used. It is what lets the
   * receipt show a room rate, a discount and a fee instead of one opaque total.
   */
  breakdown: MoneyBreakdown;
  /** What the booking was actually charged, straight off the booking row. */
  chargedRwf: number;
  /** 7.13 — the means of payment, printed above `ITEMS NUMBER`. */
  paymentLabel: string;
  /** 13.1 marks the client's identification optional; null when unknown. */
  clientId: string | null;
}

/** What a line contributes to the totals: its discounted total when it has one. */
function effectiveTotal(item: EbmReceiptItem): number {
  return item.discountedTotalRwf ?? item.totalRwf;
}

/**
 * The item lines for a stay (13.1, item section).
 *
 * Two lines at most, and each earns its place:
 *
 * 1. The accommodation, priced the way the guest was quoted it — nightly rate
 *    x nights. When the guest took the non-refundable rate, the reduction
 *    prints as the spec's own discount row (`discount -10%  <total>`) rather
 *    than being folded into a lower nightly rate, because the rate they saw was
 *    the standard one and a receipt that hides the reduction hides why the
 *    booking cannot be cancelled.
 * 2. The service fee, which is a separate service sold at the same VAT rate.
 *    Omitted entirely when it is zero: 7.27 counts the items SHOWN, so a
 *    zero-value line would inflate `ITEMS NUMBER` for nothing.
 *
 * AN OPEN COMPLIANCE QUESTION, recorded here because it is not this file's to
 * settle: the fee is the PLATFORM's revenue, and this receipt is issued under
 * the PROPERTY's TIN. Printing it here declares the platform's income as the
 * hotel's sale. The alternative — two receipts, one per taxpayer — is a
 * decision about who registers with the RRA as what, and it has not been made.
 * It is on this line rather than dropped because `TOTAL` has to be the amount
 * the guest was charged, and the guest was charged the fee.
 *
 * The discount percentage is derived from the money rather than from the 10%
 * constant it came from. `computeBreakdown` rounds the reduction to whole
 * francs, so on some totals the true percentage is 9.999…, and a line reading
 * `-10%` beside an amount that is not exactly ten percent is a receipt that
 * contradicts itself under an auditor's calculator.
 */
export function stayItems(stay: StayForReceipt): EbmReceiptItem[] {
  const { breakdown } = stay;
  const items: EbmReceiptItem[] = [];

  const discount = breakdown.nonRefundableDiscountRwf;
  items.push({
    name: `${stay.roomTypeName}, ${stay.propertyName} (${stay.checkIn} to ${stay.checkOut})`,
    unitPriceRwf: breakdown.nightlyRateRwf,
    quantity: breakdown.nights,
    totalRwf: breakdown.accommodationRwf,
    taxLabel: EBM_VAT_LABEL,
    discountPercent:
      discount > 0 && breakdown.accommodationRwf > 0
        ? Math.round((discount / breakdown.accommodationRwf) * 10_000) / 100
        : null,
    discountedTotalRwf:
      discount > 0 ? breakdown.accommodationRwf - discount : null,
  });

  if (breakdown.serviceFeeRwf > 0) {
    items.push({
      name: 'Booking service fee',
      unitPriceRwf: breakdown.serviceFeeRwf,
      quantity: 1,
      totalRwf: breakdown.serviceFeeRwf,
      taxLabel: EBM_VAT_LABEL,
      discountPercent: null,
      discountedTotalRwf: null,
    });
  }

  return items;
}

/**
 * One `TOTAL <label>-<rate>%` / `TOTAL TAX <label>` pair per rate in use
 * (13.1, totals section).
 *
 * The taxable amount is the tax-INCLUSIVE total sold under that rate, and the
 * tax is the part of it that is tax — the specification's own example is the
 * proof: 5340.00 under `B-18.00%` prints `TOTAL TAX B 814.58`, which is
 * 5340 x 18 / 118 and not 5340 x 0.18. Reading it the other way overstates
 * every accommodation invoice in the country by the VAT.
 *
 * Sorted by label so two receipts for the same sale print their totals in the
 * same order, whatever order the items happened to arrive in.
 */
export function taxLinesFor(items: EbmReceiptItem[]): EbmTaxLine[] {
  const taxableByLabel = new Map<EbmTaxLabel, number>();
  for (const item of items) {
    const rate = RATE_BY_LABEL[item.taxLabel];
    if (rate === undefined) {
      // A line carrying a rate this CIS was never programmed with cannot be
      // taxed, and inventing a rate for it would understate or overstate the
      // return. 7.21.5 says the labels are programmed; this one was not.
      throw new ReceiptArithmeticError(
        `tax label "${item.taxLabel}" is not programmed on this CIS`,
      );
    }
    taxableByLabel.set(
      item.taxLabel,
      (taxableByLabel.get(item.taxLabel) ?? 0) + effectiveTotal(item),
    );
  }

  return [...taxableByLabel.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, taxableRwf]) => {
      const ratePercent = RATE_BY_LABEL[label] ?? 0;
      return {
        label,
        ratePercent,
        taxableRwf,
        taxRwf: ebmTaxIncludedIn(taxableRwf, ratePercent),
      };
    });
}

/** The priced half of a receipt: everything decided before the VSDC is asked. */
export interface PricedStay {
  items: EbmReceiptItem[];
  totalRwf: number;
  taxLines: EbmTaxLine[];
  totalTaxRwf: number;
}

/**
 * Price a stay into item lines and totals.
 *
 * This runs BEFORE the VSDC is asked to sign, and the order is not cosmetic: a
 * device signs a sale, so the totals have to exist to be signed. Asking first
 * and pricing afterwards would produce a signature over nothing in particular.
 */
export function priceStay(stay: StayForReceipt): PricedStay {
  const items = stayItems(stay);
  const totalRwf = items.reduce((sum, item) => sum + effectiveTotal(item), 0);

  if (totalRwf !== stay.chargedRwf) {
    // The one failure this file exists to prevent. A receipt whose TOTAL is not
    // the amount taken is wrong in the direction that matters: it either
    // under-declares tax or bills a guest for money nobody took. Refusing costs
    // one broken screen; printing costs a false fiscal declaration.
    throw new ReceiptArithmeticError(
      `receipt lines total ${totalRwf} RWF but booking ${stay.bookingReference} was charged ${stay.chargedRwf} RWF`,
    );
  }

  const taxLines = taxLinesFor(items);

  return {
    items,
    totalRwf,
    taxLines,
    totalTaxRwf: taxLines.reduce((sum, line) => sum + line.taxRwf, 0),
  };
}

/**
 * A NORMAL SALE (`NS`, clause 13) receipt for one stay.
 *
 * `signature` is the VSDC's answer and this function does not second-guess it:
 * clause 7.20 is "receive response data from VSDC and add this information to
 * final receipt structure", not "and check it". The half this file is
 * answerable for — that the lines add up to the money that actually moved — was
 * checked in `priceStay`, which is where a wrong total stops.
 */
export function buildStayReceipt(
  stay: StayForReceipt,
  priced: PricedStay,
  signature: VsdcSignature,
): EbmReceipt {
  return {
    bookingReference: stay.bookingReference,
    receiptType: 'NS',
    transaction: 'SALE',
    seller: stay.seller,
    commercialMessage: COMMERCIAL_MESSAGE,
    clientId: stay.clientId,
    items: priced.items,
    totalRwf: priced.totalRwf,
    totalTaxRwf: priced.totalTaxRwf,
    taxLines: priced.taxLines,
    payment: { label: stay.paymentLabel, amountRwf: priced.totalRwf },
    // 7.27: the number of items shown, excluding voids. There are no voids on a
    // stay receipt, so it is exactly the number of lines printed above.
    itemsNumber: priced.items.length,
    sdc: signature.sdc,
    cis: signature.cis,
    closingMessage: [...CLOSING_MESSAGE],
  };
}
