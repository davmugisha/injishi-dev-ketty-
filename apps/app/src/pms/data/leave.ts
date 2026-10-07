"use client";

/**
 * The client for leave in full (ADR-058, 058-leave): the dashboard, everybody's
 * balances, requests for extra and compensatory days, restricted periods, the
 * leave types and the national defaults compared with them.
 *
 * The leave queue, a person's balances, filing and deciding a request stay in
 * `people.ts`, where slice 1 put them. The same rules as there: a read throws,
 * every response is parsed against its contract, and each read asks
 * `useMayRead` with the permissions its route declares (`OPS_READ`), so nobody
 * fires a read they would be refused. Keys follow `["ops", noun, workspaceId, …]`.
 */

import {
  LeaveAllocationPage,
  LeaveAllocationRequest,
  LeaveBalancePage,
  LeaveDashboard,
  LeaveDefaultsDiff,
  LeaveType,
  LeaveTypeList,
  RestrictedLeavePeriod,
  RestrictedLeavePeriodList,
  type ApplyLeaveDefaultsRequest,
  type CreateLeaveAllocationRequest,
  type CreateLeaveTypeRequest,
  type CreateRestrictedLeavePeriodRequest,
  type ListPage,
  type ListQuery,
  type UpdateLeaveTypeRequest,
  type UpdateRestrictedLeavePeriodRequest,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { command } from "./api";
import { useListPage } from "./lists";
import { OPS_READ, read, useMayRead } from "./ops";

export const leaveKeys = {
  dashboard: (ws: string | null) => ["ops", "leave-dashboard", ws] as const,
  types: (ws: string | null) => ["ops", "leave-types", ws] as const,
  defaults: (ws: string | null) => ["ops", "leave-defaults", ws] as const,
  periods: (ws: string | null) => ["ops", "restricted-periods", ws] as const,
};

/** Every leave read refetches together: a decision moves the queue, the balances and the dashboard at once. */
const LEAVE_NOUNS = ["leave-requests", "leave-balances", "leave-balance-list", "leave-allocations", "leave-dashboard"];

function refresh(client: QueryClient, ...nouns: string[]): void {
  for (const noun of nouns) void client.invalidateQueries({ queryKey: ["ops", noun] });
}

// --- The dashboard and everybody's balances (AC-LV13) ------------------------------------

export function useLeaveDashboard(ws: string | null): UseQueryResult<LeaveDashboard> {
  const mayRead = useMayRead(OPS_READ.leaveViews);
  return useQuery({
    queryKey: leaveKeys.dashboard(ws),
    queryFn: () => read("/ops/leave/dashboard", ws as string, LeaveDashboard),
    enabled: ws !== null && mayRead,
  });
}

/** One page of people, a balance per type each: the sum of the ledger. */
export function useLeaveBalancePage(ws: string | null, query: ListQuery): UseQueryResult<ListPage<LeaveBalancePage["items"][number]>> {
  return useListPage(ws, "leave-balance-list", "/ops/leave/balances", query, LeaveBalancePage, OPS_READ.leaveViews);
}

// --- Extra and compensatory days (AC-LV8) --------------------------------------------------

export function useLeaveAllocationPage(
  ws: string | null,
  query: ListQuery,
): UseQueryResult<ListPage<LeaveAllocationRequest>> {
  return useListPage(ws, "leave-allocations", "/ops/leave/allocation-requests", query, LeaveAllocationPage, OPS_READ.leaveAllocations);
}

export function useRequestAllocation(
  ws: string | null,
): UseMutationResult<LeaveAllocationRequest, Error, CreateLeaveAllocationRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      LeaveAllocationRequest.parse(await command<unknown>("/ops/leave/allocation-requests", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, ...LEAVE_NOUNS),
  });
}

