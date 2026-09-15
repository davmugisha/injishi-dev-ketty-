import {
  BookingCancellationResult,
  CancellationQuote,
} from "@injishi/contracts";
import { apiFetchParsed, apiResultMessage, type ApiResult } from "@/lib/api";

/**
 * The guest's side of cancelling a stay (F-B11, ADR-051).
 *
 * Two calls, always in this order: the QUOTE, which moves nothing and says what
 * cancelling would refund, then the CANCEL. The API computes both with the same
 * `cancellationRefund` over the values locked on the booking, so the number the
 * guest confirms is the number refunded. Nothing here computes a refund; it
 * prints the server's figures and the server's `rule` sentence as they come.
 *
 * Both answers are parsed against the contract schema, like `data/trips.ts`: a
 * body that does not match is `failed`, never a half-drawn refund.
 */

function referencePath(reference: string): string {
  return `/api/v1/bookings/${encodeURIComponent(reference)}`;
}

/** `GET /api/v1/bookings/:reference/cancellation`. Moves no money. */
export function fetchCancellationQuote(
  reference: string,
): Promise<ApiResult<CancellationQuote>> {
  return apiFetchParsed(CancellationQuote, `${referencePath(reference)}/cancellation`);
}

/** `POST /api/v1/bookings/:reference/cancel`. Refunds on the tier the booking locked. */
export function cancelBooking(
  reference: string,
): Promise<ApiResult<BookingCancellationResult>> {
  return apiFetchParsed(BookingCancellationResult, `${referencePath(reference)}/cancel`, {
    method: "POST",
  });
}

/**
 * The sentence for a refusal from either call, and whether anything changed.
 *
 * The controller can answer:
 *
 * - **404** for a reference that is not this guest's (or does not exist; the
 *   API deliberately does not say which).
 * - **409** with the service's own reason: already cancelled, declined, checked
 *   in, stay ended, payment already settled, or changed a moment ago. Those are
 *   written for a person and are shown as they come.
 * - **503** when the payment service did not confirm the refund. The booking is
 *   unchanged, and the API's sentence says so.
 * - **429** from the per person ceiling on money routes.
 *
 * Everything else falls through to `apiResultMessage`, which owns the
 * signed-out and unreachable wording.
 */
export function cancellationProblem(
  result: ApiResult<unknown>,
  call: "quote" | "cancel",
): string {
  if (result.status === "refused" && result.httpStatus === 404) {
    return "We couldn't find this booking on your account, so nothing was cancelled.";
  }
  if (result.status === "failed" && call === "cancel") {
    // A timeout on the POST may have landed. Say so rather than promise nothing changed.
    return "We couldn't get an answer from Injishi. Reload your trips to see whether the booking was cancelled before trying again.";
  }
  return apiResultMessage(result);
}

/** "100% refunded", "Nothing refunded" — the percentage as a guest reads it. */
export function refundHeadline(quote: Pick<CancellationQuote, "percent">): string {
  if (quote.percent === 0) return "Nothing refunded";
  if (quote.percent === 100) return "Full refund";
  return `${quote.percent}% refunded`;
}
