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
import { PropertyFacilities } from "@/components/property/property-facilities";
import { PropertyGallery } from "@/components/property/property-gallery";
import {
  PropertySubtitle,
  PropertyTitle,
} from "@/components/property/property-title";
import { SectionHeading } from "@/components/shared/section-heading";
import { LISTINGS } from "@/data/listings";
import { findDiscoverableProperty } from "@/data/discovery";
import { propertyMetadata, propertyStaticParams } from "@/lib/property-route";

export function generateStaticParams() {
  return propertyStaticParams();
}

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
  return propertyMetadata(params, (property) => ({
    title: property.name,
    description: property.about[0],
  }));
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // The catalogue first, then a property published in the database.
  const property = await findDiscoverableProperty(slug);
  if (!property) notFound();

  const related = LISTINGS.filter((listing) => listing.slug !== slug).slice(0, 3);

  return (
    <div className="flex flex-col items-center bg-background">
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

            <div className="mt-8 grid grid-cols-3 gap-4">
              {property.specs.slice(0, 3).map((spec) => (
                <div
                  key={spec.label}
                  className="flex flex-col gap-1 rounded-card border border-input p-4"
                >
                  <span className="text-xs text-page-fg-70">{spec.label}</span>
                  <b className="text-page-fg">{spec.value}</b>
                </div>
              ))}
            </div>
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
            this page stay statically generated for all thirty properties. */}
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
