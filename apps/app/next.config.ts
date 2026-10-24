import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * PMS (operator) app — the Host (Hospitality) and Landlord (Residence) shells.
 * Extracted from apps/web (2026-07-16) into its own layer per
 * docs/pms-ux-diagnosis-and-ia-blueprint.md.
 *
 * THERE ARE NO `index.html` REDIRECTS HERE ANY MORE (ADR-044, D-a).
 *
 * This file used to redirect eighteen `/<screen>/index.html` paths onto
 * `/<screen>` — ten `host-*` and eight `landlord-*` — for the baked captures
 * whose markup cross-linked with `../<screen>/index.html`. All eighteen
 * destinations were already gone: ADR-018 moved this app onto
 * `/w/[workspaceId]/<screen>`, because an address that names a KIND is one
 * address for all three hotels a person runs. A redirect onto a route nobody
 * serves is worse than no redirect, because the 404 now arrives at a second
 * address and the log reads as though the app meant to send you there.
 *
 * The captures they served are gone too. A stale bookmark now gets the
 * not-found page, which is the honest answer: the screen it names carries no
 * workspace, so nothing here can work out which hotel it meant.
 */

const nextConfig: NextConfig = {
  /**
   * Next has to guess which directory is the workspace root and prints a
   * warning saying so, and a guess that can flip between machines is not a
   * build input we want. State it: the repo root is the pnpm workspace root
   * (pnpm-workspace.yaml and pnpm-lock.yaml both live there).
   *
   * This was "../../.." - one level ABOVE the repo root, aimed at an outer dev
   * shell that no longer carries a lockfile. Vercel clones the repo to
   * /vercel/path0, so that pointed the tracing root at /vercel and every traced
   * path came back prefixed with the clone directory a second time. The build
   * compiled, then the deploy died on
   * "Cannot find module .../server.runtime.prod.js" with a require stack
   * reading /vercel/path0/path0/apps/app/noop.js. Keep this at the repo root.
   */
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  /**
   * Two Next processes sharing one `.next` corrupt each other's manifests, and
   * every route then 500s (or serves a page whose stylesheets 404) until both
   * are restarted. Setting NEXT_DIST_DIR gives a second process — a QA or
   * preview run alongside a live dev server — its own build directory. Unset,
   * which is the normal case, this is exactly the default.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /**
   * Traced server bundle, which is what infra/docker/Dockerfile.app copies.
   *
   * Opt-in rather than always on: the trace symlinks into the pnpm store, and
   * on Windows that needs Developer Mode or an elevated shell, so leaving it
   * enabled fails `pnpm build` on an ordinary Windows checkout. The Dockerfile
   * and CI set BUILD_STANDALONE=1; both run on Linux, where it just works.
   */
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  /**
   * This app is a ZONE under the web app's origin: web rewrites `/w/*`,
   * `/oversight/*` and the legacy kind roots here, and `/operator-static/*`
   * for the chunks. The prefix keeps this build's `/_next` apart from web's
   * on the shared origin. Opened directly on :3002 it still serves itself.
   */
  assetPrefix: process.env.OPERATOR_ASSET_PREFIX ?? "/operator-static",
  /**
   * `@injishi/ui` and `@injishi/utils` ship TypeScript source rather than a
   * built `dist/`, which is the deliberate exception ADR-008 recorded, so the
   * consumer has to compile them. Without this the build fails on the first
   * `.tsx` inside the package. `apps/web/next.config.ts` carries the same two
   * lines for the same reason; ADR-036 call 1 brought this app onto the package.
   */
  transpilePackages: ["@injishi/ui", "@injishi/utils"],
  experimental: {
    /**
     * A barrel import of `@injishi/ui` would otherwise pull all 24 of its
     * client components into any route that imports one of them.
     */
    optimizePackageImports: ["@injishi/ui", "lucide-react"],
  },
};

export default nextConfig;
