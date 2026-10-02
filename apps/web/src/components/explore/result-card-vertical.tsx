"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "@injishi/utils";
import { ResultGallery } from "@/components/explore/result-gallery";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import type { Listing } from "@/data/listings";
import { formatRateNumber, NO_RATE, shortBasis } from "@/lib/price";
import { partyPrice } from "@/lib/party-price";
import { EMPTY_INTENT, propertyHref, type StayIntent } from "@/lib/search-params";
import { ratingLabel } from "@/lib/rating";

/**
 * The split-view card: photo on top (16:10), name and rating below, price at
 * the bottom. A tighter shape than `ResultCard` because the split column is
 * narrow, and a tighter CLAIM too — no amenity strip, no total-with-taxes
 * line, no deal badge. Everything a guest needs to decide whether to open a
 * pin from the map; the full card lives one click away on the property page.
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
  const ref = useRef<HTMLElement | null>(null);

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
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card bg-card ring-1 transition-shadow hover:shadow-control",
        highlighted ? "ring-2 ring-primary shadow-control" : "ring-border",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <div className="absolute inset-0">
          <ResultGallery images={listing.gallery} alt={listing.image.alt} />
        </div>
        <div className="pointer-events-none absolute inset-0 z-20 flex items-start justify-end p-3">
          <span className="pointer-events-auto" data-save-stay>
            <SaveStayButton slug={listing.slug} size="sm" />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-base font-bold leading-tight text-foreground">
            <Link
              href={intent ? propertyHref(listing.slug, intent) : `/property/${listing.slug}`}
              className="after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {listing.nameLead}
              {listing.nameRest ? ` ${listing.nameRest}` : ""}
            </Link>
          </h3>
          {listing.rating ? (
            <span className="flex h-6 shrink-0 items-center gap-1 rounded bg-accent px-1.5 text-xs font-bold text-accent-foreground">
              {listing.rating.score.toFixed(1)}
            </span>
          ) : null}
        </div>

        <p className="truncate text-xs text-muted-foreground">
          {listing.location}
          {listing.rating ? (
            <>
              {" · "}
              <span className="font-bold text-accent-text">{ratingLabel(listing.rating)}</span>
            </>
          ) : null}
        </p>

        {/* Price and the one trust mark the split card keeps, side by side
            in the flow. The mark used to float absolutely over this row and
            covered the price ("F per room / night"). */}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-separator pt-2.5">
          {rate ? (
            <p className="min-w-0 text-sm font-bold text-foreground">
              <span className="block truncate">
                {rate}&nbsp;RWF{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {shortBasis(listing.priceBasis)}
                </span>
              </span>
              {party ? (
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {party.label}: <b className="font-bold text-foreground">{party.amount}</b>
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-sm font-bold text-foreground">{NO_RATE}</p>
          )}
          <span className="flex shrink-0 items-center gap-1 text-2xs font-bold uppercase tracking-widest text-accent-text">
            <ShieldCheck className="size-3.5" strokeWidth={2.5} aria-hidden />
            Verified
          </span>
        </div>
      </div>
    </article>
  );
}
