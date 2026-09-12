import { cn } from "@injishi/utils";
import { formatRateNumber, NO_RATE, NO_RATE_BASIS, shortBasis } from "@/lib/price";

/**
 * The rate block a stay card prints, in one place.
 *
 * The two cards keep their own shells (see `stay-card.md` reasoning in
 * `listing-card.tsx` and `coverflow-stay-card.tsx`) but this three-line block
 * was written twice, and the copies had already begun to differ: one printed
 * an empty "from" label when a stay published no rate and the other omitted
 * the element, so the two disagreed about the height of a card with no price.
 *
 * Ten of the thirty properties publish no rate, so the no-rate path is a third
 * of the catalogue rather than an edge case, and it is the reason the block is
 * worth sharing at all: `NO_RATE`, `NO_RATE_BASIS` and the decision to drop
 * both the "from" and the currency alongside it are one rule, not three.
 *
 * TWO tones, because the two cards put this on different grounds and each
 * ground was solved separately against WCAG:
 *
 *  - `on-photo` is white over a scrim. The qualifying lines are white at full
 *    strength rather than dimmed: at 9px over photography nothing reaches
 *    4.5:1 at any scrim setting, so the hierarchy is carried by size against
 *    the 24px figure. "196,000" without "per room / night" beside it is not a
 *    price, and a lodge on the same rail quotes per person.
 *  - `on-panel` is ink on the canvas ground. Ink reaches 4.5:1 there at about
 *    62% opacity, so the qualifiers sit at 65% and the figure at full.
 */
export function StayRate({
  nightlyRateRwf,
  priceBasis,
  tone,
  rateProps,
}: {
  nightlyRateRwf: number | null;
  priceBasis: string;
  tone: "on-photo" | "on-panel";
  /** Passed onto the figure. The coverflow deck reads `data-panel-rate` in CSS. */
  rateProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const rate = formatRateNumber(nightlyRateRwf);
  const onPhoto = tone === "on-photo";

  return (
    <div className="flex min-w-0 flex-col">
      {rate ? (
        <span
          className={cn(
            onPhoto
              ? "text-2xs text-white"
              : "text-2xs uppercase tracking-widest text-black/65",
          )}
        >
          from
        </span>
      ) : null}

      <p className="flex items-baseline gap-1">
        <b
          {...rateProps}
          className={cn(
            "font-bold leading-none",
            onPhoto
              ? "text-xl text-white md:text-2xl"
              : "text-2xl text-black lg:text-2xl",
          )}
        >
          {rate ?? NO_RATE}
        </b>
        {rate ? (
          <span
            className={cn(
              "font-bold",
              onPhoto ? "text-2xs text-white" : "text-xs text-black/75",
            )}
          >
            RWF
          </span>
        ) : null}
      </p>

      <small
        className={cn(
          "truncate",
          onPhoto ? "text-2xs text-white" : "mt-1 text-2xs text-black/65",
        )}
      >
        {rate ? shortBasis(priceBasis) : NO_RATE_BASIS}
      </small>
    </div>
  );
}
