import type { Metadata } from "next";

import { WEB_URL } from "@/lib/web-url";

/**
 * What a link to a public page shows when it is shared: the Open Graph and
 * Twitter cards that WhatsApp, Facebook, LinkedIn and X read.
 *
 * Until 2026-10-21 no page set either, so an injishi.com link pasted into a
 * WhatsApp chat (the channel this market shares on) showed a bare URL with no
 * picture, title or line. Every public page now goes through this one builder.
 *
 * ONE BUILDER BECAUSE NEXT MERGES METADATA SHALLOWLY. A page that sets
 * `openGraph` replaces the layout's whole `openGraph` object, site name and
 * image included, so a page that wrote its own would silently drop them. This
 * always returns the complete pair.
 *
 * `image` is an absolute URL or a path on this site. Without one the site card
 * stands in: `app/opengraph-image.tsx`, a 1200x630 card drawn at build.
 */
export const SITE_NAME = "Injishi";

/** The site's own share card, `app/opengraph-image.tsx`. */
export const DEFAULT_SHARE_IMAGE = `${WEB_URL}/opengraph-image`;

export function shareMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  type = "website",
}: {
  title: string;
  description: string;
  /**
   * The page's own path, `/guides/...`; the card links to that address. Left
   * out only by the root layout, whose card stands in for pages that set none:
   * a fixed URL there would tell every such page's share that it is the home
   * page.
   */
  path?: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
}): Pick<Metadata, "openGraph" | "twitter"> {
  const picture = image ? (image.startsWith("http") ? image : `${WEB_URL}${image}`) : DEFAULT_SHARE_IMAGE;
  return {
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: "en_RW",
      ...(path ? { url: `${WEB_URL}${path}` } : {}),
      title,
      description,
      images: [{ url: picture, alt: imageAlt ?? title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [picture],
    },
  };
}
