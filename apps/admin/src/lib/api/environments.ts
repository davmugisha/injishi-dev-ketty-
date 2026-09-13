import { AdminEnvironments } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Environments (F-A11) — `GET /api/v1/admin/environments`.
 *
 * P: `admin.environment.view`.
 *
 * The adapter modes come from the same config the modules themselves read. The
 * console must never be a second source of truth for which adapter is live: a
 * screen that says "payments: live" while the payment module is running the
 * mock is the most expensive lie this app could tell.
 */
export function getEnvironments(): Promise<ApiResult<AdminEnvironments>> {
  return apiGet("/api/v1/admin/environments", AdminEnvironments);
}
