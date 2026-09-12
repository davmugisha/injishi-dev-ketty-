import Link from "next/link";
import { Fragment } from "react";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";

/**
 * The photographic banner that opens About, Services, and Support — a title
 * and breadcrumb in white over a darkened still.
 */
export function PageHero({
  title,
  trail,
  image,
  lede,
}: {
  title: string;
  trail: { label: string; href?: string }[];
  image: { stem: string; alt: string };
  lede?: string;
}) {
  return (
    <section className="relative min-h-dvh w-full">
      <ArtDirectedImage
        stem={image.stem}
        alt={image.alt}
        sizes="100vw"
        width={1920}
        height={640}
        priority
        className="absolute inset-0 h-full w-full"
      />

      <div
        aria-hidden
        className="scrim-hero pointer-events-none absolute inset-0"
      />

      <div className="container relative z-[2] flex min-h-dvh flex-col justify-end pb-12 pt-28 lg:pt-40">
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="m-0 flex list-none items-center p-0 text-sm text-white">
            {trail.map((crumb, index) => {
              const last = index === trail.length - 1;
              return (
                <Fragment key={crumb.label}>
                  <li>
                    {crumb.href && !last ? (
                      <Link href={crumb.href} className="hover:underline">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-white/70" aria-current="page">
                        {crumb.label}
                      </span>
                    )}
                  </li>
                  {last ? null : (
                    <li aria-hidden className="mx-2 text-white/50">
                      /
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ol>
        </nav>

        <h1 className="text-3xl font-bold text-white md:text-display-md lg:text-display-lg">
          {title}
        </h1>
        {lede ? <p className="mt-3 max-w-read text-white/80">{lede}</p> : null}
      </div>
    </section>
  );
}
