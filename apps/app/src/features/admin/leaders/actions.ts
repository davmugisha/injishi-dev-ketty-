"use server";

/**
 * Admin's writes for local leaders and officers (P5): appoint a person by email to a role and an area,
 * and end an appointment with a reason. Both go through the admin API, which holds them to
 * `admin.user.role.grant` behind the staff step-up and writes the audit row; this checks the form with
 * the same contracts schema first, and answers in words for a toast or under a field.
 */
import { AppointOfficerRequest, EndAppointmentQuery, type OversightAppointment } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentApi } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";

export type AdminActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string>; stepUp?: true };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fieldErrorsOf(
  issues: readonly { path: readonly (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.join(".") || "_";
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

async function run<T>(write: () => Promise<T>): Promise<AdminActionResult<T>> {
  try {
    const value = await write();
    revalidatePath("/admin/leaders", "layout");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.unauthenticated) redirect("/sign-in?next=/admin/leaders");
      const body = error.body as { issues?: { path: (string | number)[]; message: string }[]; code?: string } | null;
      if (body?.code === "two_factor_required") {
        return { ok: false, error: "Enter the code we emailed you first, then try again." };
      }
      // Appointing gives authority: a step-up older than ten minutes is asked for again (2026-11-02).
      if (body?.code === "step_up_stale")
        return { ok: false, error: "Confirm it is you with a new code.", stepUp: true };
      if (error.forbidden) return { ok: false, error: "Your staff role cannot appoint or end appointments." };
      if (Array.isArray(body?.issues) && body.issues.length > 0) {
        const fieldErrors = fieldErrorsOf(body.issues);
        return { ok: false, error: body.issues[0]?.message ?? "Check the highlighted fields.", fieldErrors };
      }
      return { ok: false, error: error.message || "That did not work. Try again." };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "Injishi could not be reached. Try again." };
    throw error;
  }
}

export async function appointOfficer(input: unknown): Promise<AdminActionResult<OversightAppointment>> {
  const parsed = AppointOfficerRequest.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = fieldErrorsOf(parsed.error.issues);
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  const api = await currentApi();
  return run(() => api.post<OversightAppointment>("/api/v1/admin/local-leaders", parsed.data));
}

export async function endAppointment(id: string, reason: string): Promise<AdminActionResult<null>> {
  if (!UUID.test(id)) return { ok: false, error: "That appointment was not found." };
  const parsed = EndAppointmentQuery.safeParse({ reason });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Say why, in a few words.";
    return { ok: false, error: message, fieldErrors: { reason: message } };
  }
  const api = await currentApi();
  return run(async () => {
    await api.delete<null>(`/api/v1/admin/local-leaders/${id}`, { query: { reason: parsed.data.reason } });
    return null;
  });
}
