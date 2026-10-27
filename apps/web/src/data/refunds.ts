import {
  GuestRefund,
  GuestRefundList,
  type RefundPayeeRequest,
} from "@injishi/contracts";
import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The client for the guest's own refunds (073-gtbank-payments AC-12, AC-12a):
 * `GET /api/v1/me/refunds`, and the payee form's
 * `PUT /api/v1/me/refunds/:id/payee`.
 *
 * Both answers are validated against the contract: a refund rendered from a
 * shape nobody agreed to is worse than an honest "we couldn't load this".
 */
export async function fetchMyRefunds(): Promise<ApiResult<GuestRefundList>> {
  const result = await apiFetch<unknown>("/api/v1/me/refunds");
  if (result.status !== "ok") return result;
  const parsed = GuestRefundList.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * Give the bank the name and ID it needs to send one refund. The number is
 * sent once and never shown back: the answer carries only the refund's new
 * plain status.
 */
export async function supplyRefundPayee(
  refundId: string,
  body: RefundPayeeRequest,
): Promise<ApiResult<GuestRefund>> {
  const result = await apiFetch<unknown>(`/api/v1/me/refunds/${encodeURIComponent(refundId)}/payee`, {
    method: "PUT",
    body,
  });
  if (result.status !== "ok") return result;
  const parsed = GuestRefund.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}
