"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@injishi/utils";

/**
 * An image slot that is honest when the file is not there yet.
 *
 * ADR-048 copy.md names ten photographs and calls them "stock stand-ins,
 * chosen deliberately over your own photography so that nothing blocks", and
 * says plainly that they are the weakest part of the page and the first thing
 * to replace. None of them is in the repository yet.
 *
 * So this renders the real `next/image` against the path `copy.md` names, and
 * falls back to a quiet token-coloured ground if that file 404s. The band keeps
 * its shape and its rhythm either way, and the moment somebody drops
 * `hero.jpg` into `public/waitlist/` it simply appears, with no code change and
 * no flag to remember to flip.
 *
 * A broken `<img>` icon in the middle of a launch page is worse than no
 * photograph at all, which is the whole reason this is a client island rather
 * than a plain `<Image>`: `onError` is the only way to know, and it only exists
 * in the browser. The island is the size of the thing that actually needs the
 * browser, which is the rule `AsciiWordmark` already set in the footer.
 */
export function WaitlistImage({
  src,
  alt,
  className,
  imageClassName,
  sizes,
  priority,
  children,
}: {
  src: string;
  /**
   * Empty for a purely decorative band image, which is most of them: the
   * heading beside it already says what the reader needs. A tile that carries
   * the district's name in the picture alone is the one case that needs words.
   */
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  /** Rendered over the fallback ground only, e.g. a district name. */
  children?: React.ReactNode;
}) {
  const [missing, setMissing] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card bg-muted",
        className,
      )}
    >
      {missing ? (
        <div
          className="absolute inset-0 grid place-items-center bg-gradient-to-br from-muted to-accent/20"
          aria-hidden={children ? undefined : true}
        >
          {children}
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "100vw"}
          priority={priority}
          className={cn("object-cover", imageClassName)}
          onError={() => setMissing(true)}
        />
      )}
    </div>
  );
}
