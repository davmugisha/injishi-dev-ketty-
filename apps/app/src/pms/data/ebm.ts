"use client";

/**
 * The client for `/api/v1/ops/ebm/*` — the business's RRA EBM account
 * (ADR-041).
 *
 * The same rules as `ops.ts`, whose `read` it uses: a read throws on failure
 * and is parsed against its contract; a command returns the record as it now
 * stands and the cache is refreshed from that answer. Every route here needs
 * `ebm.manage`, reads included, so a screen only enables these queries for a
 * caller who holds it — a receptionist's session never asks.
 *
 * Nothing here holds a token. The API keeps the taxpayer's credential; this
 * file only ever sees whether one exists and whose TIN it names.
 */

import {
  EbmCatalogItemList,
  EbmConnection,
  EbmCustomerOptionList,
  type EbmConnectStart,
  type EbmItemMappingInput,
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
import { queryKeys } from "./queries";

/** The connection, or `not_connected`. `enabled` is the caller's `ebm.manage`. */
export function useEbmConnection(
  workspaceId: string | null,
  enabled: boolean,
): UseQueryResult<EbmConnection> {
  return useQuery({
    queryKey: queryKeys.ebmConnection(workspaceId),
    queryFn: () => read("/ops/ebm/connection", workspaceId as string, EbmConnection),
    enabled: enabled && workspaceId !== null,
  });
}

/**
 * The taxpayer's catalog, for the item pickers. Only asked for once connected:
 * it is read with the taxpayer's credential, and there is none before that.
 */
export function useEbmItems(
  workspaceId: string | null,
  enabled: boolean,
): UseQueryResult<EbmCatalogItemList> {
  return useQuery({
    queryKey: queryKeys.ebmItems(workspaceId),
    queryFn: () => read("/ops/ebm/items", workspaceId as string, EbmCatalogItemList),
    enabled: enabled && workspaceId !== null,
  });
}

export function useEbmCustomers(
  workspaceId: string | null,
  enabled: boolean,
): UseQueryResult<EbmCustomerOptionList> {
  return useQuery({
    queryKey: queryKeys.ebmCustomers(workspaceId),
    queryFn: () => read("/ops/ebm/customers", workspaceId as string, EbmCustomerOptionList),
    enabled: enabled && workspaceId !== null,
  });
}

/**
 * Start the consent. Answers where to send the browser; the SCREEN performs the
 * navigation, because leaving the app is a step the person should see happen,
 * not a side effect buried in a data hook.
 */
export function useStartEbmConnect(
  workspaceId: string | null,
): UseMutationResult<EbmConnectStart, Error, void> {
  return useMutation({
    mutationFn: () =>
      command<EbmConnectStart>("/ops/ebm/connect", { workspaceId: workspaceId as string }),
  });
}

/** Save which catalog items a stay is sold as. The server checks each one. */
export function useSaveEbmMapping(
  workspaceId: string | null,
): UseMutationResult<EbmConnection, Error, EbmItemMappingInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      command<EbmConnection>("/ops/ebm/mapping", {
        workspaceId: workspaceId as string,
        body,
        method: "PUT",
      }),
    onSuccess: (connection) => {
      client.setQueryData(queryKeys.ebmConnection(workspaceId), connection);
    },
  });
}

/** Stop certifying through this account. Sales then wait, held, not dropped. */
export function useDisconnectEbm(
  workspaceId: string | null,
): UseMutationResult<EbmConnection, Error, void> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      command<EbmConnection>("/ops/ebm/connection", {
        workspaceId: workspaceId as string,
        method: "DELETE",
      }),
    onSuccess: (connection) => {
      // The catalog and customers were read under the old authorisation.
      void client.removeQueries({ queryKey: queryKeys.ebmItems(workspaceId) });
      void client.removeQueries({ queryKey: queryKeys.ebmCustomers(workspaceId) });
      client.setQueryData(queryKeys.ebmConnection(workspaceId), connection);
    },
  });
}
