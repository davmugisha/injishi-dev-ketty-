"use client";

import { Grid3x3 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@injishi/ui";
import type { GalleryImage, PropertyDetail } from "@/data/properties";

/**
 * The photo mosaic.
 *
 * Five frames on desktop: one large tile and a two-by-two grid beside it. The
 * shape comes from a CSS grid rather than absolute positioning so the tiles
 * keep their aspect when the container narrows, and so the whole block can
 * collapse to a carousel on mobile without a second layout.
 *
 * Only the outer corners are rounded. Rounding all four corners of every tile
 * is the usual mistake here — it turns one photograph into five stickers.
 *
 * Photography ships as AVIF with a JPEG fallback. The `stay-*` exports have no
 * WebP, which is why this writes its own `<picture>` rather than reaching for
 * `ArtDirectedImage`, whose fallback chain assumes one.
 */
export function PropertyGallery({ property }: { property: PropertyDetail }) {
  const frames = property.gallery.slice(0, 5);
  const [current, setCurrent] = useState(1);
  const [api, setApi] = useState<CarouselApi>();

  useEffect(() => {
    if (!api) return;
    const sync = () => setCurrent(api.selectedScrollSnap() + 1);
    sync();
    api.on("select", sync);
    return () => {
      api.off("select", sync);
    };
  }, [api]);

  const galleryHref = `/property/${property.slug}/gallery`;

  return (
    <section id="photos" className="relative">
      {/* Mobile: one full-bleed swipeable strip with a counter. */}
      <div className="md:hidden">
        <Carousel setApi={setApi} className="w-full">
          <CarouselContent className="ml-0">
            {property.gallery.map((frame, index) => (
              <CarouselItem key={frame.stem} className="pl-0">
                <Link href={galleryHref} className="block">
                  <Frame frame={frame} priority={index === 0} className="aspect-[4/3]" />
                </Link>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white">
          {current} / {property.photoCount}
        </span>
      </div>

      {/* Desktop: the mosaic. */}
      <div className="hidden aspect-[2/1] grid-cols-4 grid-rows-2 gap-2 overflow-hidden rounded-card md:grid">
        {frames.map((frame, index) => (
          <Link
            key={frame.stem}
            href={galleryHref}
            className={
              index === 0
                ? "group relative col-span-2 row-span-2 overflow-hidden"
                : "group relative overflow-hidden"
            }
          >
            <Frame
              frame={frame}
              priority={index === 0}
              className="h-full w-full transition-[filter] duration-200 group-hover:brightness-90"
            />
          </Link>
        ))}
      </div>

      <Link
        href={galleryHref}
        /*
          An opaque ground, not the `page-bg` token: this pill sits on top of a
          photograph, and the token resolves to a transparent value in some
          themes, which let the picture show straight through the label.
        */
        className="absolute bottom-6 right-6 hidden items-center gap-2 border bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:bg-white/90 md:inline-flex rounded border-ink"
      >
        <GridIcon />
        Show all {property.photoCount} photos
      </Link>
    </section>
  );
}

function Frame({
  frame,
  priority,
  className,
}: {
  frame: GalleryImage;
  priority: boolean;
  className?: string;
}) {
  return (
    <picture>
      <source type="image/avif" srcSet={`/assets/${frame.stem}.avif`} />
      {/* Art-directed pair: next/image emits one format and cannot express this. */}
      <img
        src={`/assets/${frame.stem}.jpg`}
        alt={frame.alt}
        width={1120}
        height={560}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={`object-cover ${className ?? ""}`}
      />
    </picture>
  );
}

function GridIcon() {
  return (
    <Grid3x3 width={14} height={14} aria-hidden />
  );
}
