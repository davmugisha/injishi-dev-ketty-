// Copies MapLibre's web worker into public/ so the Explore map can load it.
//
// maplibre-gl v6 ships as ES modules and finds its worker relative to its own
// `import.meta.url`. Once webpack has bundled the main module that URL points
// into `/_next/static/chunks/`, where no worker exists, the request 404s to an
// HTML page, and the map never fires `load`: vector tiles go unparsed and only
// the background paints. The worker imports `./maplibre-gl-shared.mjs`, so both
// files are copied side by side, under the installed version so a dependency
// bump can never pair a new main bundle with a cached old worker.
// `explore-map.tsx` points `setWorkerUrl` at the same path.
//
// Runs before `next dev` and `next build`; the output is git-ignored.

import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(pkgPath, "utf8"));
const dist = join(dirname(pkgPath), "dist");

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const vendorRoot = join(webRoot, "public", "vendor", "maplibre-gl");
const out = join(vendorRoot, version);

rmSync(vendorRoot, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
}
console.log(`maplibre-gl ${version} worker -> public/vendor/maplibre-gl/${version}/`);
