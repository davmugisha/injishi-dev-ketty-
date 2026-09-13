import {
  AdminWaitlistPage,
  type AdminWaitlistQuery,
} from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * The waitlist (ADR-048) — `GET /api/v1/admin/waitlist`.
 *
 * Deleted whole at launch, along with the section that reads it.
 *
 * NO `reason` ARGUMENT, unlike `listOrgs` and `listObo`. Those two return
 * identity the platform holds about somebody regardless of their wishes, so
 * reading one is reason-gated and logged per record. A waitlist row is contact
 * detail a person volunteered in order to be contacted, and ADR-048 took the
 * call that it is not reason-gated. The EXPORT is still logged, because taking
 * a copy of the whole list off the platform is a different act from looking at
 * a page of it.
 */
const BASE = "/api/v1/admin/waitlist";

export function listWaitlist(
  query: AdminWaitlistQuery | Record<string, never> = {},
): Promise<ApiResult<AdminWaitlistPage>> {
  return apiGet(BASE, AdminWaitlistPage, {
    audience: "audience" in query ? query.audience : undefined,
    districtId: "districtId" in query ? query.districtId : undefined,
    limit: "limit" in query ? query.limit : undefined,
    offset: "offset" in query ? query.offset : undefined,
  });
}
