import {
  PLATFORM_SESSION_COOKIE_NAMES,
  cookieReaderFor,
  hasSessionCookie,
  isAuthPath,
  verifySessionCookie,
  withoutForeignSessionCookies,
} from "@injishi/auth/edge";
import { signInUrl } from "@/pms/lib/sign-in-url";
import { NextResponse, type NextRequest } from "next/server";


/**
 * The sign-in gate for the operator app (F-S01).
 *
 * Before this file, every PMS screen rendered for anybody who typed its url.
 * The app looked signed in because `initialState()` starts on the host
 * workspace as a manager — demo fixtures meant as a standalone fallback, which
 * a visitor with no session could not tell from a real workspace.
 *
 * WHAT THIS IS. A routing control that now VERIFIES rather than assumes. It
 * used to check only that a session cookie was PRESENT, which a cookie outlives
 * its session by design: a person whose session expired last week still walked
 * past this gate, the app painted "Opening your workspace…", and a client-side
 * round trip discovered the truth and bounced them a second later. Landing on a
 * screen you are not entitled to, even briefly, is the thing this file exists to
 * prevent, so the answer is now fetched here — before any HTML is produced.
 *
 * The cost is one request to `/api/auth/get-session` per document navigation.
 * The matcher below excludes every static asset, so it is per page rather than
 * per file, and `verifySessionCookie` caps it at three seconds.
 *
 * WHAT THE BOUNDARY IS. `SessionGuard` and `WorkspaceGuard` on the API, which
 * read the real session and the real grants. This gate reads the same answer a
 * browser would and decides which SCREEN to show; it is not the boundary and a
 * request that gets past it is still refused there.
 *
 * WHERE IT SENDS THEM. Web's `/sign-in`, not a screen of our own. There is one
 * Better Auth instance and one OTP contract; a second sign-in screen here would
 * be a second place for it to drift. The destination travels as an absolute url
 * on this origin, which web's `safeRedirect` allows only because this origin is
 * on its allowlist.
 */

/**
 * This app's own public origin, for the round trip back.
 *
 * Read from the environment rather than from `request.nextUrl.origin` because
 * behind a proxy the request origin is the internal one, and sending a browser
 * back to `http://0.0.0.0:3002` ends the sign-in it just completed.
 *
 * `||`, not `??`. A Vercel project variable that exists with an empty value is
 * SET, so `??` hands the rest of this file `""` — and `new URL(path, "")`
 * throws, which is a 500 on every page rather than a wrong destination. An
 * empty value means unconfigured, so it takes the fallback like an absent one.
 */
const SELF_URL = process.env.NEXT_PUBLIC_PMS_URL || "http://localhost:3002";

/**
 * Where Better Auth is mounted. Same variable name as web and admin, because a
 * console that verifies against a different deployment than the one issuing the
 * cookies refuses everybody.
 *
 * `||` for the same reason as SELF_URL above: an empty deploy variable is
 * unconfigured, not a valid origin.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * This image was built for the demo (ADR-043). It decides the cookie strip and
 * nothing else, and it comes from the BUILD, never from a network call, so a
 * demo build strips whether or not the API answers. The mock banner and the
 * fixture money actions read `GET /api/v1/platform` instead. Unset means
 * production, which never strips: it would remove its own session.
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
  const pass = () =>
    DEMO_BUILD ? NextResponse.next({ request: { headers } }) : NextResponse.next();

  // Better Auth's own routes are not app screens, and a gate in front of the
  // callback blocks the very exchange that would create the session.
  if (isAuthPath(request.nextUrl.pathname)) return pass();

  // No cookie is a settled answer. Skip the round trip. Production and demo
  // sessions carry different names, and this image serves one of them, so it
  // looks for both and lets the API it was built against say which one counts.
  const cookie = headers.get("cookie") ?? "";
  if (!hasSessionCookie(cookieReaderFor(cookie), PLATFORM_SESSION_COOKIE_NAMES)) {
    return bounce(request, "anonymous");
  }

  const verdict = await verifySessionCookie({ fetch, apiBase: API_URL, cookie });

  if (verdict === "valid") return pass();
  return bounce(request, verdict);
}

/**
 * Send them to sign in, and decide whether the cookie they carried survives.
 *
 * The distinction is the whole reason `verifySessionCookie` answers three ways.
 * `anonymous` means the API looked and found nothing, so the cookie is dead:
 * clearing it stops the browser re-presenting it on every future navigation and
 * paying for a round trip that can only ever say no again. `unreachable` means
 * we never got an answer, and deleting a possibly-live session because the API
 * blinked would sign a working operator out for no reason.
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

/**
 * Everything except the assets a sign-in screen would need anyway.
 *
 * `_next/*` is the build output, and the file extensions cover `public/`, whose
 * paths carry no prefix to match on. Redirecting a stylesheet request to an
 * HTML page does not fail loudly — it renders the gate unstyled, which reads as
 * the app being broken rather than as a gate. Keeping assets out also keeps the
 * session round trip to one per page.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|mjs|map|woff|woff2|ttf|json|txt|xml)$).*)",
  ],
};
