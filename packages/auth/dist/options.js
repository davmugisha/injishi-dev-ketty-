/**
 * Shared auth constants (F-S01). Single source of truth so backend and every
 * client agree on OTP shape and identity rules.
 */
/** OTP is a 6-digit numeric code. */
export const OTP_LENGTH = 6;
/** OTP is valid for 10 minutes (F-S01 §9 "OTP expiry (10 min)"). */
export const OTP_EXPIRY_SECONDS = 600;
/**
 * How many wrong guesses a code tolerates before it is invalidated
 * (Better Auth's `allowedAttempts`). This is the brute-force backstop on
 * *verifying* a code.
 *
 * It is NOT request throttling: that is the separate send cap below, keyed by
 * identifier rather than by IP, which is what F-S01 §9 asked for and ADR-039
 * built. Better Auth's own limiter still exists and is still keyed by IP; it is
 * a backstop, not the rule.
 */
export const OTP_MAX_ATTEMPTS = 5;
/**
 * The send cap (ADR-039, AC-12). How many codes ONE identifier — a phone number
 * or a lowercased email address — may have SENT to it.
 *
 * Constants rather than environment variables on purpose. Every client and the
 * server read one definition, and no deployment can quietly widen a spend cap
 * that sits behind an endpoint anyone on the internet can reach.
 *
 * Two fixed windows that reset independently, not a sliding log: cheaper, easier
 * to reason about, and the small burst allowed at a window boundary is bounded
 * by the daily figure anyway.
 */
export const OTP_MAX_PER_HOUR = 5;
/** The daily half of the same cap. See `OTP_MAX_PER_HOUR`. */
export const OTP_MAX_PER_DAY = 15;
/**
 * How long sending stops for once an identifier is over its cap.
 *
 * READ THIS AS "STOPS SENDING", NEVER AS "LOCKS THE ACCOUNT" (AC-12b). The
 * endpoint that spends this budget is public, so a cap that locked an identifier
 * would be a weapon: anyone who knows a number could hold its owner's sign in
 * shut for as long as they cared to, for free. The person keeps their email
 * route, keeps any session they already hold, and is told so.
 */
export const OTP_LOCK_SECONDS = 3600;
/**
 * A second cap, per calling IP address, on top of the per identifier one.
 *
 * The per identifier cap alone does not stop one attacker walking many numbers
 * cheaply, and Rwandan mobile numbers sit in a space small enough to walk.
 */
export const OTP_MAX_PER_IP_HOUR = 30;
/** Better Auth mounts version-neutral, outside the product `/api/v1` prefix. */
export const AUTH_BASE_PATH = "/api/auth";
/**
 * The fixed sign-in code the DEMO environment issues, so a demo works with no
 * mailbox. Wired only into the demo auth instance (see server.ts
 * `demoOtpCode`); production issues random codes. It is a real OTP — generated,
 * hashed at rest, verified normally — just deterministic.
 */
export const DEMO_OTP_CODE = "123456";
/**
 * The cookie prefix the DEMO environment's session cookie is named with.
 *
 * Production and demo are served by one API on sibling hosts under one parent
 * domain (`api.injishi.com`, `api-demo.injishi.com`), and both set their cookie
 * on that parent so the frontends can read it. Under one name the two sessions
 * overwrite each other in a browser, so signing in to the demo signs a person
 * out of production. A demo session is also minted with a code anyone can read
 * (`DEMO_OTP_CODE`), which is a second reason it must never travel under the
 * name production reads.
 *
 * The API names the demo instance's cookie with this prefix, and every edge gate
 * reads it through `PLATFORM_SESSION_COOKIE_NAMES` in `./edge`. The two change
 * together or a signed-in demo visitor is bounced to sign in forever.
 */
export const DEMO_COOKIE_PREFIX = "injishi-demo";
//# sourceMappingURL=options.js.map