export function useDecideAllocation(
  ws: string | null,
): UseMutationResult<LeaveAllocationRequest, Error, { id: string; decision: "approve" | "reject"; note?: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision, note }) =>
      LeaveAllocationRequest.parse(
        await command<unknown>(`/ops/leave/allocation-requests/${id}/${decision}`, {
          workspaceId: ws as string,
          body: { note: note ?? null },
        }),
      ),
    // A compensated day's overtime moves too.
    onSuccess: () => refresh(client, ...LEAVE_NOUNS, "attendance"),
  });
}

// --- Leave types and the national defaults (AC-LV1, AC-LV12) --------------------------------

/** Every type, archived ones too. Any HR permission reads them: every screen draws with a type's name. */
export function useLeaveTypes(ws: string | null): UseQueryResult<LeaveType[]> {
  const mayRead = useMayRead(OPS_READ.leaveTypes);
  return useQuery({
    queryKey: leaveKeys.types(ws),
    queryFn: async () => (await read("/ops/leave/types", ws as string, LeaveTypeList)).types,
    enabled: ws !== null && mayRead,
  });
}

export function useCreateLeaveType(ws: string | null): UseMutationResult<LeaveType, Error, CreateLeaveTypeRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) => LeaveType.parse(await command<unknown>("/ops/leave/types", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "leave-types", "leave-defaults", ...LEAVE_NOUNS),
  });
}

export function useUpdateLeaveType(
  ws: string | null,
): UseMutationResult<LeaveType, Error, { id: string; body: UpdateLeaveTypeRequest }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      LeaveType.parse(await command<unknown>(`/ops/leave/types/${id}`, { workspaceId: ws as string, body, method: "PATCH" })),
    onSuccess: () => refresh(client, "leave-types", "leave-defaults", ...LEAVE_NOUNS),
  });
}

/** What the national row in force says that this business's types do not. `people.manage` only. */
export function useLeaveDefaultsDiff(ws: string | null, enabled: boolean): UseQueryResult<LeaveDefaultsDiff> {
  const mayRead = useMayRead(OPS_READ.leaveDefaults);
  return useQuery({
    queryKey: leaveKeys.defaults(ws),
    queryFn: () => read("/ops/leave/types/defaults", ws as string, LeaveDefaultsDiff),
    enabled: ws !== null && mayRead && enabled,
  });
}

export function useApplyLeaveDefaults(ws: string | null): UseMutationResult<LeaveType[], Error, ApplyLeaveDefaultsRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) =>
      (LeaveTypeList.parse(await command<unknown>("/ops/leave/types/defaults/apply", { workspaceId: ws as string, body }))).types,
    onSuccess: () => refresh(client, "leave-types", "leave-defaults", ...LEAVE_NOUNS),
  });
}

// --- Restricted periods (AC-LV9) -----------------------------------------------------------

export function useRestrictedPeriods(ws: string | null): UseQueryResult<RestrictedLeavePeriod[]> {
  const mayRead = useMayRead(OPS_READ.restrictedPeriods);
  return useQuery({
    queryKey: leaveKeys.periods(ws),
    queryFn: async () => (await read("/ops/leave/restricted-periods", ws as string, RestrictedLeavePeriodList)).periods,
    enabled: ws !== null && mayRead,
  });
}

export function useSaveRestrictedPeriod(
  ws: string | null,
): UseMutationResult<
  RestrictedLeavePeriod,
  Error,
  { id: null; body: CreateRestrictedLeavePeriodRequest } | { id: string; body: UpdateRestrictedLeavePeriodRequest }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      RestrictedLeavePeriod.parse(
        await command<unknown>(id ? `/ops/leave/restricted-periods/${id}` : "/ops/leave/restricted-periods", {
          workspaceId: ws as string,
          body,
          method: id ? "PATCH" : "POST",
        }),
      ),
    onSuccess: () => refresh(client, "restricted-periods"),
  });
}

export function useRemoveRestrictedPeriod(ws: string | null): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await command<unknown>(`/ops/leave/restricted-periods/${id}`, { workspaceId: ws as string, method: "DELETE" });
    },
    onSuccess: () => refresh(client, "restricted-periods"),
  });
}
