import {
  PSF_CHECK_TOKEN_HEADER,
  PsfCardUploadResult,
  PsfClaimCardView,
  PsfLogoUploadResult,
  PsfMemberLookupConfirmed,
  PsfMemberLookupResult,
  PsfCatalogue,
  PsfIdentityLookupResult,
  PsfPublicSubmitResult,
  PsfQuote,
  PsfFeesView,
  PsfTier,
  PsfTrackPayResult,
  PsfTrackView,
  PsfVerifiedApplicant,
  type PsfIdentityConfirmRequest,
  type PsfIdentityLookupRequest,
  type PsfPublicSubmitRequest,
  type PsfRenewRequest,
  type PsfResendRequest,
  PsfFormConfig,
} from "@injishi/contracts";
import { API_URL, apiFetchParsed, type ApiResult } from "@/lib/api";

/**
 * PSF, from the API's public routes.
 *
 * The price list and sectors (the PSF page and the form read them), and THE
 * PUBLIC PSF PATH (2026-10-19): a business registers with no account, keeps a
 * docID, and follows its application by it. None of these needs a session.
 */

export function fetchPsfTiers(): Promise<ApiResult<PsfTier[]>> {
  return apiFetchParsed(PsfTier.array(), "/api/v1/psf/tiers");
}

/** What each band costs in a district: PSF sets it, the form only shows it. */
export function fetchPsfFees(districtId: number): Promise<ApiResult<PsfFeesView>> {
  return apiFetchParsed(PsfFeesView, `/api/v1/psf/fees?district=${districtId}`);
}

/** With a district, the catalogue adds that district's own subtypes to the national ones. */
export function fetchPsfCatalogue(districtId?: number): Promise<ApiResult<PsfCatalogue>> {
  return apiFetchParsed(PsfCatalogue, `/api/v1/psf/catalogue${districtId ? `?district=${districtId}` : ""}`);
}

export function lookupPsfIdentity(body: PsfIdentityLookupRequest): Promise<ApiResult<PsfIdentityLookupResult>> {
  return apiFetchParsed(PsfIdentityLookupResult, "/api/v1/psf/identity/lookup", { method: "POST", body });
}

export function confirmPsfIdentity(body: PsfIdentityConfirmRequest): Promise<ApiResult<PsfVerifiedApplicant>> {
  return apiFetchParsed(PsfVerifiedApplicant, "/api/v1/psf/identity/confirm", { method: "POST", body });
}

/** The whole form, and the RWF 5,000. A slow mobile money prompt gets a longer ceiling. */
export function submitPsfApplication(body: PsfPublicSubmitRequest): Promise<ApiResult<PsfPublicSubmitResult>> {
  return apiFetchParsed(PsfPublicSubmitResult, "/api/v1/psf/applications", { method: "POST", body, timeoutMs: 30_000 });
}

export function fetchPsfTrack(docId: string): Promise<ApiResult<PsfTrackView>> {
  return apiFetchParsed(PsfTrackView, `/api/v1/psf/track/${encodeURIComponent(docId)}`);
}

export function payPsfRegistration(docId: string, phoneE164: string): Promise<ApiResult<PsfTrackPayResult>> {
  return apiFetchParsed(PsfTrackPayResult, `/api/v1/psf/track/${encodeURIComponent(docId)}/pay-registration`, {
    method: "POST",
    body: { phoneE164 },
    timeoutMs: 30_000,
  });
}

export function payPsfMembership(docId: string, phoneE164: string): Promise<ApiResult<PsfTrackPayResult>> {
  return apiFetchParsed(PsfTrackPayResult, `/api/v1/psf/track/${encodeURIComponent(docId)}/pay`, {
    method: "POST",
    body: { phoneE164 },
    timeoutMs: 30_000,
  });
}

/** Tracking by membership number (2026-11-02): a code goes to the phone on file. */
export function lookupPsfMember(membershipNumber: string): Promise<ApiResult<PsfMemberLookupResult>> {
  return apiFetchParsed(PsfMemberLookupResult, "/api/v1/psf/member-lookup", { method: "POST", body: { membershipNumber } });
}

/** The code read back answers the docID, which opens the tracking page. */
export function confirmPsfMember(lookupToken: string, code: string): Promise<ApiResult<PsfMemberLookupConfirmed>> {
  return apiFetchParsed(PsfMemberLookupConfirmed, "/api/v1/psf/member-lookup/confirm", { method: "POST", body: { lookupToken, code } });
}

/** Renew a membership (2026-11-02): the band, the amount within it, and the phone to prompt. */
export function renewPsfMembership(docId: string, body: PsfRenewRequest): Promise<ApiResult<PsfTrackPayResult>> {
  return apiFetchParsed(PsfTrackPayResult, `/api/v1/psf/track/${encodeURIComponent(docId)}/renew`, {
    method: "POST",
    body,
    timeoutMs: 30_000,
  });
}

/** The member's certificate as a PDF: a plain link, so the browser downloads it. */
export function psfCertificateUrl(docId: string): string {
  return `${API_URL}/api/v1/psf/track/${encodeURIComponent(docId)}/certificate`;
}

