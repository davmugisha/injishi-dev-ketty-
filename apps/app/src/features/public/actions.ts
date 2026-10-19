"use server";

import { requireScreen } from "@/lib/session";
import { ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import {
  type DemoRequestInput,
  joinOwnerWaitlist,
  type OwnerWaitlistInput,
  openSupportTicket,
  readableRefusal,
  requestDemo,
  type SupportTicketInput,
} from "@/server/mutations/public";

export type PublicActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** A public write: the screen is the visitor's to use, the API decides, and a refusal comes back as words. */
async function run<T>(screen: "PublicHelp" | "PublicHost", act: () => Promise<T>): Promise<PublicActionResult<T>> {
  await requireScreen(screen);
  try {
    return { ok: true, value: await act() };
  } catch (error) {
    const refusal = readableRefusal(error);
    if (refusal !== null) return { ok: false, error: refusal };
    if (error instanceof ApiUnreachableError)
      return { ok: false, error: "The Injishi service did not answer. Try again." };
    throw error;
  }
}

/** The help centre's contact form. Anyone may write (the help centre is public); the API throttles it. */
export async function openSupportTicketAction(input: SupportTicketInput): Promise<PublicActionResult<{ id: string }>> {
  return run("PublicHelp", async () => openSupportTicket(await requestContext(), input));
}

/** "Join the waitlist" on the hosts page → `POST /waitlist/signups` (audience owner). */
export async function joinWaitlistAction(
  input: OwnerWaitlistInput,
): Promise<PublicActionResult<{ id: string; alreadyJoined: boolean }>> {
  return run("PublicHost", async () => joinOwnerWaitlist(await requestContext(), input));
}

/** "Request demo" on the hosts page → a support ticket (`POST /support/tickets`, topic other). */
export async function requestDemoAction(input: DemoRequestInput): Promise<PublicActionResult<{ id: string }>> {
  return run("PublicHost", async () => requestDemo(await requestContext(), input));
}
