import {
  AdminAccessLogResponse,
  AdminAuditResponse,
  type AdminAuditQuery,
} from "@injishi/contracts";

import { apiGet, type ApiResult, type PageQuery } from "./server";

/**
 * Audit (F-A10) — `GET /api/v1/admin/audit/**`.
 *
 * Both routes are P: `admin.audit.read`, and both are read-only by
 * construction: an audit trail a console can edit is not an audit trail.
 *
 * The two lists answer different questions and must not be merged. `audit`
 * records what somebody DID; `access-logs` records what somebody LOOKED AT.
 * A staffer who reads a hundred user records and changes nothing appears only
 * in the second, and that is precisely the pattern the second exists to catch.
 */

const BASE = "/api/v1/admin/audit";

/** What was done, by whom, to what. */
export function listAudit(
  query: AdminAuditQuery = {},
): Promise<ApiResult<AdminAuditResponse>> {
  return apiGet(BASE, AdminAuditResponse, {
    q: query.q,
    subjectType: query.subjectType,
    actorUserId: query.actorUserId,
    page: query.page,
    pageSize: query.pageSize,
  });
}

/** Who read whose identity data, and the reason they gave for it. */
export function listAccessLogs(
  query: PageQuery = {},
): Promise<ApiResult<AdminAccessLogResponse>> {
  return apiGet(`${BASE}/access-logs`, AdminAccessLogResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}
