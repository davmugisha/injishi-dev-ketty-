"use client";

import type { StockKey } from "@injishi/product-pms";
import { usePmsMedia } from "@injishi/product-pms/web";
import { Photo } from "@injishi/ui";
import type { ReactNode } from "react";

/*
 * The phone chrome these screens share with HR's (PhoneSheet, PhoneToasts, PhoneTitle, ToneTile, NothingYet
 * and the Card renderers) is `@injishi/ui/phone` (ADR-074 stage 3). What stays here is PMS's alone.
 */

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** The Kigali wall clock now, "11:06": when the person did something on this phone. */
export function kigaliClock(at: Date = new Date()): string {
  return at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Kigali" });
}

/** A stock photo with an optional caption over its lower edge (artifact: .ij-photo with a caption). */
export function PhotoTile({
  image,
  caption,
  className,
  sizes = "390px",
  priority,
  children,
}: {
  image: StockKey;
  caption?: ReactNode;
  className?: string;
  sizes?: string;
  /** Above the fold on first paint (largest contentful paint). */
  priority?: boolean;
  children?: ReactNode;
}) {
  const { photo } = usePmsMedia();
  return (
    <figure className={cx("relative m-0 overflow-hidden rounded-[18px] bg-surface-secondary", className)}>
      <Photo image={photo(image)} fill sizes={sizes} priority={priority} />
      {caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-[10px] pt-[18px] pb-[8px] text-[12px] leading-4 font-medium text-white">
          {caption}
        </figcaption>
      ) : null}
      {children}
    </figure>
  );
}
