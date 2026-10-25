"use server";

/**
 * The broker's writes (2026-10-25): reveal a landlord, start a placement, pay for a plan (each press mints
 * its own Idempotency-Key and the payment is polled until the phone answers), change or end a plan, and
 * move the home district. Every call is in the person's broker workspace; the API answers 404 for a home
 * outside the plan.
 */
import {
  type BrokerHome,
  BrokerHomeDistrictRequest,
  type BrokerPlacement,
  BrokerPlanChangeRequest,
  BrokerPlanCheckoutRequest,
  type BrokerPlanOverview,
  type BrokerPlanPayment,
  type BrokerReveal,
  StartPlacementRequest,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { type BrokerScope, brokerScope } from "@/server/broker/client";
import { type ActionResult, idempotencyKey, invalid, parse, refusal, UUID } from "@/server/rentals/action-kit";

const NOT_HERE = "That home is not on offer to you any more.";

async function runBroker<T>(write: (s: BrokerScope) => Promise<T>, notFound = NOT_HERE): Promise<ActionResult<T>> {
  const s = await brokerScope();
  if (!s) return { ok: false, error: "There is no broker registration here." };
  try {
    return { ok: true, value: await write(s) };
  } catch (error) {
    return refusal<T>(error, notFound);
  }
}

const ws = (s: BrokerScope) => ({ workspaceId: s.workspace.workspaceId });

function changed<T>(result: ActionResult<T>): ActionResult<T> {
  if (result.ok) revalidatePath("/broker", "layout");
  return result;
}

/** One home in full (all its photos), for the panel. */
export async function loadHome(unitId: string): Promise<ActionResult<BrokerHome>> {
  if (!UUID.test(unitId)) return { ok: false, error: NOT_HERE };
  return runBroker((s) => s.api.get<BrokerHome>(`/api/v1/ops/broker/homes/${unitId}`, ws(s)));
}

export async function revealLandlord(unitId: string): Promise<ActionResult<BrokerReveal>> {
  if (!UUID.test(unitId)) return { ok: false, error: NOT_HERE };
  return changed(
    await runBroker((s) => s.api.post<BrokerReveal>(`/api/v1/ops/broker/homes/${unitId}/reveal`, {}, ws(s))),
  );
}

export async function startPlacement(unitId: string, input: unknown): Promise<ActionResult<BrokerPlacement>> {
  if (!UUID.test(unitId)) return { ok: false, error: NOT_HERE };
  const parsed = parse(StartPlacementRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runBroker((s) =>
      s.api.post<BrokerPlacement>(`/api/v1/ops/broker/homes/${unitId}/placements`, parsed.data, ws(s)),
    ),
  );
}

export async function checkoutPlan(input: unknown): Promise<ActionResult<BrokerPlanPayment>> {
  const parsed = parse(BrokerPlanCheckoutRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runBroker((s) =>
      s.api.post<BrokerPlanPayment>("/api/v1/ops/broker/plan/checkout", parsed.data, {
        ...ws(s),
        idempotencyKey: idempotencyKey(),
      }),
    ),
  );
}

export async function pollPlanPayment(id: string): Promise<ActionResult<BrokerPlanPayment>> {
  if (!UUID.test(id)) return { ok: false, error: "That payment was not found." };
  const result = await runBroker(
    (s) => s.api.get<BrokerPlanPayment>(`/api/v1/ops/broker/plan/payments/${id}`, ws(s)),
    "That payment was not found.",
  );
  if (result.ok && result.value.status !== "pending") revalidatePath("/broker", "layout");
  return result;
}

export async function changePlan(input: unknown): Promise<ActionResult<BrokerPlanOverview>> {
  const parsed = parse(BrokerPlanChangeRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runBroker((s) => s.api.post<BrokerPlanOverview>("/api/v1/ops/broker/plan/change", parsed.data, ws(s))),
  );
}

export async function cancelPlan(): Promise<ActionResult<BrokerPlanOverview>> {
  return changed(await runBroker((s) => s.api.post<BrokerPlanOverview>("/api/v1/ops/broker/plan/cancel", {}, ws(s))));
}

export async function setHomeDistrict(districtId: number): Promise<ActionResult<BrokerPlanOverview>> {
  const parsed = parse(BrokerHomeDistrictRequest, { districtId });
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runBroker((s) => s.api.put<BrokerPlanOverview>("/api/v1/ops/broker/home-district", parsed.data, ws(s))),
  );
}
