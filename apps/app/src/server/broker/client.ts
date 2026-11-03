/**
 * The broker's reads (2026-10-25): typed calls over the API client, in the person's broker workspace
 * (kind `broker`, one per person). Each is cached for the request. Server side only. A unit outside the
 * broker's plan, or one its landlord did not switch on, is not found (404), and reads back as null.
 */
import type {
  BrokerBookingGroup,
  BrokerBookingList,
  BrokerCommissionList,
  BrokerDealList,
  BrokerEarnings,
  BrokerHome,
  BrokerHomes,
  BrokerHomesQuery,
  BrokerHotels,
  BrokerPayoutAccount,
  BrokerPlacementList,
  BrokerPlanOverview,
  BrokerPlanPayment,
  BrokerReviews,
  BrokerSummary,
} from "@injishi/contracts";
import { cache } from "react";
import { currentAccount, currentApi } from "@/lib/session";
import { type ApiClient, ApiError } from "../api";
import { brokerWorkspace, type Workspace } from "../auth";

export interface BrokerScope {
  api: ApiClient;
  workspace: Workspace;
}

/** The broker workspace this request acts in, or null for someone who is not a broker. */
export const brokerScope = cache(async (): Promise<BrokerScope | null> => {
  const [account, api] = await Promise.all([currentAccount(), currentApi()]);
  if (!account) return null;
  const workspace = brokerWorkspace(account);
  return workspace ? { api, workspace } : null;
});

export class NotABrokerError extends Error {
  constructor() {
    super("There is no broker registration here.");
    this.name = "NotABrokerError";
  }
}

async function get<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const s = await brokerScope();
  if (!s) throw new NotABrokerError();
  return s.api.get<T>(path, { workspaceId: s.workspace.workspaceId, query });
}

/** A unit that is not there for this broker (404) comes back null; anything else throws. */
export async function orMissing<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError && error.notFound) return null;
    throw error;
  }
}

const q = (v: number | string | undefined): string | undefined => (v === undefined || v === "" ? undefined : String(v));

export const brokerSummary = cache(() => get<BrokerSummary>("/api/v1/ops/broker/summary"));
/** The hotels inside the plan's area, each with this broker's proposed or running deal (0125). */
export const brokerHotels = cache(() => get<BrokerHotels>("/api/v1/ops/broker/hotels"));
/** Every deal this broker has proposed, newest first, whatever became of it. */
export const brokerDeals = cache(() => get<BrokerDealList>("/api/v1/ops/broker/deals"));
/** What the broker's hotel stays earned, collected and paid (0128). */
export const brokerCommissions = cache(() => get<BrokerCommissionList>("/api/v1/ops/broker/commissions"));
/** The MoMo number the broker's share is paid to, or null before one is set. */
export const brokerPayoutAccount = cache(() => get<BrokerPayoutAccount | null>("/api/v1/ops/broker/payout-account"));
/** Every group of rooms this broker booked, newest first (0126). */
export const brokerBookings = cache(() => get<BrokerBookingList>("/api/v1/ops/broker/bookings"));
/** One group; while its MoMo prompt is out, reading it asks the provider where it got to. */
export const brokerBooking = cache((id: string) => get<BrokerBookingGroup>(`/api/v1/ops/broker/bookings/${id}`));
export const brokerHomes = cache((query: BrokerHomesQuery) =>
  get<BrokerHomes>("/api/v1/ops/broker/homes", {
    district: q(query.district),
    minRent: q(query.minRent),
    maxRent: q(query.maxRent),
    bedrooms: q(query.bedrooms),
    q: q(query.q),
    sort: q(query.sort),
  }),
);
export const brokerHome = cache((unitId: string) => get<BrokerHome>(`/api/v1/ops/broker/homes/${unitId}`));
export const brokerPlacements = cache(() => get<BrokerPlacementList>("/api/v1/ops/broker/placements"));
export const brokerEarnings = cache(() => get<BrokerEarnings>("/api/v1/ops/broker/earnings"));
export const brokerReviews = cache(() => get<BrokerReviews>("/api/v1/ops/broker/reviews"));
export const brokerPlan = cache(() => get<BrokerPlanOverview>("/api/v1/ops/broker/plan"));
export const brokerPlanPayment = cache((id: string) =>
  get<BrokerPlanPayment>(`/api/v1/ops/broker/plan/payments/${id}`),
);