/** The owner's photo on a member's papers (2026-11-06). */
export function psfMemberPhotoSrc(membershipNumber: string): string {
  return `${API_URL}/api/v1/psf/card/photo?number=${encodeURIComponent(membershipNumber)}`;
}

/** What the public form asks, as PSF set it (2026-11-06). */
export function fetchPsfFormConfig(): Promise<ApiResult<PsfFormConfig>> {
  return apiFetchParsed(PsfFormConfig, "/api/v1/psf/form-config");
}

/** The member's card as a PDF (2026-11-05). */
export function psfCardUrl(docId: string): string {
  return `${API_URL}/api/v1/psf/track/${encodeURIComponent(docId)}/card`;
}

const SentTo = {
  safeParse(input: unknown): { success: true; data: { sentTo: string } } | { success: false } {
    const v = input as { sentTo?: unknown } | null;
    return v && typeof v.sentTo === "string" ? { success: true, data: { sentTo: v.sentTo } } : { success: false };
  },
};

/** Mail the certificate to the email the application gave. */
export function emailPsfCertificate(docId: string): Promise<ApiResult<{ sentTo: string }>> {
  return apiFetchParsed(SentTo, `/api/v1/psf/track/${encodeURIComponent(docId)}/certificate/email`, { method: "POST", body: {} });
}

/**
 * Send the business's logo from the form (2026-10-23) and get back the key the
 * form submits it by. Multipart, so not through `apiFetch` (see `uploads.ts`);
 * no session, so the form's verified ID check travels in a header instead.
 */
export async function uploadPsfLogo(checkToken: string, file: File): Promise<ApiResult<PsfLogoUploadResult>> {
  const form = new FormData();
  form.append("file", file, file.name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${API_URL}/api/v1/psf/logo`, {
      method: "POST",
      body: form,
      headers: { [PSF_CHECK_TOKEN_HEADER]: checkToken },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { status: "refused", message: body?.message ?? "That logo could not be uploaded.", httpStatus: res.status };
    }
    const parsed = PsfLogoUploadResult.safeParse(await res.json());
    return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** A card holder's old PSF card (2026-11-02), under the form's ID check, like the logo. */
export async function uploadPsfCard(checkToken: string, file: File): Promise<ApiResult<PsfCardUploadResult>> {
  const form = new FormData();
  form.append("file", file, file.name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${API_URL}/api/v1/psf/card-upload`, {
      method: "POST",
      body: form,
      headers: { [PSF_CHECK_TOKEN_HEADER]: checkToken },
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { status: "refused", message: body?.message ?? "That card could not be uploaded.", httpStatus: res.status };
    }
    const parsed = PsfCardUploadResult.safeParse(await res.json());
    return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** The kind's floor and each branch's price for the form's choices (2026-11-05). */
export function fetchPsfQuote(query: { district: number; tierCode: string; subsectorId?: string; branches: number[] }): Promise<ApiResult<PsfQuote>> {
  const params = new URLSearchParams({ district: String(query.district), tierCode: query.tierCode });
  if (query.subsectorId) params.set("subsectorId", query.subsectorId);
  if (query.branches.length) params.set("branches", query.branches.join(","));
  return apiFetchParsed(PsfQuote, `/api/v1/psf/quote?${params.toString()}`);
}

/** Corrections to an application PSF sent back (2026-11-05). */
export function resendPsfApplication(docId: string, body: PsfResendRequest): Promise<ApiResult<PsfTrackView>> {
  return apiFetchParsed(PsfTrackView, `/api/v1/psf/track/${encodeURIComponent(docId)}/resend`, { method: "POST", body });
}

/** What a signed link for a card sent back opens (2026-11-05). */
export function fetchPsfClaimCard(token: string): Promise<ApiResult<PsfClaimCardView>> {
  return apiFetchParsed(PsfClaimCardView, `/api/v1/psf/claim-card?token=${encodeURIComponent(token)}`);
}

/** One card file to a PSF route, with the same bounds as the logo. Null data for a 204. */
async function postPsfCard<T>(path: string, file: File, parse: (raw: unknown) => T | null): Promise<ApiResult<T>> {
  const form = new FormData();
  form.append("file", file, file.name);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${API_URL}${path}`, { method: "POST", body: form, signal: controller.signal });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { status: "refused", message: body?.message ?? "That card could not be sent.", httpStatus: res.status };
    }
    const data = parse(res.status === 204 ? null : await res.json());
    return data === null ? { status: "failed" } : { status: "ok", data };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** A new card for an application sent back. */
export function uploadPsfResendCard(docId: string, file: File): Promise<ApiResult<PsfCardUploadResult>> {
  return postPsfCard(`/api/v1/psf/track/${encodeURIComponent(docId)}/card`, file, (raw) => {
    const parsed = PsfCardUploadResult.safeParse(raw);
    return parsed.success ? parsed.data : null;
  });
}

/** The card again, by the signed link. */
export function resendPsfClaimCard(token: string, file: File): Promise<ApiResult<true>> {
  return postPsfCard(`/api/v1/psf/claim-card?token=${encodeURIComponent(token)}`, file, () => true);
}

/** The logo's address, from the tracking view's `logoUrl` (a path under the API). */
export function psfLogoSrc(logoUrl: string): string {
  return `${API_URL}${logoUrl}`;
}
