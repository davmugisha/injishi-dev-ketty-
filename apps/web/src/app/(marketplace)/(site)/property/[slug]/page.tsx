import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BookingWidget,
  BookingWidgetSkeleton,
} from "@/components/property/booking-widget";
import {
  RelatedStays,
  RelatedStaysSkeleton,
} from "@/components/property/related-stays";
import { DatabaseProperty } from "@/components/property/database-property";
import { PropertyFacilities } from "@/components/property/property-facilities";
import { KeyFacts } from "@/components/property/key-facts";
import { PropertyGallery } from "@/components/property/property-gallery";
import { RecordRecentView } from "@/components/property/record-recent-view";
import {
  PropertySubtitle,
  PropertyTitle,
} from "@/components/property/property-title";
import { SectionHeading } from "@/components/shared/section-heading";
import { LISTINGS } from "@/data/listings";
import { propertyMetadata, resolvePropertyPage } from "@/lib/property-route";
import { propertyUrl } from "@/lib/web-url";

/**
 * Rendered on request and kept for 30 seconds, not prerendered at build
 * (ADR-053, owner ruling of 2026-09-13).
 *
 * The page reads the API first, and a suspension or an unpublish has to reach it
 * without a rebuild, so this is the ceiling on how long a page can outlive that
 * change. It mirrors `PUBLIC_PROPERTY_REVALIDATE_SECONDS` as a literal because
 * Next reads a route's `revalidate` statically. A property's photographs stop
 * loading sooner than that: the photo route refuses on the very next request.
 */
export const revalidate = 30;

/*
 * A slug outside the catalogue is rendered on first request and revalidated,
 * rather than refused: a property published from the operator app exists only
 * in the database, and Next must not answer it 404 for lacking a static page
 * (booking audit, 2026-09-13). `true` is Next's default; it is stated because
 * this route depends on it.
 */
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  return propertyMetadata(params, (source, slug) => ({
    title: source.property.name,
    description:
      source.kind === "database"
        ? (source.property.description ?? undefined)
        : source.property.about[0],
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
  const source = await resolvePropertyPage(slug);
  if (!source) notFound();
  if (source.kind === "database") {
    return (
      <>
        <RecordRecentView slug={slug} />
        <DatabaseProperty property={source.property} slug={slug} />
      </>
    );
  }
  const property = source.property;

  const related = LISTINGS.filter((listing) => listing.slug !== slug).slice(0, 3);

  return (
    <div className="flex flex-col items-center bg-background">
      <RecordRecentView slug={slug} />
      {/*
        The mosaic replaces the full-bleed hero this page used to open with. The
        hero laid the name and rate over the photograph, which cost legibility on
        bright interiors and left no room for a rating. `PropertyHero` is still
        in the tree for the video tour and wants a home in the gallery route.
      */}
      <div className="container flex flex-col gap-4 pt-24 lg:pt-28">
        <PropertyTitle property={property} />
        <PropertyGallery property={property} />
      </div>

      <div className="section-y container grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div className="flex flex-col gap-14">
          <section className="flex flex-col gap-6">
            <PropertySubtitle property={property} />
            {property.about.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="text-page-fg-70">
                {paragraph}
              </p>
            ))}

            <KeyFacts property={property} />
          </section>

          <section>
            <SectionHeading lead="Specifications" className="mb-6" />
            <dl className="grid grid-cols-2 gap-x-8 gap-y-0 md:grid-cols-3">
              {property.specs.map((spec) => (
                <div
                  key={spec.label}
                  className="flex items-center justify-between gap-4 border-b border-input py-3"
                >
                  <dt className="text-sm text-page-fg-70">{spec.label}</dt>
                  <dd className="text-sm font-medium text-page-fg">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* The API's facilities when this business is on Injishi; the
              catalogue's amenities otherwise, and while the API is asked.
              Read in the browser, so this page stays static (ADR-050 D-k). */}
          <PropertyFacilities slug={property.slug} amenities={property.amenities} />
        </div>

        {/* Suspense, not a `searchParams` prop. The widget reads the guest's
            dates and party from the URL in the browser, which is what lets
            this page stay cacheable rather than rendering per query string. */}
        <Suspense fallback={<BookingWidgetSkeleton />}>
          <BookingWidget property={property} />
        </Suspense>
      </div>

      <section className="section-y container">
        <SectionHeading
          lead="Similar "
          emphasis="stays"
          action={{ label: "All stays", href: "/explore" }}
          className="mb-8"
        />
        <Suspense fallback={<RelatedStaysSkeleton />}>
          <RelatedStays listings={related} />
        </Suspense>
      </section>
    </div>
  );
}
