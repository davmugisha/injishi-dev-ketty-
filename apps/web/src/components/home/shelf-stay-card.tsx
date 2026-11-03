"use client";

import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";
import { ArrowUpRight, Award, BedDouble, MapPin, ShieldCheck, Star, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@injishi/utils";
import { StayThumb } from "@/components/home/stay-thumb";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import type { Listing } from "@/data/listings";
import { partyPrice } from "@/lib/party-price";
import { formatRateNumber, NO_RATE, shortBasis } from "@/lib/price";
import { EMPTY_INTENT } from "@/lib/search-params";

/** A score this high earns the "Top rated" mark, as on Explore. */
const TOP_RATED_SCORE = 9.3;

/**
 * The district page's stay card (it was the home page shelf's until that shelf
 * was removed on 2026-11-03).
 *
 * Explore's card is a quiet gallery tile because it sits in a grid of forty;
 * a district page shows a handful, and each has to make the case for a click.
 * So this one is a framed card that lifts on hover: the photograph zooms, the
 * score sits on it, the facts carry icons, and the price block is the same
 * two lines on every card — the rate and its basis, then either the party's
 * total (per-person rates, `lib/party-price.ts`) or what the rate covers — so
 * a row of four lines up at the bottom instead of ending at four heights.
 */
export function ShelfStayCard({ listing, className }: { listing: Listing; className?: string }) {
  const rate = formatRateNumber(listing.nightlyRateRwf);
  const party = partyPrice(listing.nightlyRateRwf, listing.priceBasis, EMPTY_INTENT);
  const score = listing.rating?.score ?? null;
  const topRated = (score ?? 0) >= TOP_RATED_SCORE;
  const name = `${listing.nameLead}${listing.nameRest ? ` ${listing.nameRest}` : ""}`;

  return (
    <article
      data-shelf-card
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card bg-card ring-1 ring-border transition-[transform,box-shadow] duration-travel ease-settle hover:-translate-y-1 hover:shadow-control",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-secondary">
        <StayThumb
          image={listing.image}
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 25vw"
          className="transition-transform duration-arrive ease-settle group-hover:scale-105"
        />
        {/* `z-20`, above the stretched title link: controls the link must not swallow. */}
        <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
          {topRated ? (
            <span className="flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-foreground shadow-control">
              <Award className="size-3.5 text-accent-text" strokeWidth={2.4} aria-hidden />
              Top rated
            </span>
          ) : (
            <span />
          )}
          <span data-save-stay>
            <SaveStayButton slug={listing.slug} size="sm" />
          </span>
        </div>

        {score !== null ? (
          <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold text-foreground shadow-control">
            <Star className="size-3.5 fill-current text-accent-text" aria-hidden />
            {score.toFixed(1)}
            <span className="font-medium text-muted-foreground">/ {listing.rating?.outOf ?? 10}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="flex items-center gap-1.5 text-base font-bold leading-tight text-foreground">
            <Link
              href={`/property/${listing.slug}`}
              className="truncate after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {name}
            </Link>
            <ShieldCheck
              className="size-4 shrink-0 text-accent-text"
              strokeWidth={2.4}
              aria-label="Verified"
            />
          </h3>
          <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {listing.location} · {ACCOMMODATION_CLASS_LABEL[listing.kind]}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs font-medium text-foreground">
          {listing.maxGuests !== null ? (
            <span className="flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1">
              <Users className="size-3.5 text-muted-foreground" aria-hidden />
              Sleeps {listing.maxGuests}
            </span>
          ) : null}
          {listing.bedrooms !== null ? (
            <span className="flex items-center gap-1 rounded-full bg-surface-secondary px-2.5 py-1">
              <BedDouble className="size-3.5 text-muted-foreground" aria-hidden />
              {listing.bedrooms} {listing.bedrooms === 1 ? "bedroom" : "bedrooms"}
            </span>
          ) : null}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-lg font-bold leading-tight text-foreground">
              {rate ? `${rate} RWF` : NO_RATE}
            </p>
            {rate ? (
              <p className="truncate text-xs text-muted-foreground">{shortBasis(listing.priceBasis)}</p>
            ) : null}
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {party ? (
                <>
                  {/* "a night" is the line above's "/ night"; repeating it here is
                      what pushed the figure off the end of a narrow card. */}
                  For {party.label}:{" "}
                  <span className="font-semibold text-accent-text">{party.amount}</span>
                </>
              ) : (
                listing.priceIncludes || "\u00a0"
              )}
            </p>
          </div>
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform duration-travel ease-spring group-hover:rotate-45"
          >
            <ArrowUpRight className="size-4" strokeWidth={2.4} />
          </span>
        </div>
      </div>
    </article>
  );
}
