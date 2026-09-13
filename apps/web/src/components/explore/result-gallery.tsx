"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@injishi/ui";
import { cn } from "@injishi/utils";
import type { GalleryImage } from "@/data/properties";

/**
 * The photo carousel inside a result card.
 *
 * Built on `@injishi/ui`'s shared Embla wrapper rather than a second carousel
 * implementation. That component positions its prev/next buttons OUTSIDE the
 * frame (`-left-12` / `-right-12`) for the decks it was built for; here they
 * sit ON the photograph at its own corners, which is a `className` override
 * `cn`'s `twMerge` resolves in this component's favour rather than a fork.
 *
 * Arrows are hidden until hover / focus on desktop (`group-hover`,
 * `focus-within`) and always visible on touch, because a touch surface has no
 * hover state to reveal them with — a control only reachable by hovering is a
 * control a phone cannot reach at all.
 *
 * **The controls must stay OUT of the card's link.** `result-card.tsx` uses a
 * stretched link on the title rather than an anchor wrapping the whole card,
 * specifically so these arrows are siblings of it. When they were descendants
 * of the anchor, a click advanced nothing and navigated to the property page
 * instead — and neither `stopPropagation` on the arrow nor a bubble-phase
 * trap around it stopped that, because the buttons are React-Aria
 * press-managed and the anchor's own default action still ran. They also sit
 * at `z-20`, above the stretched link's `z-10` overlay, or the overlay would
 * simply cover them.
 */
export function ResultGallery({
  images,
  alt,
  className,
}: {
  images: GalleryImage[];
  alt: string;
  className?: string;
}) {
  if (images.length === 0) return null;

  return (
    <Carousel
      opts={{ loop: images.length > 1 }}
      data-result-gallery
      className={cn(
        "group/gallery relative h-full w-full",
        // `CarouselContent`'s className lands on the inner flex track, not on
        // the viewport it sits in, and that viewport ships with `overflow-hidden`
        // and NO height. Without this the viewport takes its height from its
        // content, the content is a `<picture>` set to `h-full`, and an inline
        // box asked to fill a parent that has no height collapses to nothing —
        // the same failure `home/browse-by-category.tsx` records in its own
        // comment, which is how these cards shipped with blank photo columns.
        "[&_[data-slot=carousel-viewport]]:h-full",
        className,
      )}
    >
      <CarouselContent className="-ml-0 h-full">
        {images.map((image, index) => (
          <CarouselItem key={image.stem} index={index} className="h-full basis-full pl-0">
            <picture className="block h-full w-full">
              {image.src ? null : (
                <source
                  type="image/avif"
                  sizes="(max-width: 768px) 100vw, 720px"
                  srcSet={`/assets/${image.stem}.avif`}
                />
              )}
              <img
                data-gallery-image={image.stem}
                src={image.src ?? `/assets/${image.stem}.jpg`}
                sizes="(max-width: 768px) 100vw, 720px"
                width={720}
                height={450}
                alt={image.alt || alt}
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover object-center"
              />
            </picture>
          </CarouselItem>
        ))}
      </CarouselContent>

      {images.length > 1 ? (
        // `contents`, so this grouping adds no box: the arrows stay
        // positioned against the gallery itself, which is what their
        // `absolute` placement is measured from.
        <div className="contents">
          <CarouselPrevious
            data-gallery-prev
            className="left-2 top-1/2 z-20 size-8 -translate-y-1/2 border-none bg-white/90 text-foreground opacity-0 shadow-control transition-opacity duration-150 hover:bg-white focus-visible:opacity-100 group-hover/gallery:opacity-100 max-md:opacity-100"
          >
            <ChevronLeft className="size-4" strokeWidth={2.5} />
          </CarouselPrevious>
          <CarouselNext
            data-gallery-next
            className="right-2 top-1/2 z-20 size-8 -translate-y-1/2 border-none bg-white/90 text-foreground opacity-0 shadow-control transition-opacity duration-150 hover:bg-white focus-visible:opacity-100 group-hover/gallery:opacity-100 max-md:opacity-100"
          >
            <ChevronRight className="size-4" strokeWidth={2.5} />
          </CarouselNext>
          {/*
            `CarouselDots` renders `[data-dot]` buttons under its own
            `.carousel-dots` class, and that class carries no rule anywhere in
            this app — the public stylesheet's own header names it as one of
            five deliberately unstyled because nothing consumed it. This is
            now the first consumer, so the shape is styled here, on the
            buttons themselves via `[&_[data-dot]]`, rather than reviving a
            shared class this app still has no second user for.
          */}
          <CarouselDots
            className={cn(
              "absolute inset-x-0 bottom-2 z-20 flex justify-center gap-1",
              "[&_[data-dot]]:size-1.5 [&_[data-dot]]:rounded-full [&_[data-dot]]:bg-white/60 [&_[data-dot]]:transition-all",
              "[&_[data-dot][data-active=true]]:w-3.5 [&_[data-dot][data-active=true]]:bg-white",
            )}
          />
        </div>
      ) : null}
    </Carousel>
  );
}
