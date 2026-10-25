"use server";

/**
 * Expense writes (P4) that carry no file: voiding one with its reason. Writing one down and attaching a
 * receipt go through the form route (`/api/rentals/forms/expenses`), since they carry the receipt.
 */
import { type ExpenseView, VoidExpenseRequest } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { type ActionResult, invalid, parse, runLandlord, UUID, ws } from "@/server/rentals/action-kit";

export async function voidExpense(id: string, reason: string): Promise<ActionResult<ExpenseView>> {
  if (!UUID.test(id)) return { ok: false, error: "That expense was not found." };
  const parsed = parse(VoidExpenseRequest, { reason });
  if (!parsed.ok) return invalid(parsed.error);
  const result = await runLandlord(
    (s) => s.api.post<ExpenseView>(`/api/v1/ops/expenses/${id}/void`, parsed.data, ws(s)),
    "That expense was not found.",
  );
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
