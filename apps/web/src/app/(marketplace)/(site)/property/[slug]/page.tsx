import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  BookingWidget,
  BookingWidgetSkeleton,
} from "@/components/property/booking-widget";
import {
  RelatedStays,
  RelatedStaysSkeleton,
} from "@/components/property/related-stays";
import { PropertyGallery } from "@/components/property/property-gallery";
import {
  PropertySubtitle,
  PropertyTitle,
} from "@/components/property/property-title";
import { SectionHeading } from "@/components/shared/section-heading";
import { LISTINGS } from "@/data/listings";
import type { Amenity } from "@/data/properties";
import { findCatalogueProperty } from "@/data/catalogue";
import { propertyMetadata, propertyStaticParams } from "@/lib/property-route";

export function generateStaticParams() {
  return propertyStaticParams();
}

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
  const property = findCatalogueProperty(slug);
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

          <AmenitySection title="Amenities" items={property.amenities} />

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

/**
 * Every amenity, and no "more" link (ADR-044, D-a).
 *
 * This section ended in `<Link href="#">More amenities</Link>`, sitting under a
 * separator that existed to set it apart. The list above it is not truncated —
 * it maps the whole of `property.amenities` — so the link offered a second
 * copy of what the guest was already reading, and `href="#"` meant it did not
 * even offer that. There is no amenities detail route to point it at, so the
 * link goes rather than moves. Add one back only when this list starts
 * cutting itself short and something else holds the rest.
 */
function AmenitySection({ title, items }: { title: string; items: Amenity[] }) {
  return (
    <section>
      <SectionHeading lead={title} className="mb-6" />
      <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => {
          // `available: false` means the house does not have it. Striking it
          // through rather than dropping it is what the reference does, and it
          // answers the question a guest actually came with.
          const unavailable = item.available === false;
          return (
            <li key={item.label} className="flex items-center gap-3">
              <Image
                src={`/assets/${item.icon}.svg`}
                alt=""
                width={24}
                height={24}
                className={`size-6 shrink-0 ${unavailable ? "opacity-40" : "opacity-70"}`}
              />
              <span
                className={
                  unavailable
                    ? "text-sm text-page-fg-70 line-through"
                    : "text-sm text-page-fg"
                }
              >
                {item.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
