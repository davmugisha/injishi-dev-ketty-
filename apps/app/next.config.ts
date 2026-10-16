import type { NextConfig } from "next";

const config: NextConfig = {
  // The verification build (tools/verify/build.mjs) writes elsewhere so it never disturbs a running dev server.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@injishi/ui", "@injishi/data", "@injishi/db"],
  // Native embedded-database driver stays a Node.js dependency of the server bundle.
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    optimizePackageImports: ["@gravity-ui/icons"],
  },
  devIndicators: false,
  // The product's front door is the marketplace (apps/web); this app has no page at `/`.
  async redirects() {
    const webUrl = (process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/$/, "");
    return [{ source: "/", destination: webUrl, permanent: false }];
  },
};

export default config;
