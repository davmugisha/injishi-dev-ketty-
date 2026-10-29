import {
  IdentityScanResult,
  IdentityStatus,
  type AccountDocumentType,
  type TypedIdentityRequest,
} from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The web client for `/api/v1/me/identity` (ADR-060, ADR-075 A1): where the
 * caller's identity stands, the ID scan (front of the card or the photo page,
 * then a selfie), and the details typed as printed when the scan read nothing.
 *
 * Every answer is parsed against the contract the API validated it with. No
 * route here sends a code to a phone (AC-4), and no answer carries a photo's
 * object key: the keys go up, never come back.
 */

export async function fetchIdentity(): Promise<ApiResult<IdentityStatus>> {
  const res = await apiFetch<unknown>("/api/v1/me/identity");
  if (res.status !== "ok") return res;
  const parsed = IdentityStatus.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

export async function scanIdentity(
  documentType: AccountDocumentType,
  frontKey: string,
  selfieKey: string,
): Promise<ApiResult<IdentityScanResult>> {
  const res = await apiFetch<unknown>("/api/v1/me/identity/scan", {
    method: "POST",
    body: { documentType, frontKey, selfieKey },
  });
  if (res.status !== "ok") return res;
  const parsed = IdentityScanResult.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

export async function putTypedIdentity(request: TypedIdentityRequest): Promise<ApiResult<IdentityStatus>> {
  const res = await apiFetch<unknown>("/api/v1/me/identity/document", { method: "PUT", body: request });
  if (res.status !== "ok") return res;
  const parsed = IdentityStatus.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}
