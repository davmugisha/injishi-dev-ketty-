import type { Metadata } from "next";
import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@injishi/ui";
import { JsonLd } from "@/components/shared/json-ld";
import { PageHero } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/shared/section-heading";
import { FAQ, SERVICE_PILLARS } from "@/data/services";
import { shareMetadata } from "@/lib/share-metadata";
import { faqPageJsonLd } from "@/lib/structured-data";

/**
 * How Injishi works — the page that used to be `/services`.
 *
 * It moved rather than changed. `Services` on this site now means a chargeable
 * hotel amenity sold on its own — a pool day pass, a hall, a marquee — and that
 * marketplace took the `/services` address. This page is the same three
 * pillars, the same art-directed photography, the same jump links and the same
 * FAQ, at the address the footer and the mobile menu were already calling it by.
 *
 * The pillar ids are load-bearing and must not be renamed: the home page and
 * the host page link into `#escrow`, `#self-check-in` and `#rra-compliance`.
 * They come from `SERVICE_PILLARS` in `data/services.ts`, which is shared with
 * another surface, so this page reads that file and never forks it.
 */
const DESCRIPTION =
  "Escrow-backed booking, mobile money and verified hosts: how Injishi works for guests and for hosts.";

export const metadata: Metadata = {
  title: "How Injishi Works",
  description: DESCRIPTION,
  alternates: { canonical: "/how-it-works" },
  ...shareMetadata({ title: "How Injishi works", description: DESCRIPTION, path: "/how-it-works" }),
};

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col items-center">
      <PageHero
        title="How Injishi Works"
        trail={[{ label: "Home", href: "/" }, { label: "How It Works" }]}
        image={{ stem: "rwanda-kigali-hero", alt: "Kigali skyline at sunset" }}
      />

      <div className="section-y container">
        {/* Jump links, mirroring the capture's pill row above the pillars. */}
        <nav aria-label="How Injishi works" className="mb-12 flex flex-wrap gap-3">
          {SERVICE_PILLARS.map((pillar) => (
            <Link
              key={pillar.id}
              href={`#${pillar.id}`}
              className="rounded-full border border-slate-line px-5 py-2.5 text-sm text-page-fg transition-colors duration-travel hover:border-ink"
            >
              {pillar.navLabel}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-16">
          {SERVICE_PILLARS.map((pillar, index) => (
            <section
              key={pillar.id}
              id={pillar.id}
              className="grid scroll-mt-32 grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-16"
            >
              <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
                <picture>
                  <source
                    type="image/avif"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    srcSet={`/media/${pillar.image.stem}.avif`}
                  />
                  {/* Art-directed <picture>: next/image cannot express the AVIF/WebP source pair. */}
                  <img
                    src={`/media/${pillar.image.stem}.webp`}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    width={960}
                    height={640}
                    alt={pillar.image.alt}
                    loading="lazy"
                    className="aspect-[3/2] w-full rounded-card object-cover"
                  />
                </picture>
              </div>

              <div className="flex flex-col gap-4">
                <SectionHeading lead={pillar.lead} emphasis={pillar.emphasis} />
                <p className="text-page-fg-70">{pillar.body}</p>
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* The FAQ is a peer of the pillars, not a tail on them, so it carries
          `.section-y` like any other section rather than the `mt-20` it had
          grown. The interval between the two is now the two adjacent steps the
          rest of the site runs on. */}
      {/* `#faq` is where the mobile drawer's "FAQ" lands; it used to open
          `/support`, which has no questions on it. */}
      <section id="faq" className="section-y container scroll-mt-32">
        <JsonLd data={faqPageJsonLd(FAQ)} />
        <SectionHeading
          lead="Frequently Asked "
          emphasis="Questions"
          className="mb-8"
        />

        <Accordion type="single" collapsible defaultValue={FAQ[0]?.question}>
          {FAQ.map((entry) => (
            <AccordionItem key={entry.question} value={entry.question}>
              <AccordionTrigger className="text-page-fg">
                {entry.question}
              </AccordionTrigger>
              <AccordionContent className="text-page-fg-70">
                {entry.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
