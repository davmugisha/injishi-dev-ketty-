"use server";

import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import * as oversight from "@/server/mutations/oversight";

/**
 * The government officer's decisions on a registration. Each checks the case screen is the person's, calls
 * the API through `server/mutations/oversight.ts`, and refreshes the queues and the case. A refusal comes
 * back as words for the screen, never as an error the officer cannot read: the API's own message says why
 * (outside your district, you verified it yourself, a document is still unread).
 */
export type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

async function run<T>(act: () => Promise<T>): Promise<ActionResult<T>> {
  await requirePersona("OfficerCase");
  try {
    const value = await act();
    // The queues only. The case page itself is left alone on purpose: once decided, a case leaves this
    // officer's queue, so re-reading it would turn the confirmation they are looking at into "not found".
    revalidatePath(screenHref("OfficerHome"));
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.forbidden) return { ok: false, error: `Not allowed: ${error.message}` };
      return { ok: false, error: error.message };
    }
    if (error instanceof oversight.OversightRefusal) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

const ctx = () => requestContext();

/** "I have read this document" → `POST /oversight/registrations/:orgId/documents/:documentId/check`. */
export async function checkDocumentAction(orgId: string, documentId: string): Promise<ActionResult> {
  return run(async () => {
    await oversight.checkDocument(await ctx(), orgId, documentId);
    return undefined;
  });
}

/** "Record verification" → `POST /registrations/:id/field-verify`. Answers the status it moved to. */
export async function fieldVerifyAction(orgId: string, notes: string): Promise<ActionResult<string>> {
  return run(async () => (await oversight.fieldVerify(await ctx(), orgId, notes)).status);
}

/** "Approve" → `POST /registrations/:id/approve`. Answers the status it moved to (`active` or `approved`). */
export async function approveAction(orgId: string, notes: string): Promise<ActionResult<string>> {
  return run(async () => (await oversight.approve(await ctx(), orgId, notes)).status);
}

/** "Record rejection" → `field-reject` or `reject`, by the gate this officer decides. */
export async function rejectAction(
  orgId: string,
  gate: "field" | "approval",
  reasonCode: string,
  notes: string,
): Promise<ActionResult<string>> {
  return run(async () => (await oversight.reject(await ctx(), orgId, gate, reasonCode, notes)).status);
}
