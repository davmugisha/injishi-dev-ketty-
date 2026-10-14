"use client";

import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";
import { Award, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@injishi/utils";
import { ResultGallery } from "@/components/explore/result-gallery";
import { NoPhoto } from "@/components/stays/no-photo";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import type { Listing } from "@/data/listings";
import { formatRateNumber, NO_RATE, shortBasis } from "@/lib/price";
import { partyPrice } from "@/lib/party-price";
import { EMPTY_INTENT, propertyHref, type StayIntent } from "@/lib/search-params";

/** A score this high earns the "Top rated" mark. Real: read off the rating. */
const TOP_RATED_SCORE = 9.3;

/**
 * The Explore card: a photo with no frame around it, then four short lines —
 * name and score, where and what, how big, and the price. No card chrome, no
 * amenity strip, no buttons: the grid reads as a gallery of places, and the
 * whole card is one link (a stretched title) with the carousel arrows, the
 * save heart and the compare checkbox sitting above it.
 *
 * The price says its basis ("per person / night") and, under it, what THIS
 * party pays (`lib/party-price.ts`, the checkout's own arithmetic).
 */
export function ResultCardVertical({
  listing,
  intent,
  highlighted = false,
  onHover,
  className,
}: {
  listing: Listing;
  intent?: StayIntent;
  highlighted?: boolean;
  onHover?: (slug: string | null) => void;
  className?: string;
}) {
  const rate = formatRateNumber(listing.nightlyRateRwf);
  const party = partyPrice(listing.nightlyRateRwf, listing.priceBasis, intent ?? EMPTY_INTENT);
  const topRated = (listing.rating?.score ?? 0) >= TOP_RATED_SCORE;
  const ref = useRef<HTMLElement | null>(null);

  // A pin hovered on the map brings its card into view.
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlighted]);

  return (
    <article
      data-result-card
      data-variant="vertical"
      ref={ref}
      onMouseEnter={onHover ? () => onHover(listing.slug) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      className={cn("group relative flex flex-col gap-3", className)}
    >
      <div
        className={cn(
          "relative aspect-[20/19] w-full overflow-hidden rounded-card bg-surface-secondary transition-shadow",
          highlighted && "ring-2 ring-foreground ring-offset-2 ring-offset-background",
        )}
      >
        <div className="absolute inset-0">
          {listing.gallery.length > 0 ? (
            <ResultGallery images={listing.gallery} alt={listing.image?.alt ?? ""} />
          ) : (
            <NoPhoto />
          )}
        </div>
        {/* `z-20`, above the title's stretched link at `z-10`: these are
            controls and marks the link must not swallow. */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3">
          <div className="flex items-start justify-end">
            <span className="pointer-events-auto" data-save-stay>
              <SaveStayButton slug={listing.slug} size="sm" />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {topRated ? (
              <span className="flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-foreground shadow-control">
                <Award className="size-3.5 text-accent-text" strokeWidth={2.4} aria-hidden />
                Top rated
              </span>
            ) : null}
            <span className="flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-foreground shadow-control">
              <ShieldCheck className="size-3.5 text-accent-text" strokeWidth={2.4} aria-hidden />
              Verified
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-0.5 text-sm">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate text-base font-bold leading-tight text-foreground">
            <Link
              href={intent ? propertyHref(listing.slug, intent) : `/property/${listing.slug}`}
              className="after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {listing.nameLead}
              {listing.nameRest ? ` ${listing.nameRest}` : ""}
            </Link>
          </h3>
          {listing.rating ? (
            <span className="flex shrink-0 items-center gap-1 text-sm text-foreground">
              <Star className="size-3.5 fill-current" aria-hidden />
              {listing.rating.score.toFixed(1)}
            </span>
          ) : null}
        </div>

        <p className="truncate text-muted-foreground">
          {listing.location} · {ACCOMMODATION_CLASS_LABEL[listing.kind]}
        </p>
        <p className="truncate text-muted-foreground">
          Sleeps {listing.maxGuests} · {listing.bedrooms}{" "}
          {listing.bedrooms === 1 ? "bedroom" : "bedrooms"}
        </p>

        <p className="mt-1.5 truncate text-foreground">
          {rate ? (
            <>
              <b className="font-bold">{rate} RWF</b>{" "}
              <span className="text-muted-foreground">{shortBasis(listing.priceBasis)}</span>
            </>
          ) : (
            <b className="font-bold">{NO_RATE}</b>
          )}
        </p>
        {party ? (
          <p className="truncate text-muted-foreground">
            {party.label}:{" "}
            <span className="font-semibold text-foreground underline underline-offset-2">
              {party.amount}
            </span>{" "}
            {party.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
