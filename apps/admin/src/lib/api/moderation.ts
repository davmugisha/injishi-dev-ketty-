import { AdminModeration } from "@injishi/contracts";

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
