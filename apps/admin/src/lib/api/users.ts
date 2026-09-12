import {
  AdminUnclaimedStaysResponse,
  AdminUserListResponse,
  type AdminUserListQuery,
} from "@injishi/contracts";

import { apiGet, type ApiResult, type PageQuery } from "./server";

/**
 * Users (F-A04) — `GET /api/v1/admin/users/**`.
 *
 * The directory is the console's most sensitive read: it is a list of people.
 * Two things follow, and neither is negotiable.
 *
 * `reason` is a required argument. The route writes a `record_access_logs` row
 * naming the actor, the subject and the reason, and a reason this file supplied
 * would make every row in that log identical — a log that cannot distinguish a
 * fraud investigation from idle browsing is not an audit trail.
 *
 * Document numbers arrive MASKED (`phoneMasked`, `nationalIdMasked`), exactly
 * as `/api/v1/me/profile` masks them. The console lists people; it does not
 * export their documents. There is no unmasked variant to reach for.
 */

const BASE = "/api/v1/admin/users";

/** The people directory. P: `admin.user.view`. PII: reason required. */
export function listUsers(
  reason: string,
  query: AdminUserListQuery = {},
): Promise<ApiResult<AdminUserListResponse>> {
  return apiGet(BASE, AdminUserListResponse, {
    reason,
    q: query.q,
    globalRole: query.globalRole,
    kyc: query.kyc,
    page: query.page,
    pageSize: query.pageSize,
  });
}

/**
 * Stays that never got attached to an identity. P: `admin.user.view`.
 *
 * No `reason`: a stay reference and a property name are booking data, not the
 * guest's identity record, and `identityState` says only whether one exists.
 */
export function listUnclaimedStays(
  query: PageQuery = {},
): Promise<ApiResult<AdminUnclaimedStaysResponse>> {
  return apiGet(`${BASE}/unclaimed-stays`, AdminUnclaimedStaysResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}
