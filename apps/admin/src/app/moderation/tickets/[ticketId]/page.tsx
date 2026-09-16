import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminSupportTicketDetail } from "@injishi/contracts";

import { Badge } from "@injishi/ui";
import { FailureNextStep } from "@/components/failure/failure-next-step";
import { getSupportTicket } from "@/lib/api/moderation";
import { apiFailureMessage, failureHeading, type ApiFailure } from "@/lib/api/server";
import { EMPTY, dateTime, humanise } from "@/lib/present/format";
import { presentTicketClock } from "@/lib/present/moderation";

export const metadata = { title: "Support ticket" };

/**
 * Why the console is reading what somebody wrote to support, in the words that
 * reach the log. Stated here, at the one call site, for the reason the users
 * directory gives: the server writes a `record_access_logs` row with it, and a
 * reason nobody wrote cannot tell an answered ticket from browsing.
 */
const TICKET_READ_REASON =
  "Moderation desk — support ticket: reading the message and the reply address " +
  "in order to answer the person who wrote in";

/** A ticket id is a UUID; anything else is a 404 without asking the API. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * F-A12 · one support ticket (demo-comms, 2026-09-14).
 *
 * The list shows the backlog; this is where the message and the contact details
 * are read, and only here. Read only: replying, resolving and reopening are
 * writes with their own permission (`admin.moderation.act`) and audit row, and
 * none is built, so nothing on this page offers one.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) notFound();

  const result = await getSupportTicket(ticketId, TICKET_READ_REASON);
  if (!result.ok && result.reason === "missing") notFound();

  return (
    <div className="mx-auto max-w-page px-4 py-6 sm:px-6">
      <Link href="/moderation" className="text-xs font-semibold text-muted-foreground hover:underline">
        ← Moderation &amp; support
      </Link>
      {result.ok ? <Ticket ticket={result.data} /> : <Unavailable reason={result.reason} />}
    </div>
  );
}

function Ticket({ ticket }: { ticket: AdminSupportTicketDetail }) {
  const live = ticket.state === "open" || ticket.state === "reopened";

  return (
    <>
      <header className="mt-2 flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {ticket.category ? humanise(ticket.category) : "Uncategorised"} ticket
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Raised {dateTime(ticket.createdAt)} · {presentTicketClock(ticket)}
          </p>
        </div>
        <Badge variant={live ? (ticket.firstResponseAt === null ? "danger" : "warning") : "success"}>
          {ticket.state}
        </Badge>
      </header>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-label="Message" className="rounded-card border border-border bg-field p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            What they wrote
          </h2>
          <p className="mt-3 max-w-read whitespace-pre-wrap text-sm leading-6">
            {ticket.message ?? "This ticket was raised without a message."}
          </p>
        </section>

        <section aria-label="Contact" className="rounded-card bg-card p-6 text-card-foreground">
          <h2 className="text-xs font-bold uppercase tracking-wider text-card-foreground/60">
            How to answer them
          </h2>
          <dl className="mt-3 grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-card-foreground/60">Name</dt>
              <dd className="font-semibold">{ticket.contactName ?? EMPTY}</dd>
            </div>
            <div>
              <dt className="text-xs text-card-foreground/60">Email</dt>
              <dd className="font-semibold break-all">
                {ticket.contactEmail ? (
                  <a href={`mailto:${ticket.contactEmail}`} className="hover:underline">
                    {ticket.contactEmail}
                  </a>
                ) : (
                  EMPTY
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-card-foreground/60">Phone</dt>
              <dd className="font-semibold">{ticket.contactPhone ?? EMPTY}</dd>
            </div>
            <div>
              <dt className="text-xs text-card-foreground/60">Account</dt>
              <dd className="font-semibold">
                {ticket.requesterUserId ? "Signed in when they wrote" : "Not signed in"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs leading-5 text-card-foreground/60">
            Opening this ticket was recorded in the access log with the reason for
            reading it. Replies go out from your own mailbox for now: the console
            cannot answer or resolve a ticket yet.
          </p>
        </section>
      </div>
    </>
  );
}

/**
 * The read failed. Said in words, never as an empty message: an empty panel
 * would claim the person wrote nothing.
 */
function Unavailable({ reason }: { reason: ApiFailure }) {
  return (
    <div className="mt-4 animate-arrive rounded-card border border-border bg-field p-6 sm:p-7">
      <p className="text-base font-semibold">{failureHeading(reason, "admin.moderation.view")}</p>
      <p className="mt-2 max-w-read text-sm leading-relaxed text-muted-foreground">
        {apiFailureMessage(reason)}
      </p>
      <FailureNextStep reason={reason} />
    </div>
  );
}
