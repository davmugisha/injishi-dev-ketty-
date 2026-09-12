/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, NetworkOnly, Serwist } from "serwist";
import { classifyRequest } from "@/lib/sw-cache-policy";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  // Hashed Next build assets, injected at build time.
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false, // wait; Task 8 surfaces a soft "reload" prompt
  clientsClaim: true,
  navigationPreload: false,
  /*
   * NO NAVIGATION FALLBACK, BECAUSE THERE IS NO `/offline` ROUTE (ADR-044, D-a).
   *
   * This worker declared `/offline` as its document fallback and precached it,
   * and that route has never existed in this app — `ui-screens.md` has carried
   * it as a known gap since before this tree. The cost was not a missing
   * offline page. It was the whole service worker: a precache list is fetched
   * with `addAll`, one 404 rejects the batch, so INSTALL FAILED every time
   * and none of the caching below ever ran in production.
   *
   * D-a offers two ways out, build the route or drop the fallback. Dropping it
   * is the one that needs no new screen: an offline navigation now gets the
   * browser's own error page, exactly as it did while the worker was failing to
   * install, and the CacheFirst store underneath starts working for the first
   * time. Building the page belongs to F-P10 (offline-resilient PWA), which
   * owns what it should say and in which language; wire it back here in the
   * same change that adds the route.
   */
  runtimeCaching: [
    // Static, same-origin, non-user-specific assets -> CacheFirst.
    {
      matcher: ({ url, sameOrigin, request }) =>
        classifyRequest(url.pathname, {
          sameOrigin,
          isNavigation: request.mode === "navigate",
        }) === "cache-first",
      handler: new CacheFirst({
        cacheName: "injishi-static-v1",
        // The store was unbounded, and the public layer just added ~41 MB of
        // photography behind /assets/ and /media/. A visitor who browsed enough
        // listings would fill their device's quota and the browser would evict
        // the whole origin, offline page included (ADR-015 call 7).
        //
        // 60 entries bounds a COUNT, not a size: serwist offers no byte option.
        // 60 x 62 KB (the measured median) is about 4 MB; 60 x 255 KB (p90) is
        // about 15 MB. A safety bound, not a tuned policy — feature 16 owns the
        // policy, including whether a count bound is good enough.
        //
        // 30 days matches the stale-while-revalidate window in next.config.ts,
        // so the two layers cannot disagree about how long an asset is fresh.
        plugins: [
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 60 * 60 * 24 * 30,
          }),
        ],
      }),
    },
    // Everything else (navigations, /api/**, cross-origin) -> NetworkOnly.
    // Never cached - preserves per-workspace isolation.
    {
      matcher: () => true,
      handler: new NetworkOnly(),
    },
  ],
});

// Precache the runtime shell assets explicitly (these are not hashed Next
// chunks, so they aren't in __SW_MANIFEST). `/offline` was the first entry
// here and is gone with the fallback above: every url in this list must be a
// route this app serves, or install fails and nothing is cached at all.
serwist.addToPrecacheList([
  { url: "/icons/icon-192.png", revision: null },
  { url: "/icons/icon-512.png", revision: null },
]);

serwist.addEventListeners();

// defaultCache is intentionally unused: we do NOT want Serwist's default page/
// data caching, which would cache navigations and API responses.
void defaultCache;
