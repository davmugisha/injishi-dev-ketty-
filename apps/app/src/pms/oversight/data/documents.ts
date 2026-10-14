"use client";

/**
 * The documents on one registration, for the officer deciding its gate
 * (F-S03 §5).
 *
 * `GET /api/v1/oversight/registrations/:orgId/documents` for both functions,
 * and `POST .../:documentId/check` for the field verifier alone. Fetched when a
 * file is OPENED rather than with the queue: a list of thirty businesses would
 * otherwise mint thirty signed links nobody asked for, each one a live read of
 * a private document.
 *
 * The queue itself carries only the two COUNTS, which is what the list rows
 * flag on. This module is the one client for the documents themselves.
 */

import { OversightDocumentList } from "@injishi/contracts";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { API_BASE, ApiError, humanMessage, REQUEST_TIMEOUT_MS } from "../../data/api";

export const documentsKey = (orgId: string | null) =>
  ["oversight", "documents", orgId] as const;

async function call(path: string, method: "GET" | "POST"): Promise<OversightDocumentList> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      let body: { message?: string | string[] } | null = null;
      try {
        body = (await res.json()) as { message?: string | string[] };
      } catch {
        // A non JSON error body tells us nothing we need.
      }
      throw new ApiError(res.status, humanMessage(res.status, body));
    }
    // Parsed against the contract, so a drift surfaces here and not as an
    // undefined field inside the sheet.
    return OversightDocumentList.parse(await res.json());
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}

export function useDocuments(orgId: string | null): UseQueryResult<OversightDocumentList> {
  return useQuery({
    queryKey: documentsKey(orgId),
    queryFn: () => call(`/oversight/registrations/${orgId}/documents`, "GET"),
    enabled: orgId !== null,
    // Every link in the answer expires. Keeping a list from ten minutes ago
    // would hand the officer a sheet of dead links that look live.
    staleTime: 60_000,
    gcTime: 120_000,
  });
}

/**
 * Record that this officer read one document.
 *
 * The server answers with the whole list as it now stands, so the sheet redraws
 * from the server's own count rather than decrementing a number of its own —
 * the count is what the gate refuses on, and two copies of it would disagree.
 */
export function useCheckDocument(
  orgId: string | null,
): UseMutationResult<OversightDocumentList, Error, { documentId: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId }) =>
      call(`/oversight/registrations/${orgId}/documents/${documentId}/check`, "POST"),
    onSuccess: (list) => {
      client.setQueryData(documentsKey(orgId), list);
      // The row's "n to check" pill is served by the queue, so it has to be
      // asked again — the count it drew is now one behind.
      void client.invalidateQueries({ queryKey: ["oversight", "queue"] });
    },
  });
}
