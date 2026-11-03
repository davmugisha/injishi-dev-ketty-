"use server";

import type { CreatePsfSubsectorRequest, PsfSubsectorsView, UpdatePsfSubsectorRequest } from "@injishi/contracts";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";

export type PsfSubtypesResult = { ok: true; value: PsfSubsectorsView } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Each answers the subtypes as they now stand; a refusal comes back as the API's own words. */
async function run(act: () => Promise<PsfSubsectorsView>): Promise<PsfSubtypesResult> {
  await requirePersona("PsfSubtypes");
  try {
    return { ok: true, value: await act() };
  } catch (error) {
    if (error instanceof ApiError) {
      const issue = (error.body as { issues?: { message?: string }[] } | null)?.issues?.[0]?.message;
      return { ok: false, error: issue ?? error.message };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

export async function createPsfSubtypeAction(body: CreatePsfSubsectorRequest): Promise<PsfSubtypesResult> {
  return run(async () => (await requestContext()).api.post<PsfSubsectorsView>("/api/v1/oversight/psf/subsectors", body));
}

export async function updatePsfSubtypeAction(id: string, body: UpdatePsfSubsectorRequest): Promise<PsfSubtypesResult> {
  if (!UUID.test(id)) return { ok: false, error: "This subtype could not be found." };
  return run(async () => (await requestContext()).api.patch<PsfSubsectorsView>(`/api/v1/oversight/psf/subsectors/${id}`, body));
}
