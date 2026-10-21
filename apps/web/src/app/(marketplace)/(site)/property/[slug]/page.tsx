import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DatabaseProperty } from "@/components/property/database-property";
import { RecordRecentView } from "@/components/property/record-recent-view";
import { JsonLd } from "@/components/shared/json-ld";
import { propertyMetadata, resolvePropertyPage } from "@/lib/property-route";
import { shareMetadata } from "@/lib/share-metadata";
import { breadcrumbJsonLd, lodgingJsonLd } from "@/lib/structured-data";
import { propertyUrl } from "@/lib/web-url";

/**
 * Rendered on request and kept for 30 seconds, not prerendered at build
 * (ADR-053, owner ruling of 2026-09-13).
 *
 * The page reads the API, and a suspension or an unpublish has to reach it
 * without a rebuild, so this is the ceiling on how long a page can outlive that
 * change. It mirrors `PUBLIC_PROPERTY_REVALIDATE_SECONDS` as a literal because
 * Next reads a route's `revalidate` statically. A property's photographs stop
 * loading sooner than that: the photo route refuses on the very next request.
 */
export const revalidate = 30;

/*
 * Every property exists only in the database, so Next must render a slug on
 * first request rather than answer 404 for lacking a static page. `true` is
 * Next's default; it is stated because this route depends on it.
 */
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return propertyMetadata(params, (property, slug) => {
    const description =
      property.description ??
      `A verified stay${property.districtName ? ` in ${property.districtName}` : ""}, Rwanda, booked on Injishi.`;
    return {
      title: property.name,
      description,
      // The one address a search engine should credit, built from the slug and
      // web's own origin (ADR-053, AC-I9) — never from whatever host or query the
      // page happened to be reached on.
      alternates: { canonical: propertyUrl(slug) },
      // The cover photograph is what a shared link shows in WhatsApp; without
      // one the site card stands in. Photo URLs are the API's public photo
      // route, which a crawler follows to the image.
      ...shareMetadata({
        title: property.name,
        description,
        path: `/property/${encodeURIComponent(slug)}`,
        image: property.photos[0],
      }),
    };
  });
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await resolvePropertyPage(slug);
  if (!property) notFound();
  return (
    <>
      <JsonLd data={lodgingJsonLd(property, slug)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Stays", path: "/explore" },
          { name: property.name, path: `/property/${encodeURIComponent(slug)}` },
        ])}
      />
      <RecordRecentView slug={slug} />
      <DatabaseProperty property={property} slug={slug} />
    </>
  );
}
