import Link from "next/link";
import { Button } from "@injishi/ui";
import { SectionHeading } from "@/components/shared/section-heading";

/**
 * The closing block: a centred card on a tinted band.
 *
 * The reference floats its card on a drop shadow. DESIGN.md's Flat-Surface
 * Rule forbids that outright, so the separation is built the two ways the doc
 * does allow: the card sits on a tonal band (`bg-secondary` — the light ice
 * tint, the deep ink step in dark theme) while the card itself keeps the page
 * ground (`bg-background`), and a hairline `border-border` draws its edge. The
 * card is lighter than the band in light theme and darker than it in dark, and
 * the hairline carries the edge either way, so the reading survives the flip.
 *
 * `bg-card` would have been the obvious token for the card and is wrong here:
 * in dark theme it resolves to the same `ink-900` as `bg-secondary`, and the
 * card would disappear into its own band.
 *
 * The band is full-bleed colour, so it takes `section-y-loose`; the two
 * sections above it take the ordinary `section-y`. Those are the only two
 * steps.
 *
 * Two audiences, as in the reference's close: the primary pill for a host who
 * is ready to start, and a quiet link for one who already has an account. The
 * primary is `variant="primary"` (Injishi Ink), not `accent` — see the note in
 * the report about the Spent Accent Rule and the hero.
 *
 * This is the one centred heading on the page, and the FAQ directly above it is
 * deliberately not. The difference is what the two are: the FAQ is a section in
 * the page's reading column and has to sit as a peer of the openers above it,
 * while this is a terminal panel — a bounded, symmetric object with a button
 * row under it, the same composition the home hero centres. Left-aligning it
 * would leave the right half of an 820px card empty for no gain.
 */
export function HostCta() {
  return (
    <section className="section-y-loose w-full bg-secondary">
      <div className="container">
        <div className="mx-auto flex max-w-wide flex-col items-center gap-6 rounded-card border border-border bg-background px-6 py-12 text-center lg:px-16 lg:py-16">
          <SectionHeading
            lead="List your "
            emphasis="accommodation"
            className="justify-center"
            headingClassName="text-center"
          />

          <p className="max-w-narrow text-page-fg-70">
            Ten minutes to describe your place, and no documents yet. We visit
            it, photograph it at our cost, and register it with the RRA before
            your first guest arrives.
          </p>

          <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
            {/* `solid`, not the default `primary`. This card sits on
                `bg-background`, which inverts with the theme, and `primary`
                fills with the fixed `--color-ink` — so in dark mode the button
                was ink on an ink card and vanished entirely. `solid` reads the
                semantic `--primary` pair, which inverts with the ground. */}
            <Button asChild size="lg" variant="primary">
              <Link href="/host/start">Get started</Link>
            </Button>

            <Button asChild variant="link" size="md">
              <Link href="/sign-in">Already hosting with us? Sign in</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
