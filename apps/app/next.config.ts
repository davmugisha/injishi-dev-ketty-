import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const config: NextConfig = {
  // Repo root (pnpm-workspace.yaml). Needed so standalone tracing follows the
  // workspace packages into the image Dockerfile.app copies.
  outputFileTracingRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  // The verification build (tools/verify/build.mjs) writes elsewhere so it never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Traced server bundle for Dockerfile.app. Opt-in: on Windows the trace
  // needs Developer Mode, so local `pnpm build` stays without it.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // Zone under web's origin: `/operator-static` keeps this build's `/_next`
  // apart from web's. Opened directly on :3002 it still serves itself.
  assetPrefix: process.env.OPERATOR_ASSET_PREFIX ?? "/operator-static",
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@injishi/ui", "@injishi/data", "@injishi/db"],
  // Native embedded-database driver stays a Node.js dependency of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    optimizePackageImports: ["@gravity-ui/icons"],
    // A property photograph may be up to 8 MB (the API's ceiling); the default 1 MB would refuse it before the API sees it.
    serverActions: { bodySizeLimit: "10mb" },
  },
  devIndicators: false,
  // The product's front door is the marketplace (apps/web); this app has no page at `/`.
  async redirects() {
    const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/$/, "");
    return [
      { source: "/", destination: webUrl, permanent: false },
      // The console's old address. Web sent every officer here after sign-in and the approval mails and
      // bookmarks still name it; the console is `/officer` now and this app had nothing at `/oversight`.
      { source: "/oversight", destination: "/officer", permanent: false },
      { source: "/oversight/:path*", destination: "/officer", permanent: false },
    ];
  },
};

export default config;
