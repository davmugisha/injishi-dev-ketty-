/**
 * Send a form with a file (a receipt, a fault's photo, RRA's proof) to one of the app's form routes, with
 * its progress. Answers like a server action: the API's answer, or the sentence to show with the
 * fields it named. The page refreshes itself after (`router.refresh()`).
 */
export type FormResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; status?: number; fieldErrors?: Record<string, string> };

export function sendForm<T>(
  url: string,
  method: "POST" | "PUT",
  form: FormData,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<FormResult<T>> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.responseType = "text";
    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true, value: body as T });
        return;
      }
      if (xhr.status === 401) {
        window.location.assign(`/sign-in?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const message = (body as { message?: unknown } | null)?.message;
      const issues = (body as { issues?: { path?: (string | number)[]; message?: string }[] } | null)?.issues;
      const fieldErrors: Record<string, string> = {};
      for (const issue of issues ?? []) {
        const key = issue.path?.join(".") || "_";
        if (!fieldErrors[key] && issue.message) fieldErrors[key] = issue.message;
      }
      const words =
        typeof message === "string" && message !== "Validation failed" && !message.startsWith("HTTP ")
          ? message
          : xhr.status === 403
            ? "You can't do this here."
            : "That didn't work. Try again.";
      resolve({
        ok: false,
        status: xhr.status,
        error: fieldErrors._ ?? (Object.keys(fieldErrors).length > 0 ? "Check the highlighted fields." : words),
        ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
      });
    };
    xhr.onerror = () => resolve({ ok: false, error: "The upload stopped. Check your connection and try again." });
    xhr.onabort = () => reject(new DOMException("Cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/** A form's fields as multipart, leaving out what is empty. */
export function formOf(
  fields: Record<string, string | number | boolean | null | undefined>,
  file?: [string, File | null],
): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined || v === "") continue;
    form.append(k, String(v));
  }
  if (file?.[1]) form.append(file[0], file[1], file[1].name);
  return form;
}
