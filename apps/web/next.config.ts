import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import withSerwistInit from "@serwist/next";
import { appHandoffRedirects, appHandoffRscRewrites, oldZoneRedirects } from "./src/lib/app-handoff";

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
   * These ship TypeScript source rather than a built dist/, a recorded
   * exception to the dist/ rule (ADR-008, extended to products by ADR-074
   * D-d), so Next compiles them here instead.
   *
   * Two component libraries, each by its own name (ADR-074 D-p):
   * `@injishi/web-ui` is the kit this app was written against, and
   * `@injishi/ui` is the one web library products import, beside it until
   * stage 9 retires `web-ui`. A product added here owes its stylesheet import
   * in the same change (`pnpm check:manifests` refuses one without it).
   */
  transpilePackages: ["@injishi/web-ui", "@injishi/ui", "@injishi/utils"],
  experimental: {
    // The 404 for a URL that matches no route group. apps/web has five root
    // layouts and no app/layout.tsx, so a plain not-found.tsx would have no
    // document to render into; globalNotFound lets app/global-not-found.tsx
    // supply its own <html> and <body> (ADR-013 call 7).
    globalNotFound: true,
    // A barrel import of @injishi/web-ui would otherwise pull all 16 of its
    // client components into a server page that wanted one Button (ADR-008).
    optimizePackageImports: ["@injishi/web-ui", "lucide-react"],
    // The rewrite proxy to the operator zone gives up after 30s by default. In
    // development the zone compiles a page on its first request, and
    // `/w/[workspaceId]` alone took 29.8s cold, so web answered 500 ("socket
    // hang up") while the zone was still finishing a 200. Production serves a
    // prebuilt zone, so it keeps the default.
    proxyTimeout: process.env.NODE_ENV === "development" ? 180_000 : undefined,
  },
  /**
   * NO REWRITES. The operator app (`apps/app`) has its own origin in every
   * stack (app.injishi.com, :3002 on a laptop), and web serves none of its
   * pages: it used to forward `/w`, `/oversight`, `/landlord`, `/broker`,
   * `/host/*` and `/operator-static` to it as a "zone", but the app's screens
   * live at its root (`/residence`, `/owner`, ...), so the zone could only ever
   * reach a 404. Web hands sign-in to the app and sends old zone links on.
   */
  // Only the soft-navigation answer for the hand-off paths (`app-handoff.ts`): an RSC fetch cannot follow
  // a redirect across origins. Nothing is forwarded to the app as a zone.
  async rewrites() {
    return {
      beforeFiles: [...appHandoffRscRewrites(process.env.NEXT_PUBLIC_WEB_URL, process.env.NEXT_PUBLIC_PMS_URL)],
      afterFiles: [],
    };
  },
  async redirects() {
    /**
     * Signing in happens in the app, on its own origin. Redirects run before the
     * proxy, so the private-page gate's bounce to `/sign-in` lands there too.
     * `app-handoff.ts` says why the hand-off checks the two origins differ, and
     * where an old zone link goes.
     */
    return [
      ...appHandoffRedirects(process.env.NEXT_PUBLIC_WEB_URL, process.env.NEXT_PUBLIC_PMS_URL),
      ...oldZoneRedirects(process.env.NEXT_PUBLIC_WEB_URL, process.env.NEXT_PUBLIC_PMS_URL),
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

/**
 * WEBPACK FOR THE BUILD, TURBOPACK FOR DEV (Next 16). Next 16 builds with
 * Turbopack by default and refuses a config that carries a `webpack` function,
 * which `@serwist/next` adds to generate `public/sw.js`. So web's `build` script
 * passes `--webpack`, the bundler web always built with under Next 15, and the
 * service worker keeps working unchanged. Moving the build to Turbopack means
 * moving the service worker to `@serwist/turbopack` first.
 *
 * `next dev` never had a service worker (`disable` below), so the dev server
 * skips the wrapper and runs on Turbopack: under webpack a page's first visit
 * took about 24 s to compile (2026-10-30).
 */
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

export default (phase: string): NextConfig =>
  phase === PHASE_DEVELOPMENT_SERVER ? nextConfig : withSerwist(nextConfig);
