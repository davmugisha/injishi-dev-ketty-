"use server";

import { screenHref } from "@injishi/data";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError } from "@/server/api";
import { decideApprovalItem } from "@/server/approvals";
import { requestContext } from "@/server/data";

export type ApprovalResult = { ok: true } | { ok: false; error: string };

/**
 * The owner approves or declines a request, and the thing itself is decided on the API: the pay run
 * is confirmed or sent back to HR, the claim approved or declined, the login invited or refused,
 * the refund paid or refused, the swap, correction, extra days or document decided. A decline needs a
 * reason of at least five characters.
 */
export async function decideApproval(
  id: string,
  decision: "approved" | "declined",
  reason: string,
): Promise<ApprovalResult> {
  await requirePersona("Approvals");
  const note = reason.trim();
  if (decision === "declined" && note.length < 5) return { ok: false, error: "Say why in a few words." };
  try {
    await decideApprovalItem(await requestContext(), id, decision, note);
    return { ok: true };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    throw error;
  } finally {
    revalidatePath(screenHref("Approvals"));
    revalidatePath(screenHref("PayRun"));
    revalidatePath(screenHref("PeopleHome"));
    revalidatePath(screenHref("Roster"));
    revalidatePath(screenHref("Attendance"));
    revalidatePath(screenHref("Leave"));
    revalidatePath(screenHref("Employees"));
  }
}
