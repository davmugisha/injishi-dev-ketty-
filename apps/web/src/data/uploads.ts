import { UploadedObject } from "@injishi/contracts";

import { API_URL, type ApiResult } from "@/lib/api";

/**
 * The web client for `/api/v1/uploads` (F-S09, ADR-026).
 *
 * It does NOT go through `apiFetch`, and that is the whole reason it is its own
 * module. `apiFetch` serialises a body to JSON and sets a JSON content type;
 * a multipart upload must send a `FormData` and let the browser set the
 * boundary itself. Setting `Content-Type` by hand on a `FormData` body is the
 * classic way to make an upload fail with a parser error nobody can read.
 *
 * Everything else `apiFetch` guarantees is kept by hand here: credentials are
 * included so the session cookie travels, the request is bounded by a timeout,
 * and the response is parsed against the same contract the API validated it
 * with.
 */

/**
 * 60 seconds.
 *
 * Longer than every other call in the app on purpose: F-S09 §9 asks the path to
 * survive a poor 4G link, and a 10 MB scan over a slow connection is a real
 * minute. An upload with NO ceiling is the thing this avoids — that is a
 * progress bar that never resolves and a person who cannot tell whether to try
 * again.
 */
const UPLOAD_TIMEOUT_MS = 60_000;

/** Send one certificate and get back the key that attaches it. */
export async function uploadCertificate(
  file: File,
): Promise<ApiResult<UploadedObject>> {
  const form = new FormData();
  form.append("file", file, file.name);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/api/v1/uploads/certificate`, {
      method: "POST",
      body: form,
      credentials: "include",
      signal: controller.signal,
    });

    if (res.status === 401) return { status: "unauthenticated" };
    if (!res.ok) {
      // The server's own sentence, when it left one. "A certificate must be a
      // PDF, JPEG, PNG or WebP" is worth showing; "Request failed" is not.
      const body = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;
      return {
        status: "refused",
        message: body?.message ?? "That file could not be uploaded.",
        httpStatus: res.status,
      };
    }

    const parsed = UploadedObject.safeParse(await res.json());
    return parsed.success
      ? { status: "ok", data: parsed.data }
      : { status: "failed" };
  } catch {
    // An abort and a dropped connection land here alike, and read the same to
    // the person: it did not arrive, try again.
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/** Drop a file that was uploaded but never attached to a registration. */
export async function removeCertificate(
  objectKey: string,
): Promise<ApiResult<{ removed: true }>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${API_URL}/api/v1/uploads/certificate?objectKey=${encodeURIComponent(objectKey)}`,
      { method: "DELETE", credentials: "include", signal: controller.signal },
    );
    if (res.status === 401) return { status: "unauthenticated" };
    if (!res.ok) return { status: "failed" };
    return { status: "ok", data: { removed: true } };
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }
}
