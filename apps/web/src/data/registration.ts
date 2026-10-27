import {
  type BusinessKind,
  BrokerRegistrationSummary,
  ClaimPreview,
  type CreateBrokerRegistrationRequest,
  type CreateRegistrationRequest,
  MyProfile,
  PsfTier,
  type RegistrantCapacity,
  type RegistrationDraft,
  RegistrationDraftRead,
  RegistrationDraftSaved,
  RegistrationFeeQuote,
  RegistrationSummary,
  TinCheckResult,
} from "@injishi/contracts";

import { apiFetch, apiFetchParsed, retryWhileFailed, type ApiResult } from "@/lib/api";

/**
 * The web client for business registration — `/api/v1/me/profile` and
 * `/api/v1/registrations/*` (F-S03 / FL01).
 *
 * Every response is parsed against the contract the API validated it with, so
 * the two ends refuse the same shape for the same reason. The wizard also
 * validates its INPUT against those contracts before sending, which is an
 * affordance and never the control: the server checks again, and the database
 * checks after that.
 */

/** The caller's own Step 1 answers, or an empty profile for a new account. */
export async function fetchMyProfile(): Promise<ApiResult<MyProfile>> {
  const res = await apiFetch<unknown>("/api/v1/me/profile");
  if (res.status !== "ok") return res;
  const parsed = MyProfile.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * What this kind of business pays to register right now (ADR-075 AC-13): read
 * from `registration_fees` by its kind, 50,000 RWF for every business PSF
 * reviews.
 *
 * Public on purpose: a price nobody can see before signing in is a price
 * nobody trusts, so this is asked before the wizard has an identity.
 */
export async function fetchRegistrationFee(kind: BusinessKind): Promise<ApiResult<RegistrationFeeQuote>> {
  const res = await apiFetch<unknown>(`/api/v1/registrations/fee?kind=${encodeURIComponent(kind)}`);
  if (res.status !== "ok") return res;
  const parsed = RegistrationFeeQuote.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * The figure the fee is shown as, and the order is the point. Once a
 * registration exists its invoice is the bill, so its amount wins (D8); before
 * that, the server's quote. The amount quoted, charged and stored is the same
 * number (AC-13), so there is no third source: web's own per kind price list
 * (`data/registration-fees.ts`, invented amounts up to 250,000) is deleted
 * (ADR-075 D-j).
 */
export function resolveRegistrationFee({
  summary,
  quote,
}: {
  summary: RegistrationSummary | null;
  quote: RegistrationFeeQuote | null;
}): number | null {
  // `amountDueRwf` is set only while the registration is `pending_payment`: a
  // resubmitted registration is past its bill and is never shown a second one.
  if (summary !== null && summary.amountDueRwf !== null) return summary.amountDueRwf;
  return quote?.amountRwf ?? null;
}

/**
 * Ask RRA about a TIN at the Business step, before anything is billed
 * (registration Phase 0). Writes nothing. The directors come back by name only
 * when the capacity is the helper's (ADR-075 AC-7); an owner learns listed or
 * not, once their ID is on file.
 */
export async function checkTin(tin: string, capacity?: RegistrantCapacity): Promise<ApiResult<TinCheckResult>> {
  const res = await apiFetch<unknown>("/api/v1/registrations/tin-check", {
    method: "POST",
    body: capacity ? { tin, capacity } : { tin },
  });
  if (res.status !== "ok") return res;
  const parsed = TinCheckResult.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * The wizard's answers kept on the server (ADR-060), the checks the server
 * wrote beside them (ADR-075 D-m), and when the answers were saved; nulls and
 * no checks when there are none. Asked again quietly when it could not be asked
 * at all, because a wizard that opened without it would save over it.
 */
export function fetchRegistrationDraft(): Promise<ApiResult<RegistrationDraftRead>> {
  return retryWhileFailed(() => apiFetchParsed(RegistrationDraftRead, "/api/v1/me/registration-draft"));
}

/**
 * Save the answers as they are typed (ADR-075 S9). A draft is never allowed to
 * hold an ID number: the contract refuses one (422), so the wizard never sends
 * one either.
 */
export function saveRegistrationDraft(draft: RegistrationDraft): Promise<ApiResult<RegistrationDraftSaved>> {
  return apiFetchParsed(RegistrationDraftSaved, "/api/v1/me/registration-draft", { method: "PUT", body: draft });
}

/** Forget the answers and their checks: a fresh registration beside one already made. */
export async function clearRegistrationDraft(): Promise<ApiResult<null>> {
  const res = await apiFetch<unknown>("/api/v1/me/registration-draft", { method: "DELETE" });
  return res.status === "ok" ? { status: "ok", data: null } : res;
}

/**
 * Create the registration at `pending_payment`, with its bill, at the first Pay
 * press (ADR-075 D-l). `idempotencyKey` is minted once for that press at the
 * call site, never inside a retry, so a double press or a retry answers the one
 * registration the press created (AC-14).
 */
export async function createRegistration(
  request: CreateRegistrationRequest,
  idempotencyKey: string,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall("/api/v1/registrations", "POST", request, idempotencyKey);
}

/**
 * Settle the registration fee, which is what enqueues the RRA check.
 *
 * Stands in for the payment provider callback until F-S08 lands a real one, so
 * this is the whole "pay" step today. It is idempotent server-side: pressing it
 * twice advances nothing twice and bills nothing twice. It needs no accepted
 * contract any more (ADR-075 AC-12).
 */
export async function payRegistrationFee(
  orgId: string,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall(`/api/v1/registrations/${orgId}/pay`, "POST");
}

/** Where this registration got to — what the pending workspace renders. */
export async function fetchRegistration(
  orgId: string,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall(`/api/v1/registrations/${orgId}`, "GET");
}

/**
 * Correct a rejection and go round again.
 *
 * Lands on `submitted`, never back on `pending_payment`: the fee is charged once
 * per org ever and is non-refundable (D23), so a corrected registration must
 * never be shown a second bill.
 */
export async function resubmitRegistration(
  orgId: string,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall(`/api/v1/registrations/${orgId}/resubmit`, "POST");
}

/**
 * What `/claim-org` shows before the owner commits (FL02, ADR-053, AC-R3).
 *
 * A POST with the token in the body, so the token never lands in the API's
 * access log. Any token that is not live for this org is a 404, worded the same
 * whatever the reason.
 */
export async function previewOrgClaim(
  orgId: string,
  token: string,
): Promise<ApiResult<ClaimPreview>> {
  const res = await apiFetch<unknown>(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/claim/preview`,
    { method: "POST", body: { token } },
  );
  if (res.status !== "ok") return res;
  const parsed = ClaimPreview.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * Claim the business (AC-R1, AC-R11). The same 404 as the preview for every
 * refusal, a document that does not match included.
 */
export async function claimOrg(
  orgId: string,
  token: string,
): Promise<ApiResult<RegistrationSummary>> {
  return summaryCall(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/claim`,
    "POST",
    { token },
  );
}

async function summaryCall(
  path: string,
  method: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<ApiResult<RegistrationSummary>> {
  const res = await apiFetch<unknown>(path, { method, body, ...(idempotencyKey ? { idempotencyKey } : {}) });
  if (res.status !== "ok") return res;
  const parsed = RegistrationSummary.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * Register the caller as a broker (F-R09, ADR-026 assumption 2).
 *
 * Its own function rather than a branch of `createRegistration`, because it
 * returns a different thing. A broker has no org, no invoice and no
 * registration status, so `RegistrationSummary` could only describe one by
 * nulling six fields and showing a status it can never hold.
 *
 * There is no pay companion. Broker registration is free and instant while
 * ADR-026 assumption 2 stands.
 */
export async function registerAsBroker(
  request: CreateBrokerRegistrationRequest,
): Promise<ApiResult<BrokerRegistrationSummary>> {
  const res = await apiFetch<unknown>("/api/v1/registrations/broker", {
    method: "POST",
    body: request,
  });
  if (res.status !== "ok") return res;
  const parsed = BrokerRegistrationSummary.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * The PSF membership tiers the wizard's PSF step offers (ADR-056 AC-2). Checked
 * against the contract so a drifted catalogue reads as unreachable, never as
 * a tier with a blank price.
 */
export async function fetchPsfTiers(): Promise<ApiResult<PsfTier[]>> {
  const res = await apiFetch<unknown>("/api/v1/psf/tiers");
  if (res.status !== "ok") return res;
  const parsed = PsfTier.array().safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}
