import { AdminSystemHealth } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * System health (F-A09) — `GET /api/v1/admin/system-health`.
 *
 * Adapters, queues, the database and the running process, in one answer.
 * P: `admin.system.view`.
 *
 * Worth stating what an `unreachable` result means on THIS screen specifically:
 * the health endpoint itself did not answer, which is a health fact of the
 * loudest kind. The page must still say "can't reach the platform" rather than
 * inventing a red row, because we do not know which part is down — only that we
 * could not ask.
 */
export function getSystemHealth(): Promise<ApiResult<AdminSystemHealth>> {
  return apiGet("/api/v1/admin/system-health", AdminSystemHealth);
}
