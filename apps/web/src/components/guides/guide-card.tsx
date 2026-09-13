import Link from "next/link";
import { cn } from "@injishi/utils";
import { ArrowBoxIcon } from "@/components/icons/marks";
import { formatPublishedAt, type Guide } from "@/data/guides";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";

/**
 * A guide card.
 *
 * `size` picks the type scale, which is how the home page's 3fr/2fr/1fr grid
 * gets its hierarchy without three separate components.
 *
 * `caption` picks where the words sit, and the two are not interchangeable:
 *
 *  - `below` — date, title and a "Read guide" link under the frame. The /guides
 *    index and the related strip on a guide page run this, where the cards sit
 *    in an even grid on the page ground and the excerpt has room.
 *  - `overlay` — title and date INSIDE the frame, over the shared caption
 *    scrim, which is what the guides capture shows for "Latest from Blog". The
 *    three cards there are unequal columns, so a caption under the frame puts
 *    three blocks of text on three different baselines; moving them inside the
 *    photograph lands them on the card's own bottom edge instead, which is the
 *    only line all three share.
 *
 * The image takes `rounded-card` like every other photographic tile, even
 * though its caption sits below the frame rather than inside it. It ran at 12px
 * off the interior-chrome ramp, which put it a step below the promise cards and
 * district tiles it shares the home page with; DESIGN.md wants one radius
 * across the family, and this is not the surface to make an exception for.
 */
export function GuideCard({
  guide,
  size = "md",
  className,
  imageAspect = "aspect-[16/9]",
  caption = "below",
}: {
  guide: Guide;
  size?: "lg" | "md" | "sm";
  className?: string;
  /**
   * The home page runs these in unequal columns. A single ratio there renders
   * three images of three different heights, which drops each caption onto its
   * own baseline; the slot sets its own ratio so the row reads as one line.
   * Equal-width grids leave this alone.
   */
  imageAspect?: string;
  caption?: "below" | "overlay";
}) {
  const titleClass = {
    lg: "text-xl md:text-2xl",
    md: "text-lg md:text-xl",
    sm: "text-base md:text-lg",
  }[size];

  if (caption === "overlay") {
    return (
      <Link
        href={`/guides/${guide.slug}`}
        aria-label={guide.title}
        className={cn(
          "group relative flex overflow-hidden rounded-card",
          className,
        )}
      >
        {/* The ratio lives on this frame, not on the <img>, and the frame is a
            flex child so a taller sibling in the row stretches it past that
            ratio rather than leaving a band of scrim beside the photograph.
            The same shape `ExploreByDistrict` records. */}
        <div className={cn("w-full overflow-hidden", imageAspect)}>
          <ArtDirectedImage
            stem={guide.image.stem}
            alt={guide.image.alt}
            sizes="(max-width: 1024px) 80vw, 50vw"
            width={1440}
            height={810}
            pictureClassName="block h-full w-full"
            className="h-full w-full transition-transform duration-travel group-hover:scale-105"
          />
        </div>

        <div className="absolute inset-0 flex flex-col justify-end">
          {/* Shared caption scrim — see `scrim-caption` in _injishi-public.css. */}
          <div className="scrim-caption photo-caption relative p-4 md:p-6">
            <div
              aria-hidden
              className="scrim-caption-fade pointer-events-none absolute inset-x-0 bottom-full h-16"
            />

            <div className="flex flex-col gap-1">
              <h3 className={cn("font-normal leading-[1.25] text-white", titleClass)}>
                {guide.title}
              </h3>
              {/* Under the title, not above it: the capture reads the headline
                  first and the date as its footnote, and on a scrim the smaller
                  line is the one that wants the darker end of the gradient. */}
              <time dateTime={guide.publishedAt} className="text-sm text-white">
                {formatPublishedAt(guide.publishedAt)}
              </time>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/guides/${guide.slug}`}
      aria-label={guide.title}
      className={cn("group relative flex flex-col gap-4", className)}
    >
      <div className="overflow-hidden rounded-card">
        <ArtDirectedImage
          stem={guide.image.stem}
          alt={guide.image.alt}
          sizes="50vw"
          width={1440}
          height={810}
          className={cn(
            "w-full transition-transform duration-travel group-hover:scale-105",
            imageAspect,
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <time
          dateTime={guide.publishedAt}
          className="text-xs uppercase tracking-wide text-page-fg-70"
        >
          {formatPublishedAt(guide.publishedAt)}
        </time>
        <h3 className={cn("font-medium leading-[1.25] text-page-fg", titleClass)}>
          {guide.title}
        </h3>
        <span className="flex items-center gap-1.5 text-sm text-page-fg">
          <span className="underline underline-offset-4">Read guide</span>
          <ArrowBoxIcon className="transition-all duration-travel group-hover:-translate-y-1 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
