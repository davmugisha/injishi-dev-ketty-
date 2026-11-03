// Where sign in may bring a guest back to (mobile spec 0005, D-ag, D-av). Pure: no React Native
// import, so `node --test` runs it.

/** The longest path kept; anything longer is not one of the app's own. */
const MAX_LENGTH = 500;

/**
 * A path sign in may return to: one of the guest's own screens, and nothing else. An allowlist, so a
 * link can never send someone off the app's routes (`https://…`, `//host`) or into another shell
 * (`/staff`).
 */
export function isReturnPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length > MAX_LENGTH) return false;
  if (!path.startsWith("/guest/")) return false;
  // No climbing out of /guest, no backslash tricks, no whitespace or control characters.
  if (path.includes("..") || /[\\\s]/.test(path)) return false;
  for (let i = 0; i < path.length; i += 1) if (path.charCodeAt(i) < 32) return false;
  return true;
}

/** Where a signed in person lands once: the kept path for a guest, else their own home. */
export function landingAfterSignIn(input: { pending: string | null; isGuest: boolean; home: string }): string {
  return input.isGuest && isReturnPath(input.pending) ? input.pending : input.home;
}
