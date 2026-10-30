"use server";

import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import * as psf from "@/server/mutations/psf";
import type { PsfDeclineReason, PsfOfficerApplication } from "@/server/sources/psf";

/**
 * The PSF District Manager's decisions (2026-10-26). Each checks the application screen is the
 * person's, calls the API through `server/mutations/psf.ts`, and answers the application as it now
 * stands, so the screen shows the outcome without a reload. A refusal comes back as words.
 */
export type PsfActionResult = { ok: true; value: PsfOfficerApplication } | { ok: false; error: string };

async function run(act: () => Promise<PsfOfficerApplication>): Promise<PsfActionResult> {
  await requirePersona("PsfApplication");
  try {
    return { ok: true, value: await act() };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof psf.PsfRefusal) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError) return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

export async function approvePsfAction(id: string, membershipNumber: string): Promise<PsfActionResult> {
  return run(async () => psf.approvePsf(await requestContext(), id, membershipNumber));
}

export async function declinePsfAction(id: string, reason: PsfDeclineReason, note?: string): Promise<PsfActionResult> {
  return run(async () => psf.declinePsf(await requestContext(), id, reason, note));
}

export async function decidePsfBranchAction(
  id: string,
  branchId: string,
  decision: "admit" | "decline",
  note?: string,
): Promise<PsfActionResult> {
  return run(async () => psf.decidePsfBranch(await requestContext(), id, branchId, decision, note));
}
