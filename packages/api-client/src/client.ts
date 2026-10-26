/**
 * The one transport a product uses to reach `server/api` (ADR-074).
 *
 * A route file in an app resolves the session, loads data through this, and
 * hands a product's view typed data and command callbacks. So the same code
 * runs in a browser (the API origin's session cookie travels with
 * `credentials: "include"`) and on an app's server (the caller forwards the
 * cookie as a header, because a server has no cookie jar).
 *
 * It carries no business policy. It builds the request, passes the workspace,
 * the branch and an `Idempotency-Key` through, bounds the wait, and maps the
 * answer onto four outcomes a screen renders. It decides nothing about who may
 * do what: the API's guards do, and a refusal comes back as `refused`.
 *
 * It never retries. A write that timed out may have landed, so asking again is
 * the caller's decision, and a money command is never asked again with a fresh
 * key: the caller mints the key ONCE per press and reuses it on every retry of
 * that press, or the guard it feeds does nothing.
 *
 * The outcome shape is the one `apps/web/src/lib/api.ts` settled on, and it is
 * a union rather than an exception for the reason recorded there: every caller
 * renders every branch, so throwing only moves the same four cases further from
 * the screen that shows them.
 */

/** What one call to the API can turn out to be. */
export type ApiResult<T> =
  | { status: "ok"; data: T }
  /** The session is missing or expired. Never conflated with `failed`: an outage is not a sign out. */
  | { status: "unauthenticated" }
  /**
   * The API refused. `message` is present only when the API wrote one for a
   * person, never Nest's framework text ("Forbidden resource"), so a screen
   * either shows it or supplies its own sentence. `code` is the machine
   * readable reason when one was sent (`contract_not_accepted`).
   */
  | {
      status: "refused";
      httpStatus: number;
      message?: string;
      code?: string;
      issues?: RefusalIssue[];
    }
  /** Unreachable, timed out, or an answer the API did not write. */
  | { status: "failed" };

/** One field refusal, as the API's validation pipe shapes it. */
export interface RefusalIssue {
  path: (string | number)[];
  message: string;
}

export interface ApiClientOptions {
  /** Where the API listens, without a trailing slash: `https://api.injishi.com`. */
  baseUrl: string;
  /**
   * Browser callers keep the default, `include`, which sends the API origin's
   * session cookie; without it every call is anonymous and answers 401. A
   * server caller forwards the cookie through `headers` instead.
   */
  credentials?: RequestCredentials;
  /**
   * Headers sent on every call, read per call: on an app's server, the
   * visitor's `cookie`, the app's `origin` (Better Auth refuses a cookie
   * carrying POST without one it trusts) and `x-forwarded-for`.
   */
  headers?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Ceiling on one round trip. A request with no ceiling leaves a button spinning forever. */
  timeoutMs?: number;
  /** For tests, and for runtimes whose global `fetch` is not the one to use. */
  fetch?: typeof fetch;
}

export interface ApiRequest {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Sent as JSON. */
  body?: unknown;
  /** A multipart body (a file upload), sent as is so the runtime sets its boundary. */
  form?: FormData;
  /** Appended to the path; `undefined`, `null` and `""` are left out. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** The business workspace the call acts in. `WorkspaceGuard` reads `x-workspace-id`. */
  workspaceId?: string | null;
  /** Narrows to one branch (`x-branch-id`, ADR-054), where the route honours it. */
  branchId?: string | null;
  /** Sent as `Idempotency-Key`. Mint it once per press, at the call site, and reuse it on a retry. */
  idempotencyKey?: string;
  /** Overrides the client's ceiling for this call. */
  timeoutMs?: number;
}

export interface ApiClient {
  request<T>(path: string, init?: ApiRequest): Promise<ApiResult<T>>;
  /**
   * The same call, with the answer checked against a contract schema from
   * `@injishi/contracts`. A body that does not match is `failed`, never thrown
   * and never cast: a cast is how an API drift renders as `NaN RWF`. The schema
   * is taken structurally, so this package does not depend on zod.
   */
  requestParsed<T>(schema: ParseSchema<T>, path: string, init?: ApiRequest): Promise<ApiResult<T>>;
}

