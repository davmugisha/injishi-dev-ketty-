"use client";

/**
 * The client for checklists: `/api/v1/ops/hr/checklist-templates`,
 * `/checklists` and `/checklist-tasks` (ADR-058).
 *
 * The same rules as `people.ts`: a read throws so a screen can tell "no
 * checklist yet" from "no answer", every response is parsed against its
 * contract, and nothing here decides a permission. Each read asks `useMayRead`
 * with what its route declares, so the desk never fires the refused read.
 *
 * Keys follow `["ops", noun, workspaceId]`, so a command refetches a noun by
 * prefix. A person's own tasks are read through `/me/work` (`my-work.ts`).
 */

import {
  ChecklistBoard,
  ChecklistTemplate,
  ChecklistTemplateList,
  EmployeeChecklist,
  type ChecklistKind,
  type CreateChecklistTemplateRequest,
  type StartChecklistRequest,
  type UpdateChecklistTemplateRequest,
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
import { OPS_READ, read, useMayRead } from "./ops";

export const checklistKeys = {
  templates: (ws: string | null) => ["ops", "checklist-templates", ws] as const,
  board: (ws: string | null) => ["ops", "checklists", ws] as const,
};

function refresh(client: QueryClient, ...nouns: string[]): void {
  for (const noun of nouns) void client.invalidateQueries({ queryKey: ["ops", noun] });
  // Somebody the office ticks a task for reads it on their own page too.
  void client.invalidateQueries({ queryKey: ["me-work", "checklists"] });
}

export function useChecklistTemplates(ws: string | null): UseQueryResult<ChecklistTemplateList> {
  const mayRead = useMayRead(OPS_READ.checklists);
  return useQuery({
    queryKey: checklistKeys.templates(ws),
    queryFn: () => read("/ops/hr/checklist-templates", ws as string, ChecklistTemplateList),
    enabled: ws !== null && mayRead,
  });
}

/** Every checklist in the caller's branches, and who joined or is leaving with none started. */
export function useChecklistBoard(ws: string | null): UseQueryResult<ChecklistBoard> {
  const mayRead = useMayRead(OPS_READ.checklists);
  return useQuery({
    queryKey: checklistKeys.board(ws),
    queryFn: () => read("/ops/hr/checklists", ws as string, ChecklistBoard),
    enabled: ws !== null && mayRead,
  });
}

/** Write a template: a new one, or the whole of an existing one, its tasks in the order sent. */
export function useSaveChecklistTemplate(
  ws: string | null,
): UseMutationResult<
  ChecklistTemplate,
  Error,
  { id: null; body: CreateChecklistTemplateRequest } | { id: string; body: UpdateChecklistTemplateRequest }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }) =>
      ChecklistTemplate.parse(
        id === null
          ? await command<unknown>("/ops/hr/checklist-templates", { workspaceId: ws as string, body })
          : await command<unknown>(`/ops/hr/checklist-templates/${id}`, { workspaceId: ws as string, body, method: "PUT" }),
      ),
    onSuccess: () => refresh(client, "checklist-templates"),
  });
}

/** A template goes; the checklists it started stand. */
export function useDeleteChecklistTemplate(ws: string | null): UseMutationResult<void, Error, { id: string }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => command<void>(`/ops/hr/checklist-templates/${id}`, { workspaceId: ws as string, method: "DELETE" }),
    onSuccess: () => refresh(client, "checklist-templates"),
  });
}

export function useStartChecklist(ws: string | null): UseMutationResult<EmployeeChecklist, Error, StartChecklistRequest> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (body) => EmployeeChecklist.parse(await command<unknown>("/ops/hr/checklists", { workspaceId: ws as string, body })),
    onSuccess: () => refresh(client, "checklists"),
  });
}

/** Tick a task, or untick one ticked by mistake. */
export function useTickChecklistTask(ws: string | null): UseMutationResult<EmployeeChecklist, Error, { id: string; done: boolean }> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }) =>
      EmployeeChecklist.parse(
        await command<unknown>(`/ops/hr/checklist-tasks/${id}/${done ? "done" : "undo"}`, { workspaceId: ws as string }),
      ),
    onSuccess: () => refresh(client, "checklists"),
  });
}

/** What a checklist of each kind counts its days from, in words. */
export const CHECKLIST_ANCHOR: Readonly<Record<ChecklistKind, string>> = {
  onboarding: "first day",
  offboarding: "last day",
};
