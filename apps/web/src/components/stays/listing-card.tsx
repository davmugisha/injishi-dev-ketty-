import { Check, TicketPercent } from "lucide-react";
import Link from "next/link";
import { cn } from "@injishi/utils";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import { demoCommerceFor } from "@/data/demo-commerce";
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
 * **FIVE THINGS ON THIS CARD ARE INVENTED.** The review count, the total, the
 * struck-through price, the deal badge and the Ad mark all come from
 * `data/demo-commerce.ts`, which fabricates them because no Reviews, Pricing,
 * Promotions or Ads module exists. Read that file before believing anything
 * the card prints in those five places. The name, the address, the amenities,
 * the score and the nightly rate are real.
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
  const commerce = demoCommerceFor(listing);
  const rate = formatRateNumber(listing.nightlyRateRwf);
  const total = formatRateNumber(commerce.totalRwf);
  const wasTotal = formatRateNumber(commerce.wasTotalRwf);

  return (
    <Link
      href={intent ? propertyHref(listing.slug, intent) : `/property/${listing.slug}`}
      className={cn(
        "group flex h-full w-full flex-col overflow-hidden rounded-card bg-canvas ring-1 ring-surface-tint",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden">
        <picture className="block h-full w-full">
          <source
            type="image/avif"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
            srcSet={`/assets/${listing.image.stem}.avif`}
          />
          {/* Art-directed <picture>: next/image cannot express the AVIF/JPEG source pair. */}
          <img
            src={`/assets/${listing.image.stem}.jpg`}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
            width={430}
            height={269}
            alt={listing.image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
          />
        </picture>

        {/* Top right, and no word. The corner every booking site puts a heart
            in, so the mark alone carries the meaning; the label it used to
            carry was the worst-contrast element on the explore page. */}
        <div className="absolute right-3 top-3">
          <SaveStayButton slug={listing.slug} size="sm" />
        </div>

        {/* One row, so a stay that is both sponsored and verified cannot stack
            two plates in the same corner. White plates rather than scrims:
            both marks sit on unpredictable photography and have to hold their
            contrast whatever the frame behind them turns out to be. */}
        {commerce.sponsored || showVerified ? (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            {commerce.sponsored ? (
              <span className="rounded bg-white/95 px-1.5 py-0.5 text-2xs leading-tight text-black/70">
                Ad
              </span>
            ) : null}
            {/* `accent-ink`, and only it: the plate is a fixed white that never
                inverts, so the mark on it cannot either. Both classes were on
                this span, which is one too many — `accent-text` won wherever
                `accent-ink` failed to compile, and took the badge near-white in
                dark theme. */}
            {showVerified ? (
              <span className="flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-2xs font-bold uppercase tracking-widest text-accent-ink">
                <Check className="size-3 shrink-0" strokeWidth={3} aria-hidden />
                Verified
              </span>
            ) : null}
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
            stored beside it. The count beside it is NOT real. */}
        {showRating && listing.rating ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded bg-accent px-1.5 text-sm font-bold text-accent-foreground">
              {listing.rating.score.toFixed(1)}
            </span>
            <span className="min-w-0 truncate text-sm text-black/75">
              <b className="font-bold text-black">{ratingLabel(listing.rating)}</b>{" "}
              ({commerce.reviewCount} reviews)
            </span>
          </div>
        ) : null}

        <div className="mt-auto flex flex-col items-start gap-1 pt-4">
          {commerce.deal ? (
            commerce.deal.kind === "member" ? (
              /* `bg-black`, not `bg-ink-900`. The ink RAMP is declared as plain
                 custom properties rather than inside `@theme`, so the variable
                 resolves but Tailwind never generates a utility for it:
                 `bg-ink-900` compiled to nothing and this pill rendered white
                 text on a transparent ground over a cream card. Measured in the
                 browser, not guessed. */
              <span className="flex items-center gap-1.5 rounded bg-black px-2 py-1 text-xs font-bold text-white">
                <TicketPercent className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Member price available
              </span>
            ) : (
              <span className="rounded bg-accent px-2 py-1 text-xs font-bold text-accent-foreground">
                {formatRateNumber(commerce.deal.amountRwf)} RWF off
              </span>
            )
          ) : null}

          {rate ? (
            <>
              <p className="text-sm text-black/75">
                {rate} RWF{" "}
                {/* /70, not /60: ink at 60% on the card's canvas panel measures
                    4.50:1 — the AA floor exactly, which is a pass that any
                    future nudge to either token turns into a failure. */}
                <span className="text-black/70">{shortBasis(listing.priceBasis)}</span>
              </p>
              {total ? (
                <p className="flex flex-wrap items-baseline gap-x-2 text-base font-bold text-black">
                  {total} RWF total
                  {wasTotal ? (
                    <s className="text-sm font-normal text-black/65">{wasTotal} RWF</s>
                  ) : null}
                </p>
              ) : null}
              {/* `accent-ink`, not `success` and not `accent-text`. Measured
                  on the rendered card: `success` is a FILL lightness and
                  reaches 1.93:1 on the card's cream panel, against a 4.5:1
                  floor. The panel is a FIXED light ground in both themes,
                  so the ink must be fixed too: `accent-ink` holds one value
                  in both, while `accent-text` carries a dark twin that would
                  go light on a panel that never does. */}
              <p className="flex items-center gap-1.5 text-sm text-accent-ink">
                <Check className="size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                Total with taxes and fees
              </p>
            </>
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
