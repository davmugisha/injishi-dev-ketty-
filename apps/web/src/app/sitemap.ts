import { SitemapProperty } from "@injishi/contracts";
import type { MetadataRoute } from "next";

import { DESTINATIONS, destinationPath } from "@/data/destination-pages";
import { GUIDES } from "@/data/guides";
import { LEGAL_DOCUMENTS } from "@/data/legal/documents";
import { API_URL } from "@/lib/api";
import { WEB_URL, propertyUrl } from "@/lib/web-url";

/**
 * `/sitemap.xml` (ADR-053, AC-I9).
 *
 * Publishing is the one moment a page becomes indexable, so the sitemap lists
 * exactly what the API says is publicly sellable: a `published` listing whose
 * business is `active`, read through `GET /api/v1/properties/sitemap`, which is
 * the same predicate a property page answers with. An unpublished or suspended
 * property is in neither.
 *
 * THE SITE'S OWN PAGES ARE LISTED TOO (2026-10-21). It used to name the root
 * and the properties alone, so on a launch with no property published it was
 * one URL long, and the guides, the destination pages, How it works and the
 * host page, everything a crawler could actually rank, were reachable only by
 * following links. `SITE_PAGES` is the list of public pages worth indexing;
 * a page that is `noindex` (checkout, the demo, `/services`) never goes in it.
 *
 * RENDERED ON EVERY REQUEST, NOT CACHED. Contract rule 1 is that both halves are
 * checked on every public read with no cached third answer, and a sitemap
 * revalidated hourly would keep advertising a suspended business for up to an
 * hour. A crawler fetches this rarely, so exactness costs almost nothing.
 *
 * An API that cannot be reached yields the site's own pages alone rather than
 * an error: a sitemap that 500s teaches a crawler to stop asking, and one that
 * is briefly short is corrected on the next fetch.
 */
export const dynamic = "force-dynamic";

/**
 * The public pages worth a crawler's time, after the root. Not exported: Next
 * treats a metadata route's exports as its configuration.
 */
const SITE_PAGES = [
  "/explore",
  "/stays",
  "/host",
  "/how-it-works",
  "/guides",
  "/training",
  "/about",
  "/support",
  "/downloads",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const own: MetadataRoute.Sitemap = [
    { url: `${WEB_URL}/` },
    ...SITE_PAGES.map((path) => ({ url: `${WEB_URL}${path}` })),
    ...DESTINATIONS.map((place) => ({ url: `${WEB_URL}${destinationPath(place.slug)}` })),
    // A legal page joins once it is final; a draft is `noindex` (`legalRobots`).
    ...LEGAL_DOCUMENTS.filter((doc) => doc.content.status === "final").map((doc) => ({
      url: `${WEB_URL}${doc.path}`,
      lastModified: doc.content.lastUpdated,
    })),
    ...GUIDES.map((guide) => ({
      url: `${WEB_URL}/guides/${guide.slug}`,
      lastModified: guide.publishedAt,
    })),
  ];

  let entries: SitemapProperty[] = [];
  try {
    const res = await fetch(`${API_URL}/api/v1/properties/sitemap`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const parsed = SitemapProperty.array().safeParse(await res.json());
      if (parsed.success) entries = parsed.data;
    }
  } catch {
    // Unreachable or timed out: the site's own pages alone, as above.
  }

  return [
    ...own,
    ...entries.map((p) => ({
      url: propertyUrl(p.slug),
      ...(p.publishedAt ? { lastModified: p.publishedAt } : {}),
    })),
  ];
}
