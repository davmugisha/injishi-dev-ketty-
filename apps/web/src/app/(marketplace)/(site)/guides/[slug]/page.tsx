import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Separator } from "@injishi/ui";
import { GuideCard } from "@/components/guides/guide-card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { JsonLd } from "@/components/shared/json-ld";
import { SectionHeading } from "@/components/shared/section-heading";
import { DESTINATIONS, destinationPath, districtsCoveredBy } from "@/data/destination-pages";
import { findGuide, formatPublishedAt, GUIDES, readingMinutes } from "@/data/guides";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { shareMetadata } from "@/lib/share-metadata";
import { articleJsonLd, breadcrumbJsonLd } from "@/lib/structured-data";
import { WEB_URL } from "@/lib/web-url";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.excerpt,
    alternates: { canonical: `/guides/${guide.slug}` },
    ...shareMetadata({
      title: guide.title,
      description: guide.excerpt,
      path: `/guides/${guide.slug}`,
      image: `/assets/${guide.image.stem}.jpg`,
      imageAlt: guide.image.alt,
      type: "article",
    }),
  };
}

/**
 * The destination pages a guide is about, so a reader who has just read where
 * to stay can see the stays (`data/destination-pages.ts`). A guide covering no
 * single district links to them all.
 */
function destinationsFor(slug: string) {
  const covered = districtsCoveredBy(slug);
  return covered.length > 0 ? covered : DESTINATIONS;
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = findGuide(slug);
  if (!guide) notFound();

  const related = GUIDES.filter((candidate) => candidate.slug !== slug).slice(0, 3);
  const destinations = destinationsFor(slug);

  return (
    <div>
      <JsonLd
        data={articleJsonLd({
          title: guide.title,
          description: guide.excerpt,
          path: `/guides/${guide.slug}`,
          image: `/assets/${guide.image.stem}.jpg`,
          publishedAt: guide.publishedAt,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Guides", path: "/guides" },
          { name: guide.title, path: `/guides/${guide.slug}` },
        ])}
      />
      {/* `.page-y` opens the page and its bottom step doubles as the article's
          own, so the separator sits centred in the ordinary two-step interval
          and the related section below owns the page's closing step. Before,
          `.page-y` wrapped everything and its bottom stacked on top of the
          related section's, closing the page on a doubled step. */}
      <article className="page-y container">
        {/* "Guides", not "Blog": the nav, the footer and the page's own
            heading all call this section Guides. */}
        <Breadcrumbs
          trail={[
            { label: "Home", href: "/" },
            { label: "Guides", href: "/guides" },
            { label: guide.category, href: "/guides" },
            { label: guide.title },
          ]}
        />

        <h1 className="mb-8 mt-6 text-2xl text-page-fg md:mb-12 md:text-3xl lg:text-4xl">
          {guide.title}
        </h1>

        <div className="mb-10 overflow-hidden rounded-card">
          <ArtDirectedImage
            stem={guide.image.stem}
            alt={guide.image.alt}
            sizes="(max-width: 1010px) 100vw, 1010px"
            width={1920}
            height={1010}
            priority
            className="aspect-[16/9] w-full"
          />
        </div>

        <aside
          aria-label="Article info"
          className="mb-10 flex flex-wrap items-center gap-6 border-y border-input py-4"
        >
          <span className="flex items-center gap-2 text-sm text-page-fg">
            <Image
              src="/assets/injishi-short.svg"
              alt=""
              width={24}
              height={24}
              className="size-6 rounded-full"
            />
            Injishi
          </span>
          <time dateTime={guide.publishedAt} className="text-sm text-page-fg-70">
            Posted {formatPublishedAt(guide.publishedAt)}
          </time>
          <span className="text-sm text-page-fg-70">{readingMinutes(guide)} min read</span>
          {/* "Share with friends" sat here as plain text that did nothing. A
              WhatsApp link is the share this market uses, and the page's own
              card (title, line, photograph) is what the chat shows. */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`${guide.title} ${WEB_URL}/guides/${guide.slug}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-sm font-medium text-page-fg underline underline-offset-2"
          >
            Share on WhatsApp
          </a>
        </aside>

        <div className="mx-auto flex max-w-wide flex-col gap-8">
          {guide.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <SectionHeading lead={section.heading} />
              <p className="text-page-fg-70">{section.body}</p>
            </section>
          ))}

          {/* The guides used to end without a way to the stays they describe. */}
          <section className="flex flex-col gap-3 rounded-card bg-card p-6 ring-1 ring-border">
            <SectionHeading lead="Where to " emphasis="stay" />
            <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
              {destinations.map((place) => (
                <li key={place.slug}>
                  <Link
                    href={destinationPath(place.slug)}
                    className="inline-flex rounded-full border border-slate-line px-5 py-2.5 text-sm text-page-fg transition-colors duration-travel hover:border-ink"
                  >
                    Stays in {place.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      <Separator />

      <section className="section-y container">
        <div className="mb-8 flex items-center justify-between">
          <SectionHeading lead="More Rwanda " emphasis="experiences" />
          <Button asChild variant="outline" size="sm">
            <Link href="/guides">Discover all Posts</Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {related.map((candidate) => (
            <GuideCard key={candidate.slug} guide={candidate} size="sm" />
          ))}
        </div>
      </section>
    </div>
  );
}
