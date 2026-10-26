/**
 * Whether web hands `/sign-in` to the operator app (`apps/app`). It used to hand
 * `/register` too; see `APP_HANDOFF_PATHS`.
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
 * the screens sign-in and the registration pipeline were built and verified
 * against. Neither choice can loop: the destination is never this origin.
 *
 * NO IMPORTS. `next.config.ts` loads this through Next's config require hook,
 * and `tests/app-handoff.test.mjs` loads it bare.
 */

interface HandoffRedirect {
  source: string;
  destination: string;
  permanent: false;
  missing: { type: "header"; key: string }[];
}

/**
 * The entry screens the app owns when it is a separate origin: sign in only.
 *
 * `/register` WAS here and is not any more (2026-10-19). Registration is web's
 * wizard in every environment, rebuilt to the Register.dc.html artboard on the
 * real API and web's own session; handing it to the app on a laptop sent
 * `localhost:3000/register` to the app's fixture screen, so the wizard every
 * deployed stack serves could not be opened locally at all.
 */
export const APP_HANDOFF_PATHS = ["/sign-in"];

/**
 * The header Next's client router sends with every RSC fetch, a soft navigation
 * or a prefetch. A request for a page loaded in the browser never carries it.
 *
 * THE REDIRECT IS FOR PAGE LOADS ONLY. Every `<Link>` to `/sign-in`
 * navigates by fetching the RSC payload, `fetch` follows the 307
 * to the app's origin, and the app answers without CORS headers for web's, so
 * the browser blocks it. Next then logs "Failed to fetch RSC payload ...
 * Falling back to browser navigation", which the dev overlay shows as an
 * issue, and loads the page anyway: the error flashes and is gone. So the
 * redirects skip RSC fetches, and a rewrite answers those with an empty 204
 * (`appHandoffRscRewrites`), which Next's router takes as "load this url in the
 * browser". That page load meets the redirect, with nothing logged.
 *
 * A rewrite, not middleware: Next strips the RSC headers from the request it
 * hands middleware, so middleware cannot tell the two kinds of request apart.
 * And not left to fall through either: an RSC fetch would then render web's own
 * `/sign-in` while a page load gets the app's, two screens for one link.
 */
export const RSC_HEADER = "rsc";

/** The route that answers those RSC fetches: `src/app/app-handoff/route.ts`. */
export const HANDOFF_RSC_ANSWER = "/app-handoff";

interface HandoffRscRewrite {
  source: string;
  has: { type: "header"; key: string }[];
  destination: string;
}

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
    missing: [{ type: "header", key: RSC_HEADER }],
  }));
}

/**
 * The `beforeFiles` rewrites for `next.config.ts` that answer an RSC fetch for a
 * hand-off path (see `RSC_HEADER`). Built from the redirects, so the two lists
 * always name the same paths, and empty wherever the redirects are: where the
 * app shares web's origin, web's own screens answer and a soft navigation works.
 */
export function appHandoffRscRewrites(
  webUrl: string | undefined,
  appUrl: string | undefined,
): HandoffRscRewrite[] {
  return appHandoffRedirects(webUrl, appUrl).map(({ source }) => ({
    source,
    has: [{ type: "header", key: RSC_HEADER }],
    destination: HANDOFF_RSC_ANSWER,
  }));
}
