import { Check, ShieldCheck, TicketPercent } from "lucide-react";
import Link from "next/link";
import { Badge } from "@injishi/ui";
import { cn } from "@injishi/utils";
import { ResultGallery } from "@/components/explore/result-gallery";
import { SaveStayButton } from "@/components/stays/save-stay-button";
import { demoCommerceFor } from "@/data/demo-commerce";
import type { Listing } from "@/data/listings";
import { CANCELLATION_OPTIONS } from "@/data/stay-facets";
import { amenityMark } from "@/lib/amenity-icon";
import { formatRateNumber, NO_RATE, NO_RATE_BASIS, shortBasis } from "@/lib/price";
import { propertyHref, type StayIntent } from "@/lib/search-params";
import { ratingLabel } from "@/lib/rating";

/**
 * The result-list row.
 *
 * The reference's cards are WIDE and HORIZONTAL — a photo carousel on the left
 * of a fixed width, the facts in the middle, the price right-aligned on the
 * right — stacked one per row rather than tiled in a grid. That is the
 * structural change from the card this replaces, `ListingCard`, which this
 * component does not reuse: `ListingCard` is a portrait tile built for a
 * multi-column grid (photo over caption) and every one of its proportions
 * assumes that shape. It stays in `components/stays/` for the surfaces that
 * still tile listings — the home page's bands and the coverflow — while this
 * component is `/explore`'s alone.
 *
 * **The five fabricated figures are still fabricated.** The review count, the
 * total, the struck-through price, the discount badge and the Ad mark all come
 * from `data/demo-commerce.ts`. VIP tier, rooms-left and refundability come
 * from `data/stay-facets.ts`. Read both files before trusting a number this
 * card prints. Name, address, amenities, score and nightly rate are real.
 */
