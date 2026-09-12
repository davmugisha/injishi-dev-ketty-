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
}) {
  const titleClass = {
    lg: "text-xl md:text-2xl",
    md: "text-lg md:text-xl",
    sm: "text-base md:text-lg",
  }[size];

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
            "w-full transition-transform duration-300 group-hover:scale-105",
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
          <ArrowBoxIcon className="transition-all duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
