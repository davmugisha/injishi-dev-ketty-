import type { MetadataRoute } from "next";

import { WEB_URL } from "@/lib/web-url";

/**
 * Search engine instructions (ADR-048 AC-16, as launched).
 *
 * The marketplace is meant to be read by strangers, so every crawler may read
 * it. The private screens need no rule here: each one sends a visitor with no
 * session to `/sign-in`, so there is nothing behind them to index.
 *
 * THIS FILE OUTLIVED THE WAITLIST ON PURPOSE. It was written for the gate, and
 * deleting it with the gate would have started launch day with no search
 * directives at all, which is the state `apps/web` was in while a half-built
 * marketplace sat on a resolving domain.
 *
 * `/waitlist/unsubscribe/` stays disallowed while a welcome email carrying one
 * of those links can still sit in somebody's inbox. Each URL holds one person's
 * token, and an indexed token is a person's identifier in a public index, even
 * though the page itself is gone.
 *
 * `/get` is the app smart link (mobile spec 0004). It only ever redirects, to a
 * store or to a Coming soon screen, so there is nothing at it to index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/waitlist/unsubscribe/", "/get"],
      },
    ],
    sitemap: `${WEB_URL}/sitemap.xml`,
  };
}
