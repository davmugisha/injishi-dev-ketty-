"use server";

/**
 * Admin's account writes (2026-10-29): create an account, set platform staff roles, add a person to a
 * business, change their role there, take them out, and end a government seat. Each goes through the admin
 * API, which holds it to the staff permission behind the emailed step-up and writes the audit row; the form is
 * checked with the same contracts schema first, and the answer comes back in words for a toast.
 */
import {
  AdminAddMemberRequest,
  AdminChangeMemberRoleRequest,
  AdminCreateUserRequest,
  type AdminCreateUserResponse,
  type AdminMemberChange,
  type AdminOrgListResponse,
  AdminReasonQuery,
  AdminSetStaffRolesRequest,
  type AdminStaffRolesResponse,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentApi } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";
import { businesses } from "@/server/admin/people";

export type PeopleActionResult<T> = { ok: true; value: T } | { ok: false; error: string };

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
      if (body?.code === "two_factor_required") return { ok: false, error: "Enter the code we emailed you first, then try again." };
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

export async function setStaffRoles(userId: string, input: unknown): Promise<PeopleActionResult<AdminStaffRolesResponse>> {
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
    api.delete<AdminMemberChange>(`/api/v1/admin/orgs/${orgId}/members/${userId}`, { query: { reason: parsed.data.reason } }),
  );
}

export async function endSeat(userId: string, assignmentId: string, reason: string): Promise<PeopleActionResult<null>> {
  if (!UUID.test(userId) || !UUID.test(assignmentId)) return { ok: false, error: "That appointment was not found." };
  const parsed = AdminReasonQuery.safeParse({ reason });
  if (!parsed.success) return invalid(parsed.error.issues);
  const api = await currentApi();
  return run(async () => {
    await api.delete<null>(`/api/v1/admin/users/${userId}/oversight/${assignmentId}`, { query: { reason: parsed.data.reason } });
    return null;
  });
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
