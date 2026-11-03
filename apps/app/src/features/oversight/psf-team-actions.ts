"use server";

import type { AppointPsfTeamRequest, PsfTeamView } from "@injishi/contracts";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";

export type PsfTeamResult = { ok: true; value: PsfTeamView } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Each answers the team as it now stands; a refusal comes back as the API's own words. */
async function run(act: () => Promise<PsfTeamView>): Promise<PsfTeamResult> {
  await requirePersona("PsfTeam");
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

/** A Province Manager appoints a District Manager, or a District Manager a BDE, in its own area. */
export async function appointPsfTeamAction(body: AppointPsfTeamRequest): Promise<PsfTeamResult> {
  return run(async () => (await requestContext()).api.post<PsfTeamView>("/api/v1/oversight/psf/team", body));
}

/** Whoever may appoint the post ends it, with a reason. */
export async function endPsfTeamAction(assignmentId: string, reason: string): Promise<PsfTeamResult> {
  if (!UUID.test(assignmentId)) return { ok: false, error: "That appointment could not be found." };
  return run(async () =>
    (await requestContext()).api.delete<PsfTeamView>(`/api/v1/oversight/psf/team/${assignmentId}?reason=${encodeURIComponent(reason.trim())}`),
  );
}
