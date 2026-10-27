"use server";

/**
 * The landlord's lease writes (WP 2.4, 2.5): drafting, editing and cancelling a lease, signing it, the
 * tenant's invitation, starting the tenancy, and reminding the tenant of rent owed (rent is paid only
 * through the payment integration). Each checks its
 * input with the contracts schema the API checks with, runs in the business this request acts in, and
 * answers in words for a toast or under a field. Every rentals screen is refreshed after a change.
 */
import {
  CancelLeaseRequest,
  CreateLeaseRequest,
  EditLeaseRequest,
  type LeaseContractView,
  type LeaseDetail,
  type RemindersSent,
  RemindRentRequest,
  ResendInvitationRequest,
  type SigningCodeSent,
  SignLeaseRequest,
  type TenantList,
  type TenantView,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { type ActionResult, invalid, parse, runLandlord, UUID, visitor, ws } from "@/server/rentals/action-kit";

const NO_LEASE = "That lease was not found.";

async function changed<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function createLease(input: unknown): Promise<ActionResult<LeaseDetail>> {
  const parsed = parse(CreateLeaseRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(await runLandlord((s) => s.api.post<LeaseDetail>("/api/v1/ops/leases", parsed.data, ws(s))));
}

export async function editLease(id: string, input: unknown): Promise<ActionResult<LeaseDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_LEASE };
  const parsed = parse(EditLeaseRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord((s) => s.api.patch<LeaseDetail>(`/api/v1/ops/leases/${id}`, parsed.data, ws(s)), NO_LEASE),
  );
}

export async function cancelLease(id: string, reason: string): Promise<ActionResult<LeaseDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_LEASE };
  const parsed = parse(CancelLeaseRequest, { reason });
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord((s) => s.api.post<LeaseDetail>(`/api/v1/ops/leases/${id}/cancel`, parsed.data, ws(s)), NO_LEASE),
  );
}

/** Email the landlord a signing code. A second ask within a minute sends nothing new (`sent: false`). */
export async function requestLandlordSigningCode(id: string): Promise<ActionResult<SigningCodeSent>> {
  if (!UUID.test(id)) return { ok: false, error: NO_LEASE };
  return runLandlord((s) => s.api.post<SigningCodeSent>(`/api/v1/ops/leases/${id}/sign/code`, {}, ws(s)), NO_LEASE);
}

/** Sign the draft for the business: it goes out for signature and the tenant is invited by email. */
export async function signLeaseAsLandlord(id: string, input: unknown): Promise<ActionResult<LeaseDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_LEASE };
  const parsed = parse(SignLeaseRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const from = await visitor();
  return changed(
    await runLandlord(
      (s) => s.api.post<LeaseDetail>(`/api/v1/ops/leases/${id}/sign`, parsed.data, { ...ws(s), ...from }),
      NO_LEASE,
    ),
  );
}

/** The contract as it stands now, read again before signing (its hash is what a signature repeats). */
export async function reloadLeaseContract(id: string): Promise<ActionResult<LeaseContractView>> {
  if (!UUID.test(id)) return { ok: false, error: NO_LEASE };
  return runLandlord((s) => s.api.get<LeaseContractView>(`/api/v1/ops/leases/${id}/contract`, ws(s)), NO_LEASE);
}

/** Email the invitation again, or send it to a corrected address (which returns the lease to draft). */
export async function resendInvitation(id: string, input: unknown): Promise<ActionResult<LeaseDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_LEASE };
  const parsed = parse(ResendInvitationRequest, input ?? {});
  if (!parsed.ok) return invalid(parsed.error);
  return changed(
    await runLandlord(
      (s) => s.api.post<LeaseDetail>(`/api/v1/ops/leases/${id}/invitation/resend`, parsed.data, ws(s)),
      NO_LEASE,
    ),
  );
}

export async function startTenancy(id: string): Promise<ActionResult<LeaseDetail>> {
  if (!UUID.test(id)) return { ok: false, error: NO_LEASE };
  return changed(
    await runLandlord((s) => s.api.post<LeaseDetail>(`/api/v1/ops/leases/${id}/start`, {}, ws(s)), NO_LEASE),
  );
}

/** The business's tenants whose name or email matches, for the new lease form. */
export async function searchTenants(q: string): Promise<ActionResult<TenantView[]>> {
  const query = q.trim().slice(0, 120);
  return runLandlord(async (s) => {
    const list = await s.api.get<TenantList>("/api/v1/ops/tenants", { ...ws(s), query: { q: query || undefined } });
    return list.tenants;
  });
}

/** Remind the tenant of these open charges now, by email (one manual reminder per charge a day). */
export async function sendRentReminder(input: unknown): Promise<ActionResult<RemindersSent>> {
  const parsed = parse(RemindRentRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  return changed(await runLandlord((s) => s.api.post<RemindersSent>("/api/v1/ops/rent/reminders", parsed.data, ws(s))));
}
