/**
 * The waitlist gate's two matchers (ADR-048).
 *
 * THEY LIVE HERE, APART FROM `middleware.ts`, FOR ONE REASON. Host scoping is
 * what lets this feature exist with no flag and no environment variable, and
 * the cost ADR-048 accepts for that is stated plainly in its Consequences: the
 * gate's code path NEVER RUNS anywhere but production. Not on a laptop, not on
 * staging, not on the demo host. Nothing exercises it until the day it matters.
 *
 * The mitigation the decision names is that these two matchers are covered by
 * unit tests. They cannot be, inside `middleware.ts`: that module imports
 * `next/server` and `@injishi/auth/edge`, so a test would have to stub the edge
 * runtime to reach a string comparison. As plain functions with no imports at
 * all, they are loaded and run directly by `tests/waitlist-gate.test.mjs`.
 *
 * So this file is not tidiness. It is the difference between a mitigation that
 * was written down and one that exists.
 */

/**
 * The two hosts the product is not launched on.
 *
 * A plain constant and not an environment variable, deliberately: a gate with a
 * flag is a gate that can be left on, left off, or set differently on two
 * replicas. This one cannot. Launch day DELETES this feature rather than
 * emptying this list, which is what `WAITLIST-REMOVAL.md` is for.
 *
 * Adding a staging host here for a rehearsal, and taking it out again, is the
 * intended way to exercise the gate before the day.
 */
export const GATED_HOSTS = ["www.injishi.com", "injishi.com"];

/**
 * Lower-cased with any `:port` stripped, so `WWW.Injishi.com` and
 * `www.injishi.com:443` both match (AC-1).
 *
 * An IPv6 literal keeps its brackets and its own colons, which is why the port
 * is only cut from the last colon when there is no bracket to protect. A naive
 * `split(":")[0]` turns `[::1]:3000` into `[`, which matches nothing and would
 * silently open the gate on any host spelled that way.
 */
export function normalizeHost(raw: string | null | undefined): string {
  if (!raw) return "";
  const host = raw.trim().toLowerCase();
  if (host.startsWith("[")) {
    const close = host.indexOf("]");
    return close === -1 ? host : host.slice(0, close + 1);
  }
  const colon = host.lastIndexOf(":");
  return colon === -1 ? host : host.slice(0, colon);
}

export function isGatedHost(raw: string | null | undefined): boolean {
  return GATED_HOSTS.includes(normalizeHost(raw));
}

/**
 * What stays reachable while the gate is up (AC-2).
 *
 * Three groups, and each is here for a reason worth keeping:
 *
 * - `/waitlist` and below, because it is where the gate SENDS people, and a
 *   gate that redirects its own destination takes the site down.
 * - The sign-in path (`/sign-in`, `/verify-otp`, `/two-factor`, `/start`),
 *   because the whole point of this design is that pilot operators and staff
 *   keep reaching the real product on the real domain. The waitlist page links
 *   to `/sign-in` in its footer for exactly this reason (AC-19b).
 * - `/support`, `/legal/privacy` and `/legal/terms`, because the page links to
 *   all three and Law 058/2021 expects the privacy notice to be readable by the
 *   person being asked for their details.
 *
 * - `/training` and `/verify`, because ADR-049 ships before launch. A printed
 *   certificate's QR points at `/verify/<token>` on this very domain, so gating
 *   it makes every certificate unverifiable for as long as the waitlist stands,
 *   and `/training` is how a pilot host registers for the session that issues
 *   one.
 *
 * `/register`, `/activate`, `/claim-org`, `/explore` and `/property` are all
 * deliberately absent: they are the unfinished marketplace this gate covers.
 *
 * Next's static asset paths are not listed because the `matcher` at the foot of
 * `middleware.ts` already keeps middleware off them entirely. `/api/auth/` is
 * not listed either: `isAuthPath` owns that test and the middleware consults it.
 */
export const WAITLIST_OPEN_PREFIXES = [
  "/waitlist",
  "/sign-in",
  "/verify-otp",
  "/two-factor",
  "/start",
  "/support",
  "/legal/privacy",
  "/legal/terms",
  "/training",
  "/verify",
];

/**
 * Exact match, or the prefix followed by a slash: the same rule `isProtected`
 * uses, and never a bare `startsWith`.
 *
 * A bare prefix test would open `/supporters` along with `/support`, and
 * `/sign-in-to-something-else` along with `/sign-in`. An allowlist that opens
 * more than it names is the same class of bug as a gate that catches more than
 * it names, and on this gate it is the one that leaks the product.
 */
export function isWaitlistOpen(pathname: string): boolean {
  return WAITLIST_OPEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
