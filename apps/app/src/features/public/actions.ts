"use server";

import { requireScreen } from "@/lib/session";
import { ApiUnreachableError } from "@/server/api";
import { requestContext } from "@/server/data";
import {
  type CertificateCheck,
  checkCertificate,
  type DemoRequestInput,
  openSupportTicket,
  readableRefusal,
  requestDemo,
  type SupportTicketInput,
} from "@/server/mutations/public";

export type PublicActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** A public write: the screen is the visitor's to use, the API decides, and a refusal comes back as words. */
async function run<T>(
  screen: "PublicHelp" | "PublicHost" | "Training",
  act: () => Promise<T>,
): Promise<PublicActionResult<T>> {
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

/** "Request demo" on the hosts page → a support ticket (`POST /support/tickets`, topic other). */
export async function requestDemoAction(input: DemoRequestInput): Promise<PublicActionResult<{ id: string }>> {
  return run("PublicHost", async () => requestDemo(await requestContext(), input));
}

/** "Verify" on the training page → `GET /verify/:token`. A read anyone may make; the API throttles it. */
export async function checkCertificateAction(code: string): Promise<PublicActionResult<CertificateCheck>> {
  return run("Training", async () => checkCertificate(await requestContext(), code));
}
