"use server";

/**
 * The tenant's writes (P3.1-3.3): accepting a lease sent to their email, signing it, and paying rent by
 * mobile money (each press mints its own Idempotency-Key, and the payment is polled until the phone
 * answers). Every call is as the signed-in person: the API answers 404 for a lease that is not theirs.
 */
import {
  AcceptLeaseInvitationRequest,
  type LeaseContractView,
  type SigningCodeSent,
  SignLeaseRequest,
  type TenancyDetail,
  type TenantPaymentView,
  TenantPayRequest,
} from "@injishi/contracts";
import { revalidatePath } from "next/cache";
import { currentApi } from "@/lib/session";
import {
  type ActionResult,
  idempotencyKey,
  invalid,
  parse,
  runPerson,
  UUID,
  visitor,
} from "@/server/rentals/action-kit";

const NO_LEASE = "That lease was not found.";
const NO_INVITATION = "This invitation link isn't valid. Open it from your email again.";

async function changed<T>(result: ActionResult<T>): Promise<ActionResult<T>> {
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Take a lease offered to the signed-in email, from the link (`token`) or the list (`invitationId`). */
export async function acceptInvitation(input: {
  token?: string;
  invitationId?: string;
}): Promise<ActionResult<TenancyDetail>> {
  const parsed = parse(AcceptLeaseInvitationRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(
    await runPerson(() => api.post<TenancyDetail>("/api/v1/me/lease-invitations/accept", parsed.data), NO_INVITATION),
  );
}

/** Email the tenant a signing code. A second ask within a minute sends nothing new (`sent: false`). */
export async function requestTenantSigningCode(leaseId: string): Promise<ActionResult<SigningCodeSent>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const api = await currentApi();
  return runPerson(() => api.post<SigningCodeSent>(`/api/v1/me/tenancies/${leaseId}/sign/code`, {}), NO_LEASE);
}

/** Sign the lease the landlord signed: it is signed by both, and the deposit is asked for. */
export async function signLeaseAsTenant(leaseId: string, input: unknown): Promise<ActionResult<TenancyDetail>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const parsed = parse(SignLeaseRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const [api, from] = await Promise.all([currentApi(), visitor()]);
  return changed(
    await runPerson(() => api.post<TenancyDetail>(`/api/v1/me/tenancies/${leaseId}/sign`, parsed.data, from), NO_LEASE),
  );
}

/** The contract as it stands now, read again before signing. */
export async function reloadTenancyContract(leaseId: string): Promise<ActionResult<LeaseContractView>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const api = await currentApi();
  return runPerson(() => api.get<LeaseContractView>(`/api/v1/me/tenancies/${leaseId}/contract`), NO_LEASE);
}

/** Pay by MTN MoMo or Airtel Money: a prompt goes to the phone; the answer is the payment to poll. */
export async function payRent(leaseId: string, input: unknown): Promise<ActionResult<TenantPaymentView>> {
  if (!UUID.test(leaseId)) return { ok: false, error: NO_LEASE };
  const parsed = parse(TenantPayRequest, input);
  if (!parsed.ok) return invalid(parsed.error);
  const api = await currentApi();
  return changed(
    await runPerson(
      () =>
        api.post<TenantPaymentView>(`/api/v1/me/tenancies/${leaseId}/payments`, parsed.data, {
          idempotencyKey: idempotencyKey(),
        }),
      NO_LEASE,
    ),
  );
}

/** Where one payment stands; the screens are refreshed once it is no longer waiting. */
export async function pollPayment(leaseId: string, paymentId: string): Promise<ActionResult<TenantPaymentView>> {
  if (!UUID.test(leaseId) || !UUID.test(paymentId)) return { ok: false, error: "That payment was not found." };
  const api = await currentApi();
  const result = await runPerson(
    () => api.get<TenantPaymentView>(`/api/v1/me/tenancies/${leaseId}/payments/${paymentId}`),
    "That payment was not found.",
  );
  if (result.ok && result.value.status !== "pending") revalidatePath("/", "layout");
  return result;
}
