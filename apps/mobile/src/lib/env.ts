/**
 * The API origin, and the base paths derived from it.
 *
 * This is the ONLY file that reads `EXPO_PUBLIC_API_URL` (ADR-030 cross child
 * contract, module ownership; ADR-038 child 0). One reader means one place to
 * look when the phone cannot reach the API, which during development it
 * regularly cannot: the value is a LAN address on a DHCP lease, and it moves.
 *
 * Expo inlines `EXPO_PUBLIC_*` at BUILD time, not run time, so a change here
 * needs the bundler restarted. `process.env.EXPO_PUBLIC_API_URL` must also be
 * written out in full rather than looked up dynamically, because the inlining
 * is a textual substitution and a computed key is not substituted at all.
 */

/** Trailing slashes are stripped so every join below has exactly one. */
function normaliseOrigin(raw: string): string {
  return raw.trim().replace(/\/+$/, '');
}

const configured = process.env.EXPO_PUBLIC_API_URL;

/**
 * Fail loudly and early rather than at the first call.
 *
 * An unset origin makes every request go to `undefined/api/v1/...`, which
 * surfaces as a generic network failure on whichever screen happens to load
 * first. That reads as "the server is down" and sends you looking in the wrong
 * place entirely.
 */
if (!configured || !normaliseOrigin(configured)) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not set. Add it to apps/mobile/.env as your ' +
      "machine's LAN address (for example http://192.168.1.10:8000), then " +
      'restart the bundler — Expo inlines it at build time.',
  );
}

/** The API origin, with no trailing slash. */
export const API_ORIGIN = normaliseOrigin(configured);

/** Product routes. Everything except Better Auth lives under this. */
export const API_BASE = `${API_ORIGIN}/api/v1`;

/**
 * Better Auth's own routes, which are NOT versioned.
 *
 * `AUTH_BASE_PATH` in `@injishi/auth` is `/api/auth`, mounted before the
 * `/api/v1` global prefix, so an auth call that borrowed `API_BASE` would 404.
 */
export const AUTH_BASE = `${API_ORIGIN}/api/auth`;

/**
 * How long any one call may take before it is treated as unreachable.
 *
 * Chosen for the connection this app is built for rather than for a datacentre:
 * a slow 3G handover can leave a socket open and silent for a long time, and a
 * person staring at a spinner has already decided the app is broken. Fifteen
 * seconds is long enough to ride out a handover and short enough to answer.
 */
export const REQUEST_TIMEOUT_MS = 15_000;
