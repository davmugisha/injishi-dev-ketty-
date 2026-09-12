import { ArrowRight, Star } from "lucide-react";
import { Button } from "@injishi/ui";
import Image from "next/image";
import Link from "next/link";

import { SaveStayButton } from "@/components/stays/save-stay-button";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import type { FeaturedStay } from "@/data/featured-stays";
import { StayRate } from "@/components/stays/stay-rate";

/**
 * One face of the featured-stays coverflow.
 *
 * The card knows nothing about the deck beyond `depth` — its signed distance
 * from the middle, or `"hidden"` when it is parked behind. Every transform,
 * veil and fade that depth implies is CSS, keyed off `data-depth`.
 *
 * A photograph on top, a light panel under it. The first build put the caption
 * on the photograph, the way the listing tiles do, and it lost the deck: the
 * middle card measured darker than every one of its neighbours, because the
 * stay that opens the deck is photographed at night and the stay beside it is a
 * gorilla in daylight. A deck cannot borrow its focal point from whichever
 * photograph happens to be brightest. The panel makes the middle card the
 * lightest object on the band no matter what it is carrying, and it buys two
 * more things: the caption is ink on a solid ground rather than white on an
 * unpredictable photograph, and the photo box stops being 4:5. Every photograph
 * we own is landscape, roughly 3:2; a 4:5 box kept barely half their width,
 * where the box at 52% of the card sits near 1.4:1 and keeps most of it.
 *
 * The alphas on the panel are solved, not chosen. Ink on the canvas ground
 * reaches 4.5:1 — the floor for text this size — at about 62% opacity, and the
 * first build ran the qualifiers under it: the class line at 3.72:1, "from" at
 * 2.80 and the rate basis at 3.08. Those last two are exactly the words that
 * make a number mean anything; "196,000" without "per room / night" beside it
 * is not a price, and a lodge on this same deck quotes per person. So the
 * hierarchy below is carried by size and weight, and every step sits at or
 * above the floor.
 *
 * Only the middle card navigates. A neighbour is turned away from the reader
 * and is a target for bringing itself forward, because a half-turned card that
 * silently navigates is a misclick waiting to happen.
 */
