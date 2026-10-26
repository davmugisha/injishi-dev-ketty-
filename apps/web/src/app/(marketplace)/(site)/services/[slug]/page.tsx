import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Separator } from "@injishi/web-ui";
import { ServiceBookingPanel } from "@/components/services/service-booking-panel";
import { ServiceCard } from "@/components/services/service-card";
import { ServiceGallery } from "@/components/services/service-gallery";
import { ServiceKindIcon } from "@/components/services/service-kind-mark";
import { PageHero } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/shared/section-heading";
import { fetchPlatform, servesSampleData } from "@/data/platform";
import { fetchPublicProperty } from "@/data/public-property";
import {
  findServiceListing,
  SERVICE_KIND_TAG,
  servicesForProperty,
} from "@/data/service-listings";
import { formatRwf } from "@/lib/money";

/**
 * One chargeable service: gallery, price, capacity, inclusions, the property.
 *
 * `params` is a Promise in Next 15 and is awaited, the same as the property
 * route beside this one. `generateMetadata` reads the same record the page
 * does rather than a second copy of the title.
 *
 * SAMPLE DATABASES ONLY, like the index above it: the record is invented, so
 * the API is asked on every request and anything but a positive "sample data"
 * answer is a 404. That is why it no longer prerenders every service with
 * `generateStaticParams`: a build cannot know which stack it will serve.
 *
 * IT OPENS ON A PHOTOGRAPHIC HERO, AND THAT IS A HEADER DECISION AS MUCH AS A
 * DESIGN ONE. `headerVariantFor` in `data/navigation.ts` matches by PREFIX and
 * `/services` is deliberately absent from its white list, because the index
 * above this page opens on a hero. A prefix cannot say "the parent is dark and
 * the children are white", so a detail page that opened on the bare background
 * would take the dark bar and paint the wordmark and the whole nav white on
 * white — the exact bug that comment records for `/host` and `/training`. The
 * hero here is what makes the inherited variant correct.
 *
 * The hero takes the LAST gallery frame rather than the first, so the mosaic
 * directly under it does not open with the photograph the reader is still
 * looking at.
 *
 * The property link is checked against the database rather than trusted.
 * `data/service-listings.ts` names a `propertySlug` as a plain string, and a
 * plain string can name a page nobody published. The API answers whether the
 * property is public; the link and the location block render only when it is.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = findServiceListing(slug);
  if (!service) return { title: "Service not found" };

  return {
    title: `${service.name} — ${service.propertyName}`,
    description: `${service.blurb} ${formatRwf(service.priceRwf)} ${service.priceUnit}.`,
    robots: { index: false, follow: false },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!servesSampleData(await fetchPlatform())) notFound();
  const { slug } = await params;
  const service = findServiceListing(slug);
  if (!service) notFound();

  const read = await fetchPublicProperty(service.propertySlug);
  const property = read.status === "found" ? read.property : null;
  const alsoHere = servicesForProperty(service.propertySlug).filter(
    (other) => other.slug !== service.slug,
  );
  const heroFrame = service.gallery[service.gallery.length - 1];

  return (
    <div className="flex flex-col items-center bg-background">
      <PageHero
        title={service.name}
        trail={[
          { label: "Home", href: "/" },
          { label: "Services", href: "/services" },
          { label: service.name },
        ]}
        image={{ stem: heroFrame.stem, alt: heroFrame.alt }}
        lede={`${service.blurb} ${formatRwf(service.priceRwf)} ${service.priceUnit}.`}
      />

      <div className="section-y container">
        <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-page-fg-70">
          <ServiceKindIcon kind={service.kind} className="size-4 shrink-0" />
          {SERVICE_KIND_TAG[service.kind]}
          <span aria-hidden>/</span>
          {property ? (
            <Link
              href={`/property/${service.propertySlug}`}
              className="text-page-fg underline underline-offset-[4px]"
            >
              {service.propertyName}
            </Link>
          ) : (
            <span className="text-page-fg">{service.propertyName}</span>
          )}
          {property ? (
            <>
              <span aria-hidden>/</span>
              {property.districtName ?? "Rwanda"}
            </>
          ) : null}
        </div>

        <ServiceGallery service={service} />

        <div className="mt-12 grid grid-cols-1 items-start gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
          <div className="flex flex-col gap-12">
            <section className="flex flex-col gap-4">
              <SectionHeading lead="About this " emphasis="service" />
              {service.about.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="max-w-read text-page-fg-70">
                  {paragraph}
                </p>
              ))}
            </section>

            {/* Price and capacity again, in the body. The rail beside this is
                sticky on desktop and sits below everything on mobile, and the
                two questions this page exists to answer must not depend on a
                viewport. */}
            <section>
              <SectionHeading lead="Price and " emphasis="capacity" className="mb-6" />
              <dl className="m-0 grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
                <Fact label="Price">
                  {formatRwf(service.priceRwf)}{" "}
                  <span className="font-normal text-page-fg-70">
                    {service.priceUnit}
                  </span>
                </Fact>
                <Fact label="Capacity">{service.capacity}</Fact>
                <Fact label="Service">{SERVICE_KIND_TAG[service.kind]}</Fact>
                <Fact label="Property">{service.propertyName}</Fact>
              </dl>
            </section>

            <section>
              <SectionHeading lead="What is " emphasis="included" className="mb-6" />
              <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-accent-brand"
                      strokeWidth={2.5}
                      aria-hidden
                    />
                    <span className="text-sm text-page-fg">{feature}</span>
                  </li>
                ))}
              </ul>
              <Separator className="mt-6" />
              <p className="mt-3 text-sm text-page-fg-70">
                Anything not on this list is quoted separately by{" "}
                {service.propertyName}.
              </p>
            </section>

            {property ? (
              <section>
                <SectionHeading
                  lead="Where it "
                  emphasis="is"
                  action={{
                    label: "See the property",
                    href: `/property/${service.propertySlug}`,
                  }}
                  className="mb-6"
                />
                <div className="flex flex-col gap-3 rounded-card border border-border bg-card p-6">
                  <b className="text-page-fg">{property.name}</b>
                  <span className="text-sm text-page-fg-70">
                    {property.districtName ?? "Rwanda"}
                  </span>
                  {property.description ? (
                    <p className="m-0 max-w-read text-sm text-page-fg-70">
                      {property.description.split(/\n{2,}/)[0]}
                    </p>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          <ServiceBookingPanel service={service} />
        </div>

        {alsoHere.length > 0 ? (
          <section className="pt-14 lg:pt-20">
            <SectionHeading
              lead="Also at "
              emphasis={service.propertyName}
              action={{ label: "All services", href: "/services" }}
              className="mb-8"
            />
            <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
              {alsoHere.map((other) => (
                <li key={other.slug} className="flex">
                  <ServiceCard service={other} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-input py-3">
      <dt className="text-sm text-page-fg-70">{label}</dt>
      <dd className="m-0 text-right text-sm font-medium text-page-fg">{children}</dd>
    </div>
  );
}
