import { cn } from "@injishi/utils";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { NoPhoto } from "@/components/stays/no-photo";
import type { GalleryImage } from "@/data/properties";

/**
 * A stay's first photograph at thumbnail size.
 *
 * A stay's photograph is an uploaded `src`, which has no AVIF sibling and no
 * width ladder, so it renders as a plain image; a bundled stem still renders
 * through the art-directed pair. A stay with no photograph says so.
 */
export function StayThumb({
  image,
  sizes,
  className,
}: {
  image: GalleryImage | null;
  sizes: string;
  className?: string;
}) {
  if (!image) return <NoPhoto compact={sizes.endsWith("px")} />;
  if (image.src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- uploaded, unknown host
      <img
        src={image.src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }

  return (
    <ArtDirectedImage
      stem={image.stem}
      alt=""
      sizes={sizes}
      width={480}
      height={480}
      pictureClassName="block h-full w-full"
      className={cn("h-full w-full", className)}
    />
  );
}
