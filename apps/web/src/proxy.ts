import {
  PLATFORM_SESSION_COOKIE_NAMES,
  cookieReaderFor,
  hasSessionCookie,
  isAuthPath,
  verifySessionCookie,
  withoutForeignSessionCookies,
} from "@injishi/auth/edge";
import { NextResponse, type NextRequest } from "next/server";

/**
 * The sign-in gate for the marketplace app (F-S01). Next 16's `proxy.ts`
 * (`middleware.ts` before it), on the Node.js runtime.
 *
 * Web is the one app here that is mostly PUBLIC — the site, /explore and the
 * property pages are meant to be read by strangers, and gating them would be a
 * bug of the opposite kind. So this matcher is an allowlist of the screens that
 * belong to a person, not a blanket over the app.
 *
 * WHAT THIS IS. A routing control that VERIFIES rather than assumes, on the
 * allowlisted prefixes only. It used to check that a session cookie was
 * PRESENT, and a cookie outlives the session it names: a stale one walked past
 * this gate and `/claim-org` rendered — a named business, its registrant, and
 * the owner's name and email address, shown to somebody with no session at all.
 * Before this file existed, `/trips` and the rest rendered their shell
 * for anybody, with `AppShell` writing the words "Not signed in" beside the
 * avatar and showing the workspace anyway.
 *
 * WHAT IT COSTS, AND WHERE. One request to `/api/auth/get-session`, and ONLY on
 * a private prefix. The `isProtected` test below returns first for everything
 * else, so a stranger reading a property page pays nothing — which is the whole
 * reason the allowlist is checked before the session and not after. Getting that
 * order wrong would put a network round trip in front of the marketplace.
 *
 * WHAT THE BOUNDARY IS. `SessionGuard` and `WorkspaceGuard` on the API. This
 * decides which SCREEN a person sees, and it now decides it from a fact.
 */

/**
 * The screens that require a session.
 *
 * Kept as prefixes rather than as a regex over the route groups, because the
 * `(app)` / `(marketplace)` grouping is invisible in the url — middleware sees
 * `/trips`, never `/(app)/(shell)/trips` — so matching on the group
 * would silently match nothing at all. That invisibility is also why ADR-021
 * could move eleven route folders without touching a single line below.
 *
 * `/register` is deliberately absent: it carries its own inline OTP gate
 * (`RegisterGate`), because a person registering a business is signing in for
 * the first time as part of that flow. `/verify-otp` and `/activate` are absent
 * for the same reason — they are steps of sign-in, and gating them locks the
 * door from the inside. `/sign-in` itself is absent for the most obvious reason
 * of all: it is where this gate SENDS people.
 *
 * Those four now live in `(app)/(entry)/`, in the same top-level group as the
 * gated screens (ADR-021). That is a FILE layout, not a security one, and it is
 * not a reason to add them to the list below.
 */
/**
 * The Personal surface plus the one onboarding screen that shows real people.
 *
 * These were `/personal-` and `/broker-` until ADR-018 move 4, prefixes with no
 * routes behind them since the `(app)` group left. The screens exist again now,
 * at plain paths (D-f), so this list has to name the real ones IN THE SAME
 * CHANGE: an authenticated shell behind a matcher pointing at dead prefixes is
 * worse than having no shell at all.
 *
 * Broker is deliberately absent. It is a supply side job and stayed in the
 * operator app under `/w/[ws]/`, which has its own gate.
 */
const PROTECTED_PREFIXES = [
  "/trips",
  "/saved",
  "/lease",
  "/inbox",
  "/account",
  "/claim-org",
  // The guest's own stay and the room service cart. Both sit in the signed-in
  // shell and the property menu page links here on the promise that a reader
  // with no session meets sign in, which it did not (platform audit
  // 2026-09-14, H7).
  "/stay",
  // Accepting a staff invitation writes a membership for the signed-in
  // account, so it needs one (2026-09-13).
  "/join-team",
  // The post-sign-in resolver and the second-factor screens need a session
  // and nothing more (F-S02). The operator zone (/w, /oversight) is gated by
  // its own middleware on the app server the rewrite forwards to.
  "/start",
  "/two-factor",
  // ADR-049 AC-19. The HOLDER's own training record, and deliberately the only
  // gated path under `/training`: the course listing and the dates have to be
  // readable by a stranger with no cookie (AC-1), and `/verify/<token>` has to
  // be readable by anybody holding a printed certificate. `isProtected` below
  // matches the exact path or the prefix followed by a slash, so naming this
  // one gates the record without touching either public page.
  "/training/certificate",
];

/**
 * Exact match, or the prefix followed by a slash.
 *
 * Not `startsWith` alone: `/trips` would then also gate any future public route
 * whose path merely begins with those letters, and a gate that catches more than
 * it names is as much a bug as one that catches less.
 */
function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Where Better Auth is mounted. Same variable name as pms and admin, because an
 * app that verifies against a different deployment than the one issuing the
 * cookies refuses everybody.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * This image was built for the demo (ADR-043). It decides the cookie strip and
 * nothing else, and it comes from the BUILD, never from a network call, so a
 * demo build strips whether or not the API answers. Every screen decision (the
 * code, the persona picker) reads `GET /api/v1/platform` instead. Unset means
 * production, which never strips: it would remove its own session.
 */
const DEMO_BUILD = process.env.NEXT_PUBLIC_INJISHI_ENVIRONMENT === "demo";

export async function proxy(request: NextRequest) {
  // THE FIRST STATEMENT, ahead of every early return, the public bypass
  // included (AC-14). Production's session cookie reaches demo hosts through
  // the shared parent domain; a demo build drops it here, reads cookies only
  // from what is left, and forwards only what is left.
  const headers = DEMO_BUILD
    ? withoutForeignSessionCookies(request.headers)
    : request.headers;
  const pass = () =>
    DEMO_BUILD ? NextResponse.next({ request: { headers } }) : NextResponse.next();

  const { pathname } = request.nextUrl;

  // PUBLIC FIRST after the strip, and it must stay there. Everything below
  // this line costs a network round trip, and the marketplace must not pay it.
  if (!isProtected(pathname)) return pass();

  // Better Auth's own routes are not app screens, and a gate in front of the
  // callback blocks the very exchange that would create the session.
  if (isAuthPath(pathname)) return pass();

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
 * `anonymous` means the API looked and found nothing, so the cookie is dead.
 * Clearing it matters more here than anywhere else: this app HOSTS the sign-in
 * screen, and leaving a corpse cookie in the browser means the screen they are
 * about to use starts by reading a session that does not exist.
 *
 * `unreachable` means we never got an answer, and deleting a possibly-live
 * session because the API blinked would sign a working person out.
 */
function bounce(request: NextRequest, verdict: "anonymous" | "unreachable") {
  const { pathname, search } = request.nextUrl;

  // Same origin, so a path is enough here — and a path is what `safeRedirect`
  // prefers. The cross-origin form is only for pms and admin.
  const signIn = new URL("/sign-in", request.url);
  signIn.searchParams.set("redirect", `${pathname}${search}`);

  const response = NextResponse.redirect(signIn);
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
