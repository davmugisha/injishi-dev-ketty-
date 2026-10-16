import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

/**
 * The marketing `screens` list that used to sit here is gone with the captured
 * marketing layer it served (deleted in `a78935c`): about, collections,
 * explore, guides, guides-detail, property, property-2, services and support.
 * Every entry redirected `/<screen>/index.html` onto a route that no longer
 * existed, so the redirect only turned one 404 into another.
 *
 * That deleted layer ALSO carried the group name the live marketplace group
 * used to have, which is why this comment used to read as if the group were
 * gone while a live one sat in `src/app`. ADR-021 renamed the live one to
 * `(marketplace)` and it serves those pages as real routes, with no redirects.
 */

/**
 * Authenticated web_app screens (prototype/screens/web_app/*). Their captured
 * markup and the runtime shell (shared/js/injishi-web-shell.js) cross-link with
 * `../<screen>/index.html`, resolving to `/<screen>/index.html` from a
 * single-segment route; redirect those onto the real routes.
 */
// Host/Landlord (operator) screens were extracted to apps/app (2026-07-16);
// apps/web keeps the marketplace, the five entry screens (sign-in, verify-otp,
// activate, register, claim-org) and the Personal (demand) surface. Since
// ADR-021 those live in two route groups, `(marketplace)` and `(app)`, not
// four.
/**
 * ONLY SCREENS THAT STILL ANSWER (ADR-044, D-a).
 *
 * This list carried fifteen names and ten of them pointed at nothing: four
 * `broker-*` and six `personal-*` routes the capture had and this app never
 * built. Each one turned a 404 on `/personal-trips/index.html` into a 404 on
 * `/personal-trips`, which is not a redirect, it is a detour to the same wall.
 * The Personal surface lives at plain paths now (`/trips`, `/saved`,
 * `/account`; see `lib/app-nav.ts`) and the broker surface moved to
 * `apps/app` under `/w/[ws]/`, so there is no name to repoint them at either.
 *
 * The five below are the entry screens, and each one is a real route in
 * `(app)/(entry)`. Adding a name here without a route under it is the bug this
 * comment exists to stop.
 */
const webAppScreens = ["activate", "claim-org", "join-team", "register", "sign-in", "verify-otp"];

