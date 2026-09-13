import { DistrictListResponse, ProvinceListResponse } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Rwanda's districts — `GET /api/v1/geography/districts`.
 *
 * The waitlist section's district filter reads the full list from here rather
 * than from the rows on screen, so a district nobody on the current page joined
 * from is still one a staffer can pick (ADR-048 AC-17).
 *
 * NO LONGER WAITLIST-ONLY. The Training section's venue form picks its district
 * from here too (ADR-049 AC-32), so this file outlives the waitlist section at
 * launch.
 */
export function listDistricts(): Promise<ApiResult<DistrictListResponse>> {
  return apiGet("/api/v1/geography/districts", DistrictListResponse);
}

/**
 * Rwanda's provinces — `GET /api/v1/geography/provinces`.
 *
 * Read only to NAME the groups in a district picker. A district's
 * `provinceId` already carries its province, so nothing here is ever sent back
 * to the API; the venue form sends the district alone (ADR-049 D11).
 */
export function listProvinces(): Promise<ApiResult<ProvinceListResponse>> {
  return apiGet("/api/v1/geography/provinces", ProvinceListResponse);
}
