/**
 * Admin's reads for People (2026-10-29): the account directory, one person with every authority they hold,
 * and the businesses an admin can add them to. The directory and a person are PII reads, so each carries the
 * reason the API records on the access trail. `StaffGuard` decides; server side only.
 */
import type { AdminOrgListResponse, AdminPersonDetail, AdminUserListResponse } from "@injishi/contracts";
import { currentApi } from "@/lib/session";

/** What the access trail records for a read from these screens. */
const READ_REASON = "Admin console: People";

export async function people(q: string | undefined, page = 1): Promise<AdminUserListResponse> {
  const api = await currentApi();
  return api.get<AdminUserListResponse>("/api/v1/admin/users", {
    query: { q: q?.trim() || undefined, page: String(page), pageSize: "25", reason: READ_REASON },
  });
}

export async function person(userId: string): Promise<AdminPersonDetail> {
  const api = await currentApi();
  return api.get<AdminPersonDetail>(`/api/v1/admin/users/${userId}`, { query: { reason: READ_REASON } });
}

/** Businesses by name, TIN or UPI, for "Add to a business". */
export async function businesses(q: string): Promise<AdminOrgListResponse> {
  const api = await currentApi();
  return api.get<AdminOrgListResponse>("/api/v1/admin/orgs", { query: { q: q.trim(), pageSize: "10" } });
}
