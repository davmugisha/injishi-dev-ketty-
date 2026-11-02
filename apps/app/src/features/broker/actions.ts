"use server";

/**
 * The broker's writes (2026-10-25): reveal a landlord, start a placement, pay for a plan (each press mints
 * its own Idempotency-Key and the payment is polled until the phone answers), change or end a plan, and
 * move the home district. Every call is in the person's broker workspace; the API answers 404 for a home
 * outside the plan.
 */
import {
  type BrokerBookingGroup,
  type BrokerDeal,
  type BrokerHome,
  BrokerHomeDistrictRequest,
  type BrokerPayoutAccount,
  type BrokerPlacement,
  BrokerPlanChangeRequest,
  BrokerPlanCheckoutRequest,
  type BrokerPlanOverview,
  type BrokerPlanPayment,
  type BrokerReveal,
  type BrokerRoomOffer,
  BrokerRoomsQuery,
  CreateBrokerBookingRequest,
  EndBrokerDealRequest,
  ProposeBrokerDealRequest,
  SetBrokerPayoutAccountRequest,
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

// --- Hotel deals (0124) ---------------------------------------------------------------------------

const NO_HOTEL = "That hotel is not open to you for a deal any more.";
const NO_DEAL = "That deal is not there any more.";

/** Propose commission terms to a hotel inside the plan's area. */
export async function proposeDeal(orgId: string, input: unknown): Promise<ActionResult<BrokerDeal>> {
  if (!UUID.test(orgId)) return { ok: false, error: NO_HOTEL };
  const parsed = parse(ProposeBrokerDealRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runBroker(
      (s) => s.api.post<BrokerDeal>(`/api/v1/ops/broker/hotels/${orgId}/deals`, parsed.data, ws(s)),
      NO_HOTEL,
    ),
  );
}

/** Take back a proposal the hotel has not answered, or end a running deal. */
export async function closeDeal(id: string, move: "withdraw" | "end", note: string): Promise<ActionResult<BrokerDeal>> {
  if (!UUID.test(id)) return { ok: false, error: NO_DEAL };
  const parsed = parse(EndBrokerDealRequest, { note: note.trim() || null });
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runBroker(
      (s) => s.api.post<BrokerDeal>(`/api/v1/ops/broker/deals/${id}/${move}`, parsed.data, ws(s)),
      NO_DEAL,
    ),
  );
}

// --- Bookings under a running deal (0125) ---------------------------------------------------------

/** The hotel's rooms for these dates, with their rates and how many are free. */
export async function loadRooms(
  orgId: string,
  checkIn: string,
  checkOut: string,
): Promise<ActionResult<BrokerRoomOffer>> {
  if (!UUID.test(orgId)) return { ok: false, error: NO_HOTEL };
  const parsed = parse(BrokerRoomsQuery, { checkIn, checkOut });
  if (!parsed.ok) return invalid(parsed.error);
  return runBroker(
    (s) =>
      s.api.get<BrokerRoomOffer>(`/api/v1/ops/broker/hotels/${orgId}/rooms`, {
        ...ws(s),
        query: { checkIn: parsed.data.checkIn, checkOut: parsed.data.checkOut },
      }),
    "You have no running deal with that hotel any more.",
  );
}

/** Book the rooms: written at once when paid at the hotel; when paid by MoMo, once the phone approves. */
export async function bookRooms(orgId: string, input: unknown): Promise<ActionResult<BrokerBookingGroup>> {
  if (!UUID.test(orgId)) return { ok: false, error: NO_HOTEL };
  const parsed = parse(CreateBrokerBookingRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runBroker(
      (s) => s.api.post<BrokerBookingGroup>(`/api/v1/ops/broker/hotels/${orgId}/bookings`, parsed.data, ws(s)),
      "You have no running deal with that hotel any more.",
    ),
  );
}

/** Where a group's MoMo payment got to. */
export async function pollBooking(id: string): Promise<ActionResult<BrokerBookingGroup>> {
  if (!UUID.test(id)) return { ok: false, error: "That booking is not there." };
  return runBroker(
    (s) => s.api.get<BrokerBookingGroup>(`/api/v1/ops/broker/bookings/${id}`, ws(s)),
    "That booking is not there.",
  );
}

/** Where the broker's share of hotel commissions is paid; a share that waited for a number goes out at once. */
export async function setPayoutNumber(input: unknown): Promise<ActionResult<BrokerPayoutAccount>> {
  const parsed = parse(SetBrokerPayoutAccountRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runBroker((s) => s.api.put<BrokerPayoutAccount>("/api/v1/ops/broker/payout-account", parsed.data, ws(s))),
  );
}