export function CoverflowStayCard({
  stay,
  depth,
  onSelect,
  priority,
}: {
  stay: FeaturedStay;
  /** Signed distance from the middle, or `"hidden"` when parked behind. */
  depth: number | "hidden";
  onSelect: () => void;
  /** Set on the card that opens in the middle; everything else lazy-loads. */
  priority: boolean;
}) {
  const isCentre = depth === 0;
  const parked = depth === "hidden";
  const name = `${stay.nameLead} ${stay.nameRest}`.trim();

  return (
    <li
      // bg-canvas is deliberate and must NOT become bg-card: it has to match
      // `[data-panel]` in _injishi-public.css, which is painted in the same
      // --color-canvas. The strip the photo box uncovers on a phone is that
      // colour already, and the light panel is the device that keeps the
      // centre card the brightest object whatever photograph it carries.
      className="coverflow-card bg-canvas"
      data-depth={depth}
      aria-hidden={parked || undefined}
    >
      <div data-photo>
        <ArtDirectedImage
          stem={stay.image.stem}
          alt={stay.image.alt}
          sizes="(max-width: 640px) 72vw, (max-width: 1280px) 344px, 364px"
          width={728}
          height={550}
          priority={priority}
          className="h-full w-full"
          style={{ objectPosition: stay.imagePosition }}
        />
      </div>

      {/* Same inset as the panel below. At 14px against the panel's 16 and 20
          the save control sat closer to the card edge than anything else on the
          card, which reads as a misalignment rather than as a choice. */}
      <div data-photo-overlay className="absolute left-0 top-0 z-[4] p-4 lg:p-5">
        {/* No word at all now. "Add to Saved" used to wrap onto a second line
            inside its own pill at 390px, and "Save" was the trim that fixed
            it; the circle appearance drops the problem rather than trimming
            it, and matches the listing card in the same grid. */}
        <SaveStayButton slug={stay.slug} size="sm" />
      </div>

      <div data-panel>
        {/* Centred with a fixed gap, not spread with `justify-between`.
            Spreading put whatever slack the panel had between the two blocks,
            so the hairline rule floated: measured, 40px above it and 25px
            below, which reads as an accident rather than a division. Centring
            splits the slack above and below the pair instead, and the rule sits
            in a gap it owns. */}
        <div data-panel-text className="flex h-full flex-col justify-center gap-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <Image
                  src="/assets/rw.svg"
                  alt=""
                  width={20}
                  height={20}
                  className="size-4 shrink-0 rounded-full"
                />
                <span className="truncate text-accent-foreground/70">
                  {stay.location}
                </span>
              </span>

              {/* Attributed, or absent. A score with no source beside it is a
                  number we would be asking the reader to take on faith. */}
              {stay.rating ? (
                <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-accent-foreground/70">
                  <StarMark />
                  <b className="font-semibold text-accent-foreground">
                    {stay.rating.score.toFixed(1)}
                  </b>
                  /{stay.rating.outOf} {stay.rating.source}
                </span>
              ) : null}
            </div>

            <h3 className="mt-1.5 text-balance leading-[1.2] lg:text-xl text-accent-foreground">
              <b className="font-bold">{stay.nameLead}</b> {stay.nameRest}
            </h3>

            {/* The centre card only. On a turned card this line arrives as
                about ten grey pixels under a veil, which a critic fairly called
                below the threshold of being worth setting. */}
            <p data-panel-summary className="mt-1 truncate text-accent-foreground/70">
              {stay.summary}
            </p>
          </div>

          {/* The rate is on every card; only the button swaps in.

              The build before this one showed neighbours a single short rate
              line where the middle card has a three-line block and a button,
              and two critics read the result the same way: a broken instance of
              the front card, eighty pixels of blank white where the button
              should be. The band has to be filled by something that belongs on
              a card you cannot click, and the price is exactly that. */}
          <div className="flex items-center justify-between gap-3 border-t border-surface-tint pt-4">
            <StayRate
              nightlyRateRwf={stay.nightlyRateRwf}
              priceBasis={stay.priceBasis}
              tone="on-panel"
              rateProps={{ "data-panel-rate": "" } as React.HTMLAttributes<HTMLElement>}
            />

            {/* A span, not a link. The whole card is already one anchor, and an
                anchor inside an anchor is invalid; this is the affordance and
                the overlay below is the target. */}
            <span
              data-panel-full
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-3.5 py-2 font-bold uppercase tracking-widest text-accent-foreground"
            >
              View stay
              <ArrowMark />
            </span>
          </div>
        </div>
      </div>

      <span data-veil aria-hidden />

      {/* The target. One overlay for the whole face: a link when this card is
          the one being read, a button that brings it forward when it is not. */}
      {isCentre ? (
        <Link
          href={`/property/${stay.slug}`}
          className="absolute inset-0 z-[6] rounded-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus focus-visible:outline-ring"
        >
          <span className="sr-only">
            {name}, {stay.location}
          </span>
        </Link>
      ) : (
        // A hit target over the whole card, not a button box: `h-auto`,
        // `bg-transparent` and `p-0` strip HeroUI's own shape so nothing is
        // drawn, and only the press and focus behaviour is kept.
        <Button
          variant="ghost"
          shape="square"
          onClick={onSelect}
          tabIndex={parked ? -1 : 0}
          className="absolute inset-0 z-[6] h-auto rounded-card bg-transparent p-0 hover:bg-transparent"
        >
          <span className="sr-only">Show {name}</span>
        </Button>
      )}
    </li>
  );
}

/**
 * The rating star.
 *
 * `green-800`, not the `green-700` it started at. On the panel's canvas ground
 * that step measures 3.93:1 — over the 3:1 a graphical object has to clear, so
 * it was not a failure, but it sits directly beside a score that clears 15:1
 * and the mismatch showed. This step reaches 5.32:1 and stops the glyph looking
 * washed against the number it belongs to.
 */
function StarMark() {
  return (
    <Star
      className="size-3 shrink-0"
      stroke="none"
      fill="var(--color-green-800)"
      aria-hidden
    />
  );
}

function ArrowMark() {
  return (
    <ArrowRight className="size-3" strokeWidth={2} aria-hidden />
  );
}
