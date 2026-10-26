/**
 * Where web hands a visitor to the operator app (`apps/app`): `/sign-in`, and
 * the links that used to open the app as a zone under web.
 *
 * The app has its OWN origin in every stack: app.injishi.com in production,
 * :3002 on a laptop and in `pnpm docker:up` (NEXT_PUBLIC_PMS_URL). It has its
 * own sign-in, which decides each persona's home, so web's `/sign-in` sends
 * people there. Web used to serve the app as a zone under its own origin, with
 * NEXT_PUBLIC_PMS_URL equal to web's; the app's screens live at its root, so
 * that zone answered a 404 to everyone it signed in (2026-10-24), and it is
 * gone.
 *
 * Both sets of redirects check that the app really is another origin. When it
 * is web's own, the same redirect would point a path at itself:
 * `https://www.injishi.com/sign-in` once answered `307 Location:
 * https://www.injishi.com/sign-in` forever (observed 2026-10-19). Then web's
 * own `(app)/(entry)/sign-in` answers instead. Neither choice can loop.
 *
 * NO IMPORTS. `next.config.ts` loads this through Next's config require hook,
 * and `tests/app-handoff.test.mjs` loads it bare.
 */

interface HandoffRedirect {
  source: string;
  destination: string;
  permanent: false;
  missing?: { type: "header"; key: string }[];
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
 * The app's url when it is another origin than web's, else null.
 *
 * `||`, not `??`, because a build arg passed as an empty string is set to
 * nothing, not unset (the note in `.env.example` about `NEXT_PUBLIC_SITE_URL`).
 */
function separateApp(webUrl: string | undefined, appUrl: string | undefined): string | null {
  const app = (appUrl || APP_DEFAULT).replace(/\/+$/, "");
  const appOrigin = originOf(app);
  if (!appOrigin || appOrigin === originOf(webUrl || WEB_DEFAULT)) return null;
  return app;
}

/**
 * The sign-in redirects for `next.config.ts`, from the two public origins it
 * was built with. Empty when the app shares web's origin, and empty when the
 * app's url is not an absolute url: a relative destination would be this
 * origin again.
 */
export function appHandoffRedirects(
  webUrl: string | undefined,
  appUrl: string | undefined,
): HandoffRedirect[] {
  const app = separateApp(webUrl, appUrl);
  if (!app) return [];
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

/** The roots web used to forward to the app as a zone. Web has no page under any of them. */
export const OLD_ZONE_ROOTS = ["/w", "/oversight", "/landlord", "/broker"];

/**
 * Old zone links, sent on rather than left to 404 (2026-10-24).
 *
 * A property setup page (`/w/<id>/setup`) is a real page of the app, so it
 * keeps its path there. Anything else under an old root (`/w/<id>`,
 * `/oversight/verifier`, ...) named a screen the app no longer has at that
 * path, so it goes to web's `/start`: signed in, that opens the person's own
 * home in the app (`access.ts`); signed out, the gate sends them to sign in
 * first and `/start` runs after.
 */
export function oldZoneRedirects(
  webUrl: string | undefined,
  appUrl: string | undefined,
): HandoffRedirect[] {
  const app = separateApp(webUrl, appUrl);
  const setup: HandoffRedirect[] = app
    ? [{ source: "/w/:workspaceId/setup", destination: `${app}/w/:workspaceId/setup`, permanent: false }]
    : [];
  return [
    ...setup,
    ...OLD_ZONE_ROOTS.flatMap((root): HandoffRedirect[] => [
      { source: root, destination: "/start", permanent: false },
      { source: `${root}/:path*`, destination: "/start", permanent: false },
    ]),
  ];
}
