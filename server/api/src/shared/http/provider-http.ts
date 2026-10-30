/**
 * One way to call an outside provider over HTTP (ADR-073's `ProviderHttp`,
 * first built for the sandbox adapters): a ceiling on every call, JSON in and
 * out, and a failure that says what kind it is.
 *
 * The kind matters more than the message, because callers handle them in
 * opposite ways (ADR-073 §The rules):
 * - `unreachable`: nothing reached the provider (refused, no such host). Safe
 *   to send again. `delivered: 'no'`.
 * - `timeout`: the request may have arrived. Never resent blindly; read back.
 *   `delivered: 'maybe'`.
 * - `unavailable`: the provider answered that it could not serve (5xx, 429).
 *   A 503 or 429 took nothing (`no`); any other 5xx may have (`maybe`).
 * - `unauthorised`: our credentials were refused (401, 403). A configuration
 *   fault, never the customer's.
 * - `refused`: the provider read the request and said no (other 4xx). The body
 *   says why, in the provider's words.
 * - `unreadable`: a success whose body is not the JSON promised.
 *
 * It never logs a body: request bodies here carry ID numbers, selfies and
 * phone numbers.
 */

export type ProviderFailureKind = 'unreachable' | 'timeout' | 'unavailable' | 'unauthorised' | 'refused' | 'unreadable';

export class ProviderHttpError extends Error {
  readonly provider: string;
  readonly kind: ProviderFailureKind;
  readonly status: number | null;
  readonly body: unknown;
  readonly delivered: 'no' | 'maybe';

  constructor(input: {
    provider: string;
    kind: ProviderFailureKind;
    status: number | null;
    body: unknown;
    delivered: 'no' | 'maybe';
    detail: string;
  }) {
    super(`${input.provider}: ${input.kind}${input.status ? ` (HTTP ${input.status})` : ''}: ${input.detail}`);
    this.name = 'ProviderHttpError';
    this.provider = input.provider;
    this.kind = input.kind;
    this.status = input.status;
    this.body = input.body;
    this.delivered = input.delivered;
  }

  /** The provider's own error code, when its body carries one under `code` or `error`. */
  get providerCode(): string | null {
    const body = this.body as { code?: unknown; error?: unknown } | null;
    if (body && typeof body.code === 'string') return body.code;
    if (body && typeof body.error === 'string') return body.error;
    return null;
  }
}

export interface ProviderRequest {
  /** For the error message: `gtbank`, `rra`, `smile_id`. */
  provider: string;
  method: 'GET' | 'POST' | 'PUT';
  url: string;
  headers?: Record<string, string>;
  /** Sent as JSON. */
  json?: unknown;
  /** Sent as is, with the caller's content type. */
  body?: string;
  timeoutMs: number;
}

export interface ProviderResponse<T = unknown> {
  status: number;
  body: T;
}

const NOT_SENT_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET_BEFORE_SEND', 'EHOSTUNREACH', 'ENETUNREACH']);

/** One call. Resolves on a 2xx with its JSON body (or null when empty); throws `ProviderHttpError` otherwise. */
export async function providerFetch<T = unknown>(request: ProviderRequest): Promise<ProviderResponse<T>> {
  const headers: Record<string, string> = { accept: 'application/json', ...(request.headers ?? {}) };
  let body: string | undefined = request.body;
  if (request.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(request.json);
  }
  const mutating = request.method !== 'GET';

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch (error) {
    const name = (error as { name?: string }).name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ProviderHttpError({
        provider: request.provider,
        kind: 'timeout',
        status: null,
        body: null,
        delivered: mutating ? 'maybe' : 'no',
        detail: `no answer within ${request.timeoutMs} ms`,
      });
    }
    const code = (error as { cause?: { code?: string } }).cause?.code ?? '';
    throw new ProviderHttpError({
      provider: request.provider,
      kind: 'unreachable',
      status: null,
      body: null,
      // A reset after connecting may follow a request the provider read.
      delivered: NOT_SENT_CODES.has(code) || !mutating ? 'no' : 'maybe',
      detail: code || (error as Error).message,
    });
  }

  const text = await response.text().catch(() => '');
  let parsed: unknown = null;
  let readable = true;
  if (text.trim() !== '') {
    try {
      parsed = JSON.parse(text);
    } catch {
      readable = false;
      parsed = null;
    }
  }

  if (response.ok) {
    if (!readable) {
      throw new ProviderHttpError({
        provider: request.provider,
        kind: 'unreadable',
        status: response.status,
        body: null,
        delivered: mutating ? 'maybe' : 'no',
        detail: 'the answer is not JSON',
      });
    }
    return { status: response.status, body: parsed as T };
  }

  const status = response.status;
  const kind: ProviderFailureKind =
    status === 401 || status === 403 ? 'unauthorised' : status === 429 || status >= 500 ? 'unavailable' : 'refused';
  const delivered: 'no' | 'maybe' =
    !mutating || kind === 'refused' || kind === 'unauthorised' || status === 429 || status === 503 ? 'no' : 'maybe';
  throw new ProviderHttpError({
    provider: request.provider,
    kind,
    status,
    body: parsed,
    delivered,
    detail: describe(parsed),
  });
}

function describe(body: unknown): string {
  const b = body as { message?: unknown; error_description?: unknown; error?: unknown; code?: unknown } | null;
  const message = b?.message ?? b?.error_description ?? b?.error ?? b?.code;
  return typeof message === 'string' ? message : 'no reason given';
}
