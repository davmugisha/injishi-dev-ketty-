"use server";

/**
 * Moving out writes (WP 1.7). The landlord's run in the business this request acts in: record a notice
 * that came outside Injishi, acknowledge one, record the move out, settle the deposit (one
 * Idempotency-Key per form, so a second press is the same settlement) and look at a refund waiting on
 * the phone. The tenant's run as the signed-in person: give notice, withdraw it, dispute a settlement.
 */
import {
  type DepositView,
  DisputeDepositRequest,
  type LeaseDetail,
  RecordedNoticeRequest,
  RecordMoveOutRequest,
  SettleDepositRequest,
  type TenancyMoveOut,
  TenantNoticeRequest,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { currentApi } from "@/lib/session";
import { type ActionResult, invalid, parse, runLandlord, runPerson, UUID, ws } from "@/server/rentals/action-kit";

const NO_LEASE = "That lease was not found.";
const NO_DEPOSIT = "That deposit was not found.";

async function changed<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function recordNotice(leaseId: string, input: unknown): Promise<ActionResult<LeaseDetail>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const parsed = parse(RecordedNoticeRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord(
      (s) => s.api.post<LeaseDetail>(`/api/v1/ops/leases/${leaseId}/notice`, parsed.data, ws(s)),
      NO_LEASE,
    ),
  );
}

export async function acknowledgeNotice(leaseId: string): Promise<ActionResult<LeaseDetail>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  return changed(
    await runLandlord(
      (s) => s.api.post<LeaseDetail>(`/api/v1/ops/leases/${leaseId}/notice/acknowledge`, {}, ws(s)),
      NO_LEASE,
    ),
  );
}

export async function recordMoveOut(leaseId: string, input: unknown): Promise<ActionResult<LeaseDetail>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const parsed = parse(RecordMoveOutRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord(
      (s) => s.api.post<LeaseDetail>(`/api/v1/ops/leases/${leaseId}/move-out`, parsed.data, ws(s)),
      NO_LEASE,
    ),
  );
}

/** One deposit; a refund on the landlord's phone is asked about first. */
export async function loadDeposit(id: string): Promise<ActionResult<DepositView>> {
  if (!UUID.test(id)) return { ok: false, error: NO_DEPOSIT };
  return runLandlord((s) => s.api.get<DepositView>(`/api/v1/ops/deposits/${id}`, ws(s)), NO_DEPOSIT);
}

export async function settleDeposit(id: string, key: string, input: unknown): Promise<ActionResult<DepositView>> {
  if (!UUID.test(id)) return { ok: false, error: NO_DEPOSIT };
  if (!UUID.test(key)) return { ok: false, error: "Open the form again and retry." };
  const parsed = parse(SettleDepositRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord(
      (s) =>
        s.api.post<DepositView>(`/api/v1/ops/deposits/${id}/settle`, parsed.data, { ...ws(s), idempotencyKey: key }),
      NO_DEPOSIT,
    ),
  );
}

// --- The tenant's side --------------------------------------------------------------------------

export async function giveNotice(leaseId: string, input: unknown): Promise<ActionResult<TenancyMoveOut>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const parsed = parse(TenantNoticeRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(
    await runPerson(() => api.post<TenancyMoveOut>(`/api/v1/me/tenancies/${leaseId}/notice`, parsed.data), NO_LEASE),
  );
}

export async function withdrawNotice(leaseId: string): Promise<ActionResult<TenancyMoveOut>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const api = await currentApi();
  return changed(
    await runPerson(() => api.post<TenancyMoveOut>(`/api/v1/me/tenancies/${leaseId}/notice/withdraw`, {}), NO_LEASE),
  );
}

export async function disputeDeposit(leaseId: string, input: unknown): Promise<ActionResult<TenancyMoveOut>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const parsed = parse(DisputeDepositRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(
    await runPerson(
      () => api.post<TenancyMoveOut>(`/api/v1/me/tenancies/${leaseId}/deposit/dispute`, parsed.data),
      NO_LEASE,
    ),
  );
}
