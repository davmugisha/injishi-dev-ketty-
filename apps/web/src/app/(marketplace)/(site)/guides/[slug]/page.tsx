import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button, Separator } from "@injishi/ui";
import { GuideCard } from "@/components/guides/guide-card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import { findGuide, formatPublishedAt, GUIDES } from "@/data/guides";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";

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
  return { title: guide.title, description: guide.excerpt };
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

  return (
    <div>
      {/* `.page-y` opens the page and its bottom step doubles as the article's
          own, so the separator sits centred in the ordinary two-step interval
          and the related section below owns the page's closing step. Before,
          `.page-y` wrapped everything and its bottom stacked on top of the
          related section's, closing the page on a doubled step. */}
      <article className="page-y container">
        <Breadcrumbs
          trail={[
            { label: "Home", href: "/" },
            { label: "Blog", href: "/guides" },
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
          <span className="text-sm text-page-fg-70">{guide.readingMinutes} min read</span>
          <span className="ml-auto text-sm text-page-fg-70">Share with friends</span>
        </aside>

        <div className="mx-auto flex max-w-wide flex-col gap-8">
          {guide.sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <SectionHeading lead={section.heading} />
              <p className="text-page-fg-70">{section.body}</p>
            </section>
          ))}
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
