import { ACCOMMODATION_CLASS_LABEL } from "@injishi/contracts";
import { ArrowRight, Award, MapPin, ShieldCheck, Star, TicketPercent } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Badge } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { ResultGallery } from "@/components/explore/result-gallery";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import { demoCommerceFor } from "@/data/demo-commerce";
import type { Listing } from "@/data/listings";
import { amenityMark } from "@/lib/amenity-icon";
import { formatRateNumber, NO_RATE, NO_RATE_BASIS, shortBasis } from "@/lib/price";
import { partyPrice } from "@/lib/party-price";
import { EMPTY_INTENT, propertyHref, type StayIntent } from "@/lib/search-params";
import { ratingLabel } from "@/lib/rating";

/**
 * The result-list row: photo carousel on the left, the facts in the middle,
 * the price and a "View stay" call to action on the right.
 *
 * **The fabricated figures are still fabricated.** The review count, the
 * total, the struck-through price, the discount badge and the Ad mark come
 * from `data/demo-commerce.ts`; VIP tier, rooms-left and refundability from
 * `data/stay-facets.ts`. Read both before trusting a number this card prints.
 * Name, address, type, amenities, score and nightly rate are real, and so is
 * "Top rated", which is read off the score.
 */

/** A score this high earns the "Top rated" mark. Real: read off the rating. */
const TOP_RATED_SCORE = 9.3;

