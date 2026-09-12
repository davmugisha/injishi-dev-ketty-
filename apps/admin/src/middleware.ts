import {
  PLATFORM_SESSION_COOKIE_NAMES,
  cookieReaderFor,
  hasSessionCookie,
  isAuthPath,
  verifySessionCookie,
  withoutForeignSessionCookies,
} from "@injishi/auth/edge";
import { RETURN_HEADER } from "@/lib/return-path";
import { signInUrl } from "@/lib/sign-in-url";
import { NextResponse, type NextRequest } from "next/server";


/**
 * The sign-in gate for the admin console (F-S01).
 *
 * This app had no authentication of any kind. Not a weak check — none: no
 * session read, no sign-in screen, and no call to the API at all. `/` redirected
 * to `/overview` and every screen rendered from local fixtures, for anybody who
 * reached the origin. `roleLens` made it worse by defaulting to `super_admin`,
 * so the console opened wearing the highest role in the system.
 *
 * WHAT THIS IS. A routing control that now VERIFIES rather than assumes. It
 * used to check only that a session cookie was PRESENT, and a cookie outlives
 * the session it names: a stale one walked past this gate, the console painted
 * "Checking your access…", and only then did a client-side round trip bounce
 * them. That intermediate screen is a screen they were not entitled to, so the
 * question is now asked here, before any HTML exists.
 *
 * It still says nothing about whether the holder is STAFF — a guest's perfectly
 * valid session satisfies it. `StaffBoundary` asks `/api/v1/me/staff` for that
 * second answer, and the API is the boundary for both.
 *
 * Two checks rather than one because they fail differently and must: no session
 * is "sign in", and a live session belonging to a non-staff account is "this is
 * not yours" — sending the second person to a sign-in screen they have already
 * passed is a loop. That is why this file refuses only on the first question.
 */

/**
 * This console's own public origin, for the round trip back.
 *
 * From the environment rather than `request.nextUrl.origin`, which behind a
 * proxy is the internal address; returning a browser to it ends the sign-in it
 * just completed.
 */
const SELF_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";

/**
 * Where Better Auth is mounted. Same variable name as web and pms, because a
 * console that verifies against a different deployment than the one issuing the
 * cookies refuses everybody.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * This image was built for the demo (ADR-043). It decides the cookie strip and
 * nothing else, and it comes from the BUILD, never from a network call, so a
 * demo build strips whether or not the API answers. Unset means production,
 * which never strips: it would remove its own session.
 */
const DEMO_BUILD = process.env.NEXT_PUBLIC_INJISHI_ENVIRONMENT === "demo";

export async function middleware(request: NextRequest) {
  // THE FIRST STATEMENT, ahead of every early return (AC-14). Production's
  // session cookie reaches demo hosts through the shared parent domain; a demo
  // build drops it here, reads cookies only from what is left, and forwards
  // only what is left.
  const headers = DEMO_BUILD
    ? withoutForeignSessionCookies(request.headers)
    : request.headers;

  // Better Auth's own routes are not console screens, and a gate in front of
  // the callback blocks the very exchange that would create the session.
  if (isAuthPath(request.nextUrl.pathname)) {
    return DEMO_BUILD ? NextResponse.next({ request: { headers } }) : NextResponse.next();
  }

  // No cookie is a settled answer. Skip the round trip. Production and demo
  // sessions carry different names, and this image serves one of them, so it
  // looks for both and lets the API it was built against say which one counts.
  const cookie = headers.get("cookie") ?? "";
  if (!hasSessionCookie(cookieReaderFor(cookie), PLATFORM_SESSION_COOKIE_NAMES)) {
    return bounce(request, "anonymous");
  }

  const verdict = await verifySessionCookie({ fetch, apiBase: API_URL, cookie });

  if (verdict === "valid") {
    // Hand the requested path to the server components below. A server
    // component is not told the url it is rendering, so without this the
    // staff boundary could only send a staffer back to the console's ROOT
    // after the emailed code — someone who opened /finance/payouts landed on
    // /overview and had to find their way back. The header is SET here on
    // every console request, so a value a client sent under the same name is
    // overwritten rather than trusted; the boundary still re-checks it. Built
    // from the stripped headers, so a demo build forwards no production cookie.
    const forwarded = new Headers(headers);
    forwarded.set(RETURN_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.next({ request: { headers: forwarded } });
  }
  return bounce(request, verdict);
}

/**
 * Send them to sign in, and decide whether the cookie they carried survives.
 *
 * `anonymous` means the API looked and found nothing, so the cookie is dead and
 * clearing it stops the browser re-presenting it forever. `unreachable` means we
 * never got an answer, and deleting a possibly-live session because the API
 * blinked would sign a working staffer out for no reason.
 */
function bounce(request: NextRequest, verdict: "anonymous" | "unreachable") {
  const { pathname, search } = request.nextUrl;
  const returnTo = new URL(`${pathname}${search}`, SELF_URL).toString();
  const response = NextResponse.redirect(signInUrl(returnTo));

  if (verdict === "anonymous") {
    for (const name of PLATFORM_SESSION_COOKIE_NAMES) {
      response.cookies.delete(name);
    }
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|woff|woff2|ttf|json|txt|xml)$).*)",
  ],
};
