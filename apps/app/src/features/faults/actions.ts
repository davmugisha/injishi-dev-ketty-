"use server";

/**
 * Fault writes (P4) for both sides. The landlord's run in the business this request acts in: raise one,
 * move it along its chain, hand it over, reply, and pay the fixer through Injishi (one Idempotency-Key per
 * form, so a second press is the same payment). The tenant's are as the signed-in person on their own
 * lease: report, reply and reopen. Photos and receipts go through the form routes (`send-form.ts`).
 */
import {
  AssignFaultRequest,
  type FaultDetail,
  FaultMessageRequest,
  MoveFaultRequest,
  PayFixerRequest,
  RaiseFaultRequest,
  ReopenFaultRequest,
  ReportFaultRequest,
  type TenantFaultDetail,
  TenantFaultMessageRequest,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { currentApi } from "@/lib/session";
import { type ActionResult, invalid, parse, runLandlord, runPerson, UUID, ws } from "@/server/rentals/action-kit";

const NO_FAULT = "That fault was not found.";

async function changed<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

// --- The landlord's side --------------------------------------------------------------------------

/** One fault in full, when its panel opens or while a payment settles. */
export async function loadFault(id: string): Promise<ActionResult<FaultDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_FAULT };
  return runLandlord((s) => s.api.get<FaultDetail>(`/api/v1/ops/faults/${id}`, ws(s)), NO_FAULT);
}

/** Write down a fault on a unit (photos follow through the form route once it is saved). */
export async function raiseFault(input: unknown): Promise<ActionResult<FaultDetail>> {
  const parsed = parse(RaiseFaultRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(await runLandlord((s) => s.api.post<FaultDetail>("/api/v1/ops/faults", parsed.data, ws(s))));
}

export async function moveFault(id: string, input: unknown): Promise<ActionResult<FaultDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_FAULT };
  const parsed = parse(MoveFaultRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord((s) => s.api.post<FaultDetail>(`/api/v1/ops/faults/${id}/move`, parsed.data, ws(s)), NO_FAULT),
  );
}

export async function assignFault(id: string, input: unknown): Promise<ActionResult<FaultDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_FAULT };
  const parsed = parse(AssignFaultRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord((s) => s.api.post<FaultDetail>(`/api/v1/ops/faults/${id}/assign`, parsed.data, ws(s)), NO_FAULT),
  );
}

export async function replyOnFault(id: string, input: unknown): Promise<ActionResult<FaultDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_FAULT };
  const parsed = parse(FaultMessageRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord(
      (s) => s.api.post<FaultDetail>(`/api/v1/ops/faults/${id}/messages`, parsed.data, ws(s)),
      NO_FAULT,
    ),
  );
}

/** Pay the fixer through Injishi: a prompt goes to the landlord's phone; the answer shows it waiting. */
export async function payFixer(id: string, key: string, input: unknown): Promise<ActionResult<FaultDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_FAULT };
  if (!UUID.test(key)) return { ok: false, error: "Open the form again and retry." };
  const parsed = parse(PayFixerRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord(
      (s) => s.api.post<FaultDetail>(`/api/v1/ops/faults/${id}/pay`, parsed.data, { ...ws(s), idempotencyKey: key }),
      NO_FAULT,
    ),
  );
}

// --- The tenant's side ------------------------------------------------------------------------------

export async function loadTenantFault(leaseId: string, id: string): Promise<ActionResult<TenantFaultDetail>> {
  if (!UUID.test(leaseId) || !UUID.test(id)) return { ok: false, error: NO_FAULT };
  const api = await currentApi();
  return runPerson(() => api.get<TenantFaultDetail>(`/api/v1/me/tenancies/${leaseId}/faults/${id}`), NO_FAULT);
}

/** Report a fault on the tenant's home (photos follow through the form route once it is saved). */
export async function reportFault(leaseId: string, input: unknown): Promise<ActionResult<TenantFaultDetail>> {
  if (!UUID.test(leaseId)) return { ok: false, error: "That lease was not found." };
  const parsed = parse(ReportFaultRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(
    await runPerson(() => api.post<TenantFaultDetail>(`/api/v1/me/tenancies/${leaseId}/faults`, parsed.data)),
  );
}

export async function reopenFault(
  leaseId: string,
  id: string,
  input: unknown,
): Promise<ActionResult<TenantFaultDetail>> {
  if (!UUID.test(leaseId) || !UUID.test(id)) return { ok: false, error: NO_FAULT };
  const parsed = parse(ReopenFaultRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(
    await runPerson(
      () => api.post<TenantFaultDetail>(`/api/v1/me/tenancies/${leaseId}/faults/${id}/reopen`, parsed.data),
      NO_FAULT,
    ),
  );
}

export async function tenantReplyOnFault(
  leaseId: string,
  id: string,
  input: unknown,
): Promise<ActionResult<TenantFaultDetail>> {
  if (!UUID.test(leaseId) || !UUID.test(id)) return { ok: false, error: NO_FAULT };
  const parsed = parse(TenantFaultMessageRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(
    await runPerson(
      () => api.post<TenantFaultDetail>(`/api/v1/me/tenancies/${leaseId}/faults/${id}/messages`, parsed.data),
      NO_FAULT,
    ),
  );
}
