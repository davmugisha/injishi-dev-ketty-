import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

/**
 * Injishi Admin — internal control tower (F-A*). Served on :3001 next to the
 * marketplace webapp on :3000. Internal tool: never indexed (also enforced
 * per-page via metadata.robots).
 */
const nextConfig: NextConfig = {
  /**
   * Trace from the pnpm workspace root (`injishi/`), which is where
   * node_modules resolves from and where `pnpm-lock.yaml` sits, so the shared
   * packages are followed into the bundle. `apps/web` and `apps/app` use the
   * same root.
   *
   * It used to be one level higher, from when this app lived in the deleted
   * `injishi.managed` repo beside a second lockfile. Inside the image that
   * higher level is `/`, which nests the standalone server under
   * `repo/apps/admin/` instead of `apps/admin/`, where Dockerfile.admin runs it.
   */
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  /**
   * Two Next processes sharing one `.next` corrupt each other's manifests.
   * Setting NEXT_DIST_DIR gives a second process (a build or a verification
   * server beside a live dev server) its own folder, exactly as `apps/web` and
   * `apps/app` already allow. Unset, which is the normal case, this is the
   * default.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /**
   * Traced server bundle, which is what infra/docker/Dockerfile.admin copies.
   *
   * Opt-in rather than always on, for the reason apps/web records: the trace
   * symlinks into the pnpm store, and on Windows that needs Developer Mode or
   * an elevated shell. The Dockerfile sets BUILD_STANDALONE=1 on Linux.
   */
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  /**
   * `@injishi/ui` and `@injishi/utils` ship TypeScript source rather than a
   * built `dist/` (the exception ADR-008 recorded), so the consumer compiles
   * them; without this the build fails on the first `.tsx` inside the package.
   * `apps/web` and `apps/app` carry the same two lines. ADR-040 call 1 brought
   * this app onto the package.
   */
  transpilePackages: ["@injishi/ui", "@injishi/utils"],
  experimental: {
    // Next 15.5.4's dev-only Segment Explorer devtool injects a client
    // reference (segment-explorer-node.js#SegmentViewNode) that the RSC client
    // manifest fails to resolve after a hot recompile, 500ing every route and
    // killing the dev server. Off until the upstream regression is patched.
    devtoolSegmentExplorer: false,
    // A barrel import of `@injishi/ui` would otherwise pull all 24 of its
    // client components into any route that imports one of them.
    optimizePackageImports: ["@injishi/ui", "lucide-react"],
  },
  async redirects() {
    return [
      // The control tower opens on the platform overview.
      { source: "/home", destination: "/overview", permanent: false },
    ];
  },
};

export default nextConfig;
