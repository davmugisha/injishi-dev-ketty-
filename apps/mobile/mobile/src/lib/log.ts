/**
 * Where a failure is reported, with the credential taken out.
 *
 * ADR-030's cross child contract: `log.ts` never records a session token, an
 * OTP, or an auth header. ADR-038 restates it for the bearer token, which is
 * the credential now — a token in a log line is a token in a crash report, a
 * bug ticket and a screenshot, and unlike a password nobody thinks to redact it
 * because it does not look like one.
 *
 * A failure path that needs to identify a call logs its method and path, never
 * its headers and never its body. The body is where the OTP is.
 */

/** Header names whose values are never printed, whatever the casing. */
const REDACTED_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'set-auth-token',
  'x-api-key',
]);

export const REDACTED = '[redacted]';

/**
 * Copy headers with every credential replaced.
 *
 * The header NAME survives, because "this call carried an Authorization header"
 * is exactly the fact you need when a call is refused and you are trying to
 * work out whether the token was attached at all.
 */
export function redactHeaders(
  headers: Record<string, string> | Headers | undefined,
): Record<string, string> {
  if (!headers) return {};
  const entries =
    headers instanceof Headers
      ? Array.from(headers.entries())
      : Object.entries(headers);

  const safe: Record<string, string> = {};
  for (const [name, value] of entries) {
    safe[name] = REDACTED_HEADERS.has(name.toLowerCase()) ? REDACTED : value;
  }
  return safe;
}

/**
 * Strip a query string, and anything that looks like a credential in a path.
 *
 * A token should never be in a URL, but "should never" is not a guarantee, and
 * a log is the wrong place to discover it was.
 */
export function redactUrl(url: string): string {
  const withoutQuery = url.split('?')[0];
  return withoutQuery.replace(/\/[A-Za-z0-9_-]{40,}(?=\/|$)/g, `/${REDACTED}`);
}

export interface FailureContext {
  /** The HTTP method, for reading a log without guessing. */
  method?: string;
  /** The URL. Redacted before it is printed. */
  url?: string;
  /** The HTTP status, when there was one. */
  httpStatus?: number;
  /** Which of the four outcomes this was. */
  outcome?: string;
}

/**
 * Report a failed call.
 *
 * `console` rather than a reporting service: none is wired yet, and inventing
 * one here would be a decision this ADR did not make. When one arrives it
 * replaces this body and no call site changes, which is the point of the file
 * owning the fact.
 */
export function logFailure(message: string, context: FailureContext = {}): void {
  const { url, ...rest } = context;
  console.warn(
    `[injishi] ${message}`,
    url ? { ...rest, url: redactUrl(url) } : rest,
  );
}
