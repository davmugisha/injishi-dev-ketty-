/**
 * The one definition of where the API is, and the one way to call it.
 *
 * Three files had already written `process.env.NEXT_PUBLIC_API_URL ?? …` for
 * themselves. That is one fact with three owners, and the registration wizard
 * would have made it four.
 *
 * Every call is BOUNDED, for the reason `lib/session.ts` and `lib/otp.ts` both
 * record: a request with no ceiling under a button someone is watching leaves
 * that button spinning forever instead of failing. A request that has not
 * answered by the deadline is treated as one that will not.
 *
 * `credentials: "include"` is not optional here. The Better Auth session cookie
 * belongs to the API origin (:8000) and the web app runs on :3000, so a call
 * without it is an anonymous call — which the API answers with a 401 that reads,
 * confusingly, as "you are signed out".
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Ceiling on one API round trip. */
const API_TIMEOUT_MS = 12_000;

/**
 * What a call to the API can turn out to be.
 *
 * `unauthenticated` is kept apart from `failed` for the same reason
 * `lib/session.ts` keeps `unreachable` apart from `anonymous`: one means "sign
 * in again", the other means "we could not ask". Collapsing them sends a
 * signed-in person back through the front door because a server hiccuped.
 */
export type ApiResult<T> =
  | { status: "ok"; data: T }
  /** The session is missing or expired. */
  | { status: "unauthenticated" }
  /** The server refused, with a message meant for a person. */
  | { status: "refused"; message: string; httpStatus: number }
  /** Unreachable, timed out, or an answer we could not read. */
  | { status: "failed" };

/**
 * Messages that are the framework talking, not the product.
 *
 * The API's own refusals are written for a person ("Check-out must be after
 * check-in.") and are shown as they come. These are not: Nest's default
 * exception texts, the Zod pipe's "Validation failed", and a route miss. A
 * guest who reads "Forbidden resource" at checkout learns nothing except that
 * nobody thought about them.
 */
const FRAMEWORK_MESSAGE =
  /^(validation failed|internal server error|forbidden( resource)?|bad request|not found|unauthorized|too many requests|throttlerexception.*|cannot (get|post|put|patch|delete) .*)\.?$/i;

/**
 * An owned sentence for a refusal that carried no human message. Each says
 * what it means for the person — above all whether anything changed — and
 * never guesses a cause the status does not tell us.
 */
function fallbackFor(httpStatus: number): string {
  if (httpStatus === 403) return "This account can't do that here, so nothing changed.";
  if (httpStatus === 404) return "We couldn't find that any more. It may have changed since this page loaded.";
  if (httpStatus === 409) return "That changed while you were looking at it, so nothing went through. Reload to see where it stands.";
  if (httpStatus === 429) return "That's a lot of tries in a short time. Give it a minute, then try again.";
  if (httpStatus >= 500) return "Something went wrong on our side, and nothing changed. Try again in a moment.";
  return "We couldn't accept that as it was sent, and nothing changed. Check the details and try again.";
}

/**
 * The message an API error body carries when it is meant for a person, or an
 * owned fallback. A list of field messages (class-validator) is never joined
 * into a paragraph: those name fields, not people's problems.
 */
function messageOf(body: unknown, httpStatus: number): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string" && m.trim() && !FRAMEWORK_MESSAGE.test(m.trim())) return m;
  }
  return fallbackFor(httpStatus);
}

/**
 * Call the API and come back with an outcome rather than an exception.
 *
 * Callers render every branch, so throwing would only move the same four cases
 * into a catch block further away from the screen that has to show them.
 */
export async function apiFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init?.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) return { status: "unauthenticated" };

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      status: "refused",
      httpStatus: res.status,
      message: messageOf(body, res.status),
    };
  }
  return { status: "ok", data: body as T };
}

/** One sentence for the branches that carry no server message of their own. */
export function apiResultMessage(result: ApiResult<unknown>): string {
  switch (result.status) {
    case "ok":
      return "";
    case "unauthenticated":
      return "Your session has ended. Sign in again and you'll come straight back here.";
    case "refused":
      return result.message;
    case "failed":
      // `failed` is a timeout, an unreachable API, or an answer we could not
      // read — as often our side as the reader's connection, so it names no
      // culprit. It does not promise "nothing changed" either: a write that
      // timed out may have landed. A caller that KNOWS (checkout reuses one
      // request, so it cannot charge twice) says so beside this line.
      return "We couldn't reach Injishi just now. Try again in a moment.";
  }
}
