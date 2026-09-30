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

/** A response body that did not parse as JSON, kept apart from a JSON `null`. */
const NOT_JSON = Symbol("not-json");

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
  /**
   * The server refused, with a message meant for a person. `code` is the
   * machine readable reason when the API sent one (`contract_not_accepted`),
   * so a screen can act on a refusal without matching on its English.
   */
  | {
      status: "refused";
      message: string;
      httpStatus: number;
      code?: string;
      /**
       * The field refusals the validation pipe (or a service refusing in its
       * shape) sent, each with its path, so a form can put the sentence under
       * the field it came from rather than above the whole form.
       */
      issues?: RefusalIssue[];
    }
  /** Unreachable, timed out, or an answer we could not read. */
  | { status: "failed" };

/** One field refusal, as the API's validation pipe shapes it. */
export interface RefusalIssue {
  path: (string | number)[];
  message: string;
}

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
  // "Validation failed" is the pipe's headline, not a sentence; the first
  // field refusal under it is written for a person.
  const first = issuesOf(body)[0];
  if (first) return first.message;
  return fallbackFor(httpStatus);
}

/** The field refusals in an error body, when it carries any. */
function issuesOf(body: unknown): RefusalIssue[] {
  if (!body || typeof body !== "object" || !("issues" in body)) return [];
  const raw = (body as { issues?: unknown }).issues;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((issue) => {
    if (!issue || typeof issue !== "object") return [];
    const { path, message } = issue as { path?: unknown; message?: unknown };
    return Array.isArray(path) && typeof message === "string"
      ? [{ path: path.filter((p): p is string | number => typeof p === "string" || typeof p === "number"), message }]
      : [];
  });
}

/** The refusal's machine readable `code`, when the body carries one. */
function codeOf(body: unknown): { code?: string } {
  if (body && typeof body === "object" && "code" in body) {
    const c = (body as { code?: unknown }).code;
    if (typeof c === "string" && c) return { code: c };
  }
  return {};
}

/**
 * Call the API and come back with an outcome rather than an exception.
 *
 * Callers render every branch, so throwing would only move the same four cases
 * into a catch block further away from the screen that has to show them.
 */
export async function apiFetch<T>(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    /**
     * Sent as `Idempotency-Key`, for a command the API refuses without one (a
     * guest order). Mint it ONCE per intent and reuse it on every retry of that
     * intent: a fresh key per attempt is exactly the double order it prevents.
     */
    idempotencyKey?: string;
  },
): Promise<ApiResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const headers: Record<string, string> = {};
  if (init?.body) headers["content-type"] = "application/json";
  if (init?.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: init?.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    return { status: "failed" };
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) return { status: "unauthenticated" };

  const body: unknown = await res.json().catch(() => NOT_JSON);

  /*
   * An error the API did not write is not an answer from the API.
   *
   * Every refusal Nest sends is JSON. A plain-text error on this origin is the
   * gateway talking: while the API container restarts (a deploy, the demo's
   * nightly rebuild) Traefik has no route and answers `404 page not found`. That
   * used to come back as `refused` 404, which every caller reads as "gone": the
   * booking card told a guest the stay could not be booked online, and an
   * invite link read as invalid, for as long as the restart lasted and until a
   * reload. It is the "we could not ask" case, so it is worded as one.
   */
  if (!res.ok && body === NOT_JSON) return { status: "failed" };

  if (!res.ok) {
    return {
      status: "refused",
      httpStatus: res.status,
      message: messageOf(body, res.status),
      ...codeOf(body),
      ...(issuesOf(body).length > 0 ? { issues: issuesOf(body) } : {}),
    };
  }
  return { status: "ok", data: (body === NOT_JSON ? null : body) as T };
}

/**
 * The same call, with the answer checked against a contract schema.
 *
 * `apiFetch<T>` only CASTS: it tells TypeScript what the body is without asking
 * the body. On a read that carries money a cast is how an API drift renders as
 * `NaN RWF` or an `undefined` reference instead of an honest failure. A body
 * that does not match the schema is reported as `failed`, the branch every
 * screen already renders as "we couldn't load this", and never thrown.
 *
 * The schema is taken structurally (anything with `safeParse`) so this file
 * does not import zod for the sake of one type.
 */
export async function apiFetchParsed<T>(
  schema: { safeParse(input: unknown): { success: true; data: T } | { success: false } },
  path: string,
  init?: Parameters<typeof apiFetch>[1],
): Promise<ApiResult<T>> {
  const result = await apiFetch<unknown>(path, init);
  if (result.status !== "ok") return result;
  const parsed = schema.safeParse(result.data);
  return parsed.success ? { status: "ok", data: parsed.data } : { status: "failed" };
}

/**
 * Ask again, quietly, when we could not ask at all.
 *
 * For a READ a guest did not press anything to start, where a blip should heal
 * itself rather than put a "Try again" button in front of them: an API restart
 * lasts seconds. Only `failed` is retried. A refusal, a 401 or an answer is the
 * API speaking, and asking again would only repeat it.
 *
 * Never wrap a write in this: a write that timed out may have landed.
 */
export async function retryWhileFailed<T>(
  read: () => Promise<ApiResult<T>>,
  delaysMs: readonly number[] = [1_500, 4_000],
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((done) => setTimeout(done, ms)),
): Promise<ApiResult<T>> {
  let result = await read();
  for (const delay of delaysMs) {
    if (result.status !== "failed") return result;
    await sleep(delay);
    result = await read();
  }
  return result;
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
