/**
 * The session cookie, as seen from an edge runtime (F-S01).
 *
 * Next.js middleware runs before a page and is the only place an app can refuse
 * a request without first rendering it. It cannot call `getSession()` — there is
 * no react there, and an awaited round trip on every navigation is not a gate,
 * it is a stall. So the gate reads the cookie instead.
 *
 * This is a FOURTH entry point on purpose, and it must stay separate from the
 * other three. `./server` drags Better Auth's Drizzle adapter, `./client` drags
 * react, and `.` re-exports the server. Middleware can afford neither, so this
 * file imports nothing but the shared constants and depends on no runtime at
 * all — it is handed a reader and returns a boolean.
 *
 * WHAT THIS IS NOT. A cookie being present does not mean it is valid: nothing
 * here verifies a signature, checks an expiry, or reads the database. It cannot,
 * and it does not try. A forged cookie of the right name walks straight past
 * this check and is then refused by `SessionGuard` and `WorkspaceGuard` on the
 * API, which read the real session and are the actual boundary.
 *
 * So this is a routing control, not a security control. Its whole job is to
 * send a signed-out visitor to the sign-in screen instead of painting a
 * workspace shell that every subsequent request will refuse to fill.
 */
import { DEMO_COOKIE_PREFIX } from "./options.js";
export { DEMO_COOKIE_PREFIX };
/**
 * Better Auth's own default cookie prefix, and therefore the marketplace's.
 *
 * The three marketplace apps (web, pms, admin) have always run on it, so it
 * stays the default here and nothing about them moves.
 */
export declare const MARKETPLACE_COOKIE_PREFIX = "better-auth";
/**
 * Both names a session signed with `prefix` may arrive under, cheapest first.
 *
 * Two names for one cookie, because Better Auth turns on `useSecureCookies`
 * automatically when the base URL is https, and that RENAMES the cookie rather
 * than only adding a flag. Production sees one name and development the other,
 * so a gate that knows only one works locally and locks every user out on
 * deploy.
 *
 * A SECOND SURFACE PASSES ITS OWN PREFIX. `createAuth({ cookiePrefix })` sets
 * it on the server; this sets the matching names on the gate. The two must
 * change together: `getSessionCookie` in Better Auth does not read the server
 * config either, and a gate looking for the wrong name fails OPEN in the worst
 * way — it sees no cookie, so it bounces a signed-in person to sign in forever.
 */
export declare function sessionCookieNames(prefix?: string): readonly string[];
/** The marketplace session cookie. */
export declare const SESSION_COOKIE_NAME = "better-auth.session_token";
/** The same cookie over HTTPS. */
export declare const SESSION_COOKIE_NAME_SECURE = "__Secure-better-auth.session_token";
/** Both names a marketplace session may arrive under, cheapest first. */
export declare const SESSION_COOKIE_NAMES: readonly string[];
/** Both names a DEMO session may arrive under. See `DEMO_COOKIE_PREFIX`. */
export declare const DEMO_SESSION_COOKIE_NAMES: readonly string[];
/**
 * Every name a marketplace session may arrive under, production or demo.
 *
 * What a frontend gate should look for. One image serves one environment, but
 * the gate does not need to know which: presence only decides whether the API
 * is worth asking, and `verifySessionCookie` then asks the API the image was
 * built against, which reads only its own environment's cookie. A production
 * cookie reaching a demo frontend therefore still verifies as `anonymous`.
 *
 * It also keeps local development working, where every localhost request is
 * the demo environment and a gate reading only the production names would
 * bounce a signed-in developer forever.
 */
export declare const PLATFORM_SESSION_COOKIE_NAMES: readonly string[];
/**
 * The government console's cookie prefix: `OVERSIGHT_AUTH_COOKIE_NAME`'s
 * default in the API, and the only value any deployment uses. A demo process
 * names its console cookie `${OVERSIGHT_COOKIE_PREFIX}-demo` (ADR-043 AC-8).
 */
export declare const OVERSIGHT_COOKIE_PREFIX = "injishi-oversight";
/** Whether a cookie of this name belongs to a production session. */
export declare function isProductionSessionCookie(name: string): boolean;
/**
 * A `Cookie` header with every production session cookie removed (ADR-043,
 * AC-14). Everything else (theme, locale, the demo's own session) passes
 * untouched and in order.
 *
 * WHY THE DEMO NEEDS THIS. Production and the demo both set cookies on the
 * parent domain (`.injishi.com`), so a person signed in to production carries
 * that session cookie to every demo host. The demo holds no production secret
 * and could never verify it, but it would still LOG it and hand it to whatever
 * code reads the request. So a demo process drops it before anything reads the
 * request: the API in its first request hook, and the demo web, app and admin
 * as the first statement of their middleware.
 *
 * Called only in a demo build or process. Production must never run it: it
 * would strip production's own session. Never throws; an empty or missing
 * header comes back as "".
 */
export declare function dropForeignSessionCookies(cookieHeader: string | null | undefined): string;
/**
 * A copy of a middleware's request headers with production's session cookies
 * removed. A demo build's middleware computes this as its FIRST statement, reads
 * cookies only from it, and forwards it with `NextResponse.next({ request: {
 * headers } })`, so no page, route or Server Action below ever sees the
 * production value (ADR-043, AC-14).
 *
 * `Headers` is the caller's, and so is the constructor used on it: nothing here
 * reaches for a global at module scope.
 */
export declare function withoutForeignSessionCookies(headers: Headers): Headers;
/**
 * A `CookieReader` over a raw `Cookie` header, for a middleware that must read
 * the cookies of its stripped headers rather than `request.cookies`, which
 * still holds what the browser sent.
 */
