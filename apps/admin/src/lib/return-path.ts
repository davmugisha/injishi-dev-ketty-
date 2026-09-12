/**
 * Getting a staffer back to the page they asked for, after a detour.
 *
 * Two detours leave this console and come back: sign-in and the emailed code
 * (F-S02). Both live on web, and both need an ABSOLUTE url on this console's
 * origin to return to, which web accepts only because that origin is on its
 * exact-origin allowlist (`apps/web/src/lib/redirect.ts`).
 *
 * The page that needs the url cannot see it: `StaffBoundary` is a server
 * component, and a server component is not told the url it is rendering. So
 * `middleware.ts` passes the path down in a request header and the boundary
 * reads it back. This module is the one place both sides agree on, and it
 * imports nothing from `next/headers` so the edge middleware can load it.
 */

/** The request header the middleware sets and the boundary reads. */
export const RETURN_HEADER = "x-admin-return-path";

/**
 * Turn the forwarded path into an absolute url on `adminOrigin`, or fall back
 * to the console's root.
 *
 * The header is set by the middleware on every console request, overwriting
 * anything a client sent under that name — but this still re-checks it,
 * because a value read from a request header is a value from a request. It is
 * resolved against the admin origin with the real url parser and accepted only
 * if it is STILL on that origin. A prefix check would not do: the parser strips
 * tabs and newlines and reads `\` as `/`, which is exactly how web's own
 * redirect check was bypassed (`/\t/evil.com` → `http://evil.com/`).
 */
export function returnUrl(forwardedPath: string | null, adminOrigin: string): string {
  const root = new URL("/", adminOrigin).toString();
  if (!forwardedPath || !forwardedPath.startsWith("/")) return root;
  try {
    const origin = new URL(adminOrigin).origin;
    const url = new URL(forwardedPath, origin);
    return url.origin === origin ? url.toString() : root;
  } catch {
    return root;
  }
}
