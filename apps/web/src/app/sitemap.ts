import type { MetadataRoute } from "next";

/**
 * The sitemap while the gate is up (ADR-048 AC-16).
 *
 * ONE URL, because one URL is all a stranger can reach. Listing `/explore` or a
 * property page here while the middleware redirects both to `/waitlist` would
 * be asking search engines to crawl a wall.
 *
 * THIS FILE IS NET NEW, like `robots.ts`, and like it, launch day REPLACES its
 * contents rather than deleting the file.
 *
 * `lastModified` is deliberately absent. Every other value on this surface
 * refuses to be a date for the same reason (ADR-048: "No value this feature
 * produces is a date"), and a build timestamp here would tell crawlers the page
 * changed every time the image was rebuilt, which is not true and is the kind
 * of signal that gets a site trusted less rather than more.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return [
    {
      url: `${base}/waitlist`,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
