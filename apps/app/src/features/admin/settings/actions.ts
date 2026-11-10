"use server";

/**
 * Admin's one settings write here (2026-11-09): a new registration fee for a kind of business, with a reason.
 * The API appends it (the old one stays in the history), holds it to `admin.fee.edit` and writes the audit row.
 */
import { type AdminRegistrationFee, AppendRegistrationFeeRequest } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentApi } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";

export type FeeResult =
  | { ok: true; value: AdminRegistrationFee }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function setRegistrationFee(input: unknown): Promise<FeeResult> {
  const parsed = AppendRegistrationFeeRequest.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const key = String(i.path[0] ?? "_");
      if (!fieldErrors[key]) fieldErrors[key] = i.message;
    }
    return { ok: false, error: "Check the highlighted fields.", fieldErrors };
  }
  try {
    const api = await currentApi();
    const value = await api.post<AdminRegistrationFee>("/api/v1/admin/configuration/fees", parsed.data);
    revalidatePath("/admin/rules");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.unauthenticated) redirect("/sign-in?next=/admin/rules");
      const body = error.body as { code?: string } | null;
      if (body?.code === "two_factor_required") {
        return { ok: false, error: "Enter the code we emailed you first, then try again." };
      }
      if (error.forbidden) return { ok: false, error: "Your staff role cannot change fees." };
      return { ok: false, error: error.message || "That did not work. Try again." };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "Injishi could not be reached. Try again." };
    throw error;
  }
}
