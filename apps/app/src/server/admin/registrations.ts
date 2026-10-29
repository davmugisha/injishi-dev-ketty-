import type { AdminOrgListResponse } from "@injishi/contracts";
import { currentApi } from "@/lib/session";

/** One audit line of a business's registration (`GET /admin/orgs/:id/timeline`). */
export interface RegistrationEvent {
  id: string;
  eventType: string;
  actorName: string | null;
  reason: string | null;
  occurredAt: string;
}

/** Every business that registered, newest first (`GET /admin/orgs`), as this staffer. */
export async function adminRegistrations(): Promise<AdminOrgListResponse> {
  const api = await currentApi();
  return api.get<AdminOrgListResponse>("/api/v1/admin/orgs", { query: { pageSize: 100 } });
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
