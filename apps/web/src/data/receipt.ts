import { EbmReceipt } from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The client for `GET /api/v1/bookings/:reference/receipt` (C8, C9).
 *
 * It goes through `apiFetch` for the three reasons `data/bookings.ts` records
 * and does not repeat: one definition of where the API is, `credentials:
 * "include"` so the session cookie crosses from :3000 to :8000, and a ceiling
 * on the round trip so a receipt that will not load fails instead of spinning.
 *
 * THE RESPONSE IS VALIDATED, which `createBooking` does not do and this must.
 * A booking result feeds a sentence; a receipt feeds a document laid out clause
 * by clause, where a missing `sdc` block is not a blank line but a crash on
 * `sdc.qrData`, and a missing `taxLines` entry is a tax total that silently
 * disagrees with its parts. `EbmReceipt` is the schema BOTH sides already
 * import, so validating here costs one parse and cannot drift from the shape
 * the API builds against.
 *
 * A response that does not match the contract is reported as `failed` rather
 * than rendered halfway. Half a fiscal document is worse than none: a reader
 * cannot tell which half is missing.
 */

/**
 * Read the RRA EBM receipt for one booking.
 *
 * `reference` is the human-facing booking code (`BK-XXXX-XXXX`) rather than the
 * booking's uuid, because that is what the guest was shown on the confirmation
 * screen and what `checkout-outcome.tsx` puts in the link. It is encoded on the
 * way into the path: the code's alphabet is safe today, and a client that
 * assumes an encoding rule the server owns is a client that breaks the day the
 * server changes it.
 */
export async function fetchReceipt(
  reference: string,
): Promise<ApiResult<EbmReceipt>> {
  const result = await apiFetch<unknown>(
    `/api/v1/bookings/${encodeURIComponent(reference)}/receipt`,
  );
  if (result.status !== "ok") return result;

  const parsed = EbmReceipt.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };

  return { status: "ok", data: parsed.data };
}
