import type { MetadataRoute } from "next";

/**
 * Search engine instructions while the gate is up (ADR-048 AC-16).
 *
 * THIS FILE IS NET NEW. `apps/web` has never had one, which means the whole
 * half-built marketplace has been crawlable by default the entire time the
 * domain has resolved.
 *
 * ALLOW `/waitlist` AND DISALLOW EVERYTHING ELSE. The rest of the site
 * redirects strangers here anyway, and a crawler indexing a redirect chain
 * teaches search engines that the product's real pages are empty — a lesson
 * they keep for months after launch.
 *
 * AT LAUNCH THIS FILE IS REPLACED, NEVER DELETED. Removing it starts launch day
 * with no search directives at all, which is not a neutral state: it is the
 * state this app was already in and the reason this file exists. Swap the rules
 * for the real ones in the same change that deletes the gate
 * (`apps/web/WAITLIST-REMOVAL.md` says so).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/waitlist",
        // The unsubscribe path is under `/waitlist`, so it would be allowed by
        // the line above. It is disallowed explicitly because each of its URLs
        // carries one person's token, and an indexed token is a private key in
        // a public index. The page also carries its own `noindex`.
        disallow: ["/", "/waitlist/unsubscribe/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
