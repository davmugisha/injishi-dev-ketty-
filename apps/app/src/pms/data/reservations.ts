"use client";

/**
 * The client for `/api/v1/ops/reservations` (ADR-012, the first thread).
 *
 * This is the shape every other operator command copies, so it is worth reading
 * once in full:
 *
 *   - a read goes through TanStack Query and reports a failure as an ERROR,
 *     never as an empty list. "We could not reach the server" and "you have no
 *     reservations" look identical on screen if the fetch swallows the
 *     difference, and the first one told the operator a lie (AC-13);
 *   - a command goes through `command()`, which throws a typed `ApiError`. That
 *     typing is what lets the query client spot a 403 and refresh what this
 *     person may do, which is one of the three freshness triggers (AC-15);
 *   - the server's answer replaces the row. A command returns the reservation
 *     as it now stands, so the list is patched from the server rather than from
 *     an optimistic guess that a later refetch would have to undo.
 *
 * Nothing here decides a permission. `useCapability` reads the resolved array
 * for the buttons; `WorkspaceGuard` is the control.
 */

import {
  OperatorReservationList,
  type OperatorReservation,
} from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { API_BASE, ApiError, REQUEST_TIMEOUT_MS, command } from "./api";
import { OPS_READ, useMayRead } from "./ops";
import { queryKeys } from "./queries";

/**
 * A read that THROWS, unlike `getJson`.
 *
 * The difference is deliberate and it is the whole of AC-13 for this screen.
 * `getJson` settles a failure into null because its caller (`me.ts`) reports a
 * status; here the caller is a query, and a query needs to know the difference
 * between "the desk is empty" and "we never heard back" so it can say so.
 */
async function readReservations(
  workspaceId: string,
): Promise<OperatorReservationList> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1/ops/reservations`, {
      credentials: "include",
      // The guard reads the workspace from the header first. Sending it here
      // too, on a read, would be a second source of truth for the same fact.
      headers: { "x-workspace-id": workspaceId },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(res.status, "We couldn't load your reservations.");
    }
    const body: unknown = await res.json();
    // Parsed against the contract, so a drift is caught here rather than three
    // components later as an undefined field nobody can trace.
    return OperatorReservationList.parse(body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "We couldn't reach the server. Try again.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The reservations on this workspace's desk.
 *
 * Disabled with no workspace id, which is the standalone demo case: there is no
 * server to ask, so asking would only produce a failure to render. The screen
 * falls back to the demo store there and the mock banner says so (AC-12).
 */
export function useReservations(
  workspaceId: string | null,
): UseQueryResult<OperatorReservationList> {
  // Not asked on behalf of a role the server refuses (audit H1): the command
  // bar and the calendar call this for whoever is signed in, and a 403 would
  // invalidate the grant on every visit.
  const mayRead = useMayRead(OPS_READ.reservations);
  return useQuery({
    queryKey: queryKeys.reservations(workspaceId),
    queryFn: () => readReservations(workspaceId as string),
    enabled: workspaceId !== null && mayRead,
  });
}

/** Approve and decline are one decision with two answers, so one hook builds both. */
function useReservationDecision(
  workspaceId: string | null,
  action: "approve" | "decline",
): UseMutationResult<OperatorReservation, Error, string> {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      command<OperatorReservation>(`/ops/reservations/${id}/${action}`, {
        workspaceId: workspaceId as string,
      }),
    onSuccess: (updated) => {
      // Patch the row from the server's answer, then refetch. The patch makes
      // the list correct immediately; the refetch catches anything else that
      // moved (an auto-decline that fired while this request was in flight).
      client.setQueryData<OperatorReservationList>(
        queryKeys.reservations(workspaceId),
        (current) =>
          current
            ? {
                reservations: current.reservations.map((r) =>
                  r.id === updated.id ? updated : r,
                ),
              }
            : current,
      );
      void client.invalidateQueries({
        queryKey: queryKeys.reservations(workspaceId),
      });
      // Approving opens the booking's bill, which the Payment lens renders from
      // that moment (ADR-044, D-c). Without this it says "no bill" for a minute.
      if (action === "approve") {
        void client.invalidateQueries({ queryKey: queryKeys.folios(workspaceId) });
      }
    },
  });
}

export function useApproveReservation(
  workspaceId: string | null,
): UseMutationResult<OperatorReservation, Error, string> {
  return useReservationDecision(workspaceId, "approve");
}

export function useDeclineReservation(
  workspaceId: string | null,
): UseMutationResult<OperatorReservation, Error, string> {
  return useReservationDecision(workspaceId, "decline");
}
