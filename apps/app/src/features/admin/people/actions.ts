"use server";

/**
 * Admin's account writes (2026-10-29, roles and suspension 2026-11-02): create an account, set platform staff
 * roles, give or take a custom role, suspend and reactivate, resend the invitation, sign a device out, add a
 * person to a business, change their role there, take them out, and end a government seat. A grant whose
 * step-up is older than ten minutes comes back with `stepUp`, and the screen asks for a new code. Each goes through the admin
 * API, which holds it to the staff permission behind the emailed step-up and writes the audit row; the form is
 * checked with the same contracts schema first, and the answer comes back in words for a toast.
 */
import {
  AdminActionRequest,
  AdminAddMemberRequest,
  AdminAssignCustomRoleRequest,
  AdminChangeMemberRoleRequest,
  AdminCreateUserRequest,
  type AdminCreateUserResponse,
  type AdminCustomRoleAssignment,
  type AdminInvitationResent,
  type AdminMemberChange,
  type AdminOrgListResponse,
  AdminReasonQuery,
  type AdminSessionEnded,
  AdminSetStaffRolesRequest,
  type AdminStaffRolesResponse,
  type AdminSuspensionChange,
  AdminUpdateUserRequest,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentApi } from "@/lib/session";
import { businesses } from "@/server/admin/people";
import { ApiError, ApiUnreachableError } from "@/server/api";

export type PeopleActionResult<T> = { ok: true; value: T } | { ok: false; error: string; stepUp?: true };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run<T>(write: () => Promise<T>): Promise<PeopleActionResult<T>> {
  try {
    const value = await write();
    revalidatePath("/admin/people", "layout");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.unauthenticated) redirect("/sign-in?next=/admin/people");
      const body = error.body as { issues?: { message: string }[]; code?: string; message?: string } | null;
      if (body?.code === "two_factor_required")
        return { ok: false, error: "Enter the code we emailed you first, then try again." };
      if (body?.code === "step_up_stale")
        return { ok: false, error: "Confirm it is you with a new code.", stepUp: true };
      if (error.forbidden && typeof body?.message === "string" && body.code) return { ok: false, error: body.message };
      if (error.forbidden) return { ok: false, error: "Your staff role cannot do this." };
      if (Array.isArray(body?.issues) && body.issues[0]) return { ok: false, error: body.issues[0].message };
      return { ok: false, error: error.message || "That did not work. Try again." };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "Injishi could not be reached. Try again." };
    throw error;
  }
}

function invalid<T>(issues: readonly { message: string }[]): PeopleActionResult<T> {
  return { ok: false, error: issues[0]?.message ?? "Check the form." };
}

export async function createAccount(input: unknown): Promise<PeopleActionResult<AdminCreateUserResponse>> {
  const parsed = AdminCreateUserRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() => api.post<AdminCreateUserResponse>("/api/v1/admin/users", parsed.data));
}

export async function setStaffRoles(
  userId: string,
  input: unknown,
): Promise<PeopleActionResult<AdminStaffRolesResponse>> {
  if (!UUID.test(userId)) return { ok: false, error: "That person was not found." };
  const parsed = AdminSetStaffRolesRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() => api.put<AdminStaffRolesResponse>(`/api/v1/admin/users/${userId}/staff-roles`, parsed.data));
}

export async function addToBusiness(orgId: string, input: unknown): Promise<PeopleActionResult<AdminMemberChange>> {
  if (!UUID.test(orgId)) return { ok: false, error: "Choose a business from the list." };
  const parsed = AdminAddMemberRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() => api.post<AdminMemberChange>(`/api/v1/admin/orgs/${orgId}/members`, parsed.data));
}

export async function changeBusinessRole(
  orgId: string,
  userId: string,
  input: unknown,
): Promise<PeopleActionResult<AdminMemberChange>> {
  if (!UUID.test(orgId) || !UUID.test(userId)) return { ok: false, error: "That membership was not found." };
  const parsed = AdminChangeMemberRoleRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() => api.patch<AdminMemberChange>(`/api/v1/admin/orgs/${orgId}/members/${userId}`, parsed.data));
}

