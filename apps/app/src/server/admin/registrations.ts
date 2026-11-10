import type {
  AdminOrgDetail,
  AdminOrgListQuery,
  AdminOrgListResponse,
  AdminOrgPeopleResponse,
  AdminOrgPropertiesResponse,
  AdminOrgSubscription,
} from "@injishi/contracts";
import { currentApi } from "@/lib/session";

/** One audit line of a business's registration (`GET /admin/orgs/:id/timeline`). */
export interface RegistrationEvent {
  id: string;
  eventType: string;
  actorName: string | null;
  reason: string | null;
  occurredAt: string;
}

export const BUSINESSES_PAGE_SIZE = 25;

/** One page of the businesses that registered, newest first and filtered (`GET /admin/orgs`), as this staffer. */
export async function adminRegistrations(query: Omit<AdminOrgListQuery, "pageSize">): Promise<AdminOrgListResponse> {
  const api = await currentApi();
  const q = Object.fromEntries(
    Object.entries({ ...query, pageSize: BUSINESSES_PAGE_SIZE }).filter(([, v]) => v !== undefined && v !== ""),
  ) as Record<string, string | number>;
  return api.get<AdminOrgListResponse>("/api/v1/admin/orgs", { query: q });
}

export async function registrationTimeline(orgId: string): Promise<RegistrationEvent[]> {
  const api = await currentApi();
  const r = await api.get<{ items: RegistrationEvent[] }>(`/api/v1/admin/orgs/${orgId}/timeline`, {
    query: { pageSize: 50 },
  });
  return r.items;
}

/** 0118: a business's star grade and whether Injishi has confirmed it (`GET /admin/orgs/:id/star-grade`). */
export interface StarGradeState {
  grade: number | null;
  verifiedAt: string | null;
}

export async function starGradeOf(orgId: string): Promise<StarGradeState> {
  const api = await currentApi();
  return api.get<StarGradeState>(`/api/v1/admin/orgs/${orgId}/star-grade`);
}

/** Confirm the grade against RDB's grading certificate, or withdraw a confirmation; both need a reason. */
export async function decideStarGrade(orgId: string, confirm: boolean, reason: string): Promise<StarGradeState> {
  const api = await currentApi();
  return api.post<StarGradeState>(`/api/v1/admin/orgs/${orgId}/star-grade/${confirm ? "confirm" : "withdraw"}`, {
    reason,
  });
}

/** One business in full (`GET /admin/orgs/:id`), as this staffer. */
export async function businessDetail(orgId: string): Promise<AdminOrgDetail> {
  const api = await currentApi();
  return api.get<AdminOrgDetail>(`/api/v1/admin/orgs/${orgId}`);
}

/** Everyone in one business; a read of people's identities, so it says why. */
export async function businessPeople(orgId: string): Promise<AdminOrgPeopleResponse> {
  const api = await currentApi();
  return api.get<AdminOrgPeopleResponse>(`/api/v1/admin/orgs/${orgId}/people`, {
    query: { reason: "Admin console: a business's people", pageSize: "100" },
  });
}

export async function businessProperties(orgId: string): Promise<AdminOrgPropertiesResponse> {
  const api = await currentApi();
  return api.get<AdminOrgPropertiesResponse>(`/api/v1/admin/orgs/${orgId}/properties`, { query: { pageSize: "100" } });
}

/** Its subscription and invoices: finance staff only. */
export async function businessSubscription(orgId: string): Promise<AdminOrgSubscription> {
  const api = await currentApi();
  return api.get<AdminOrgSubscription>(`/api/v1/admin/orgs/${orgId}/subscription`);
}
