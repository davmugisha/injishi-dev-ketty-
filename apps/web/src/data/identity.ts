import {
  IdentityStatus,
  NationalIdLookupResult,
  PassportVerifyResult,
  VerifiedPerson,
} from "@injishi/contracts";

import { apiFetch, type ApiResult } from "@/lib/api";

/**
 * The web client for `/api/v1/me/identity` (ADR-060): where the caller's
 * identity stands, the National ID lookup and its code, and the passport scan.
 *
 * Every answer is parsed against the contract the API validated it with. The
 * lookup's answer carries nobody's name: the person is revealed only by
 * `confirmNationalId`, to whoever typed the code the register's phone received.
 */

export async function fetchIdentity(): Promise<ApiResult<IdentityStatus>> {
  const res = await apiFetch<unknown>("/api/v1/me/identity");
  if (res.status !== "ok") return res;
  const parsed = IdentityStatus.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

export async function lookupNationalId(
  documentNumber: string,
): Promise<ApiResult<NationalIdLookupResult>> {
  const res = await apiFetch<unknown>("/api/v1/me/identity/national-id/lookup", {
    method: "POST",
    body: { documentNumber },
  });
  if (res.status !== "ok") return res;
  const parsed = NationalIdLookupResult.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

export async function confirmNationalId(
  challengeId: string,
  code: string,
): Promise<ApiResult<VerifiedPerson>> {
  const res = await apiFetch<unknown>("/api/v1/me/identity/national-id/confirm", {
    method: "POST",
    body: { challengeId, code },
  });
  if (res.status !== "ok") return res;
  const parsed = VerifiedPerson.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

export async function verifyPassport(
  documentObjectKey: string,
  selfieObjectKey: string,
): Promise<ApiResult<PassportVerifyResult>> {
  const res = await apiFetch<unknown>("/api/v1/me/identity/passport", {
    method: "POST",
    body: { documentObjectKey, selfieObjectKey },
  });
  if (res.status !== "ok") return res;
  const parsed = PassportVerifyResult.safeParse(res.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}