export async function removeFromBusiness(
  orgId: string,
  userId: string,
  reason: string,
): Promise<PeopleActionResult<AdminMemberChange>> {
  if (!UUID.test(orgId) || !UUID.test(userId)) return { ok: false, error: "That membership was not found." };
  const parsed = AdminReasonQuery.safeParse({ reason });
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() =>
    api.delete<AdminMemberChange>(`/api/v1/admin/orgs/${orgId}/members/${userId}`, {
      query: { reason: parsed.data.reason },
    }),
  );
}

export async function endSeat(userId: string, assignmentId: string, reason: string): Promise<PeopleActionResult<null>> {
  if (!UUID.test(userId) || !UUID.test(assignmentId)) return { ok: false, error: "That appointment was not found." };
  const parsed = AdminReasonQuery.safeParse({ reason });
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(async () => {
    await api.delete<null>(`/api/v1/admin/users/${userId}/oversight/${assignmentId}`, {
      query: { reason: parsed.data.reason },
    });
    return null;
  });
}

export async function assignCustomRole(
  userId: string,
  input: unknown,
): Promise<PeopleActionResult<AdminCustomRoleAssignment>> {
  if (!UUID.test(userId)) return { ok: false, error: "That person was not found." };
  const parsed = AdminAssignCustomRoleRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() => api.post<AdminCustomRoleAssignment>(`/api/v1/admin/users/${userId}/custom-roles`, parsed.data));
}

export async function revokeCustomRole(
  userId: string,
  roleId: string,
  reason: string,
): Promise<PeopleActionResult<AdminCustomRoleAssignment>> {
  if (!UUID.test(userId) || !UUID.test(roleId)) return { ok: false, error: "That role was not found." };
  const parsed = AdminReasonQuery.safeParse({ reason });
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() =>
    api.delete<AdminCustomRoleAssignment>(`/api/v1/admin/users/${userId}/custom-roles/${roleId}`, {
      query: { reason: parsed.data.reason },
    }),
  );
}

/** Suspend (`on`) or reactivate an account. */
/** Change a person's details; only the fields sent change, and the audit log keeps each from and to. */
export async function updateDetails(
  userId: string,
  input: unknown,
): Promise<PeopleActionResult<{ userId: string; changed: string[] }>> {
  if (!UUID.test(userId)) return { ok: false, error: "That person was not found." };
  const parsed = AdminUpdateUserRequest.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() => api.patch<{ userId: string; changed: string[] }>(`/api/v1/admin/users/${userId}`, parsed.data));
}

export async function setSuspended(
  userId: string,
  on: boolean,
  reason: string,
): Promise<PeopleActionResult<AdminSuspensionChange>> {
  if (!UUID.test(userId)) return { ok: false, error: "That person was not found." };
  const parsed = AdminActionRequest.safeParse({ reason });
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() =>
    api.post<AdminSuspensionChange>(`/api/v1/admin/users/${userId}/${on ? "suspend" : "reactivate"}`, parsed.data),
  );
}

export async function resendInvitation(
  userId: string,
  reason: string,
): Promise<PeopleActionResult<AdminInvitationResent>> {
  if (!UUID.test(userId)) return { ok: false, error: "That person was not found." };
  const parsed = AdminActionRequest.safeParse({ reason });
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() => api.post<AdminInvitationResent>(`/api/v1/admin/users/${userId}/resend-invitation`, parsed.data));
}

export async function endDeviceSession(
  userId: string,
  sessionId: string,
  reason: string,
): Promise<PeopleActionResult<AdminSessionEnded>> {
  if (!UUID.test(userId) || !UUID.test(sessionId)) return { ok: false, error: "That device was not found." };
  const parsed = AdminReasonQuery.safeParse({ reason });
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(() =>
    api.delete<AdminSessionEnded>(`/api/v1/admin/users/${userId}/sessions/${sessionId}`, {
      query: { reason: parsed.data.reason },
    }),
  );
}

/** The businesses matching what the admin typed, for the picker. */
export async function findBusinesses(q: string): Promise<AdminOrgListResponse["items"]> {
  if (q.trim().length < 2) return [];
  try {
    return (await businesses(q)).items;
  } catch {
    return [];
  }
}
