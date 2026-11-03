/**
 * Admin's reads for People and Roles: the account directory, one person with every authority they hold,
 * their sign ins and their trail, the businesses an admin can add them to, and the staff roles. The
 * directory, a person and their sign ins are PII reads, so each carries the reason the API records on the
 * access trail. `StaffGuard` decides; server side only.
 */
import type {
  AdminActivityResponse,
  AdminOrgListResponse,
  AdminPersonDetail,
  AdminRoleHolders,
  AdminSignInsResponse,
  AdminStaffRoleCatalog,
  AdminUserListQuery,
  AdminUserListResponse,
} from "@injishi/contracts";
import { currentApi } from "@/lib/session";

/** What the access trail records for a read from these screens. */
const READ_REASON = "Admin console: People";

export const PEOPLE_PAGE_SIZE = 25;

/** The directory filters as the URL carries them. */
export type PeopleQuery = Pick<AdminUserListQuery, "q" | "kind" | "status" | "role" | "sort" | "dir"> & {
  page: number;
};

export async function people(query: PeopleQuery): Promise<AdminUserListResponse> {
  const api = await currentApi();
  return api.get<AdminUserListResponse>("/api/v1/admin/users", {
    query: {
      q: query.q?.trim() || undefined,
      kind: query.kind,
      status: query.status,
      role: query.role,
      sort: query.sort,
      dir: query.dir,
      page: String(query.page),
      pageSize: String(PEOPLE_PAGE_SIZE),
      reason: READ_REASON,
    },
  });
}

export async function person(userId: string): Promise<AdminPersonDetail> {
  const api = await currentApi();
  return api.get<AdminPersonDetail>(`/api/v1/admin/users/${userId}`, { query: { reason: READ_REASON } });
}

export async function signIns(userId: string): Promise<AdminSignInsResponse> {
  const api = await currentApi();
  return api.get<AdminSignInsResponse>(`/api/v1/admin/users/${userId}/sign-ins`, { query: { reason: READ_REASON } });
}

export async function activity(userId: string): Promise<AdminActivityResponse> {
  const api = await currentApi();
  return api.get<AdminActivityResponse>(`/api/v1/admin/users/${userId}/activity`);
}

/** Businesses by name, TIN or UPI, for "Add to a business". */
export async function businesses(q: string): Promise<AdminOrgListResponse> {
  const api = await currentApi();
  return api.get<AdminOrgListResponse>("/api/v1/admin/orgs", { query: { q: q.trim(), pageSize: "10" } });
}

/** Every staff role, built in and custom, with its permissions: the roles list and the matrix. */
export async function roleCatalog(): Promise<AdminStaffRoleCatalog> {
  const api = await currentApi();
  return api.get<AdminStaffRoleCatalog>("/api/v1/admin/staff-roles");
}

/** Who holds a role: a built-in key or a custom role id. */
export async function roleHolders(role: string): Promise<AdminRoleHolders> {
  const api = await currentApi();
  return api.get<AdminRoleHolders>(`/api/v1/admin/staff-roles/${encodeURIComponent(role)}/holders`);
}
