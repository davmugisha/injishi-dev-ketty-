"use server";

/**
 * The hotel's answers to brokers (0124, 2026-11-02): accept or decline a proposal, end a running deal. Each
 * call is in the hotel's own business workspace; the API needs `payout.manage`, and a deal of another hotel
 * is not found.
 */
import { type BrokerDeal, DecideBrokerDealRequest, EndBrokerDealRequest } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import type { ApiClient } from "@/server/api";
import { type ActionResult, invalid, parse, refusal, UUID } from "@/server/rentals/action-kit";
import { hostScope } from "@/server/rentals/client";

const NO_DEAL = "That deal is not there any more.";

/** One write as the hotel, with the API's refusals in words. */
async function asHotel(
  workspaceId: string,
  write: (api: ApiClient) => Promise<BrokerDeal>,
): Promise<ActionResult<BrokerDeal>> {
  const scope = await hostScope(workspaceId);
  if (!scope) return { ok: false, error: "There is no hotel business here." };
  try {
    const value = await write(scope.api);
    revalidatePath(`/w/${workspaceId}/brokers`);
    return { ok: true, value };
  } catch (error) {
    return refusal<BrokerDeal>(error, NO_DEAL);
  }
}

export async function decideDeal(
  workspaceId: string,
  id: string,
  decision: "accept" | "decline",
  note: string,
): Promise<ActionResult<BrokerDeal>> {
  if (!UUID.test(workspaceId) || !UUID.test(id)) return { ok: false, error: NO_DEAL };
  const parsed = parse(DecideBrokerDealRequest, { decision, note: note.trim() || null });
  if (!parsed.ok) return invalid(parsed.error);
  return asHotel(workspaceId, (api) =>
    api.post<BrokerDeal>(`/api/v1/ops/broker-deals/${id}/decision`, parsed.data, { workspaceId }),
  );
}

export async function endHotelDeal(workspaceId: string, id: string, note: string): Promise<ActionResult<BrokerDeal>> {
  if (!UUID.test(workspaceId) || !UUID.test(id)) return { ok: false, error: NO_DEAL };
  const parsed = parse(EndBrokerDealRequest, { note: note.trim() || null });
  if (!parsed.ok) return invalid(parsed.error);
  return asHotel(workspaceId, (api) =>
    api.post<BrokerDeal>(`/api/v1/ops/broker-deals/${id}/end`, parsed.data, { workspaceId }),
  );
}