export function ResultCard({
  listing,
  intent,
  className,
  highlighted = false,
  onHover,
}: {
  listing: Listing;
  intent?: StayIntent;
  className?: string;
  highlighted?: boolean;
  onHover?: (slug: string | null) => void;
}) {
  const commerce = demoCommerceFor(listing);
  const rate = formatRateNumber(listing.nightlyRateRwf);
  const party = partyPrice(listing.nightlyRateRwf, listing.priceBasis, intent ?? EMPTY_INTENT);
  const { roomsLeft, vip, cancellation } = listing.facets;
  const refundable = cancellation.includes("fully_refundable");
  const topRated = (listing.rating?.score ?? 0) >= TOP_RATED_SCORE;
  const href = intent ? propertyHref(listing.slug, intent) : `/property/${listing.slug}`;

  // Scroll the card into view when the map (not the mouse) is the source of
  // the highlight, so hovering a pin brings its card on-screen. `nearest`
  // avoids jerking the whole page around when the card is already visible.
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlighted]);

  return (
    <article
      data-result-card
      ref={ref}
      onMouseEnter={onHover ? () => onHover(listing.slug) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      className={cn(
        // `bg-card`, not `bg-canvas`: `--canvas` is fixed across themes and
        // this card's text follows the theme, so the two must move together.
        // The row's height is decided on the article (`md:min-h`), never by
        // the photograph, so every card in the list is the same height.
        "group relative flex flex-col overflow-hidden rounded-card bg-card ring-1 transition-[box-shadow,transform] duration-quick ease-settle hover:-translate-y-0.5 hover:shadow-control md:min-h-[212px] md:flex-row",
        highlighted ? "ring-2 ring-primary shadow-control" : "ring-border",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden md:aspect-auto md:w-[220px] lg:w-[232px] 2xl:w-[260px]">
        {/* Out of flow at every width, so a portrait first photograph cannot
            set its own row height; `object-cover` crops to the row instead. */}
        <div className="absolute inset-0">
          <ResultGallery images={listing.gallery} alt={listing.image.alt} />
        </div>

        {/* `z-20`, above the title's stretched link at `z-10`: everything in
            this layer is a control the link must not swallow. */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3">
          <div className="flex items-start justify-end">
            <span data-save-stay className="pointer-events-auto">
              <SaveStayButton slug={listing.slug} size="sm" />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* `light` Badge: fixed white whatever the theme, which is what a
                chip sitting on a photograph needs. */}
            <Badge
              variant="light"
              size="sm"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-foreground shadow-control"
            >
              <ShieldCheck className="size-3.5 shrink-0 text-accent-text" strokeWidth={2.5} aria-hidden />
              Verified
            </Badge>
          </div>
        </div>
      </div>

      {/* `min-w-0` is load bearing: without it the row's min-content width
          (facts + price column) overflowed the card and sliced the price. */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 md:flex-row md:gap-4 md:p-5">
        <div className="flex min-w-0 flex-1 flex-col">
          {topRated || vip || commerce.sponsored ? (
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {topRated ? (
                <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent-text">
                  <Award className="size-3" strokeWidth={2.6} aria-hidden />
                  Top rated
                </span>
              ) : null}
              {vip ? (
                <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-2xs font-bold uppercase tracking-widest text-foreground">
                  VIP Access
                </span>
              ) : null}
              {commerce.sponsored ? (
                <span className="rounded-full px-1.5 py-0.5 text-2xs text-muted-foreground ring-1 ring-border">
                  Ad
                </span>
              ) : null}
            </div>
          ) : null}

          <h3 className="text-lg font-bold leading-[1.25] text-foreground lg:text-xl">
            {/*
              A STRETCHED LINK, not a link wrapping the whole card: the card
              holds real controls (carousel arrows, the save heart, the compare
              checkbox), and a button inside an anchor is invalid HTML that
              navigated on arrow clicks. The `after:` overlay keeps the whole
              card clickable while those controls sit above it.
            */}
            <Link
              href={href}
              className="after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {listing.nameLead}
              {listing.nameRest ? ` ${listing.nameRest}` : ""}
            </Link>
          </h3>

          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="truncate">{listing.location}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{ACCOMMODATION_CLASS_LABEL[listing.kind]}</span>
          </p>

          {listing.rating ? (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Star className="size-4 shrink-0 fill-current text-warning" aria-hidden />
              <span className="font-bold text-foreground">{listing.rating.score.toFixed(1)}</span>
              <span className="font-bold text-accent-text">{ratingLabel(listing.rating)}</span>
              <span className="truncate text-muted-foreground">({commerce.reviewCount} reviews)</span>
            </div>
          ) : null}

          {listing.amenities.length || refundable ? (
            <ul className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-3">
              {listing.amenities.map((amenity) => {
                const { Icon, short } = amenityMark(amenity.label);
                return (
                  <li key={amenity.label} className="flex items-center gap-1.5 text-sm text-foreground/80">
                    <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden />
                    {short}
                  </li>
                );
              })}
              {refundable ? (
                <li className="flex items-center gap-1.5 text-sm text-accent-text">
                  <ShieldCheck className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
                  Fully refundable
                </li>
              ) : null}
            </ul>
          ) : null}

          {roomsLeft !== null ? (
            // Plain danger-coloured text, not a pill: the softest claim on the
            // card should not shout loudest. `danger-text` holds 4.5:1 on the
            // card in both themes where `danger` (a fill tone) did not.
            <p className="mt-2 text-xs font-semibold text-danger-text">
              Only {roomsLeft} left at this price
            </p>
          ) : null}
        </div>

        <div
          data-price-block
          className="flex min-w-0 shrink-0 flex-row items-end justify-between gap-3 border-t border-separator pt-3 md:w-[148px] md:flex-col md:items-end md:border-t-0 md:pt-0 md:text-right"
        >
          <div className="flex flex-col items-start gap-1 md:items-end">
            {commerce.deal ? (
              commerce.deal.kind === "member" ? (
                <span className="mb-1 flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background">
                  <TicketPercent className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  Member price
                </span>
              ) : (
                <span className="mb-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
                  {formatRateNumber(commerce.deal.amountRwf)} RWF off
                </span>
              )
            ) : null}

            {rate ? (
              <>
                <p className="whitespace-nowrap text-xl font-bold leading-tight text-foreground">
                  {rate} RWF
                </p>
                {/* The basis travels with the figure: a per-person lodge rate
                    and a per-room hotel rate are not the same product. */}
                <p className="text-xs text-muted-foreground">{shortBasis(listing.priceBasis)}</p>
                {party ? (
                  // What THIS party pays, from the search on screen, by the
                  // checkout's own arithmetic (`lib/party-price.ts`).
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="whitespace-nowrap">{party.label}:</span>{" "}
                    <b className="whitespace-nowrap font-bold text-foreground">{party.amount}</b>
                    <span className="block">{party.note}</span>
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="text-xl font-bold leading-tight text-foreground">{NO_RATE}</p>
                <p className="text-xs text-muted-foreground">{NO_RATE_BASIS}</p>
              </>
            )}
          </div>

          {/* Looks like a button; the whole card is already the link (the
              stretched title), so this is a visual cue, hidden from AT. */}
          <span
            aria-hidden
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity group-hover:opacity-90 md:mt-auto"
          >
            View stay
            <ArrowRight className="size-4 transition-transform duration-quick group-hover:translate-x-0.5" strokeWidth={2.4} />
          </span>
        </div>
      </div>
    </article>
  );
}
