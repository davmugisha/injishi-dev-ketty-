"use server";

import { revalidatePath } from "next/cache";
import { requirePersona } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { sendGuestMessage } from "@/server/mutations/stays";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Messages → Send: the reply goes onto the guest's conversation through the API, so the guest app
 * and every desk see it. A refusal (an archived conversation, a missing permission) comes back as
 * words for the screen's toast.
 */
export async function replyToGuest(threadId: string, body: string): Promise<ActionResult> {
  await requirePersona("Messages");
  try {
    await sendGuestMessage(await requestContext(), threadId, body);
  } catch (error) {
    if (error instanceof ApiError)
      return { ok: false, error: error.unauthenticated ? "Your session ended. Sign in again." : error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
  revalidatePath("/messages");
  return { ok: true };
}
