/**
 * Messages between a landlord and a tenant (P3.4): the first read of each screen, on the server. The
 * open conversation then reads and writes from the browser through `/api/messages/*` (same origin), and
 * hears about new lines on the live socket. Server side only.
 */
import type { LeaseThreadList, LeaseThreadView, MessageUnread } from "@injishi/contracts";
import { cache } from "react";
import { currentApi } from "@/lib/session";
import { ApiError } from "./api";
import { landlordScope, NoRentalsBusinessError } from "./rentals/client";

async function asLandlord<T>(path: string, query?: Record<string, string | undefined>): Promise<T> {
  const scope = await landlordScope();
  if (!scope) throw new NoRentalsBusinessError();
  return scope.api.get<T>(path, { workspaceId: scope.workspace.workspaceId, query });
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
    if (error instanceof NoRentalsBusinessError) return null;
    throw error;
  }
}
