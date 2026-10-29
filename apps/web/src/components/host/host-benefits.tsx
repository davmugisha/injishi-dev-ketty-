import { Banknote, FileCheck, Globe } from "lucide-react";
import type { SVGProps } from "react";
import { SectionHeading } from "@/components/shared/section-heading";
import { HOST_BENEFITS, type HostBenefit } from "@/data/host";

/**
 * "Why list on Injishi" — the three reasons, as one row rather than three
 * loose blocks.
 *
 * The reference (apps.expediapartnercentral.com/en_US/list) runs its three
 * benefits as columns separated by thin vertical rules that span the full
 * height of the row; the rules are what make it read as a single row. That
 * treatment is carried over verbatim, and it is the one the system already
 * sanctions — DESIGN.md's Flat-Surface Rule names "a scrim, a tonal band, or a
 * hairline border" as the three ways a surface may separate from what is behind
 * or beside it, so a hairline is the correct instrument here and a card (with
 * its fill, or worse its shadow) is not.
 *
 * Three deliberate departures from the reference:
 *
 *   1. Its section heading is centred at 42px. Ours is the Headline step
 *      (24px -> 32px) through `SectionHeading`, left-aligned like every other
 *      section opener on the site. DESIGN.md: "Every peer section uses this
 *      exact step — sections read as peers only if their headings match."
 *   2. Its sub-headings are coloured. Ours are not. Injishi has exactly one
 *      accent and The Spent Accent Rule buys two things per screen with it —
 *      the trust surface and the primary action. Three coloured sub-heads would
 *      spend it on decoration, and the Split-Weight Rule already says this
 *      system emphasises with weight rather than colour.
 *   3. Its columns go three-across from tablet. Ours wait for `lg`. These are
 *      columns of running copy, not photographs: at `md` a third of the column
 *      leaves roughly 25 characters a line, which is a stack of ragged
 *      fragments rather than a paragraph.
 */
export function HostBenefits() {
  return (
    <section className="section-y container">
      <SectionHeading lead="Why list on " emphasis="Injishi" className="mb-8" />

      {/* The rule is drawn with `divide-*` rather than per-item borders so it
          can only ever appear *between* entries. Grid items stretch, so the
          vertical rule runs the full height of the tallest column — which is
          the whole point of it.

          When the row stacks the rule does not disappear, it rotates: `divide-y`
          below `lg` puts the same hairline between the stacked entries, so the
          three still read as one list. Padding rather than `gap` opens the
          gutter, because a gap would push the rule against the leading edge of
          the next column instead of centring it between the two. */}
      <ul className="grid grid-cols-1 divide-y divide-border lg:grid-cols-3 lg:divide-x lg:divide-y-0">
        {HOST_BENEFITS.map((benefit) => {
          const Icon = BENEFIT_ICONS[benefit.icon];

          return (
            <li
              key={benefit.title}
              className="flex flex-col gap-2 py-7 first:pt-0 last:pb-0 lg:px-8 lg:py-0 lg:first:pl-0 lg:last:pr-0"
            >
              <span className="mb-3 flex size-11 items-center justify-center rounded-[0.75rem] bg-surface-secondary text-page-fg">
                <Icon />
              </span>

              {/* Body size, not the reference's 18px. The documented hierarchy
                  has nothing between Headline and Title, and Title (22 -> 30) is
                  reserved for headings set into photographic scrims. The face
                  does the separating instead: Spectral 500 here — h1–h6 are
                  routed to the display face at the base layer — over Figtree at
                  70% ink below. */}
              <h3 className="text-lg font-medium text-page-fg">{benefit.title}</h3>

              <p className="max-w-[46ch] text-base leading-relaxed text-page-fg-70">{benefit.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------------------------------------------------------------------
 * Icons.
 *
 * Local to this file: they are drawn for these three entries and nothing else,
 * and the shared modules in `components/icons/` are for marks that appeared on
 * every page of the captures.
 *
 * DESIGN.md's Shapes section sets the icon language — "line-drawn at 1px on
 * `currentColor`, typically 22–24px" — so each is a 24px box, stroked at 1px,
 * inheriting its colour from the column. No fills, and no accent: the icon is a
 * label for the paragraph beneath it, not a trust mark.
 *
 * `trust` is a document rather than the obvious shield-check, because the copy
 * it labels is about RRA registration and records, and because Partners on the
 * home page already draws a shield-check — two shields on one site that mean
 * different things is worse than one that names its mechanism.
 * ------------------------------------------------------------------------- */

const BENEFIT_ICONS = {
  reach: ReachIcon,
  payout: PayoutIcon,
  trust: TrustIcon,
} satisfies Record<HostBenefit["icon"], (props: SVGProps<SVGSVGElement>) => React.ReactElement>;

/**
 * The three benefit marks. Each keeps the hairline weight the panel was drawn
 * with, so the row still reads as one set rather than three borrowed glyphs.
 */
const FRAME = { width: 24, height: 24, strokeWidth: 1, "aria-hidden": true } as const;

/** Reach — a globe. The listing is seen from outside Rwanda, which is the claim. */
function ReachIcon(props: SVGProps<SVGSVGElement>) {
  return <Globe {...FRAME} {...props} />;
}

/** Payout — a banknote. The rate you set is the rate you are paid. */
function PayoutIcon(props: SVGProps<SVGSVGElement>) {
  return <Banknote {...FRAME} {...props} />;
}

/** Trust — a document, checked. The paperwork is done before the first booking. */
function TrustIcon(props: SVGProps<SVGSVGElement>) {
  return <FileCheck {...FRAME} {...props} />;
}
