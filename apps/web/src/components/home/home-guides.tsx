import Link from "next/link";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { SectionHeading } from "@/components/shared/section-heading";
import { formatPublishedAt, GUIDES } from "@/data/guides";

/**
 * Guides: three even cards, newest first.
 *
 * Even, not the old 3fr/2fr/1fr row: three guides read as three peers, and
 * the "All guides" link in the heading does what the "More" tile did.
 */
export function HomeGuides() {
  const guides = [...GUIDES]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 3);
  // No articles, no strip: an empty "Guides" heading is a promise with nothing behind it.
  if (guides.length === 0) return null;

  return (
    <section className="section-y container flex flex-col gap-8">
      <SectionHeading
        lead="Guides "
        emphasis="for the road"
        action={{ label: "All guides", href: "/guides" }}
      />

      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
        {guides.map((guide) => (
          <article key={guide.slug} className="group relative flex w-[80%] shrink-0 snap-start flex-col gap-3 md:w-auto">
            <div className="aspect-[4/3] overflow-hidden rounded-card bg-surface-secondary">
              <ArtDirectedImage
                stem={guide.image.stem}
                alt={guide.image.alt}
                sizes="(max-width: 768px) 80vw, 33vw"
                width={960}
                height={720}
                pictureClassName="block h-full w-full"
                className="h-full w-full transition-transform duration-travel ease-settle group-hover:scale-105"
              />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
              {guide.category} · {formatPublishedAt(guide.publishedAt)}
            </p>
            <h3 className="text-lg font-bold leading-snug text-foreground">
              <Link
                href={`/guides/${guide.slug}`}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {guide.title}
              </Link>
            </h3>
            <p className="line-clamp-2 text-sm text-muted-foreground">{guide.excerpt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
