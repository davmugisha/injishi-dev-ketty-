/**
 * Where the restored oversight / PSF console sends someone to sign in.
 *
 * Sign-in lives on this app (`/sign-in`), not on web. The return path is
 * carried as `?next=` so the person lands back on the console after OTP.
 */

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_PMS_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";

/** Absolute origin of this app (for building return urls). */
export const WEB_URL = APP_ORIGIN;

/** Sign-in, carrying an absolute url to come back to. */
export function signInUrl(returnTo: string): string {
  const url = new URL("/sign-in", APP_ORIGIN);
  url.searchParams.set("next", returnTo);
  return url.toString();
}

/**
 * Step-up (email OTP) when the API still owes a second factor. Same origin as
 * sign-in on this app; falls back to `/sign-in` if a dedicated 2FA route is
 * not mounted yet.
 */
export function twoFactorUrl(returnTo: string): string {
  const url = new URL("/sign-in", APP_ORIGIN);
  url.searchParams.set("next", returnTo);
  return url.toString();
}
