import { AdminOverview } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * The platform overview (F-A02 / F-A09) — `GET /api/v1/admin/overview`.
 *
 * One call answers the whole screen: KPIs, revenue lines, district density, the
 * work queue, and the adapter and queue health strips. It is one endpoint
 * rather than six because the overview is a single statement about the platform
 * at one instant, and six requests would let its halves disagree.
 *
 * P: `admin.overview.view`.
 */
export function getOverview(): Promise<ApiResult<AdminOverview>> {
  return apiGet("/api/v1/admin/overview", AdminOverview);
}