export function ResultCard({
  listing,
  intent,
  className,
}: {
  listing: Listing;
  intent?: StayIntent;
  className?: string;
}) {
  const commerce = demoCommerceFor(listing);
  const rate = formatRateNumber(listing.nightlyRateRwf);
  const total = formatRateNumber(commerce.totalRwf);
  const wasTotal = formatRateNumber(commerce.wasTotalRwf);
  const { roomsLeft, vip, cancellation } = listing.facets;
  const refundable = cancellation.includes("fully_refundable");

  return (
    <article
      data-result-card
      className={cn(
        // `bg-card`, NOT `bg-canvas`. `--canvas` is one of the FIXED tokens —
        // the same value in both themes — and this card sets its text with
        // theme-following roles. Pairing the two put light `--foreground` text
        // on a permanently light panel in dark mode and made the title, the
        // score word and the rate unreadable. `--card` follows the theme, so
        // the panel and its text move together. Measured in a real Chromium in
        // both themes, not assumed.
        // `md:min-h-[220px]` on the ARTICLE, not on the photo column. The row's
        // height is now decided here and nowhere else, so every card in the
        // list is the same height — which is what the reference's list is and
        // what this one was not: photographs of different intrinsic ratios were
        // setting their own rows to 227px, 254px and 449px down the same column.
        "group relative flex flex-col overflow-hidden rounded-card bg-card ring-1 ring-border transition-shadow hover:shadow-control md:min-h-[220px] md:flex-row",
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden md:aspect-auto md:w-[220px] lg:w-[248px] xl:w-[272px]">
        {/*
          OUT OF FLOW at every width, and that is the whole point of this
          wrapper. The gallery's `<img>` carries an intrinsic ratio, so while
          it was an in-flow flex item its own height became the flex line's
          height and the photograph — not the card — decided how tall the row
          was. A stay whose first photograph is portrait (900x1188) made a
          449px row next to a 227px one. Absolute takes the picture out of the
          height calculation entirely; `object-cover` on it then crops to
          whatever box the row settles on, which is the behaviour the
          reference's uniform list has.

          It was `md:absolute` only, and below `md` the same portrait
          photograph did the same thing inside the 16:10 frame: the carousel's
          `h-full` had no height to resolve against, the track took the
          picture's own height, the frame clipped it, and the arrows placed at
          `top-1/2` of that taller track sat half hidden on the frame's bottom
          edge. The frame carries its own ratio below `md`, so the gallery can
          be out of flow there too.
        */}
        <div className="absolute inset-0">
          <ResultGallery images={listing.gallery} alt={listing.image.alt} />
        </div>

        {/*
          `z-20`, above the title's stretched overlay at `z-10`. Everything in
          this strip is a CONTROL — the carousel arrows underneath it, the
          save heart here — and a control that sits under the card's own link
          overlay is a control the link swallows.
        */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3">
          <div className="pointer-events-auto flex items-start justify-between">
            <div className="flex flex-col items-start gap-1.5">
              {/*
                `Badge`, which is HeroUI's `Chip` under `@injishi/ui`, rather
                than a hand-rolled `span` per pill. Same reason every other
                pill on the site is one: the padding, the type ramp and the
                focus ring come from the component, so a card pill and a
                property-page pill cannot drift apart, and the two that sit on
                a photograph take the `light` variant — fixed white, never
                theme-following — which is what a chip over an image needs.
                `rounded` overrides the component's pill radius, which is what
                the reference's square-cornered corner marks are.
              */}
              {vip ? (
                <Badge
                  variant="light"
                  size="sm"
                  className="rounded px-1.5 py-0.5 text-2xs font-bold uppercase tracking-widest text-accent-text"
                >
                  VIP Access
                </Badge>
              ) : null}
              {commerce.sponsored ? (
                <Badge
                  variant="light"
                  size="sm"
                  className="rounded px-1.5 py-0.5 text-2xs leading-tight text-ink/70"
                >
                  Ad
                </Badge>
              ) : null}
            </div>
            <span data-save-stay>
              <SaveStayButton slug={listing.slug} size="sm" />
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge
              variant="light"
              size="sm"
              className="flex items-center gap-1 px-2.5 py-1 text-2xs font-bold uppercase tracking-widest text-accent-text"
            >
              <ShieldCheck className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />
              Verified
            </Badge>
          </div>
        </div>
      </div>

      {/*
        `min-w-0` is load bearing, not tidiness. A flex item's automatic
        minimum size is its min-content width, and this row's min-content is
        the facts column plus a fixed-width price block plus padding. That came
        to 467px inside a 376px share, so the row grew past the card and the
        card's own `overflow-hidden` sliced the price off — the reader saw
        "304,400 R" against a hard edge. `min-w-0` lets the row take the share
        it actually has.
      */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:flex-row md:gap-4 md:p-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold leading-[1.25] text-foreground lg:text-xl">
            {/*
              A STRETCHED LINK, not a link wrapping the whole card.
              The card holds real controls — a photo carousel with prev/next
              arrows, a save toggle — and nesting those inside an `<a>` is
              invalid HTML, is an accessibility failure (a button inside a
              link has no unambiguous activation), and broke in practice: a
              click on the carousel arrow reached the anchor and navigated to
              the property page instead of advancing the photograph.
              Neither `stopPropagation` on the arrow nor a bubble-phase trap
              around it fixed that, because HeroUI's button is React-Aria
              press-managed and the anchor's own default action still ran.
              Taking the controls OUT of the anchor is the fix that cannot
              regress. The `after:` overlay keeps the whole card clickable.
            */}
            <Link
              href={
                intent ? propertyHref(listing.slug, intent) : `/property/${listing.slug}`
              }
              className="after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {listing.nameLead}
              {listing.nameRest ? ` ${listing.nameRest}` : ""}
            </Link>
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {listing.location}
          </p>

          {listing.rating ? (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="flex h-7 min-w-9 shrink-0 items-center justify-center rounded bg-accent px-1.5 text-sm font-bold text-accent-foreground">
                {listing.rating.score.toFixed(1)}
              </span>
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                <b className="font-bold text-foreground">{ratingLabel(listing.rating)}</b>{" "}
                ({commerce.reviewCount} reviews)
              </span>
            </div>
          ) : null}

          {listing.amenities.length ? (
            <ul className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {listing.amenities.map((amenity) => {
                const { Icon, short } = amenityMark(amenity.label);
                return (
                  <li
                    key={amenity.label}
                    className="flex items-center gap-1.5 text-sm text-foreground/80"
                  >
                    <Icon
                      className="size-4 shrink-0 text-muted-foreground"
                      strokeWidth={1.8}
                      aria-hidden
                    />
                    {short}
                  </li>
                );
              })}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {refundable ? (
              <Badge variant="outline" size="sm" className="px-2.5 py-1 text-xs font-medium">
                {CANCELLATION_OPTIONS[0].label}
              </Badge>
            ) : null}
            {roomsLeft !== null ? (
              // Plain danger-coloured TEXT, not a pill, and deliberately not a
              // `Badge`. The reference writes this line as bare red type beside
              // the price, and it is right to: a filled pill reads as loud as
              // the score chip and the deal chip, so three competing marks land
              // on one card and the scarcity note — the softest claim of the
              // three — shouts hardest. Colour alone carries it.
              //
              // `danger-text`, not `danger`. `danger` is a FILL lightness, and
              // as type on the dark theme's card it measured 3.63:1 against a
              // 4.5:1 floor; `danger-text` is the same crimson tuned for ink
              // and carries a lighter dark-theme twin, exactly as `accent-text`
              // does for the accent.
              <p className="text-xs font-semibold text-danger-text">
                Only {roomsLeft} left at this price
              </p>
            ) : null}
          </div>
        </div>

        <div
          data-price-block
          // 210px was wider than the column could pay for once the photograph
          // and the facts had taken their share, and it was a hard floor
          // (`shrink-0` with a fixed width), so the excess left the card
          // instead of the block getting narrower. It is sized to the widest
          // real string now — "1,258,000 RWF total" — and allowed to shrink.
          className="flex min-w-0 shrink-0 flex-row items-end justify-between gap-2 border-t border-separator pt-3 md:w-[150px] md:flex-col md:items-end md:border-t-0 md:pt-0 md:text-right lg:w-[168px]"
        >
          {commerce.deal ? (
            commerce.deal.kind === "member" ? (
              <Badge
                variant="default"
                size="sm"
                className="flex items-center gap-1.5 rounded bg-foreground px-2 py-1 text-xs font-bold text-background"
              >
                <TicketPercent className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                Member price
              </Badge>
            ) : (
              <Badge
                variant="success"
                size="sm"
                className="rounded px-2 py-1 text-xs font-bold"
              >
                {formatRateNumber(commerce.deal.amountRwf)} RWF off
              </Badge>
            )
          ) : (
            <span />
          )}

          <div className="flex flex-col items-end">
            {rate ? (
              <>
                {/*
                  The basis is on its OWN line rather than trailing the figure.
                  "258,000 RWF per apartment / night" is one 240px string and
                  the column is 168px wide, so as one run it either wrapped at
                  an arbitrary point mid-figure or ran off the card. Splitting
                  it puts the break where a reader would put it.
                */}
                <p className="text-sm leading-tight text-muted-foreground">
                  <span className="whitespace-nowrap">{rate} RWF</span>
                  {/* The role at full strength: `muted-foreground` is already
                      the quiet one, and dimming it to 80% took the basis line
                      to 3.62:1 on the card in light theme. */}
                  <span className="block text-xs text-muted-foreground">
                    {shortBasis(listing.priceBasis)}
                  </span>
                </p>
                {total ? (
                  // `text-lg`, and the figure kept whole on its own line.
                  // A six-figure RWF total plus a struck-through was-price is a
                  // long string, and at 18px in a 210px column "356,400 RWF
                  // total" broke mid-number against the card edge.
                  <p className="mt-0.5 flex flex-col items-end text-base font-bold leading-tight text-foreground">
                    {wasTotal ? (
                      <s className="text-sm font-normal text-muted-foreground">
                        {wasTotal} RWF
                      </s>
                    ) : null}
                    <span className="whitespace-nowrap">{total} RWF total</span>
                  </p>
                ) : null}
                <p className="mt-0.5 flex items-center justify-end gap-1.5 text-xs text-accent-text">
                  <Check className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                  Total with taxes and fees
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-bold text-foreground">{NO_RATE}</p>
                <p className="text-sm text-muted-foreground">{NO_RATE_BASIS}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
