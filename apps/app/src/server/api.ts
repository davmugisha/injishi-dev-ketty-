/**
 * The one client apps/app uses to reach server/api. Server side only: it carries the API's session
 * cookie, which never reaches the browser. It imports nothing from `next/*`, so the verify scripts
 * (`scripts/verify-*.ts`, run under tsx) drive the same code the pages do.
 *
 * The API is the boundary (AGENTS.md § Authorization): SessionGuard resolves the cookie,
 * WorkspaceGuard checks the `x-workspace-id` grant and the route's permission. Nothing here decides
 * what a person may do; it forwards who they are and reports what the API answered.
 */

/** Where the API listens. Compose names it `http://api:8000`; a laptop runs it on :8000. */
export function apiBaseUrl(): string {
  return (process.env.INJISHI_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
}

/**
 * Better Auth refuses a cookie-carrying POST under /api/auth without an Origin it trusts
 * (403 MISSING_OR_NULL_ORIGIN). The app's own public origin is on the API's CORS_ORIGINS list.
 */
export function apiOrigin(): string {
  return (
    process.env.INJISHI_API_ORIGIN ||
    process.env.INJISHI_APP_URL ||
    process.env.NEXT_PUBLIC_PMS_URL ||
    "http://localhost:3002"
  ).replace(/\/+$/, "");
}

const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get unauthenticated(): boolean {
    return this.status === 401;
  }
  get forbidden(): boolean {
    return this.status === 403;
  }
  get notFound(): boolean {
    return this.status === 404;
  }
}

/** The API could not be reached at all. Never read as "signed out" (an outage is not a sign-out). */
export class ApiUnreachableError extends Error {
  constructor(readonly cause: unknown) {
    super(`The Injishi API at ${apiBaseUrl()} did not answer.`);
    this.name = "ApiUnreachableError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** The business workspace the call acts in (WorkspaceGuard reads `x-workspace-id`). */
  workspaceId?: string | null;
  /** Narrow to one property (`x-branch-id`), where the route honours it. */
  branchId?: string | null;
  /** Money routes need one key per press, minted at the call site. */
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** A multipart body (a file upload). Sent as is; the runtime sets the multipart content type and boundary. */
  form?: FormData;
  /** The visitor's address, forwarded so the API's per-IP sign-in limits count them and not this server. */
  clientIp?: string | null;
  /** The visitor's browser, forwarded where the API keeps it as evidence (a lease signature). */
  userAgent?: string | null;
}

/**
 * The header that names the visitor to the API. Every call here reaches the API from THIS server, so
 * without it Better Auth sees no client address at all: in production it then skips its rate limiter and
 * the per-IP send cap altogether ("Rate limiting skipped: could not determine client IP address").
 * Web's sign-in form forwards it the same way (`apps/web/src/lib/otp.server.ts`).
 */
export function clientIpHeaders(clientIp: string | null | undefined): Record<string, string> {
  return clientIp ? { "x-forwarded-for": clientIp } : {};
}

/** The browser's Better Auth cookies as a `Cookie` header: `injishi-demo.session_token=…` (name differs per environment). */
export type SessionCookie = string;

function messageOf(body: unknown, status: number): { code: string | null; message: string } {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    const code = typeof b.code === "string" ? b.code : typeof b.error === "string" ? b.error : null;
    const raw = b.message;
    const message = Array.isArray(raw) ? raw.join("; ") : typeof raw === "string" ? raw : null;
    return { code, message: message ?? code ?? `HTTP ${status}` };
  }
  return { code: null, message: typeof body === "string" && body ? body : `HTTP ${status}` };
}

/** One HTTP call. Returns the parsed JSON body (or null on 204). Throws ApiError / ApiUnreachableError. */
export async function apiRequest<T>(
  cookie: SessionCookie | null,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const url = new URL(`${apiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const headers: Record<string, string> = {
    accept: "application/json",
    origin: apiOrigin(),
    ...clientIpHeaders(options.clientIp),
  };
  if (cookie) headers.cookie = cookie;
  if (options.workspaceId) headers["x-workspace-id"] = options.workspaceId;
  if (options.branchId) headers["x-branch-id"] = options.branchId;
  if (options.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;
  if (options.userAgent) headers["user-agent"] = options.userAgent.slice(0, 500);
  let payload: string | FormData | undefined;
  if (options.form) {
    payload = options.form;
  } else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(options.body);
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? (payload ? "POST" : "GET"),
      headers,
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new ApiUnreachableError(error);
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON: keep the text for the error message.
  }
  if (!response.ok) {
    const { code, message } = messageOf(body, response.status);
    throw new ApiError(response.status, code, message, body);
  }
  return body as T;
}

/** A client bound to one session and (optionally) one workspace. */
export interface ApiClient {
  readonly cookie: SessionCookie | null;
  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T>;
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T>;
  /** POST a file as multipart/form-data. */
  upload<T>(path: string, form: FormData, options?: Omit<RequestOptions, "method" | "body" | "form">): Promise<T>;
}

export function createApiClient(cookie: SessionCookie | null): ApiClient {
  return {
    cookie,
    get: (path, options) => apiRequest(cookie, path, { ...options, method: "GET" }),
    post: (path, body, options) => apiRequest(cookie, path, { ...options, method: "POST", body: body ?? {} }),
    put: (path, body, options) => apiRequest(cookie, path, { ...options, method: "PUT", body: body ?? {} }),
    patch: (path, body, options) => apiRequest(cookie, path, { ...options, method: "PATCH", body: body ?? {} }),
    delete: (path, options) => apiRequest(cookie, path, { ...options, method: "DELETE" }),
    upload: (path, form, options) => apiRequest(cookie, path, { ...options, method: "POST", form }),
  };
}
