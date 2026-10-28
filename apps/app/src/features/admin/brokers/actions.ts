"use server";

/**
 * Admin's one write for broker plans: a new monthly price with a reason. The API holds it to
 * `admin.fee.edit` behind the staff step-up, keeps District free, and writes the audit row; this checks
 * the form with the same contracts schema first and answers in words.
 */
import { AdminBrokerPlanUpdate, type BrokerPlan, BrokerPlanCode } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentApi } from "@/lib/session";
import { ApiError, ApiUnreachableError } from "@/server/api";

export type PlanPriceResult =
  | { ok: true; value: BrokerPlan }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function setBrokerPlanPrice(code: string, input: unknown): Promise<PlanPriceResult> {
  const plan = BrokerPlanCode.safeParse(code);
  if (!plan.success) return { ok: false, error: "No broker plan has that code." };
  const parsed = AdminBrokerPlanUpdate.safeParse(input);
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
    const value = await api.patch<BrokerPlan>(`/api/v1/admin/brokers/plans/${plan.data}`, parsed.data);
    revalidatePath("/admin/brokers/plans");
    return { ok: true, value };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.unauthenticated) redirect("/sign-in?next=/admin/brokers/plans");
      const body = error.body as { code?: string; message?: string } | null;
      if (body?.code === "two_factor_required") {
        return { ok: false, error: "Enter the code we emailed you first, then try again." };
      }
      if (error.forbidden) return { ok: false, error: "Your staff role cannot change plan prices." };
      return { ok: false, error: error.message || "That did not work. Try again." };
    }
    if (error instanceof ApiUnreachableError) return { ok: false, error: "Injishi could not be reached. Try again." };
    throw error;
  }
}
