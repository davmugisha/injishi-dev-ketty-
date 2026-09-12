import type { ServiceListing } from "@/data/service-listings";

/**
 * The photo strip on a service detail page: every frame, equally weighted.
 *
 * It takes however many frames the fixture carries — three today — rather than
 * assuming five the way `PropertyGallery` does, so a parking bay with three
 * photographs does not leave two empty cells.
 *
 * NO HERO TILE HERE, deliberately. The page above this already opens on a
 * full-height `PageHero` carrying the last frame of this same gallery, and a
 * second full-width photograph immediately under it pushed the price, the
 * capacity and the inclusions a whole screen further down — two screens of
 * photography before the first fact. Equal tiles read as a gallery and cost one
 * band.
 *
 * The layout is a plain grid rather than a mosaic with a column span, and that
 * is a build constraint as much as a taste: `_injishi-public.css` imports
 * Tailwind with
 * `source(none)` and lists the directories it scans, `components/services` is
 * not on that list yet, so a class used ONLY here compiles to nothing. Every
 * class below is one the marketplace tree already uses, which is what lets this
 * component render correctly before that line lands.
 *
 * THE CAPTION UNDER IT IS NOT DECORATION. There is no amenity photography in
 * `public/assets/` — no pool, no ballroom, no marquee — so these frames are
 * scenery near the property and the `alt` text says what each photograph
 * actually shows. Presenting a hillside as "our marquee" would be the one kind
 * of lie a demo notice cannot undo, so the page says plainly what the reader is
 * looking at.
 */
export function ServiceGallery({ service }: { service: ServiceListing }) {
  return (
    <section aria-label={`Photographs for ${service.name}`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {service.gallery.map((frame, index) => (
          <Frame
            key={frame.stem}
            stem={frame.stem}
            alt={frame.alt}
            priority={index === 0}
            className="aspect-[4/3] w-full rounded-card"
          />
        ))}
      </div>

      <p className="mt-3 text-sm text-page-fg-70">
        Photography shows the property and the country around it. Injishi has not
        published photographs of this amenity yet, and each caption describes the
        picture it sits under rather than the service.
      </p>
    </section>
  );
}

function Frame({
  stem,
  alt,
  priority,
  className,
}: {
  stem: string;
  alt: string;
  priority: boolean;
  className?: string;
}) {
  return (
    <picture className="block">
      <source
        type="image/avif"
        sizes="(max-width: 768px) 100vw, 70vw"
        srcSet={`/assets/${stem}.avif`}
      />
      {/* Art-directed pair: next/image emits one format and cannot express this. */}
      <img
        src={`/assets/${stem}.jpg`}
        sizes="(max-width: 768px) 100vw, 70vw"
        width={1120}
        height={630}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
        className={`object-cover ${className ?? ""}`}
      />
    </picture>
  );
}
