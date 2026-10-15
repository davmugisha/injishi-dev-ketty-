/** Writes for the public area, through the API. Plain functions: server actions and verify flows both call them. */
import type { SourceContext } from "../sources/types";

/** The support intake's closed topics (`SupportTopic` in @injishi/contracts support.ts). */
export type SupportTopic = "booking" | "payment" | "listing" | "other";

export interface SupportTicketInput {
  topic: SupportTopic;
  message: string;
  email: string;
  name?: string;
}

/**
 * Open a support ticket. Public on purpose: a signed-out visitor needs help too. When someone is signed
 * in, the API attributes the ticket to them from the session; the body can never name a requester.
 */
export async function openSupportTicket(ctx: SourceContext, input: SupportTicketInput): Promise<{ id: string }> {
  return ctx.api.post<{ id: string }>("/api/v1/support/tickets", input);
}
