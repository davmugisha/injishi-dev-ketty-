import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DatabaseProperty } from "@/components/property/database-property";
import { RecordRecentView } from "@/components/property/record-recent-view";
import { propertyMetadata, resolvePropertyPage } from "@/lib/property-route";
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
  return propertyMetadata(params, (property, slug) => ({
    title: property.name,
    description: property.description ?? undefined,
    // The one address a search engine should credit, built from the slug and
    // web's own origin (ADR-053, AC-I9) — never from whatever host or query the
    // page happened to be reached on.
    alternates: { canonical: propertyUrl(slug) },
  }));
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
      <RecordRecentView slug={slug} />
      <DatabaseProperty property={property} slug={slug} />
    </>
  );
}
