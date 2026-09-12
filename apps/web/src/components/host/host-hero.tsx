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
        className="pointer-events-none absolute inset-0 hidden bg-linear-to-r from-transparent via-black/25 via-50% to-black lg:block"
      />

      <div className="container relative z-[2] grid min-h-dvh grid-cols-1 content-center gap-10 py-16 lg:grid-cols-12 lg:items-center lg:gap-8 lg:py-20">
        <div className="lg:col-span-6">
          {/* The Display step: Spectral 500, 34px → 44px, line-height 1, once
              per page and always over photography in white. The reference sets
              its own h1 at 56px; ours is the documented step, not that one.
              Weight, never colour, carries the emphasis — the Split-Weight
              Rule, landing on the noun that matters. */}
          <h1 className="text-display-sm font-medium text-white lg:text-display-md">
            List your<span className="font-bold"> accommodation</span>
          </h1>

          {/* The Body role at 16px, capped near the reference's ~40-character
              measure so it stays a lede rather than a column. */}
          <p className="mt-5 max-w-[40ch] text-white/80">
            Tell us about your place and we will verify it, photograph it, and get it
            live. Payouts are made in full, and Injishi takes no commission from the host.
          </p>
        </div>

        <HostChooser className="lg:col-span-6 lg:col-start-7 lg:ml-auto lg:w-full lg:max-w-narrow" />
      </div>
    </section>
  );
}
