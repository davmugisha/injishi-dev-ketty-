import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@injishi/web-ui";
import { GuideCard } from "@/components/guides/guide-card";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { SectionHeading } from "@/components/shared/section-heading";
import { formatPublishedAt, GUIDES } from "@/data/guides";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { shareMetadata } from "@/lib/share-metadata";

const DESCRIPTION =
  "Guides to staying across Rwanda: Kigali, Musanze, Lake Kivu, Huye and the districts in between.";

// "Guides", not "Blog": the browser tab said Blog while the nav, the footer and
// the page's own heading said Guides.
export const metadata: Metadata = {
  title: "Guides to Rwanda",
  description: DESCRIPTION,
  alternates: { canonical: "/guides" },
  ...shareMetadata({ title: "Guides to staying in Rwanda", description: DESCRIPTION, path: "/guides" }),
};

export default function GuidesPage() {
  const [first, second, ...rest] = GUIDES;
  const featured = [first, second].filter((guide) => guide !== undefined);

  return (
    <div>
      {/* `.page-y` opens the page and its bottom step doubles as this block's
          own, so the guide grid below can take a plain `.section-y` and the two
          meet on the ordinary interval instead of the `mt-16` it had grown. */}
      <div className="page-y container">
        <Breadcrumbs
          trail={[
            { label: "Home", href: "/" },
            { label: "Guides", href: "/guides" },
            { label: "Destinations" },
          ]}
        />

        <h1 className="sr-only">Guides from across Rwanda</h1>

        {/* The two most recent guides lead, side by side. */}
        <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {featured.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              aria-label={guide.title}
              className="group flex w-full flex-1 flex-col overflow-hidden rounded-card"
            >
              <div className="relative overflow-hidden">
                <ArtDirectedImage
                  stem={guide.image.stem}
                  alt={guide.image.alt}
                  sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw"
                  width={960}
                  height={540}
                  className="aspect-[16/10] w-full transition-transform duration-300 group-hover:scale-105"
                />
                <Badge variant="glass" className="absolute left-4 top-4">
                  Most recent article
                </Badge>
              </div>

              <div className="flex flex-col gap-3 pt-5">
                <h2 className="text-xl text-page-fg group-hover:underline md:text-2xl">
                  {guide.title}
                </h2>
                <p className="text-sm text-page-fg-70">{guide.excerpt}</p>
                <div className="flex items-center gap-4 text-xs text-page-fg-70">
                  <span className="flex items-center gap-2">
                    <Image
                      src="/assets/injishi-short.svg"
                      alt=""
                      width={20}
                      height={20}
                      className="size-5 rounded-full"
                    />
                    Injishi
                  </span>
                  <time dateTime={guide.publishedAt}>
                    Posted {formatPublishedAt(guide.publishedAt)}
                  </time>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>

      <section className="section-y container">
        <SectionHeading lead="Guides from across Rwanda" className="mb-8" />
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>
      </section>
    </div>
  );
}
