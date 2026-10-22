import {
  cookieReaderFor,
  hasSessionCookie,
  PLATFORM_SESSION_COOKIE_NAMES,
  withoutForeignSessionCookies,
} from "@injishi/auth/edge";
import { screenByPath } from "@injishi/data";
import { type NextRequest, NextResponse } from "next/server";
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
  const headers = DEMO_BUILD ? withoutForeignSessionCookies(request.headers) : request.headers;
  const pass = () => (DEMO_BUILD ? NextResponse.next({ request: { headers } }) : NextResponse.next());
  const { pathname, search } = request.nextUrl;
  const screen = screenByPath(pathname);
  if (!screen || screen.persona === null) return pass();
  if (hasSessionCookie(cookieReaderFor(headers.get("cookie")), PLATFORM_SESSION_COOKIE_NAMES)) return pass();
  const url = request.nextUrl.clone();
  url.pathname = "/sign-in";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|stock/|brand/|favicon|.*\\.[a-z0-9]+$).*)"],
};
