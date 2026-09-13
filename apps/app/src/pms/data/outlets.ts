"use client";

/**
 * The client for `/api/v1/ops/outlets` and `/api/v1/ops/outlet-parties`
 * (ADR-050 slice 4, task 21).
 *
 * The same four rules as `ops.ts`: a read throws so a screen can tell "no
 * outlets" from "no answer", every response is parsed against its contract, a
 * command's answer is written into the cache before the refetch lands, and
 * nothing here decides a permission.
 *
 * **The query keys live in this file**, not in `queries.ts`, because this leaf
 * owns only this file. They follow that file's shape exactly — `["ops", noun,
 * workspaceId]` — so a later move into `queryKeys` is a cut and paste, and a
 * 403 anywhere still invalidates them through the query client's own watcher.
 *
 * **The parties read is permissioned** (`outlet.manage`). A receptionist gets
 * a 403 from it, and a 403 tells the query client our capability picture is
 * stale, so asking would refetch `me.workspaces` for nothing on every visit.
 * `useOutletParties` therefore takes an `enabled` flag and the screen passes
 * `can("outlet.manage")`.
 */

import {
  type CreateOutletRequest,
  OperatorAmenityList,
  OperatorOutlet,
  OperatorOutletList,
  OutletPartyList,
  type UpdateOutletRequest,
} from "@injishi/contracts";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { command } from "./api";
import { read } from "./ops";
import { queryKeys } from "./queries";

export const outletKeys = {
  outlets: (workspaceId: string | null) => ["ops", "outlets", workspaceId] as const,
  parties: (workspaceId: string | null) => ["ops", "outlet-parties", workspaceId] as const,
};

/** Every outlet the workspace runs, archived ones included, plus the relationship policy. */
export function useOutlets(workspaceId: string | null): UseQueryResult<OperatorOutletList> {
  return useQuery({
    queryKey: outletKeys.outlets(workspaceId),
    queryFn: () => read("/ops/outlets", workspaceId as string, OperatorOutletList),
    enabled: workspaceId !== null,
  });
}

/**
 * The parties this business has on record, its own among them.
 *
 * Only for someone holding `outlet.manage`; see the file header for why a
 * refused read is not merely wasted here.
 */
export function useOutletParties(
  workspaceId: string | null,
  enabled: boolean,
): UseQueryResult<OutletPartyList> {
  return useQuery({
    queryKey: outletKeys.parties(workspaceId),
    queryFn: () => read("/ops/outlet-parties", workspaceId as string, OutletPartyList),
    enabled: workspaceId !== null && enabled,
  });
}

/**
 * Amenity labels for every property an outlet stands at.
 *
 * One read per property, on the same key `useAmenities` in `ops.ts` uses, so
 * the form's amenity picker and the list's labels share a single cache entry
 * rather than asking twice. The read is open to any workspace member.
 */
export function useAmenityLabels(
  workspaceId: string | null,
  propertyIds: readonly string[],
): { labelFor: (propertyId: string | null, code: string) => string } {
  const results = useQueries({
    queries: propertyIds.map((propertyId) => ({
      queryKey: queryKeys.amenities(workspaceId, propertyId),
      queryFn: () =>
        read(
          `/ops/amenities?propertyId=${encodeURIComponent(propertyId)}`,
          workspaceId as string,
          OperatorAmenityList,
        ),
      enabled: workspaceId !== null,
    })),
  });
  const labels = new Map<string, string>();
  results.forEach((result, i) => {
    for (const amenity of result.data?.amenities ?? []) {
      labels.set(`${propertyIds[i]}:${amenity.code}`, amenity.label);
    }
  });
  return {
    // Fall back to the code, readable enough, while the read is in flight.
    labelFor: (propertyId, code) => labels.get(`${propertyId ?? ""}:${code}`) ?? code,
  };
}

/** Write the server's answer for one outlet into the list, then let the refetch confirm it. */
function settle(client: QueryClient, workspaceId: string | null, outlet: OperatorOutlet) {
  client.setQueryData<OperatorOutletList>(outletKeys.outlets(workspaceId), (list) => {
    if (!list) return list;
    const at = list.outlets.findIndex((o) => o.id === outlet.id);
    const outlets =
      at === -1
        ? [...list.outlets, outlet]
        : list.outlets.map((o) => (o.id === outlet.id ? outlet : o));
    return { ...list, outlets };
  });
  void client.invalidateQueries({ queryKey: outletKeys.outlets(workspaceId) });
}

/**
 * Open an outlet.
 *
 * The body is what the contract accepts and nothing more: `taxEntityOrgId` is
 * the server's to decide and is never sent.
 */
export function useCreateOutlet(
  workspaceId: string | null,
): UseMutationResult<OperatorOutlet, Error, CreateOutletRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      OperatorOutlet.parse(
        await command<unknown>("/ops/outlets", { workspaceId: workspaceId as string, body }),
      ),
    onSuccess: (outlet) => settle(client, workspaceId, outlet),
  });
}

/** Change an outlet. Only the fields that changed are sent. */
export function useUpdateOutlet(
  workspaceId: string | null,
): UseMutationResult<OperatorOutlet, Error, { outletId: string; patch: UpdateOutletRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ outletId, patch }) =>
      OperatorOutlet.parse(
        await command<unknown>(`/ops/outlets/${outletId}`, {
          workspaceId: workspaceId as string,
          body: patch,
          method: "PATCH",
        }),
      ),
    onSuccess: (outlet) => settle(client, workspaceId, outlet),
  });
}

/**
 * Archive an outlet. Never a delete: its orders and receipts name it.
 *
 * The server refuses while a tenancy is active (409) and says so; the screen
 * shows that sentence rather than a guess.
 */
export function useArchiveOutlet(
  workspaceId: string | null,
): UseMutationResult<OperatorOutlet, Error, { outletId: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ outletId }) =>
      OperatorOutlet.parse(
        await command<unknown>(`/ops/outlets/${outletId}/archive`, {
          workspaceId: workspaceId as string,
        }),
      ),
    onSuccess: (outlet) => settle(client, workspaceId, outlet),
  });
}
