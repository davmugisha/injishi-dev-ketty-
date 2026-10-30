import Link from "next/link";
import { Receipt } from "lucide-react";
import { HostChooser } from "@/components/host/host-chooser";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";

/**
 * The `/host` hero.
 *
 * Shaped after the reference funnel's opening screen: a dark photographic
 * still with the headline and lede left-aligned over it, and the property-type
 * chooser floated over its right-hand side. The chooser is the page's whole
 * proposition — the funnel opens by asking what kind of place you have — so it
 * sits beside the headline rather than below it.
 *
 * The photograph is a host's own property rather than a landscape. The page
 * asks somebody to list the place they own; showing the thing being listed is
 * a truer frame than showing the country.
 *
 * Two scrims, both ink, both doing a named job:
 *
 *   The vertical ramp is the standing hero treatment from DESIGN.md — it opens
 *   at 70% ink so the header keeps contrast over a bright interior, lifts to
 *   40% through the band where the headline sits, and bottoms out on solid
 *   `ink-950`. That last stop is load-bearing, not decorative: the hero has to
 *   close on the colour the page opens with, so in dark theme the two meet
 *   with nothing between them. Any near-navy there shows as a hue seam across
 *   the full width of the page.
 *
 *   The horizontal ramp exists only from `lg`, and only because of the card.
 *   The chosen still is bright exactly where the card lands — a balcony window
 *   full of sky sits in its upper right — so this ramp grades that corner down
 *   to solid ink. It is what stands in for the reference's drop shadow: rather
 *   than the card darkening the picture beneath it, the picture is already
 *   dark, and by the card's own edge it has become the page ground. See the
 *   note at the top of `host-chooser.tsx` for the rest of that argument.
 *
 * The Injishi outline mark that ghosts behind the home hero is deliberately
 * absent. It is that hero's signature, it sits centred, and here it would run
 * straight under the chooser card and compete with it.
 */
export function HostHero() {
  return (
    <section className="relative min-h-dvh w-full">
      <ArtDirectedImage
        stem="rwanda-apartment-interior"
        alt="Living room of a serviced apartment in Rwanda, with a balcony over the hills"
        sizes="100vw"
        width={1920}
        height={1280}
        priority
        className="absolute inset-0 h-full w-full object-[50%_46%]"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/70 via-black/40 via-45% to-black"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-black/45 via-black/25 via-50% to-black lg:block"
      />

      <div className="container relative z-[2] grid min-h-dvh grid-cols-1 content-center gap-10 pt-28 pb-16 lg:grid-cols-12 lg:items-center lg:gap-12 lg:pt-32 lg:pb-20">
        <div className="lg:col-span-6 lg:pr-6 xl:pr-10">
          <p className="text-xs font-semibold tracking-[0.12em] text-white/70 uppercase">
            For hosts
          </p>

          {/* The Display step: Spectral 500, 34px → 44px, line-height 1, once
              per page and always over photography in white. Weight, never
              colour, carries the emphasis — the Split-Weight Rule, landing on
              the noun that matters. */}
          <h1 className="mt-4 text-display-sm font-medium text-white lg:text-display-md">
            List your<span className="font-bold"> accommodation</span>
          </h1>

          {/* The Body role, capped near a ~42-character measure so it stays a
              lede rather than a column. */}
          <p className="mt-6 max-w-[42ch] text-base leading-relaxed text-white/85 lg:text-lg">
            Register your business and add your photos. We verify everything
            online and put your listing live. You keep the full rate you set:
            Injishi takes no commission on bookings.
          </p>

          {/* What it costs, before the choice is made: both charges and the
              commission, and no figure. The fee is named on the pay step and
              nowhere before it (`HOST_CHARGES` in `data/host.ts`). Set off by a
              hairline so it reads as a footnote to the lede, not a second
              paragraph. On a phone it is read before the card, which is when
              it is worth knowing. */}
          <p className="mt-8 flex max-w-[42ch] items-start gap-3 border-t border-white/15 pt-6 text-sm leading-relaxed text-white/80">
            <Receipt size={18} strokeWidth={1.5} aria-hidden className="mt-0.5 shrink-0 text-white" />
            <span>
              A one-time registration fee, then a monthly plan once you&apos;re
              live.{" "}
              <Link
                href="#host-charges"
                className="font-medium whitespace-nowrap text-white underline underline-offset-4 hover:text-white/80"
              >
                See what it costs
              </Link>
            </span>
          </p>
        </div>

        <HostChooser className="w-full lg:col-span-6 lg:col-start-7 lg:ml-auto lg:max-w-read" />
      </div>
    </section>
  );
}
