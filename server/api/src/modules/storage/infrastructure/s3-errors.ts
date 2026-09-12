/**
 * Time bounds and error reading for every S3 call (storage contract: "every S3
 * call is time-bounded").
 *
 * The SDK's defaults are no connection timeout and no request timeout, so a
 * MinIO that accepts the TCP connection and then stalls holds an upload request
 * open forever, and with it a database connection from a pool of twenty. Three
 * bounds, because each catches a different stall:
 *
 * - `connectMs` on the socket's connection phase: the host is gone.
 * - `requestMs` on one attempt's request and response: the host is there and
 *   not answering.
 * - `operationMs` on the whole call, retries included: the SDK retries up to
 *   `maxAttempts`, and three attempts at the request bound is longer than any
 *   caller should wait. It is the one bound a caller can rely on.
 *
 * Constants rather than settings. The storage contract names every variable the
 * API reads, and a timeout is not one of them; ten megabytes to an in-country
 * store on the same network finishes in a fraction of these.
 */
export interface S3Timeouts {
  readonly connectMs: number;
  readonly requestMs: number;
  readonly operationMs: number;
}

export const S3_TIMEOUTS: S3Timeouts = {
  connectMs: 5_000,
  requestMs: 20_000,
  operationMs: 30_000,
};

export const S3_MAX_ATTEMPTS = 3;

/** Per-call options that abandon the call, retries included, at the deadline. */
export function withDeadline(ms: number = S3_TIMEOUTS.operationMs): { abortSignal: AbortSignal } {
  return { abortSignal: AbortSignal.timeout(ms) };
}

interface S3ErrorLike {
  name?: string;
  code?: string;
  message?: string;
  $metadata?: { httpStatusCode?: number };
}

const asErrorLike = (error: unknown): S3ErrorLike =>
  typeof error === 'object' && error !== null ? (error as S3ErrorLike) : {};

/** The HTTP status S3 answered with, when it answered at all. */
export function s3StatusOf(error: unknown): number | undefined {
  return asErrorLike(error).$metadata?.httpStatusCode;
}

/** A call abandoned at a deadline, by the signal or by the request handler. */
export function isS3Timeout(error: unknown): boolean {
  const { name, code } = asErrorLike(error);
  return name === 'AbortError' || name === 'TimeoutError' || code === 'ETIMEDOUT';
}

/**
 * One line for a log or a boot refusal: the error's name, the status, and the
 * start of its message. An SDK error carries the request, never the secret key,
 * so its message is safe to print; it is still cut short because a
 * misconfigured proxy can answer with a whole HTML page.
 */
export function describeS3Error(error: unknown): string {
  const { name, code, message } = asErrorLike(error);
  const status = s3StatusOf(error);
  const parts = [name || 'Error'];
  if (status) parts.push(`HTTP ${status}`);
  if (code && code !== name) parts.push(code);
  const head = parts.join(', ');
  const detail = (message ?? String(error)).replace(/\s+/g, ' ').trim().slice(0, 200);
  return detail && detail !== name ? `${head}: ${detail}` : head;
}
