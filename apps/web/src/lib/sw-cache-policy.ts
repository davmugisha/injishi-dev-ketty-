// Single source of truth for what the service worker may cache. The default is
// network-only; only an explicit allowlist of static, non-user-specific,
// same-origin asset paths is cacheable. This is the per-workspace isolation
// guardrail — authenticated data and documents must never be cached.
type CacheDecision = "cache-first" | "network-only";

// NOTE: any future DYNAMIC route added under one of these prefixes would become
// cacheable — this allowlist's safety is coupled to those dirs staying static.
const CACHEABLE_PREFIXES = [
  "/_next/static/",
  "/shared/",
  "/assets/",
  "/icons/",
  "/img/",
  "/media/",
];

export function classifyRequest(
  url: string,
  opts: { sameOrigin: boolean; isNavigation: boolean },
): CacheDecision {
  // Cross-origin (incl. signed storage URLs) and all navigations: never cache.
  if (!opts.sameOrigin) return "network-only";
  if (opts.isNavigation) return "network-only";

  // Normalize both bare paths and absolute URLs, and collapse ./.. segments,
  // so a denylist bypass like "/assets/../api/v1/bookings" cannot slip through.
  const path = new URL(url, "http://sw-internal").pathname;

  // Hard denylist — authenticated surfaces, defense in depth.
  if (path.startsWith("/api/")) return "network-only";

  return CACHEABLE_PREFIXES.some((p) => path.startsWith(p))
    ? "cache-first"
    : "network-only";
}
