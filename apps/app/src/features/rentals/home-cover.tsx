"use client";

import { homeCoverPhoto, homeStockCover } from "@injishi/data/home-stock";
import { Icon } from "@injishi/ui";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A unit or home cover: uploaded photo, or a stable local stock image. */
export function HomeCoverImage({
  seed,
  photos = [],
  className,
  imgClassName,
}: {
  seed: string;
  photos?: readonly string[];
  className?: string;
  imgClassName?: string;
}) {
  const cover = photos.length > 0 ? homeCoverPhoto(seed, photos) : { ...homeStockCover(seed), stock: true };
  return (
    <div className={cx("relative overflow-hidden bg-default", className)}>
      {/* biome-ignore lint/performance/noImgElement: signed URLs and local stock */}
      <img
        src={cover.src}
        alt={cover.alt}
        className={cx(
          "size-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none",
          imgClassName,
        )}
      />
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/30 via-black/5 to-transparent" aria-hidden />
    </div>
  );
}

/** When there is no photo row at all — a soft placeholder (panels, narrow strips). */
export function HomeCoverPlaceholder({ className }: { className?: string }) {
  return (
    <div className={cx("flex items-center justify-center bg-default text-muted", className)}>
      <Icon name="FolderHouse" className="size-8 opacity-60" />
    </div>
  );
}
