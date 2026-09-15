import { AdminModeration, AdminSupportTicketDetail } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Moderation (F-A12) — `GET /api/v1/admin/moderation`.
 *
 * Reviews, support tickets and escalations together, because they are one
 * backlog seen from three angles: a review gets reported, the report becomes a
 * ticket, the ticket escalates. Splitting them into three screens is how an
 * escalation ends up with nobody's name on it.
 *
 * P: `admin.moderation.view` (ADR-053). Acting on an item is
 * `admin.moderation.act`.
 */
export function getModeration(): Promise<ApiResult<AdminModeration>> {
  return apiGet("/api/v1/admin/moderation", AdminModeration);
}

/**
 * One support ticket with the message and the contact details —
 * `GET /api/v1/admin/moderation/tickets/:ticketId`.
 *
 * P: `admin.moderation.view`. PII: `reason` is a required argument, for the
 * reason `listUsers` gives: the route writes a `record_access_logs` row naming
 * the ticket, and a reason supplied here would make every row identical.
 */
export function getSupportTicket(
  ticketId: string,
  reason: string,
): Promise<ApiResult<AdminSupportTicketDetail>> {
  return apiGet(
    `/api/v1/admin/moderation/tickets/${encodeURIComponent(ticketId)}`,
    AdminSupportTicketDetail,
    { reason },
  );
}
