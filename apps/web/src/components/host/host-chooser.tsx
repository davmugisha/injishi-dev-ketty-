import Link from "next/link";
import { cn } from "@injishi/utils";
import { HostKindIcons } from "@/components/icons/search";
import { HOST_PROPERTY_KINDS, hostKindHref } from "@/data/host";

/**
 * The property-type chooser — the entry point to the listing funnel.
 *
 * The reference funnel opens by asking what kind of place you have rather than
 * by showing a form, and that question is the single most important element on
 * its page: a white card floated over the hero photograph. We take the same
 * move and the same position; what we cannot take is how it is held there.
 *
 * The reference floats its card on a drop shadow. DESIGN.md's Flat-Surface
 * Rule forbids `box-shadow` outright — "the answer is a scrim, a tonal band, or
 * a hairline border" — so the separation is rebuilt from those three, and each
 * one carries a different part of the job:
 *
 *   1. The scrim (in `host-hero.tsx`). A second, horizontal ink ramp deepens
 *      the photograph toward the side the card sits on, ending on solid
 *      `ink-950` at the viewport edge. Its purpose is not decoration: it means
 *      the card never sits on an unpredictable photographic value — behind this
 *      card the picture has been graded down to the page's own dark-theme
 *      ground. That is the shadow's real job (guaranteeing local contrast at
 *      the card's edge) done by the ground instead of by the card.
 *
 *   2. The tonal surface. Because the scrim has taken the photograph down to
 *      the ground colour, the ordinary `--card` / `--background` token pair can
 *      do its ordinary work: `bg-card` is white in light theme and `ink-900` in
 *      dark, and in both it is exactly one step lighter than what sits behind
 *      it. The card is also the only flat, un-textured region in the
 *      composition, which on its own reads as a separate plane.
 *
 *   3. The hairline. `border-border` resolves to the `--border` token, which
 *      the token package tints from ink in light theme and from paper in
 *      dark. (It is named here rather than quoted as a value: the values this
 *      comment used to print had already drifted.) It is nearly
 *      redundant in light theme, where white-on-ink is already a maximum step,
 *      and load-bearing in dark, where it is the rim of light that finishes the
 *      edge the small tonal step cannot finish alone.
 *
 * Inside the card the same tonal logic runs one scale down: the tiles are a
 * step *darker* than the card in both themes, so they read as recessed into it,
 * and on hover they rise to the card's own surface and take an ink (or white)
 * hairline. Three planes — photograph, card, tile — with no shadow anywhere.
 *
 * Each tile goes straight to `/register` with its kind (`hostKindHref`): the
 * wizard takes the answer as given and opens on the next question, so a tile
 * here IS the first step of registering, not a door to a page about it.
 *
 * No Verified Green is spent here. Four accented tiles would read as brand
 * paint rather than as the Spent Accent Rule's "single most important action",
 * and the card already carries all the pull it needs from being white on ink.
 */

export function HostChooser({ className }: { className?: string }) {
  return (
    <section
      aria-labelledby="host-chooser-title"
      className={cn(
        "rounded-card border border-border bg-card p-5",
        className,
      )}
    >
      {/* The Title role: Spectral 500, 22px → 30px. DESIGN.md assigns it to
          "card and promise headings set into photographic scrims", which is
          precisely what this is. The base layer supplies its 1.2 leading. */}
      <h2
        id="host-chooser-title"
        className="text-xl font-medium text-page-fg lg:text-3xl"
      >
        What kind of place do you have?
      </h2>

      <ul className="mt-5 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2">
        {HOST_PROPERTY_KINDS.map((kind) => {
          // No fallback and no cast: `HostKindIcons` is total over `HostKind`
          // and `kind.value` is one, so a missing mark is a compile error
          // rather than a blank circle (ADR-011 call 7).
          const Icon = HostKindIcons[kind.value];

          return (
            <li key={kind.value}>
              <Link
                href={hostKindHref(kind.value)}
                className="flex h-full items-center gap-3 border border-transparent bg-secondary p-3.5 transition-colors duration-quick hover:border-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:flex-col sm:items-start sm:gap-3 sm:p-4 rounded-card bg-surface-secondary"
              >
                {/* Line icon boxed in a hairline circle, per DESIGN.md's icon
                    treatment. 22px, the bottom of the documented 22–24px step:
                    the card carries nine tiles now rather than four, and the
                    step's own floor is what pays for the extra rows. Below 22
                    would leave the step, so the rest of the saving comes from
                    padding and gaps instead. */}
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-page-fg">
                  <Icon size={22} />
                </span>

                <span className="flex flex-col gap-1">
                  <span className="font-medium text-page-fg">{kind.label}</span>
                  <span className="text-sm leading-[1.5] text-page-fg-70">
                    {kind.blurb}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
