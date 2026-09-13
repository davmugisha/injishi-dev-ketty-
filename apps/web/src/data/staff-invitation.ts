import {
  AcceptedStaffInvitation,
  StaffInvitationPreview,
} from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * Accepting a staff invitation (2026-09-13). Web owns this page as it owns
 * sign-in: one account, one place a person accepts anything. The token travels
 * in a POST body, never a query string the API would log.
 */
export async function previewStaffInvitation(
  orgId: string,
  token: string,
): Promise<ApiResult<StaffInvitationPreview>> {
  const res = await apiFetch<unknown>(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/staff-invitation/preview`,
    { method: "POST", body: { token } },
  );
  if (res.status !== "ok") return res;
  const parsed = StaffInvitationPreview.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

export async function acceptStaffInvitation(
  orgId: string,
  token: string,
): Promise<ApiResult<AcceptedStaffInvitation>> {
  const res = await apiFetch<unknown>(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/staff-invitation/accept`,
    { method: "POST", body: { token } },
  );
  if (res.status !== "ok") return res;
  const parsed = AcceptedStaffInvitation.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}
