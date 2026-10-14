import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@injishi/utils";
import { NoPhoto } from "@/components/stays/no-photo";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import type { Listing } from "@/data/listings";
import { amenityMark } from "@/lib/amenity-icon";
import { formatRateNumber, NO_RATE, NO_RATE_BASIS, shortBasis } from "@/lib/price";
import { propertyHref, type StayIntent } from "@/lib/search-params";
import { ratingLabel } from "@/lib/rating";

/**
 * A listing card — the grid tile used by explore, collections, the home bands
 * and the related-stays rails.
 *
 * **The facts sit on a panel UNDER the photograph, not over it.** They used to
 * be laid over the foot of the image inside a scrim. That worked at three
 * across, where the tile was about 430px wide and the caption had 265px of
 * photograph to sit on. It stopped working the moment the grid went to four
 * across and the card gained a rating line: at 318px the caption needed more
 * height than the 199px frame had, so the name, the score and the rate
 * overlapped each other on top of the picture. Ink on the canvas ground
 * reaches 4.5:1 where white over an unpredictable photograph never reliably
 * does, and the caption can grow without eating the picture.
 *
 * Everything it prints is the stay's own record: name, address, amenities,
 * score and nightly rate. The review count, "total with taxes", struck-through
 * price, deal badge and Ad mark it used to carry were invented from the slug
 * and are gone (2026-10-08).
 *
 * The BASIS survives the redesign even though the reference this was rebuilt
 * from has no such idea. "26,000 RWF nightly" on a per-person gorilla lodge and
 * on a per-room city hotel are not the same offer, and the two sit in the same
 * grid, so `shortBasis` still rides beside the figure. Dropping it to match the
 * reference exactly would make two prices that differ by an order of magnitude
 * look comparable.
 *
 * `rounded-card` is the shared photographic-card radius; the photo box keeps
 * the 16:10 ratio the sourced images are shot at.
 */
export function ListingCard({
  listing,
  intent,
  showRating = false,
  showVerified = false,
  compact = false,
  className,
}: {
  listing: Listing;
  /**
   * What the guest asked for, carried onto the property page.
   *
   * Omitted on surfaces that have no search behind them (Saved), where the
   * link is a plain property URL. Where it IS given, the dates and the party
   * ride across, and the booking widget opens on them rather than asking a
   * second time.
   */
  intent?: StayIntent;
  /**
   * Print the attributed score and its word. Renders nothing when the listing
   * carries no rating — a score with no source is not shown, the deck's rule.
   */
  showRating?: boolean;
  /**
   * Print the "Verified" mark. Every listed property is verified by policy, so
   * this is a surface choice, not a per-stay fact.
   */
  showVerified?: boolean;
  /** Tighter type and padding for a four-across grid. */
  compact?: boolean;
  className?: string;
}) {
  const rate = formatRateNumber(listing.nightlyRateRwf);

  return (
    <Link
      href={intent ? propertyHref(listing.slug, intent) : `/property/${listing.slug}`}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-card bg-canvas ring-1 ring-surface-tint",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden">
        {listing.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- a photo route URL, which the image optimiser would cache past an unpublish
          <img
            src={listing.image.src ?? `/assets/${listing.image.stem}.jpg`}
            width={430}
            height={269}
            alt={listing.image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <NoPhoto />
        )}

        {/* Top right, and no word. The corner every booking site puts a heart
            in, so the mark alone carries the meaning; the label it used to
            carry was the worst-contrast element on the explore page. */}
        <div className="absolute right-3 top-3">
          <SaveStayButton slug={listing.slug} size="sm" />
        </div>

        {/* A white plate rather than a scrim: the mark sits on unpredictable
            photography and has to hold its contrast whatever the frame is. */}
        {showVerified ? (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            {/* `accent-ink`, and only it: the plate is a fixed white that never
                inverts, so the mark on it cannot either. Both classes were on
                this span, which is one too many — `accent-text` won wherever
                `accent-ink` failed to compile, and took the badge near-white in
                dark theme. */}
            <span className="flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-2xs font-bold uppercase tracking-widest text-accent-ink">
              <Check className="size-3 shrink-0" strokeWidth={3} aria-hidden />
              Verified
            </span>
          </div>
        ) : null}
      </div>

      <div className={cn("flex flex-1 flex-col", compact ? "p-4" : "p-5")}>
        <h3
          className={cn(
            // Sans, not the display serif the card used to set this in. The
            // reference sets every card title in its UI sans, and at 17px in a
            // 300px column the serif's thin strokes were the first thing to go
            // soft. Figtree is the app's own body family, so this borrows
            // nothing from outside the brand.
            "font-sans font-bold leading-[1.25] text-black",
            compact ? "text-lg" : "text-xl lg:text-xl",
          )}
        >
          {listing.nameLead}
          {listing.nameRest ? ` ${listing.nameRest}` : ""}
        </h3>

        {/* The address alone. It carried a Rwandan flag beside it, on a site
            where all thirty properties are in Rwanda, so the mark told the
            reader nothing and cost width in a 300px column. */}
        <p className="mt-1 truncate text-sm text-black/70">{listing.location}</p>

        {listing.amenities.length ? (
          <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {listing.amenities.map((amenity) => {
              const { Icon, short } = amenityMark(amenity.label);
              return (
                <li
                  key={amenity.label}
                  className="flex items-center gap-1.5 text-sm text-black/80"
                >
                  <Icon
                    className="size-4 shrink-0 text-black/60"
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  {short}
                </li>
              );
            })}
          </ul>
        ) : null}

        {/* Attributed, or absent. The word holds the scale in the reader's head
            so the number does not have to; it is derived from the score, never
            stored beside it. */}
        {showRating && listing.rating ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded bg-accent px-1.5 text-sm font-bold text-accent-foreground">
              {listing.rating.score.toFixed(1)}
            </span>
            <span className="min-w-0 truncate text-sm text-black/75">
              <b className="font-bold text-black">{ratingLabel(listing.rating)}</b>
            </span>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col items-start gap-1 pt-4">
          {rate ? (
            <p className="text-base font-bold text-black">
              {rate} RWF{" "}
              {/* /70, not /60: ink at 60% on the card's canvas panel measures
                  4.50:1 — the AA floor exactly, which is a pass that any
                  future nudge to either token turns into a failure. */}
              <span className="text-sm font-normal text-black/70">{shortBasis(listing.priceBasis)}</span>
            </p>
          ) : (
            <>
              <p className="text-base font-bold text-black">{NO_RATE}</p>
              <p className="text-sm text-black/65">{NO_RATE_BASIS}</p>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
