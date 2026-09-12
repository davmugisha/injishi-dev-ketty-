"use client";

/**
 * ONE operator inbox (ADR-018, D-g, AC-11).
 *
 * `host/messages` and `landlord/tenant-messages` were two destinations for the
 * same job, and a person holding both carried both. They already shared
 * `Conversation`, so what differed was never the screen: it was which threads,
 * what the thread is tied to, and the four replies that workspace actually
 * sends.
 *
 * **The threads are no longer passed in** (ADR-035, D-f wave 1).
 * `GET /api/v1/ops/threads` is scoped to the workspace by `WorkspaceGuard`, so
 * "which threads" is the server's answer and `Conversation` asks for it itself.
 * What is left here is the only thing that genuinely differs between the two
 * surfaces: the wording.
 *
 * ONE PER APP, NOT ONE PER PLATFORM. A host who also travels still has an inbox
 * here and another in the marketplace app. That is the accepted cost, stated in
 * ADR-018 rather than hidden: threads are scoped per workspace, and a
 * receptionist should not be bounced out of the operator app mid shift to
 * answer a guest.
 */

import { Conversation } from "./conversation";
import { usePms } from "../store";

export function Inbox() {
  const { state } = usePms();

  if (state.ws === "landlord") {
    return (
      <Conversation
        listLabel="Tenant threads"
        scopeNote="This thread is tied to the lease — what you agree here is what the rent roll shows."
        placeholder="Reply to the tenant…"
        quick={[
          "That works — pay on the 25th and I'll note it.",
          "I'll send the caretaker round.",
          "Leave the wall — I'll handle it at the review.",
          "Thanks for letting me know.",
        ]}
      />
    );
  }

  return (
    <Conversation
      listLabel="Guest threads"
      scopeNote="This thread is tied to the reservation — charges agreed here land on that stay's bill."
      placeholder="Reply to the guest…"
      quick={[
        "Yes, that works — see you then.",
        "Breakfast is 06:30 – 10:00 in the restaurant.",
        "We can arrange an airport shuttle — shall I book it?",
        "I've added it to your bill.",
      ]}
    />
  );
}
