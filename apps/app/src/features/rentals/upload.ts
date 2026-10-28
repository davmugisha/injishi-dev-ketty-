/**
 * Send a unit's photo or video to the app's upload route with its progress, for `PhotoUploader` and
 * `VideoField` (the kit never calls the API itself). Resolves with the API's answer, or throws an Error
 * whose message is the sentence to show.
 */
export function uploadWithProgress<T>(
  url: string,
  method: "POST" | "PUT",
  form: FormData,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        body = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }
      const message = (body as { message?: unknown } | null)?.message;
      const issues = (body as { issues?: { message?: string }[] } | null)?.issues;
      reject(
        new Error(
          issues?.[0]?.message ??
            (typeof message === "string" && message !== "Validation failed"
              ? message
              : "The upload didn't go through. Try again."),
        ),
      );
    };
    xhr.onerror = () => reject(new Error("The upload stopped. Check your connection and try again."));
    xhr.onabort = () => reject(new DOMException("Cancelled", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
