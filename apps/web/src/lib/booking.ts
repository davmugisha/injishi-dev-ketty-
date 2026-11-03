import {
  type CancellationTier,
  cancellationSummary,
  computeBreakdown,
  type MoneyBreakdown,
  type RoomPriceBasis,
  tourismTaxIncludedRwf,
} from "@injishi/contracts";
import { buildMoneyLines, type MoneyLine } from "@injishi/utils/money";
import { formatPrice } from "@injishi/utils";

/**
 * Guest-facing booking maths.
 *
 * Everything here is a *preview*. `POST /api/v1/bookings` re-derives the money
 * breakdown from the room type's own rate and ignores any amount the client
 * sends, so the charge is right whatever this file says.
 *
 * What changed (ADR-014 call 4, ADR-020 AC-8): this file used to hold its own
 * copy of the arithmetic and its own copy of the two rates, hand-kept in step
 * with the server's. Two copies of a rounding rule is a quote that eventually
 * disagrees with the charge, and the guest reads the quote. The arithmetic now
 * comes from `@injishi/contracts`, which is where `MoneyBreakdown` is defined,
 * so the preview and the charge cannot drift apart at all.
 *
 * What stays here is the wording: a receipt row is presentation, not a wire
 * shape (ADR-011 call 3).
 */
export interface QuotePreview extends MoneyBreakdown {
  lines: MoneyLine[];
  /** Rwanda's 3% tourism tax inside the room's price (2026-10-30): shown, never added. */
  tourismTaxRwf: number;
}

/** Returns null when there are no nights to price. */
export function computeQuote({
  nightlyRateRwf,
  nights,
  guests,
  nonRefundable = false,
  priceBasis = "per_person",
}: {
  /** Per guest, per night; or, for a place let whole, per night. */
  nightlyRateRwf: number;
  nights: number;
  /** Billable guests (adults plus children). Infants are free and never counted. */
  guests: number;
  nonRefundable?: boolean;
  /** `per_unit`: a villa or apartment, priced for the whole place whatever the party. */
  priceBasis?: RoomPriceBasis | null;
}): QuotePreview | null {
  if (nights <= 0) return null;

  const amounts = computeBreakdown({ nightlyRateRwf, nights, nonRefundable, guests, priceBasis });
  const party = amounts.guests ?? 1;
  const nightWord = `${nights} night${nights === 1 ? "" : "s"}`;

  const lines: MoneyLine[] = buildMoneyLines(amounts, {
    accommodation:
      priceBasis === "per_unit"
        ? `${formatPrice(nightlyRateRwf)} × ${nightWord}`
        : `${formatPrice(nightlyRateRwf)} × ${party} guest${party === 1 ? "" : "s"} × ${nightWord}`,
    nonRefundableDiscount: "Non-refundable discount",
    serviceFee: "Guest service fee",
  });

  // What the guest pays for the room, after any discount, holds the tax.
  const tourismTaxRwf = tourismTaxIncludedRwf(amounts.accommodationRwf - amounts.nonRefundableDiscountRwf);
  return { ...amounts, lines, tourismTaxRwf };
}

/** The room's cancellation terms in one sentence, from the rules the refund is computed with. */
export function cancellationCopy(tier: CancellationTier | null, nonRefundable = false): string {
  // No tier on the room type means flexible: it is what the server applies when the guest cancels.
  return cancellationSummary(tier, nonRefundable);
}
