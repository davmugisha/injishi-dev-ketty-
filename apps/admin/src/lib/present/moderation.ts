import type {
  AdminEscalation,
  AdminModeratedReview,
  AdminModeration,
  AdminSupportTicket,
  AdminSupportTicketDetail,
} from "@injishi/contracts";

import type { BadgeIntent, SectionModel, SectionRow, SectionStat } from "@/lib/types";

import { EMPTY, count, date, dateTime, detail, elapsed, humanise } from "./format";

/**
 * Moderation (F-A12) — reviews, tickets and escalations, one backlog.
 */

/**
 * A moderated review.
 *
 * `state` crosses as a plain string, not an enum — the contract left it open —
 * so this mapping shows it verbatim and colours only the two words it can be
 * certain of. Guessing an intent from an unknown state string is how a
 * "published" review ends up looking like a removed one.
 */
export function presentModeratedReview(review: AdminModeratedReview): SectionRow {
  return {
    ref: date(review.createdAt),
    subject: review.propertyName ?? "property not named",
    context: detail(
      review.authorName,
      review.rating !== null ? `${review.rating}★` : null,
      review.body,
    ),
    state: review.state,
    intent: reviewIntent(review.state),
  };
}

function reviewIntent(state: string): BadgeIntent {
  if (state === "removed" || state === "rejected") return "danger";
  if (state === "flagged" || state === "pending") return "warning";
  return "default";
}

/**
 * A support ticket.
 *
 * The colour comes from the response clock, not from the ticket's own words. An
 * open ticket that nobody has replied to is red however politely it is worded;
 * an open ticket with a first response is amber because somebody has it.
 * `reopened` is red too: a ticket that came back is a ticket that was closed
 * wrongly, and it must not sit in the same grey as a fresh one.
 */
export function presentSupportTicket(ticket: AdminSupportTicket): SectionRow & { href: string } {
  const unanswered = ticket.firstResponseAt === null;
  const live = ticket.state === "open" || ticket.state === "reopened";

  return {
    // The row opens the ticket, which is the one place the message is read:
    // behind a stated reason and an access log row (demo-comms, 2026-09-14).
    href: supportTicketHref(ticket.id),
    ref: date(ticket.createdAt),
    subject: ticket.category ? humanise(ticket.category) : "uncategorised",
    context: detail(
      ticket.domain && humanise(ticket.domain),
      unanswered
        ? `no reply · waiting ${elapsed(ticket.createdAt)}`
        : `first reply ${date(ticket.firstResponseAt)}`,
      ticket.resolvedAt ? `resolved ${date(ticket.resolvedAt)}` : null,
      ticket.csat !== null ? `CSAT ${ticket.csat}` : null,
    ),
    state: ticket.state,
    intent: !live
      ? "success"
      : ticket.state === "reopened" || unanswered
        ? "danger"
        : "warning",
  };
}

/**
 * An escalation.
 *
 * Open is always red. An escalation is by definition something that already
 * failed to be handled one level down, so there is no "mildly open" version of
 * it, and an amber here would let one sit.
 */
export function presentEscalation(escalation: AdminEscalation): SectionRow {
  return {
    ref: date(escalation.createdAt),
    subject: humanise(escalation.type),
    context: detail(
      escalation.subjectType ? humanise(escalation.subjectType) : null,
      escalation.subjectId,
      escalation.ownerUserId ? `owner ${escalation.ownerUserId}` : "unowned",
      escalation.resolutionNote,
    ),
    state: escalation.state,
    intent: escalation.state === "open" ? "danger" : "success",
  };
}

export function presentModerationStats(data: AdminModeration): SectionStat[] {
  const openTickets = data.tickets.filter(
    (t) => t.state === "open" || t.state === "reopened",
  ).length;
  const openEscalations = data.escalations.filter(
    (e) => e.state === "open",
  ).length;
  const unanswered = data.tickets.filter(
    (t) => t.firstResponseAt === null,
  ).length;

  return [
    {
      label: "Open tickets",
      value: count(openTickets),
      intent: openTickets > 0 ? "warning" : "success",
      note: `${count(unanswered)} with no reply yet`,
    },
    {
      label: "Open escalations",
      value: count(openEscalations),
      intent: openEscalations > 0 ? "danger" : "success",
      note: "already failed one level down",
    },
    {
      label: "Reviews in moderation",
      value: count(data.reviews.length),
      intent: "default",
      note: "reported or held",
    },
  ];
}

/**
 * The headline.
 *
 * Counted from the rows in THIS response, which is honest about what it is:
 * these are the counts on the page, not a platform-wide total. The contract
 * sends no aggregate for this section, and inventing one from a partial list
 * would be the console reporting a slice as the whole.
 */
export function presentModerationPrimary(
  data: AdminModeration,
): SectionModel["primary"] {
  const openEscalations = data.escalations.filter(
    (e) => e.state === "open",
  ).length;
  const oldest = data.escalations
    .filter((e) => e.state === "open")
    .map((e) => e.createdAt)
    .sort()[0];

  return {
    label: "Open escalations",
    value: count(openEscalations),
    note: oldest ? `oldest waiting ${elapsed(oldest)}` : EMPTY,
    intent: openEscalations > 0 ? "danger" : "success",
  };
}

/** Where one support ticket is read. */
export function supportTicketHref(ticketId: string): string {
  return `/moderation/tickets/${ticketId}`;
}

/**
 * The response clock of one ticket, in words, for the detail page.
 *
 * The same reading the list row gives, so the row and the record never tell a
 * staffer two different things about whether somebody has been answered.
 */
export function presentTicketClock(ticket: AdminSupportTicketDetail): string {
  return detail(
    ticket.firstResponseAt === null
      ? `no reply · waiting ${elapsed(ticket.createdAt)}`
      : `first reply ${dateTime(ticket.firstResponseAt)}`,
    ticket.resolvedAt ? `resolved ${dateTime(ticket.resolvedAt)}` : null,
    ticket.csat !== null ? `CSAT ${ticket.csat}` : null,
  );
}
