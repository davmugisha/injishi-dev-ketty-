import { signInUrlFor } from "@injishi/auth/edge";

/**
 * Where the admin console sends someone to sign in (F-S01).
 *
 * The url is BUILT in `@injishi/auth/edge`, which admin and pms share, so the
 * shape of the destination is defined once. What stays here is the one thing
 * that is genuinely this app's own: which web origin to send them to.
 *
 * The env read stays in app source on purpose. `NEXT_PUBLIC_*` is inlined at
 * build time by the app's own bundler, and `@injishi/auth` is consumed as
 * prebuilt output that no app lists in `transpilePackages` — so a read moved
 * into the package would sit somewhere the replacement may never reach.
 */
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

/**
 * This console's own public origin, for the round trip back from web.
 *
 * From the environment rather than a request header: behind a proxy the
 * request's own origin is the internal address, and returning a browser to it
 * ends the sign-in it just completed.
 */
export const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? "http://localhost:3001";

/** Sign-in, carrying an absolute url to come back to. */
export function signInUrl(returnTo: string): string {
  return signInUrlFor(WEB_URL, returnTo);
}

/**
 * Web's emailed-code screen (F-S02), carrying an absolute url to come back to.
 * Web owns it exactly as it owns sign-in; this console must not grow a second.
 */
export function twoFactorUrl(returnTo: string): string {
  const url = new URL("/two-factor/verify", WEB_URL);
  url.searchParams.set("redirect", returnTo);
  return url.toString();
}
