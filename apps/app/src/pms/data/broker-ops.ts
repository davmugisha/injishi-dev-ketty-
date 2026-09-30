"use client";

/**
 * The client for `/api/v1/ops/broker/*` (ADR-038 child 6).
 *
 * The broker workspace's Directory, Placements and Earnings read from here. It
 * replaced `data/broker.ts`, a fixture of six invented units and three invented
 * fees that every broker saw whatever their real record held.
 *
 * Same rules as `ops.ts`: a read throws and is parsed against its contract, and
 * a command patches nothing optimistically — it invalidates, and the screen
 * redraws from the server's answer. A reveal spends a credit, so a guessed
 * balance would be the worst place to be wrong.
 */

import {
  BrokerDirectory,
  BrokerEarnings,
  type BrokerPlacement,
  BrokerPlacementList,
  type BrokerReveal,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { command } from "./api";
import { read } from "./ops";

export const brokerKeys = {
  all: (workspaceId: string | null) => ["ops", "broker", workspaceId] as const,
  directory: (workspaceId: string | null) => ["ops", "broker", workspaceId, "directory"] as const,
  placements: (workspaceId: string | null) => ["ops", "broker", workspaceId, "placements"] as const,
  earnings: (workspaceId: string | null) => ["ops", "broker", workspaceId, "earnings"] as const,
};

export function useBrokerDirectory(workspaceId: string | null): UseQueryResult<BrokerDirectory> {
  return useQuery({
    queryKey: brokerKeys.directory(workspaceId),
    queryFn: () => read("/ops/broker/directory", workspaceId as string, BrokerDirectory),
    enabled: workspaceId !== null,
  });
}

export function useBrokerPlacements(workspaceId: string | null): UseQueryResult<BrokerPlacementList> {
  return useQuery({
    queryKey: brokerKeys.placements(workspaceId),
    queryFn: () => read("/ops/broker/placements", workspaceId as string, BrokerPlacementList),
    enabled: workspaceId !== null,
  });
}

export function useBrokerEarnings(workspaceId: string | null): UseQueryResult<BrokerEarnings> {
  return useQuery({
    queryKey: brokerKeys.earnings(workspaceId),
    queryFn: () => read("/ops/broker/earnings", workspaceId as string, BrokerEarnings),
    enabled: workspaceId !== null,
  });
}

/**
 * Spend a credit to see a landlord's contact.
 *
 * No idempotency key: the server is idempotent by LISTING, which is stronger.
 * A second press, a retry or next week's visit all return the reveal already
 * bought, with `charged: false`.
 */
export function useRevealContact(
  workspaceId: string | null,
): UseMutationResult<BrokerReveal, Error, { listingId: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId }) =>
      command<BrokerReveal>(`/ops/broker/directory/${listingId}/reveal`, {
        workspaceId: workspaceId as string,
      }),
    // The balance shows on Directory and Earnings, so both refetch.
    onSettled: () => void client.invalidateQueries({ queryKey: brokerKeys.all(workspaceId) }),
  });
}

export function useStartPlacement(
  workspaceId: string | null,
): UseMutationResult<BrokerPlacement, Error, { listingId: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ listingId }) =>
      command<BrokerPlacement>(`/ops/broker/directory/${listingId}/placements`, {
        workspaceId: workspaceId as string,
      }),
    onSettled: () => void client.invalidateQueries({ queryKey: brokerKeys.all(workspaceId) }),
  });
}
