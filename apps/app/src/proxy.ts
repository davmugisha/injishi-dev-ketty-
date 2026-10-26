import {
  cookieReaderFor,
  hasSessionCookie,
  PLATFORM_SESSION_COOKIE_NAMES,
  withoutForeignSessionCookies,
} from "@injishi/auth/edge";
import { screenByPath } from "@injishi/data";
import { type NextRequest, NextResponse } from "next/server";
import { isSetupPath } from "@/lib/setup-path";
import { DEMO_BUILD } from "@/server/session-cookies";

/**
 * Route guard (Next.js 16 proxy). Public screens pass; protected screens need a session cookie,
 * otherwise the visitor goes to sign-in and comes back afterwards. Pages still verify the session
 * and the persona's access with `requireScreen`.
 *
 * The cookie is Better Auth's own, shared with web and the API, under any name a session of this
 * platform may carry. A demo build first drops production's session, which reaches demo hosts through
 * the shared parent domain, and forwards only what is left (ADR-043, AC-14).
 */
export function proxy(request: NextRequest) {
  const own = ownHostFor(request);
  if (own) return NextResponse.redirect(own);
  const headers = DEMO_BUILD ? withoutForeignSessionCookies(request.headers) : request.headers;
  const pass = () => (DEMO_BUILD ? NextResponse.next({ request: { headers } }) : NextResponse.next());
  const { pathname, search } = request.nextUrl;
  const screen = screenByPath(pathname);
  // The property setup page is not a registered screen, but it is never public (lib/setup-path.ts).
  const gated = screen ? screen.persona !== null : isSetupPath(pathname);
  if (!gated) return pass();
  if (hasSessionCookie(cookieReaderFor(headers.get("cookie")), PLATFORM_SESSION_COOKIE_NAMES)) return pass();
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

function hostOf(raw: string | undefined): string | null {
  try {
    return raw ? new URL(raw).host : null;
  } catch {
    return null;
  }
}

const APP_URL = (process.env.NEXT_PUBLIC_PMS_URL || "").replace(/\/$/, "");
const APP_HOST = hostOf(APP_URL);
const WEB_HOST = hostOf(process.env.NEXT_PUBLIC_WEB_URL);

/**
 * The same page on this app's own host, for a visit that reached it through web's zone; null otherwise.
 *
 * Production serves this app on its own host with its screens at the root, while web still forwards `/w`,
 * `/oversight` and `/officer` to it, and the registration mails link there. A page rendered under web's
 * origin had a shell whose every link (`/owner`, `/rates`, `/notifications` …) was a path web does not
 * forward, so each one 404ed. Web's rewrite names the visitor's host in `x-forwarded-host`; a visit
 * naming web's host is sent here, path and query kept. Reads only: a form post is never redirected.
 * Nothing changes where the app shares web's origin.
 */
function ownHostFor(request: NextRequest): string | null {
  if (!APP_HOST || !WEB_HOST || APP_HOST === WEB_HOST) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
  if (forwarded !== WEB_HOST.toLowerCase()) return null;
  // Next turns a redirect to the server's OWN address (its bind host and port, which is what `nextUrl`
  // carries) into a relative one, and the browser would resolve that against web again, forever. That
  // happens only where this server listens at its public url, a laptop's `localhost:3002`; a deployed one
  // listens on `0.0.0.0:3002` behind its host, so the absolute address survives.
  if (request.nextUrl.host.toLowerCase() === APP_HOST.toLowerCase()) return null;
  const { pathname, search } = request.nextUrl;
  return `${APP_URL}${pathname}${search}`;
}

export const config = {
  matcher: ["/((?!_next/|api/|stock/|brand/|favicon|.*\\.[a-z0-9]+$).*)"],
};
