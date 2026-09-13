import { AdminAnnouncementResponse } from "@injishi/contracts";

import { apiGet, type ApiResult, type PageQuery } from "./server";

/**
 * Announcements (F-A13) — `GET /api/v1/admin/announcements`.
 *
 * P: `admin.announcement.view`. Drafts and published notices arrive in the
 * same list, separated by `state`, so nobody can publish something twice by
 * looking at the wrong screen.
 *
 * `audience` crosses as `unknown` — it is a stored targeting expression whose
 * shape the contract deliberately does not pin down. The console renders what
 * it can prove and nothing more; it must not guess a structure for it.
 */
export function listAnnouncements(
  query: PageQuery = {},
): Promise<ApiResult<AdminAnnouncementResponse>> {
  return apiGet("/api/v1/admin/announcements", AdminAnnouncementResponse, {
    page: query.page,
    pageSize: query.pageSize,
  });
}
