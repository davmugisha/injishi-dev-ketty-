/**
 * Every HTTP call the app makes, and the only place two headers are attached.
 *
 * ADR-030 fixed the four branch result; ADR-038 child 0 fixed the two headers.
 *
 * - `Authorization: Bearer <token>` comes from `auth.ts` and is attached HERE
 *   and in no other file (AC-S3).
 * - `x-workspace-id` comes from the active workspace and is attached HERE from
 *   module state, never passed as an argument by a call site (AC-S4). A call
 *   site cannot override it, which is the point: a screen that could choose its
 *   own workspace id is a screen that can read another workspace's rows.
 *
 * A `/me/` route carries no workspace header, because it is person scoped and
 * `WorkspaceGuard` does not run on it.
 */
import { API_BASE, REQUEST_TIMEOUT_MS } from './env';
import { authHeaders, clearToken } from './auth';
import { logFailure } from './log';
import type { ApiPath } from './endpoints';

/**
 * The four outcomes, and there are exactly four (ADR-030 cross child contract).
 *
 * The same union `apps/web/src/lib/api.ts` returns, so the two clients describe
 * a failure in one vocabulary and a reader moving between them is not learning
 * two. Every failure a screen can show is one of these:
 *
 *   ok              it worked
 *   unauthenticated you are signed out
 *   refused         the server said no, and said why
 *   failed          we could not reach it
 */
export type ApiResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unauthenticated' }
  | { status: 'refused'; message: string; httpStatus: number }
  | { status: 'failed' };

export type ApiErrorKind = 'unauthenticated' | 'refused' | 'failed';

/**
 * What `unwrap()` throws, so TanStack Query has a real error to hold.
 *
 * It carries the same four names as its `kind`, so a query's error state can
 * say which of the four happened without re-deriving it from a message string.
 */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly httpStatus?: number;

  constructor(kind: ApiErrorKind, message: string, httpStatus?: number) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

/**
 * The active workspace, held here because `api.ts` attaches the header.
 *
 * Module state rather than a hook: `api.ts` is called from query functions,
 * which are plain functions outside React's tree and cannot read context.
 * `workspace.tsx` is the only writer and keeps this in step with what it holds.
 */
let activeWorkspaceId: string | null = null;

/** Called by `workspace.tsx` alone, on resolve and on a successful switch. */
export function setActiveWorkspaceId(workspaceId: string | null): void {
  activeWorkspaceId = workspaceId;
}

export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId;
}

/**
 * What to do when the server says the session is gone.
 *
 * Registered once by the session provider. `api.ts` does not navigate and does
 * not know about routes; it reports, and the app decides.
 */
type UnauthenticatedHandler = () => void;
let onUnauthenticated: UnauthenticatedHandler | null = null;

export function setUnauthenticatedHandler(
  handler: UnauthenticatedHandler | null,
): void {
  onUnauthenticated = handler;
}

/**
 * Whether we have already reacted to a 401 in this burst.
 *
 * A cold start fires several calls at once and a dead session fails all of
 * them. Reacting per call would clear the token repeatedly and, worse, bounce
 * the person to sign in several times over. The invariant is "once, not once
 * per in flight call", and this flag is what enforces it. It is released once
 * the burst has passed so a LATER expiry is still handled.
 */
let handlingUnauthenticated = false;

async function reactToUnauthenticated(): Promise<void> {
  if (handlingUnauthenticated) return;
  handlingUnauthenticated = true;
  try {
    await clearToken();
    onUnauthenticated?.();
  } finally {
    setTimeout(() => {
      handlingUnauthenticated = false;
    }, 1_000);
  }
}

/** Reset the 401 latch. Tests only; a stuck latch would hide a real expiry. */
export function resetUnauthenticatedLatch(): void {
  handlingUnauthenticated = false;
}

/**
 * Read the server's own message out of a refusal.
 *
 * The API has no exception filter, so a refusal is Nest's default body:
 * `{ statusCode, message, error }`, where `message` is a string, or an ARRAY of
 * strings when a Zod pipe rejects several fields. Joining the array with a
 * space is what `apps/web/src/lib/api.ts` already does, and the two clients
 * parse this identically on purpose.
 */
function messageOf(body: unknown, fallback: string): string {
  if (typeof body === 'string' && body.trim()) return body;
  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
    if (Array.isArray(message)) {
      const joined = message
        .filter((part): part is string => typeof part === 'string')
        .join(' ');
      if (joined.trim()) return joined;
    }
  }
  return fallback;
}