/** Anything with zod's `safeParse`. */
export interface ParseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

const DEFAULT_TIMEOUT_MS = 12_000;

/** A response body that did not parse as JSON, kept apart from a JSON `null`. */
const NOT_JSON = Symbol("not-json");

/**
 * Messages that are the framework talking, not the product: Nest's default
 * exception texts, the Zod pipe's headline and a route miss.
 */
const FRAMEWORK_MESSAGE =
  /^(validation failed|internal server error|forbidden( resource)?|bad request|not found|unauthorized|too many requests|throttlerexception.*|cannot (get|post|put|patch|delete) .*)\.?$/i;

export function createApiClient(options: ApiClientOptions): ApiClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? fetch;

  async function request<T>(path: string, init: ApiRequest = {}): Promise<ApiResult<T>> {
    const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = { accept: "application/json", ...(await options.headers?.()) };
    if (init.workspaceId) headers["x-workspace-id"] = init.workspaceId;
    if (init.branchId) headers["x-branch-id"] = init.branchId;
    if (init.idempotencyKey) headers["idempotency-key"] = init.idempotencyKey;

    let body: string | FormData | undefined;
    if (init.form) {
      body = init.form;
    } else if (init.body !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(init.body);
    }

    let response: Response;
    try {
      response = await doFetch(url, {
        method: init.method ?? (body === undefined ? "GET" : "POST"),
        credentials: options.credentials ?? "include",
        cache: "no-store",
        headers,
        body,
        signal: AbortSignal.timeout(init.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch {
      return { status: "failed" };
    }

    if (response.status === 401) return { status: "unauthenticated" };
    if (response.status === 204) return { status: "ok", data: null as T };

    const parsed: unknown = await response.json().catch(() => NOT_JSON);

    // Every refusal Nest sends is JSON. A plain text error is the gateway
    // talking (Traefik's `404 page not found` while the API restarts), which is
    // the "we could not ask" case, not a refusal.
    if (!response.ok && parsed === NOT_JSON) return { status: "failed" };
    if (!response.ok) return refusal(response.status, parsed);
    return { status: "ok", data: (parsed === NOT_JSON ? null : parsed) as T };
  }

  async function requestParsed<T>(schema: ParseSchema<T>, path: string, init?: ApiRequest): Promise<ApiResult<T>> {
    const result = await request<unknown>(path, init);
    if (result.status !== "ok") return result;
    const checked = schema.safeParse(result.data);
    return checked.success ? { status: "ok", data: checked.data } : { status: "failed" };
  }

  return { request, requestParsed };
}

function refusal(httpStatus: number, body: unknown): ApiResult<never> {
  const issues = issuesOf(body);
  const message = personMessage(body) ?? issues[0]?.message;
  const code = field(body, "code");
  return {
    status: "refused",
    httpStatus,
    ...(message ? { message } : {}),
    ...(code ? { code } : {}),
    ...(issues.length > 0 ? { issues } : {}),
  };
}

function field(body: unknown, key: string): string | undefined {
  if (!body || typeof body !== "object" || !(key in body)) return undefined;
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

/** The body's `message` when it is a sentence for a person. A class-validator array is never joined into one. */
function personMessage(body: unknown): string | undefined {
  const message = field(body, "message");
  return message && !FRAMEWORK_MESSAGE.test(message.trim()) ? message : undefined;
}

function issuesOf(body: unknown): RefusalIssue[] {
  if (!body || typeof body !== "object" || !("issues" in body)) return [];
  const raw = (body as { issues?: unknown }).issues;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((issue) => {
    if (!issue || typeof issue !== "object") return [];
    const { path, message } = issue as { path?: unknown; message?: unknown };
    if (!Array.isArray(path) || typeof message !== "string") return [];
    return [{ path: path.filter((p): p is string | number => typeof p === "string" || typeof p === "number"), message }];
  });
}
