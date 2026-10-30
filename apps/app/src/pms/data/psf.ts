/**
 * PSF membership (ADR-056, widened by the PSF path): the business's own portal
 * and the PSF membership officer's console read and write through here.
 *
 * NOT through `command()`: these routes are guarded by the session and the
 * applicant rule (or the officer's posting), never by `WorkspaceGuard`, so they
 * name no workspace. A business still in the registration pipeline holds no
 * permission, and its PSF page must work there.
 */
import type {
  CreatePsfApplicationRequest,
  PayPsfMembershipRequest,
  PsfApproveRequest,
  PsfBranchDecisionRequest,
  PsfBusinessesPage,
  PsfBusinessesQuery,
  PsfCatalogue,
  PsfDeclineRequest,
  PsfMembershipOverview,
  PsfOfficerApplication,
  PsfQueuePage,
  PsfRegisterSummary,
  PsfTier,
} from "@injishi/contracts";

import { API_BASE, ApiError, REQUEST_TIMEOUT_MS, getJson, humanMessage, readRefusal, type ReadResult } from "./api";

async function send<T>(path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      method: "POST",
      credentials: "include",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw await readRefusal(res);
    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // We never heard back, which is not a refusal: the write may have landed.
    throw new ApiError(0, humanMessage(0, null));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Was this refusal a mobile money prompt still waiting on the person's phone?
 * Not a failure: the payment is in flight, and pressing again asks again.
 */
export function isPaymentPending(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  const body = error.body as { code?: unknown; message?: { code?: unknown } } | null;
  return body?.code === "payment_pending" || body?.message?.code === "payment_pending";
}

/** A refusal's field, when the server named one: `declaredFeeRwf`, `feeRwf`. */
export function refusalField(error: unknown): { path: string; message: string } | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body as { issues?: { path?: (string | number)[]; message?: string }[] } | null;
  const issue = body?.issues?.[0];
  return issue?.path && issue.message ? { path: issue.path.join("."), message: issue.message } : null;
}

// --- PSF's price list and sectors (public) ------------------------------------

export function fetchPsfTiers(): Promise<ReadResult<PsfTier[]>> {
  return getJson<PsfTier[]>("/psf/tiers");
}

export function fetchPsfCatalogue(): Promise<ReadResult<PsfCatalogue>> {
  return getJson<PsfCatalogue>("/psf/catalogue");
}

// --- The business ------------------------------------------------------------

export function fetchPsfMembership(orgId: string): Promise<ReadResult<PsfMembershipOverview>> {
  return getJson<PsfMembershipOverview>(`/orgs/${orgId}/psf-membership`);
}

export function applyForPsf(orgId: string, body: CreatePsfApplicationRequest): Promise<PsfMembershipOverview> {
  return send<PsfMembershipOverview>(`/orgs/${orgId}/psf-applications`, body);
}

export function withdrawPsfApplication(orgId: string, applicationId: string): Promise<PsfMembershipOverview> {
  return send<PsfMembershipOverview>(`/orgs/${orgId}/psf-applications/${applicationId}/withdraw`);
}

/** Pay an approved application's fee by mobile money. Idempotent on the application. */
export function payPsfMembership(
  orgId: string,
  applicationId: string,
  body: PayPsfMembershipRequest,
): Promise<PsfMembershipOverview> {
  return send<PsfMembershipOverview>(`/orgs/${orgId}/psf-applications/${applicationId}/pay`, body);
}

// --- The PSF membership officer ------------------------------------------------

export function fetchPsfQueue(cursor?: string | null): Promise<ReadResult<PsfQueuePage>> {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return getJson<PsfQueuePage>(`/oversight/psf-applications${q}`);
}

export function fetchPsfApplication(applicationId: string): Promise<ReadResult<PsfOfficerApplication>> {
  return getJson<PsfOfficerApplication>(`/oversight/psf-applications/${applicationId}`);
}

export function approvePsfApplication(applicationId: string, body: PsfApproveRequest): Promise<PsfOfficerApplication> {
  return send<PsfOfficerApplication>(`/oversight/psf-applications/${applicationId}/approve`, body);
}

export function declinePsfApplication(applicationId: string, body: PsfDeclineRequest): Promise<PsfOfficerApplication> {
  return send<PsfOfficerApplication>(`/oversight/psf-applications/${applicationId}/decline`, body);
}

/** Admit or decline one branch, as the officer of the branch's district (2026-10-23). */
export function decidePsfBranch(applicationId: string, branchId: string, body: PsfBranchDecisionRequest): Promise<PsfOfficerApplication> {
  return send<PsfOfficerApplication>(`/oversight/psf-applications/${applicationId}/branches/${branchId}/decision`, body);
}

/** The officer's register: every filter optional, in the query string. */
export function fetchPsfBusinesses(query: PsfBusinessesQuery): Promise<ReadResult<PsfBusinessesPage>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const q = params.toString();
  return getJson<PsfBusinessesPage>(`/oversight/psf/businesses${q ? `?${q}` : ""}`);
}

export function fetchPsfRegisterSummary(): Promise<ReadResult<PsfRegisterSummary>> {
  return getJson<PsfRegisterSummary>("/oversight/psf/summary");
}
