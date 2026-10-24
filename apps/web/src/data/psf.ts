import {
  PSF_CHECK_TOKEN_HEADER,
  PsfLogoUploadResult,
  PsfCatalogue,
  PsfIdentityLookupResult,
  PsfPublicSubmitResult,
  PsfFeesView,
  PsfTier,
  PsfTrackPayResult,
  PsfTrackView,
  PsfVerifiedApplicant,
  type PsfIdentityConfirmRequest,
  type PsfIdentityLookupRequest,
  type PsfPublicSubmitRequest,
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

/** The member's certificate as a PDF: a plain link, so the browser downloads it. */
export function psfCertificateUrl(docId: string): string {
  return `${API_URL}/api/v1/psf/track/${encodeURIComponent(docId)}/certificate`;
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

/** The logo's address, from the tracking view's `logoUrl` (a path under the API). */
export function psfLogoSrc(logoUrl: string): string {
  return `${API_URL}${logoUrl}`;
}
