import { cn } from "@injishi/utils";
import { buildSrcSet, fullSizeSrc } from "@/lib/responsive-image";

/**
 * An AVIF-with-WebP-fallback `<picture>`.
 *
 * next/image cannot express a source pair like this — it owns the whole
 * element and emits one format — so these stay as a hand-written `<picture>`.
 * Widths come from `buildSrcSet`, which knows which exports each stem has.
 */
export function ArtDirectedImage({
  stem,
  alt,
  sizes,
  width,
  height,
  className,
  pictureClassName,
  priority = false,
  style,
}: {
  stem: string;
  alt: string;
  sizes: string;
  width: number;
  height: number;
  className?: string;
  /**
   * Classes for the `<picture>` itself. It is an inline box by default, and an
   * inline box asked to fill a sized parent collapses; a caller that wraps this
   * in a frame passes `block h-full w-full` so the image can fill it.
   */
  pictureClassName?: string;
  /** Set on the one image above the fold; everything else lazy-loads. */
  priority?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <picture className={pictureClassName}>
      <source type="image/avif" sizes={sizes} srcSet={buildSrcSet(stem, "avif")} />
      <img
        src={fullSizeSrc(stem, "webp")}
        srcSet={buildSrcSet(stem, "webp")}
        sizes={sizes}
        width={width}
        height={height}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={cn("object-cover", className)}
        style={style}
      />
    </picture>
  );
}
