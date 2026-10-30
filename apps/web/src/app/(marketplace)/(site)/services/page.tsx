import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ServiceCard } from "@/components/services/service-card";
import { fetchPlatform, servesSampleData } from "@/data/platform";
import { ServiceKindIcon } from "@/components/services/service-kind-mark";
import { PageHero } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  SERVICE_KIND_BLURB,
  SERVICE_KIND_LABEL,
  SERVICE_KIND_ORDER,
  servicesOfKind,
} from "@/data/service-listings";

/**
 * The services index: every hotel amenity sold on its own, grouped by kind.
 *
 * `/services` used to render the marketing pillars and the FAQ, a second copy
 * of `/how-it-works` at the address the amenities marketplace had already
 * taken. `/services/[slug]` linked "All services" back here and landed on
 * escrow and self check-in. The pillars live at `/how-it-works` alone now, and
 * this page is what its children's breadcrumb promises.
 *
 * It reads the same fixture and the same card the detail page does
 * (`data/service-listings.ts`, `ServiceCard`), so a tile here is the tile a
 * reader clicked on the property page. Every figure in that fixture is
 * invented; read its header before quoting one.
 *
 * It opens on a photographic hero ON PURPOSE: `headerVariantFor` keeps
 * `/services` off its white-page list, and the detail pages under it inherit
 * the dark header by prefix.
 *
 * SAMPLE DATABASES ONLY. There is no Services module; every business, price
 * and capacity here is invented. Production served it as real offers, linked
 * from the header, until 2026-10-21. Now the API is asked, and anything but a
 * positive "sample data" answer is a 404 (fail closed, as `/demo` does), and
 * no crawler is ever told to index it. When the real module lands, this gate
 * goes with the fixture.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Pool day passes, halls, outdoor spaces, marquees and parking, booked on their own at hotels across Rwanda.",
  robots: { index: false, follow: false },
};

const GROUPS = SERVICE_KIND_ORDER.map((kind) => ({
  kind,
  services: servicesOfKind(kind),
})).filter((group) => group.services.length > 0);

export default async function ServicesPage() {
  if (!servesSampleData(await fetchPlatform())) notFound();

  return (
    <div className="flex flex-col items-center bg-background">
      <PageHero
        title="Services"
        trail={[{ label: "Home", href: "/" }, { label: "Services" }]}
        image={{ stem: "kigali-hills-view-01", alt: "Kigali's hills in the afternoon" }}
        lede="Book a hotel's pool, hall, lawn, marquee or parking without booking a room."
      />

      <div className="section-y container">
        {/* Jump links, one per kind, the same pill row `/how-it-works` opens on. */}
        <nav aria-label="Service kinds" className="mb-12 flex flex-wrap gap-3">
          {GROUPS.map(({ kind }) => (
            <Link
              key={kind}
              href={`#${kind}`}
              className="flex items-center gap-2 rounded-full border border-slate-line px-5 py-2.5 text-sm text-page-fg transition-colors duration-travel hover:border-ink"
            >
              <ServiceKindIcon kind={kind} className="size-4 shrink-0" />
              {SERVICE_KIND_LABEL[kind]}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-16">
          {GROUPS.map(({ kind, services }) => (
            <section key={kind} id={kind} className="scroll-mt-32">
              <SectionHeading
                lead={SERVICE_KIND_LABEL[kind]}
                lede={SERVICE_KIND_BLURB[kind]}
                className="mb-8"
              />
              <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <li key={service.slug} className="flex">
                    <ServiceCard service={service} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-16 text-sm text-page-fg-70">
          Wondering how paying for a service works?{" "}
          <Link
            href="/how-it-works#escrow"
            className="text-page-fg underline underline-offset-[4px]"
          >
            How Injishi works
          </Link>
        </p>
      </div>
    </div>
  );
}
