"use client";

/**
 * The image slot shared by the operator's visual catalogs.
 *
 * Its whole job is what happens when there is no photograph. A catalog where
 * half the tiles are grey rectangles looks broken; one where they are drawn
 * lettered plates looks like a catalog someone is still filling in — which is
 * exactly what it is. The plate carries the item's initials on a brand ink, and
 * says so in words on hover, so the host knows the photo is theirs to add
 * rather than ours to load.
 */

import { initialsOf, placeholderInk, type Photo } from "../lib/media";

export function MediaTile({
  photo,
  name,
  ratio = "4 / 3",
  radius = 10,
  /** Rendered over the image, bottom-left — a price, a badge, a count. */
  overlay,
  className,
}: {
  photo: Photo | null;
  name: string;
  ratio?: string;
  radius?: number;
  overlay?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{
        position: "relative",
        display: "block",
        aspectRatio: ratio,
        borderRadius: radius,
        overflow: "hidden",
        background: photo ? "var(--hover)" : placeholderInk(name),
        flex: "0 0 auto",
        // The container for the placeholder's cqw sizing below. It has to sit
        // on the ancestor: container units never resolve against their own box.
        containerType: "inline-size",
      }}
    >
      {photo ? (
        <picture>
          {photo.avif ? <source srcSet={photo.avif} type="image/avif" /> : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.src}
            alt={name}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </picture>
      ) : (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--on-fill)",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(18px, 26cqw, 34px)",
            fontWeight: 700,
            letterSpacing: "0.02em",
            containerType: "inline-size",
          }}
        >
          {initialsOf(name)}
        </span>
      )}
      {overlay ? (
        <span
          style={{
            position: "absolute",
            inset: "auto 0 0 0",
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            padding: "18px 10px 8px",
            // A real gradient scrim, so white text over a bright photograph
            // clears 4.5:1 at the bottom edge where it actually sits.
            background:
              "linear-gradient(to top, rgba(4,35,48,0.82), rgba(4,35,48,0.45) 55%, rgba(4,35,48,0))",
          }}
        >
          {overlay}
        </span>
      ) : null}
    </span>
  );
}

/** The "no photo yet" note the catalogs put under a placeholder plate. */
export function NeedsPhoto({ label = "No photo yet" }: { label?: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11,
        fontWeight: 600,
        color: "var(--muted)",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <rect x="1.6" y="3.4" width="12.8" height="9.6" rx="2" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8.2" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      {label}
    </span>
  );
}
