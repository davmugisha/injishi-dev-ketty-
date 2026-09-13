/**
 * Web's own public origin, for an absolute URL this app hands to somebody else:
 * a sitemap entry, a canonical link (ADR-053, AC-I9).
 *
 * `NEXT_PUBLIC_WEB_URL`, the value every deploy compose file bakes into this
 * image from `WEB_HOST`, and the one `lib/redirect.ts` already trusts. `||` and
 * not `??`, because a build that carries the variable as an empty string must
 * fall back rather than print addresses with no host.
 */
export const WEB_URL = (
  process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000"
).replace(/\/+$/, "");

/** A property's one public address: the origin, `/property/`, the slug. */
export function propertyUrl(slug: string): string {
  return `${WEB_URL}/property/${encodeURIComponent(slug)}`;
}
