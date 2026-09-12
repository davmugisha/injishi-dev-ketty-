import { signInUrlFor } from "@injishi/auth/edge";

/**
 * Where this app sends someone to sign in (F-S01).
 *
 * The url is BUILT in `@injishi/auth/edge`, which pms and admin share, so the
 * shape of the destination is defined once. What stays here is the one thing
 * that is genuinely this app's own: which web origin to send them to.
 *
 * The env read stays in app source on purpose. `NEXT_PUBLIC_*` is inlined at
 * build time by the app's own bundler, and `@injishi/auth` is consumed as
 * prebuilt output that no app lists in `transpilePackages` — so a read moved
 * into the package would sit somewhere the replacement may never reach.
 */
export const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000";

/** Sign-in, carrying an absolute url to come back to. */
export function signInUrl(returnTo: string): string {
  return signInUrlFor(WEB_URL, returnTo);
}

/**
 * The step-up screen lives on web beside sign-in, for the same reason sign-in
 * does: one Better Auth instance, one place a code is entered (F-S02). It
 * emails a code and asks for it; there is nothing to enrol, so there is one
 * screen and one url.
 */
export function twoFactorUrl(returnTo: string): string {
  const url = new URL("/two-factor/verify", WEB_URL);
  url.searchParams.set("redirect", returnTo);
  return url.toString();
}
