/**
 * The Better Auth session cookie, which the browser holds and the app, web and the API all read.
 *
 * The app used to keep the API's session in a private `ij_session` cookie of its own. Web never saw it,
 * so a person who signed in here was a stranger on web: checkout, the claim and staff invitation links
 * and the personal pages all bounced them back to sign in, and that led back here. Now sign-in hands
 * the browser the cookie the API set, under the API's own name, domain and expiry, so there is one
 * session and one sign-out for every app.
 *
 * No `next/*` imports: the verify scripts and the route handlers use these too.
 */

import { DEMO_COOKIE_PREFIX, isProductionSessionCookie, MARKETPLACE_COOKIE_PREFIX } from "@injishi/auth/edge";
import type { SessionCookie } from "./api";

/** Every name a Better Auth cookie of this platform starts with, production or demo, plain or over https. */
const AUTH_COOKIE_PREFIXES = [MARKETPLACE_COOKIE_PREFIX, DEMO_COOKIE_PREFIX].flatMap((p) => [
  `${p}.`,
  `__Secure-${p}.`,
]);

/**
 * This image was built for the demo (ADR-043). Production's session cookie reaches demo hosts through the
 * shared parent domain, and a demo build never reads or forwards it (`withoutForeignSessionCookies`).
 */
export const DEMO_BUILD = process.env.NEXT_PUBLIC_INJISHI_ENVIRONMENT === "demo";

/** Whether a cookie is one of Better Auth's (the session token, its cache, its "don't remember" flag). */
export function isAuthCookie(name: string): boolean {
  return AUTH_COOKIE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * The `Cookie` header to send the API for the browser's session, or null when the browser holds none.
 * Only Better Auth's own cookies travel: the API has no business with anything else the browser holds.
 * Values arrive decoded (Next decodes cookies) and are re-encoded the way the API wrote them.
 */
export function sessionCookieHeader(
  cookies: readonly { name: string; value: string }[],
  demoBuild: boolean = DEMO_BUILD,
): SessionCookie | null {
  const pairs = cookies
    .filter((c) => c.value && isAuthCookie(c.name) && !(demoBuild && isProductionSessionCookie(c.name)))
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`);
  return pairs.some((p) => /\.session_token=/.test(p)) ? pairs.join("; ") : null;
}

/** One `Set-Cookie` the API sent, ready to set again on the browser from this app's origin. */
export interface ForwardedCookie {
  name: string;
  /** Decoded: the cookie store encodes it again when it writes the header. */
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "lax" | "strict" | "none";
}

/**
 * Read one `Set-Cookie` line. Every attribute the API chose is kept, the `Domain` above all: deployed it
 * is the shared parent (`.injishi.com`, AUTH_COOKIE_DOMAIN), which is what lets web and the API read the
 * cookie this app sets. Locally there is none, and a host-only `localhost` cookie reaches every port.
 */
export function parseSetCookie(line: string): ForwardedCookie | null {
  const [pair, ...attrs] = line.split(";").map((part) => part.trim());
  const eq = pair.indexOf("=");
  if (eq < 1) return null;
  const name = pair.slice(0, eq);
  let value = pair.slice(eq + 1);
  try {
    value = decodeURIComponent(value);
  } catch {
    // Not percent-encoded after all; keep it as written.
  }
  const cookie: ForwardedCookie = { name, value, httpOnly: false, secure: false };
  for (const attr of attrs) {
    const at = attr.indexOf("=");
    const key = (at === -1 ? attr : attr.slice(0, at)).trim().toLowerCase();
    const raw = at === -1 ? "" : attr.slice(at + 1).trim();
    if (key === "domain" && raw) cookie.domain = raw;
    else if (key === "path" && raw) cookie.path = raw;
    else if (key === "expires" && raw) {
      const date = new Date(raw);
      if (!Number.isNaN(date.getTime())) cookie.expires = date;
    } else if (key === "max-age" && raw && Number.isFinite(Number(raw))) cookie.maxAge = Number(raw);
    else if (key === "httponly") cookie.httpOnly = true;
    else if (key === "secure") cookie.secure = true;
    else if (key === "samesite") {
      const same = raw.toLowerCase();
      if (same === "lax" || same === "strict" || same === "none") cookie.sameSite = same;
    }
  }
  return cookie;
}

/** The Better Auth cookies a response set, to hand on to the browser. Anything else it set stays behind. */
export function authCookiesFrom(response: Response): ForwardedCookie[] {
  return response.headers
    .getSetCookie()
    .map(parseSetCookie)
    .filter((c): c is ForwardedCookie => c !== null && isAuthCookie(c.name));
}

/** The `Cookie` header the API would read back from a set of cookies it just set (a live session only). */
export function cookieHeaderFor(cookies: readonly ForwardedCookie[]): SessionCookie | null {
  return sessionCookieHeader(
    cookies.filter((c) => c.maxAge !== 0),
    false,
  );
}
