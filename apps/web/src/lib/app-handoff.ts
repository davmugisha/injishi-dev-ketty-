/**
 * Whether web hands `/sign-in` and `/register` to the operator app (`apps/app`).
 *
 * Since the new interface (`3d42976`) a laptop runs web on :3000 and the app on
 * :3002, and the app has its own sign-in and register screens there, so web
 * redirects both paths to it. In a deployed stack the app is not another origin:
 * it is a ZONE under web's (`NEXT_PUBLIC_PMS_URL` is web's own origin, DOKPLOY.md
 * § Public hosts), and only the roots `next.config.ts` rewrites reach it.
 * `/sign-in` is not one of them, so the same redirect pointed `/sign-in` at
 * itself: `https://www.injishi.com/sign-in` answered `307 Location:
 * https://www.injishi.com/sign-in` forever, `/register` likewise, on production
 * and on the demo alike (observed 2026-10-19). The waitlist's only door into the
 * product (ADR-048 AC-19b) was a redirect loop.
 *
 * So the hand-off happens only when the app really is a different origin. When
 * it is web's own, web's `(app)/(entry)/sign-in` and `register` answer, which are
 * the screens the waitlist gate and the registration pipeline were built and
 * verified against. Neither choice can loop: the destination is never this
 * origin.
 *
 * NO IMPORTS. `next.config.ts` loads this through Next's config require hook,
 * and `tests/app-handoff.test.mjs` loads it bare, as `waitlist-gate.test.mjs`
 * loads the gate's matchers.
 */

export interface HandoffRedirect {
  source: string;
  destination: string;
  permanent: false;
}

/** The two entry screens the app owns when it is a separate origin. */
export const APP_HANDOFF_PATHS = ["/sign-in", "/register"];

/** The defaults `web-url.ts` and the old redirect used when a variable is unset. */
const WEB_DEFAULT = "http://localhost:3000";
const APP_DEFAULT = "http://localhost:3002";

/** The origin of an absolute url, or null when it is not one. */
function originOf(raw: string): string | null {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/**
 * The redirects for `next.config.ts`, from the two public origins it was built
 * with. Empty when the app shares web's origin, and empty when the app's url is
 * not an absolute url: a relative destination would be this origin again.
 *
 * `||`, not `??`, because a build arg passed as an empty string is set to
 * nothing, not unset (the note in `.env.example` about `NEXT_PUBLIC_SITE_URL`).
 */
export function appHandoffRedirects(
  webUrl: string | undefined,
  appUrl: string | undefined,
): HandoffRedirect[] {
  const app = (appUrl || APP_DEFAULT).replace(/\/+$/, "");
  const appOrigin = originOf(app);
  if (!appOrigin || appOrigin === originOf(webUrl || WEB_DEFAULT)) return [];
  return APP_HANDOFF_PATHS.map((source) => ({
    source,
    destination: `${app}${source}`,
    permanent: false,
  }));
}