const nextConfig: NextConfig = {
  /**
   * Two Next processes sharing one `.next` corrupt each other: the second to
   * start wipes the manifests the first is still serving from, and every route
   * 500s with ENOENT on app-paths-manifest.json until both are restarted. That
   * happens routinely here — a dev server plus a QA/preview run of the same app.
   * Setting NEXT_DIST_DIR gives the second process its own build directory.
   * Unset (the normal case) this is exactly the default.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  /**
   * Traced server bundle, which is what infra/docker/Dockerfile.web copies.
   * Carried over from the donor config when the public layer moved in.
   *
   * Opt-in rather than always on: the trace symlinks into the pnpm store, and
   * on Windows that needs Developer Mode or an elevated shell, so leaving it
   * enabled fails `pnpm build` on an ordinary Windows checkout. The Dockerfile
   * and CI set BUILD_STANDALONE=1; both run on Linux, where it just works.
   */
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // Trace from the workspace root, not this app, so the shared packages are
  // followed into the bundle. fileURLToPath, not URL.pathname: on Windows the
  // latter yields "/C:/..." and the trace silently produces nothing.
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  // The public layer's photography is served through next/image.
  images: {
    formats: ["image/avif", "image/webp"],
  },
  /**
   * @injishi/ui and @injishi/utils ship TypeScript source rather than a built
   * dist/, which is a recorded exception to the dist/ rule in the root
   * AGENTS.md, scoped to these two packages and to Next consumers (ADR-008).
   * Next compiles them here instead.
   */
  transpilePackages: ["@injishi/ui", "@injishi/utils"],
  experimental: {
    // The 404 for a URL that matches no route group. apps/web has five root
    // layouts and no app/layout.tsx, so a plain not-found.tsx would have no
    // document to render into; globalNotFound lets app/global-not-found.tsx
    // supply its own <html> and <body> (ADR-013 call 7).
    globalNotFound: true,
    // Next 15.5.4's dev-only Segment Explorer devtool injects a client
    // reference (segment-explorer-node.js#SegmentViewNode) that the RSC client
    // manifest fails to resolve after a hot recompile, 500ing every route and
    // killing the dev server. Off until the upstream regression is patched.
    devtoolSegmentExplorer: false,
    // A barrel import of @injishi/ui would otherwise pull all 16 of its client
    // components into a server page that wanted one Button (ADR-008).
    optimizePackageImports: ["@injishi/ui", "lucide-react"],
    // The rewrite proxy to the operator zone gives up after 30s by default. In
    // development the zone compiles a page on its first request, and
    // `/w/[workspaceId]` alone took 29.8s cold, so web answered 500 ("socket
    // hang up") while the zone was still finishing a 200. Production serves a
    // prebuilt zone, so it keeps the default.
    proxyTimeout: process.env.NODE_ENV === "development" ? 180_000 : undefined,
  },
  /**
   * The operator app is a ZONE under this origin (one product, one sign-in,
   * two code bases). Everything under these roots is forwarded to the app
   * server, which keeps its own repo folder, build and deploy. Cookies travel
   * because the browser only ever sees this origin.
   *
   * `/operator-static` is the zone's `assetPrefix`, so its chunks do not
   * collide with this app's `/_next`. In development the zone's hot reload
   * socket does not cross the rewrite; open :3002 directly for HMR on it.
   */
  async rewrites() {
    const raw = process.env.OPERATOR_APP_URL || "http://localhost:3002";
    const zone = raw.endsWith("/") ? raw.slice(0, -1) : raw;
    const forward = (r: string) => [
      { source: `/${r}`, destination: `${zone}/${r}` },
      { source: `/${r}/:path*`, destination: `${zone}/${r}/:path*` },
    ];
    /**
     * Roots this app has NO pages under. Forwarding them before the file system
     * is consulted costs nothing, because there is nothing here to consult.
     */
    const roots = ["w", "oversight", "landlord", "broker"];
    return {
      beforeFiles: [
        { source: "/operator-static/:path*", destination: `${zone}/operator-static/:path*` },
        ...roots.flatMap(forward),
      ],
      /**
       * `host` IS WEB'S, AND HAS TO BE CHECKED LAST (ADR-044, D-b).
       *
       * It sat in `beforeFiles` with the four roots above, and `beforeFiles`
       * runs before Next looks for a page. So `/host` and `/host/start` — the
       * marketplace's own "list your property" pages, which exist in
       * `(marketplace)/(site)/host` — never rendered once, and all seven
       * "become a host" links in the chrome landed on the operator app's
       * deprecated shim instead: an operator login shown to somebody still
       * deciding whether to become one.
       *
       * `afterFiles` is checked AFTER pages, so those two pages answer and any
       * other `/host/*` path still falls through to the shim, until ADR-018's
       * D-h trigger deletes it. The other four stay above because web owns no
       * page under them, so there is nothing for the file system to win.
       */
      afterFiles: forward("host"),
    };
  },
  async redirects() {
    /**
     * Signing in and registering a business happen in the operator app
     * (`apps/app`), on its own origin. Redirects run before middleware, so the
     * private-page gate's bounce to `/sign-in` lands there too.
     */
    const appUrl = (process.env.NEXT_PUBLIC_PMS_URL || "http://localhost:3002").replace(/\/$/, "");
    return [
      { source: "/sign-in", destination: `${appUrl}/sign-in`, permanent: false },
      { source: "/register", destination: `${appUrl}/register`, permanent: false },
      { source: "/home/index.html", destination: "/", permanent: false },
      { source: "/home", destination: "/", permanent: false },
      ...webAppScreens.map((s) => ({
        source: `/${s}/index.html`,
        destination: `/${s}`,
        permanent: false as const,
      })),
    ];
  },
  /**
   * Everything Next serves out of `public/` gets `Cache-Control: public,
   * max-age=0` by default, so the prototype's frozen stylesheets, fonts and
   * media revalidate on every navigation — a conditional request per asset,
   * per page, forever, to be told nothing changed. (`/_next/static` is exempt:
   * Next already marks its hashed output immutable.)
   *
   * Rules are ordered broad to specific because when two sources match the same
   * request Next lets the LAST one win for a given header key.
   */
  async headers() {
    const immutable = "public, max-age=31536000, immutable";
    return [
      {
        // Prototype media and imagery. Not content-addressed, so a week of
        // freshness plus a month of stale-while-revalidate rather than
        // `immutable`: repeat visits cost nothing, and a replaced asset still
        // reaches everyone inside a month without a rename.
        source: "/:dir(assets|media|_rwanda_media|img|icons)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=2592000" }],
      },
      {
        // Hand-maintained runtime layer (shared/js/*, shared/css/*). These do
        // change, and nothing renames them, so freshness stays short.
        source: "/shared/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
      {
        // Font binaries are replaced by adding a file, never by editing one.
        source: "/shared/fonts/:path*",
        headers: [{ key: "Cache-Control", value: immutable }],
      },
      {
        // Content-hashed by scripts/dedupe-capture-css.mjs — a changed byte
        // changes the filename, which is what makes `immutable` safe here.
        source: "/assets/css/dedupe/:path*",
        headers: [{ key: "Cache-Control", value: immutable }],
      },
      {
        // The service worker must never be pinned: a cached sw.js cannot be
        // superseded, and this one owns a CacheFirst store for every /assets/
        // and /shared/ path above.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        // The owner claim link carries its token in the query (ADR-053). The page
        // lifts it out of the address bar on load, and this stops every resource
        // the page loads from learning the URL it came from. `no-store` keeps the
        // tokened document out of any shared cache.
        source: "/claim-org",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
      {
        // The staff invitation link carries its token the same way (2026-09-13).
        source: "/join-team",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Register manually in a client component so we control prod-only + update UX.
  register: false,
  disable: process.env.NODE_ENV === "development",
  /**
   * Keep the photography OUT of the precache manifest.
   *
   * @serwist/next globs the whole of `public/` into `__SW_MANIFEST` (its default
   * pattern matches every file under it), and a production build before this
   * rule put **310 image entries** in it: every /assets/ and /media/ file just
   * arrived. Precache is not a cache. The service worker fetches every entry on
   * install, so a first visit would have pulled roughly 41 MB before the page
   * was usable, on Rwandan mobile data.
   *
   * These belong to the CacheFirst runtime handler in `src/app/sw.ts`, which
   * fetches an image only when a page asks for one and holds at most 60. What
   * stays precached is the runtime shell: `shared/` and `icons/`.
   *
   * Two things a build had to prove rather than assume. It has to be
   * `globPublicPatterns` and not `exclude`: `exclude` filters webpack assets
   * only, and the `public/` sweep is a separate glob that ignores it. And the
   * list has to be an allow-list rather than `"star-star"` plus `!` negations,
   * because that sweep runs on node-glob, which has no `!` negation and would
   * treat each one as a literal pattern matching nothing.
   *
   * So this names the shell: stylesheets, scripts, fonts, marks, PWA icons.
   * Everything with a photograph in it is left to the runtime handler,
   * `shared/img/photos/` included.
   *
   * ADR-015 AC-10 is the check that found this. Its answer was not known when
   * the record was written.
   */
  globPublicPatterns: [
    "*",
    "icons/**",
    "shared/css/**",
    "shared/js/**",
    "shared/fonts/**",
    "shared/img/*.svg",
    "assets/*.svg",
  ],
});

export default withSerwist(nextConfig);
