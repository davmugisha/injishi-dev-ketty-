"use server";

/**
 * Tax writes (P4) that carry no file: whether the business lets as a person or a company. Marking a
 * declaration and a lease filed with RRA go through the form route, since they carry RRA's receipt.
 */
import { SetTaxpayerRequest, type TaxpayerView } from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { type ActionResult, invalid, parse, runLandlord, ws } from "@/server/rentals/action-kit";

export async function setTaxpayer(kind: string): Promise<ActionResult<TaxpayerView>> {
  const parsed = parse(SetTaxpayerRequest, { kind });
  if (!parsed.ok) return invalid(parsed.error);
  const result = await runLandlord((s) => s.api.put<TaxpayerView>("/api/v1/ops/taxes/taxpayer", parsed.data, ws(s)));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
