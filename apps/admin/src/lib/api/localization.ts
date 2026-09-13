import { AdminLocalization } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Localization (F-A15) — `GET /api/v1/admin/localization`.
 *
 * P: `admin.localization.view`. Translation entries, email templates, and the
 * coverage counts.
 *
 * Coverage is computed server-side and sent, rather than counted here from
 * `entries`. The two are not the same population — coverage spans every key the
 * platform has, `entries` is what this response chose to carry — so counting
 * the array would report the state of a slice as the state of the platform.
 */
export function getLocalization(): Promise<ApiResult<AdminLocalization>> {
  return apiGet("/api/v1/admin/localization", AdminLocalization);
}
