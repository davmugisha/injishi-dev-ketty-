import {
  CreateSupportTicketResult,
  type CreateSupportTicketInput,
} from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The client for `POST /api/v1/support/tickets`.
 *
 * The form used to post to `/api/support`, a same-origin path with no handler
 * in this app and no rewrite to the API, so every submission 404ed. This goes
 * through `apiFetch` for the reasons `lib/api.ts` records: one definition of
 * where the API is, a ceiling on the round trip so the button cannot spin
 * forever, and the session cookie sent along so a signed-in guest's ticket
 * says who sent it. The route works without that cookie too.
 *
 * The response is checked against the contract before it is called a success.
 * A 2xx carrying something other than a ticket id is not proof the ticket
 * exists, and telling someone "we will reply" on the strength of it is the
 * failure this form must never produce.
 */
export async function submitSupportTicket(
  input: CreateSupportTicketInput,
): Promise<ApiResult<CreateSupportTicketResult>> {
  const result = await apiFetch<unknown>("/api/v1/support/tickets", {
    method: "POST",
    body: input,
  });
  if (result.status !== "ok") return result;

  const parsed = CreateSupportTicketResult.safeParse(result.data);
  if (!parsed.success) return { status: "failed" };

  return { status: "ok", data: parsed.data };
}
