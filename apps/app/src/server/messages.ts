/**
 * Messages between a landlord and a tenant (P3.4): the first read of each screen, on the server. The
 * open conversation then reads and writes from the browser through `/api/messages/*` (same origin), and
 * hears about new lines on the live socket. Server side only.
 */
import type {
  LeaseThreadList,
  LeaseThreadView,
  MessageUnread,
  PlacementThreadList,
  PlacementThreadView,
} from "@injishi/contracts";
import { cache } from "react";
import { currentApi } from "@/lib/session";
import { ApiError } from "./api";
import { brokerScope, NotABrokerError } from "./broker/client";
import { landlordScope, NoRentalsBusinessError } from "./rentals/client";

async function asLandlord<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const scope = await landlordScope();
  if (!scope) throw new NoRentalsBusinessError();
  return scope.api.get<T>(path, { workspaceId: scope.workspace.workspaceId, query });
}

async function asBroker<T>(path: string): Promise<T> {
  const scope = await brokerScope();
  if (!scope) throw new NotABrokerError();
  return scope.api.get<T>(path, { workspaceId: scope.workspace.workspaceId });
}

async function asPerson<T>(path: string): Promise<T> {
  const api = await currentApi();
  return api.get<T>(path);
}

export const landlordThreads = cache((q?: string) =>
  asLandlord<LeaseThreadList>("/api/v1/ops/rentals/messages", { q: q || undefined }),
);
export const landlordThread = cache((leaseId: string) =>
  asLandlord<LeaseThreadView>(`/api/v1/ops/rentals/messages/${leaseId}`),
);
export const landlordUnread = cache(() => asLandlord<MessageUnread>("/api/v1/ops/rentals/messages/unread"));

/** The landlord's conversations with brokers, one per placement (2026-10-26). Opening one makes it. */
export const landlordPlacementThreads = cache(() =>
  asLandlord<PlacementThreadList>("/api/v1/ops/rentals/placement-messages"),
);
export const landlordPlacementThread = cache((placementId: string) =>
  asLandlord<PlacementThreadView>(`/api/v1/ops/rentals/placement-messages/${placementId}`),
);

/** The broker's conversations with landlords. */
export const brokerThreads = cache(() => asBroker<PlacementThreadList>("/api/v1/ops/broker/messages"));
export const brokerThread = cache((placementId: string) =>
  asBroker<PlacementThreadView>(`/api/v1/ops/broker/messages/${placementId}`),
);
export const brokerUnread = cache(() => asBroker<MessageUnread>("/api/v1/ops/broker/messages/unread"));

export const tenantThread = cache((leaseId: string) =>
  asPerson<LeaseThreadView>(`/api/v1/me/tenancies/${leaseId}/messages`),
);
export const tenantUnread = cache(() => asPerson<MessageUnread>("/api/v1/me/tenancies/messages/unread"));

/** A count for the sidebar, or null when the API can't give one (the item then shows no count). */
export async function quietUnread(read: Promise<MessageUnread>): Promise<MessageUnread | null> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof ApiError || (error instanceof Error && error.name === "ApiUnreachableError")) return null;
    if (error instanceof NoRentalsBusinessError || error instanceof NotABrokerError) return null;
    throw error;
  }
}
