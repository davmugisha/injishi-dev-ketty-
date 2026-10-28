"use server";

/**
 * The broker on a lease, from the landlord's side (2026-10-25): finding the broker who brought the
 * tenant, marking the recorded fee paid or owed (the money moves outside Injishi), and rating the broker
 * once the tenancy has started. Each runs in the business this request acts in.
 */
import {
  BrokerFeeStatusRequest,
  type BrokerPick,
  type BrokerPickList,
  BrokerRatingRequest,
  type LeaseBrokerView,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { type ActionResult, invalid, parse, runLandlord, UUID, ws } from "@/server/rentals/action-kit";

const NO_LEASE = "That lease was not found.";

async function changed<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Active brokers by name or phone; the ones with an open placement on your units first. */
export async function searchBrokers(q: string): Promise<ActionResult<BrokerPick[]>> {
  const query = q.trim().slice(0, 80);
  return runLandlord(async (s) => {
    const list = await s.api.get<BrokerPickList>("/api/v1/ops/rentals/brokers", {
      ...ws(s),
      query: { q: query || undefined },
    });
    return list.brokers;
  });
}

export async function setBrokerFeePaid(leaseId: string, paid: boolean): Promise<ActionResult<LeaseBrokerView>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const parsed = parse(BrokerFeeStatusRequest, { paid });
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord(
      (s) => s.api.put<LeaseBrokerView>(`/api/v1/ops/leases/${leaseId}/broker-fee`, parsed.data, ws(s)),
      NO_LEASE,
    ),
  );
}

export async function rateBroker(leaseId: string, input: unknown): Promise<ActionResult<LeaseBrokerView>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const parsed = parse(BrokerRatingRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord(
      (s) => s.api.post<LeaseBrokerView>(`/api/v1/ops/leases/${leaseId}/broker-rating`, parsed.data, ws(s)),
      NO_LEASE,
    ),
  );
}
