"use client";

/**
 * The client half of the one list contract (ADR-058, 058-list-framework).
 *
 * Every HR list screen reads its page through `useListPage`, keeps its state
 * in the URL through `useListUrl`, and saves views through `useSavedViews`.
 * The same rules as `ops.ts`: a read throws so a screen can tell "nothing
 * here" from "no answer", every response is parsed against its contract, and
 * nothing here decides a permission. The caller passes the permissions the
 * route declares, so a refused read is never fired.
 */

import {
  BulkResponse,
  ListIds,
  SavedView,
  SavedViewList,
  encodeListQuery,
  isListKey,
  LIST_READ,
  type ListPage,
  type ListQuery,
  type ListReader,
  type ListSpec,
  type ListView,
  type Permission,
  type SavedViewConfig,
} from "@injishi/contracts";
import { useListState, type UseListState } from "@injishi/ui";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

import { API_BASE, REQUEST_TIMEOUT_MS, command, readRefusal } from "./api";
import { branchHeader } from "./branch";
import { read, useMayRead } from "./ops";

/** Just enough of a Zod schema to validate a response, as in `ops.ts`. */
interface Parser<T> {
  parse: (value: unknown) => T;
}

/** A list query as the search string of its route. */
export function listSearch(query: ListQuery): string {
  return new URLSearchParams(encodeListQuery(query)).toString();
}

/** The list's state, kept in the address bar. */
export function useListUrl(
  spec: ListSpec,
  reader: ListView | ListReader,
  defaultView?: SavedViewConfig | null,
): UseListState {
  const search = useSearchParams().toString();
  return useListState(spec, { search, reader, defaultView });
}

/**
 * One page of a list. Keyed by the noun first, as every operator read is, so a
 * command that invalidates `["ops", noun]` refreshes every page of it; the
 * previous page stays on screen while the next one loads.
 */
export function useListPage<T>(
  ws: string | null,
  noun: string,
  path: string,
  query: ListQuery,
  schema: Parser<ListPage<T>>,
  anyOf: readonly Permission[],
  options: { refetchInterval?: number } = {},
): UseQueryResult<ListPage<T>> {
  const mayRead = useMayRead(anyOf);
  const search = listSearch(query);
  return useQuery({
    queryKey: ["ops", noun, ws, "page", search],
    queryFn: () => read(`${path}${search ? `?${search}` : ""}`, ws as string, schema),
    enabled: ws !== null && mayRead,
    placeholderData: keepPreviousData,
    refetchInterval: options.refetchInterval,
  });
}

/** Select all: the ids the query matches, up to the bulk cap, and how many match (AC-LF15). */
export function readListIds(ws: string, path: string, query: ListQuery): Promise<ListIds> {
  const search = listSearch({ ...query, page: 1 });
  return read(`${path}/ids${search ? `?${search}` : ""}`, ws, ListIds);
}

/** Run a bulk action; one result per id, a refusal in the command's own words (AC-LF6). */
export function runBulkAction(
  ws: string,
  path: string,
  action: string,
  ids: readonly string[],
  params?: Record<string, unknown>,
): Promise<BulkResponse> {
  return command<unknown>(`${path}/bulk`, {
    workspaceId: ws,
    body: { action, ids, ...(params ? { params } : {}) },
  }).then((answer) => BulkResponse.parse(answer));
}

/**
 * Download the current view as CSV (AC-LF7). A plain link cannot carry the
 * workspace header, so the file is fetched and handed to the browser as a
 * blob; the server names it and logs the export.
 */
export async function downloadListCsv(
  ws: string,
  path: string,
  query: ListQuery,
  columns: readonly string[],
): Promise<void> {
  const params = new URLSearchParams(encodeListQuery({ ...query, page: 1 }));
  if (columns.length > 0) params.set("columns", columns.join(","));
  const controller = new AbortController();
  // An export may run to 10,000 rows, so it gets more time than a page.
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS * 5);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}/export.csv?${params.toString()}`, {
      credentials: "include",
      headers: { "x-workspace-id": ws, ...branchHeader() },
      signal: controller.signal,
    });
    if (!res.ok) throw await readRefusal(res);
    const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "export.csv";
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  } finally {
    clearTimeout(timer);
  }
}

// --- Saved views -----------------------------------------------------------------

const viewsKey = (ws: string | null, listKey: string) => ["ops", "list-views", ws, listKey] as const;

/** The caller's views of a list and the shared ones (AC-LF5). */
export function useSavedViews(ws: string | null, listKey: string): UseQueryResult<SavedView[]> {
  const anyOf: readonly Permission[] = isListKey(listKey) ? LIST_READ[listKey] : [];
  const mayRead = useMayRead(anyOf);
  return useQuery({
    queryKey: viewsKey(ws, listKey),
    queryFn: async () =>
      (await read(`/ops/list-views?listKey=${encodeURIComponent(listKey)}`, ws as string, SavedViewList)).views,
    enabled: ws !== null && mayRead,
  });
}

export interface SavedViewMutations {
  readonly create: UseMutationResult<
    SavedView,
    Error,
    { name: string; shared: boolean; isDefault: boolean; config: SavedViewConfig }
  >;
  readonly update: UseMutationResult<SavedView, Error, { id: string; patch: { config?: SavedViewConfig; isDefault?: boolean } }>;
  readonly remove: UseMutationResult<void, Error, string>;
}

export function useSavedViewMutations(ws: string | null, listKey: string): SavedViewMutations {
  const client = useQueryClient();
  const refresh = () => void client.invalidateQueries({ queryKey: viewsKey(ws, listKey) });
  const create = useMutation({
    mutationFn: async (input: { name: string; shared: boolean; isDefault: boolean; config: SavedViewConfig }) =>
      SavedView.parse(await command<unknown>("/ops/list-views", { workspaceId: ws as string, body: { listKey, ...input } })),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { config?: SavedViewConfig; isDefault?: boolean } }) =>
      SavedView.parse(await command<unknown>(`/ops/list-views/${id}`, { workspaceId: ws as string, body: patch, method: "PATCH" })),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => command<void>(`/ops/list-views/${id}`, { workspaceId: ws as string, method: "DELETE" }),
    onSuccess: refresh,
  });
  return { create, update, remove };
}

/** The saved views block `DataView` takes, wired to the routes. */
export function useSavedViewsFor(ws: string | null, listKey: string) {
  const views = useSavedViews(ws, listKey);
  const { create, update, remove } = useSavedViewMutations(ws, listKey);
  const defaultView = views.data?.find((v) => v.mine && v.isDefault)?.config ?? null;
  return {
    defaultView,
    savedViews: {
      views: views.data,
      create: (input: { name: string; shared: boolean; isDefault: boolean; config: SavedViewConfig }) => create.mutateAsync(input),
      update: (id: string, patch: { config?: SavedViewConfig; isDefault?: boolean }) => update.mutateAsync({ id, patch }),
      remove: (id: string) => remove.mutateAsync(id),
    },
  };
}