export interface ApiCallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialised as JSON. Use `formData` for an upload instead. */
  body?: unknown;
  /** A multipart body, for `POST /uploads`. Sets no Content-Type: fetch does. */
  formData?: FormData;
  /** Lets a caller abort, e.g. TanStack Query cancelling a stale query. */
  signal?: AbortSignal;
  /**
   * Force the workspace header off for a route that is person scoped but does
   * not sit under `/me/`. Rare, and named so it is visible at the call site.
   */
  withoutWorkspace?: boolean;
  /**
   * Sent as `Idempotency-Key`, for a command the API refuses without one (an
   * order, a payment). Mint it ONCE per intent and reuse it on every retry of
   * that intent: a fresh key per attempt is exactly the double order it exists
   * to prevent.
   */
  idempotencyKey?: string;
}

/**
 * A person scoped route carries no workspace header.
 *
 * `/me/...` is the whole rule today. It is a function rather than a constant
 * because the next person scoped prefix should be added here, once, rather
 * than at the call sites.
 */
function isPersonScoped(path: string): boolean {
  return path.startsWith('/me/') || path === '/me';
}

/**
 * Make one call and return one of the four outcomes.
 *
 * Never throws for an HTTP answer. A refusal is a value, because a mutation
 * needs to show the server's own message and a `catch` block is a bad place to
 * read one from.
 *
 * `path` is an `ApiPath`, which only `endpoints.ts` can mint. A plain string is
 * not one, so a screen cannot invent a URL: every path this app asks for is
 * declared in that one file, where it can be checked against the API's route
 * table rather than discovered as a 404 on a device.
 */
export async function api<T>(
  path: ApiPath,
  options: ApiCallOptions = {},
): Promise<ApiResult<T>> {
  const { method = 'GET', body, formData, signal, withoutWorkspace, idempotencyKey } = options;
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = { ...authHeaders() };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  // Never set Content-Type for multipart: fetch has to write the boundary, and
  // a hand-written header without one makes the body unparseable.
  if (formData === undefined && body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!withoutWorkspace && !isPersonScoped(path) && activeWorkspaceId) {
    headers['x-workspace-id'] = activeWorkspaceId;
  }

  // Every call is bounded. A socket that stays open and silent is the failure
  // mode a phone actually has, and without this it presents as a spinner that
  // never resolves rather than as an error anyone can act on.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
      // Never the native cookie jar: identity is the bearer header alone.
      // `authCall` in `auth.ts` records what a replayed session cookie did.
      credentials: 'omit',
      signal: controller.signal,
    });

    if (response.status === 401) {
      await reactToUnauthenticated();
      return { status: 'unauthenticated' };
    }

    if (!response.ok) {
      const parsed = await response.json().catch(() => null);
      const message = messageOf(parsed, 'That request was refused.');
      logFailure('call refused', {
        method,
        url,
        httpStatus: response.status,
        outcome: 'refused',
      });
      return { status: 'refused', message, httpStatus: response.status };
    }

    // 204, and any other answer with no body, is a success with no data.
    if (response.status === 204) return { status: 'ok', data: undefined as T };

    const data = (await response.json().catch(() => null)) as T;
    return { status: 'ok', data };
  } catch {
    // Reachability: a timeout, a dropped connection, no network, DNS. Not an
    // answer from the server, so never shown as one and never retried into.
    logFailure('call could not reach the server', {
      method,
      url,
      outcome: 'failed',
    });
    return { status: 'failed' };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/**
 * The data, or a throw, for TanStack Query.
 *
 * Query functions do not branch on `ApiResult`; they call this. TanStack Query
 * needs a throw to drive its error state and its retry policy, while mutations
 * keep the value shape where the message matters. That split is ADR-030's, and
 * it is why both forms exist rather than one.
 */
export async function unwrap<T>(result: Promise<ApiResult<T>>): Promise<T> {
  const answer = await result;
  switch (answer.status) {
    case 'ok':
      return answer.data;
    case 'unauthenticated':
      throw new ApiError('unauthenticated', 'Your session has ended.');
    case 'refused':
      throw new ApiError('refused', answer.message, answer.httpStatus);
    case 'failed':
      throw new ApiError('failed', 'We could not reach Injishi.');
  }
}

/**
 * Whether TanStack Query should retry this error.
 *
 * `unauthenticated` and `refused` are ANSWERS, not failures: the server was
 * reached and it said no. Retrying either just asks the same question again,
 * more slowly, and in the refusal case shows the person a screen that keeps
 * retrying something that cannot succeed. Only `failed` is worth another go.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.kind !== 'failed') return false;
  return failureCount < 2;
}
