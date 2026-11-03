"use server";

/**
 * Admin's writes for staff roles (2026-11-02): make a custom role, change it, archive it, and read who holds
 * one. Each goes through the admin API, which holds the writes to `admin.user.role.grant` (super admins only)
 * behind a step-up under ten minutes old, refuses reserved permissions and any the staffer does not hold,
 * and writes the audit row. The form is checked with the same contracts schema first.
 */
import {
  AdminCreateCustomRoleRequest,
  type AdminCustomRoleChange,
  AdminReasonQuery,
  type AdminRoleHolders,
  AdminUpdateCustomRoleRequest,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentApi } from "@/lib/session";
import { roleHolders } from "@/server/admin/people";
import { ApiError, ApiUnreachableError } from "@/server/api";

export type RoleActionResult<T> = { ok: true; value: T } | { ok: false; error: string; stepUp?: true };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function run<T>(write: () => Promise<T>): Promise<RoleActionResult<T>> {
  try {
    const value = await write();
    revalidatePath("/admin/roles");
    revalidatePath("/admin/people", "layout");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.unauthenticated) redirect("/sign-in?next=/admin/roles");
      const body = error.body as { issues?: { message: string }[]; code?: string; message?: string } | null;
      if (body?.code === "two_factor_required")
        return { ok: false, error: "Enter the code we emailed you first, then try again." };
      if (body?.code === "step_up_stale")
        return { ok: false, error: "Confirm it is you with a new code.", stepUp: true };
      if (Array.isArray(body?.issues) && body.issues[0]) return { ok: false, error: body.issues[0].message };
      if (body?.code && typeof body.message === "string") return { ok: false, error: body.message };
      if (error.forbidden) return { ok: false, error: "Only a super admin can change roles." };
      return { ok: false, error: error.message || "That did not work. Try again." };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "Injishi could not be reached. Try again." };
    throw error;
  }
}

export async function createRole(input: unknown): Promise<RoleActionResult<AdminCustomRoleChange>> {
  const parsed = AdminCreateCustomRoleRequest.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const api = await currentApi();
  return run(() => api.post<AdminCustomRoleChange>("/api/v1/admin/staff-roles", parsed.data));
}

export async function updateRole(roleId: string, input: unknown): Promise<RoleActionResult<AdminCustomRoleChange>> {
  if (!UUID.test(roleId)) return { ok: false, error: "That role was not found." };
  const parsed = AdminUpdateCustomRoleRequest.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  const api = await currentApi();
  return run(() => api.put<AdminCustomRoleChange>(`/api/v1/admin/staff-roles/${roleId}`, parsed.data));
}

export async function archiveRole(roleId: string, reason: string): Promise<RoleActionResult<AdminCustomRoleChange>> {
  if (!UUID.test(roleId)) return { ok: false, error: "That role was not found." };
  const parsed = AdminReasonQuery.safeParse({ reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Say why, in a few words." };
  const api = await currentApi();
  return run(() =>
    api.delete<AdminCustomRoleChange>(`/api/v1/admin/staff-roles/${roleId}`, { query: { reason: parsed.data.reason } }),
  );
}

/** Who holds a role, for its panel. Empty when it cannot be read. */
export async function loadHolders(role: string): Promise<AdminRoleHolders["items"]> {
  if (!/^[a-z_]+$/.test(role) && !UUID.test(role)) return [];
  try {
    return (await roleHolders(role)).items;
  } catch {
    return [];
  }
}