export declare function cookieReaderFor(cookieHeader: string | null | undefined): CookieReader;
/**
 * Reads a cookie by name. `NextRequest.cookies.get` satisfies this, and so does
 * a plain map in a test, which is the reason the signature is a function rather
 * than a request: this file never imports `next`.
 */
export type CookieReader = (name: string) => {
    value?: string;
} | string | undefined | null;
/**
 * Whether a session cookie is present under either name. Never throws.
 *
 * `names` defaults to the marketplace pair, so the three existing apps call it
 * exactly as before. A surface with its own `cookiePrefix` passes its own, from
 * `sessionCookieNames(prefix)`.
 */
export declare function hasSessionCookie(read: CookieReader, names?: readonly string[]): boolean;
/**
 * Whether a path belongs to Better Auth rather than to the app.
 *
 * A gate that matches `/api/auth/*` blocks the very callback that would create
 * the session, so every app's matcher has to exclude it and they may not
 * disagree about where it sits. `AUTH_BASE_PATH` is that one definition.
 */
export declare function isAuthPath(pathname: string): boolean;
/**
 * Sign-in on the web app, carrying an absolute url to come back to.
 *
 * There is one sign-in screen and it is on web. pms and admin must never grow
 * their own: a second screen is a second place for the OTP contract to drift,
 * and this package exists precisely so there is one. Both apps held a
 * byte-identical copy of this builder, which is how one of them ends up
 * redirecting to a host web's allowlist no longer accepts — and an unrecognised
 * origin lands the person on `/` with no explanation instead of back where they
 * were.
 *
 * `webUrl` is a PARAMETER rather than a `process.env` read, and that is
 * deliberate. This file promises above that it depends on no runtime at all;
 * reading `process` here would break that promise, and typing it would mean
 * adding `@types/node` to a package that has no Node dependency. The origin is
 * also per deployment, so it belongs in app code where the bundler already
 * inlines `NEXT_PUBLIC_WEB_URL` — moving that read into a prebuilt package
 * would put it somewhere no app currently transpiles.
 *
 * `returnTo` must already be absolute: the destination is on a different origin
 * from the sign-in screen, and web's `safeRedirect` accepts it only because the
 * calling app's origin is on its allowlist. The two are configured together or
 * not at all.
 */
export declare function signInUrlFor(webUrl: string, returnTo: string): string;
/**
 * What a cookie turned out to be worth.
 *
 * Three answers rather than a boolean, because collapsing the third into either
 * of the others produces a wrong action. `anonymous` means the server looked and
 * found nothing, so the cookie is dead and may be cleared. `unreachable` means
 * we never got an answer, so the cookie may be perfectly good and clearing it
 * would destroy a live session over a network blip.
 */
export type SessionVerdict = "valid" | "anonymous" | "unreachable";
/**
 * Everything the verifier needs, handed in rather than imported.
 *
 * `fetch` is a parameter for the same reason `webUrl` is one on `signInUrlFor`:
 * this file promises above that it depends on no runtime, and a module-scope
 * reference to a global would make that promise false in any environment that
 * lacks it. The caller is middleware, which always has one.
 */
export interface VerifySessionInput {
    fetch: typeof globalThis.fetch;
    /** Origin the API is served from. Better Auth is mounted under it. */
    apiBase: string;
    /** The request's raw `Cookie` header, forwarded verbatim. */
    cookie: string;
    /** Ceiling on the round trip. */
    timeoutMs?: number;
}
/**
 * How long to wait for the session answer before giving up.
 *
 * A gate that awaits an unbounded fetch is not a gate, it is a hang: when the
 * API refuses the connection the request can stay pending and the navigation
 * never resolves. Short, because this sits in front of every document request.
 */
export declare const VERIFY_SESSION_TIMEOUT_MS = 3000;
/**
 * Whether the cookie on this request stands for a live session (F-S01).
 *
 * `hasSessionCookie` above answers "is there a cookie", which is all an edge
 * runtime can answer for free, and is what every app's middleware used to gate
 * on. It is not enough: a cookie outlives the session it names, so a person
 * whose session expired a week ago still walks past it, the app paints a shell,
 * and only a client-side round trip discovers the truth and bounces them. That
 * bounce is a visible wrong screen, and on the operator app it was a whole demo
 * workspace.
 *
 * So this asks. It is one extra request per document navigation, deliberately
 * accepted: the alternative is rendering an app we already know we cannot fill.
 * Static assets never reach here — every app's matcher excludes them — so the
 * cost is per page, not per file.
 *
 * NOT A SECURITY BOUNDARY, still. It reads the same answer the browser would
 * get, and a caller could lie about `apiBase`. `SessionGuard` and
 * `WorkspaceGuard` on the API remain the boundary. This decides which SCREEN a
 * person sees, and it now decides it from a fact instead of from a guess.
 *
 * Never throws. Every failure route lands on `unreachable`, because a verifier
 * that can throw turns a middleware into a 500 and a 500 is not a sign-in page.
 */
export declare function verifySessionCookie(input: VerifySessionInput): Promise<SessionVerdict>;
/**
 * Whether a `get-session` body describes a session that exists.
 *
 * Exported so the shape this code trusts can be tested without a server, and
 * narrow on purpose: `null` is the documented "no session" body, and a body
 * that parses but carries no `session` object is not something to read a user
 * out of. Anything unrecognised is treated as no session rather than as yes —
 * a verifier that fails open is the bug it was written to remove.
 */
export declare function isLiveSession(body: unknown): boolean;
//# sourceMappingURL=edge.d.ts.map