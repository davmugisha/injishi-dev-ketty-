"use server";

import { requireScreen } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import { openSupportTicket, type SupportTicketInput } from "@/server/mutations/public";

export type PublicActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** The help centre's contact form. Anyone may write (the help centre is public); the API throttles it. */
export async function openSupportTicketAction(input: SupportTicketInput): Promise<PublicActionResult<{ id: string }>> {
  await requireScreen("PublicHelp");
  try {
    return { ok: true, value: await openSupportTicket(await requestContext(), input) };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, error: error.message };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}
