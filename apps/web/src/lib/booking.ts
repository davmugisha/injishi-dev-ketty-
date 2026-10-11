import { computeBreakdown, type MoneyBreakdown } from "@injishi/contracts";
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
}

/** Returns null when there are no nights to price. */
export function computeQuote({
  nightlyRateRwf,
  nights,
  guests,
  nonRefundable = false,
}: {
  /** Per guest, per night. */
  nightlyRateRwf: number;
  nights: number;
  /** Billable guests (adults plus children). Infants are free and never counted. */
  guests: number;
  nonRefundable?: boolean;
}): QuotePreview | null {
  if (nights <= 0) return null;

  const amounts = computeBreakdown({ nightlyRateRwf, nights, nonRefundable, guests });
  const party = amounts.guests ?? 1;

  const lines: MoneyLine[] = buildMoneyLines(amounts, {
    accommodation: `${formatPrice(nightlyRateRwf)} × ${party} guest${party === 1 ? "" : "s"} × ${nights} night${nights === 1 ? "" : "s"}`,
    nonRefundableDiscount: "Non-refundable discount",
    serviceFee: "Guest service fee",
  });

  return { ...amounts, lines };
}

const CANCELLATION_COPY = {
  flexible: "Free cancellation up to 24 hours before check-in.",
  moderate: "Free cancellation up to 5 days before check-in, then 50% refundable.",
  limited: "50% refund up to 7 days before check-in; non-refundable after.",
  firm: "50% refund up to 30 days before check-in; non-refundable after.",
  strict_extended_stay: "Extended-stay terms: 50% refund up to 30 days before check-in.",
} as const;

export function cancellationCopy(
  tier: keyof typeof CANCELLATION_COPY | null,
  nonRefundable = false,
): string {
  if (nonRefundable) {
    return "Non-refundable — full forfeit on cancellation, regardless of tier.";
  }
  if (!tier) return "Cancellation policy is shown before payment.";
  return CANCELLATION_COPY[tier];
}
