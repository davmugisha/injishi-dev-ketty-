"use server";

import { screenHref } from "@injishi/data";
import type { ApprovalRequest } from "@injishi/data/fixtures/owner";
import { getDocument, updateDocument } from "@injishi/db";
import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";

/**
 * The owner approves or declines a request. The decision is final: an already decided request is left as it is,
 * and a decline needs a reason of at least five characters (the same rule the dialog enforces).
 */
export async function decideApproval(id: string, decision: "approved" | "declined", reason: string): Promise<void> {
  await requirePersona("Approvals");
  const request = await getDocument<ApprovalRequest>("owner.approvalRequests", id);
  if (!request || request.decision) return;
  const note = reason.trim();
  if (decision === "declined" && note.length < 5) return;
  await updateDocument<ApprovalRequest>("owner.approvalRequests", id, { decision, decisionReason: note });
  revalidatePath(screenHref("Approvals"));
}
