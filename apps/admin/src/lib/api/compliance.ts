import { AdminCompliance } from "@injishi/contracts";

import { apiGet, type ApiResult } from "./server";

/**
 * Compliance (F-A08) — `GET /api/v1/admin/compliance`.
 *
 * One call for the artifacts (NCSA registration, DPO of record, DPIAs, the
 * processor inventory), the data-subject requests, and the counts that say
 * whether either is overdue. P: `admin.compliance.view`.
 *
 * The DSR rows carry `subjectUserId` but no name or contact detail, so this
 * route is not a PII read and takes no `reason`.
 */
export function getCompliance(): Promise<ApiResult<AdminCompliance>> {
  return apiGet("/api/v1/admin/compliance", AdminCompliance);
}
