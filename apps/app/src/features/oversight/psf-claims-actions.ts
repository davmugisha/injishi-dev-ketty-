"use server";

import type { ConfirmPsfClaimRequest, PsfMemberListResult, PsfMemberListRow } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";

/**
 * The PSF District Manager's decisions on membership claims (0121, 2026-10-30): confirm a typed number
 * against PSF's records, reject it with a reason, or upload PSF's own member list so matching claims
 * confirm themselves. A refusal comes back as the API's words.
 */
export type ClaimActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

async function run<T>(act: () => Promise<T>): Promise<ClaimActionResult<T>> {
  await requirePersona("PsfClaims");
  try {
    const value = await act();
    revalidatePath("/psf/claims");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

export async function confirmClaimAction(id: string, body: ConfirmPsfClaimRequest): Promise<ClaimActionResult> {
  return run(async () => {
    await (await requestContext()).api.post(`/api/v1/oversight/psf/claims/${id}/confirm`, body);
    return undefined;
  });
}

export async function rejectClaimAction(id: string, reason: string): Promise<ClaimActionResult> {
  return run(async () => {
    await (await requestContext()).api.post(`/api/v1/oversight/psf/claims/${id}/reject`, { reason });
    return undefined;
  });
}

export async function uploadMemberListAction(
  rows: PsfMemberListRow[],
): Promise<ClaimActionResult<PsfMemberListResult>> {
  return run(async () =>
    (await requestContext()).api.post<PsfMemberListResult>("/api/v1/oversight/psf/member-list", { rows }),
  );
}
