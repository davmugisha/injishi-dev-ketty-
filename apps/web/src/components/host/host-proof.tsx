import Link from "next/link";
import { SectionHeading } from "@/components/shared/section-heading";
import { HOST_PROOF } from "@/data/host";

/**
 * The proof block.
 *
 * The reference runs a two-column split here — heading, short body and a text
 * link on the left, a media panel on the right — where the panel plays a video
 * case study. We have no video and DESIGN.md forbids inventing proof, so the
 * panel carries the one thing about this funnel a reader can check the shape
 * of: the commission. `HOST_PROOF.stat` is the argument and the heading asks
 * the question the number answers.
 *
 * The panel is a tonal band (`bg-ink-700`, Deep Band Teal — the step the July
 * 2026 audit moved band backgrounds to) rather than a filled card, so it
 * separates from the page the way DESIGN.md's Flat-Surface Rule asks: a band,
 * not a shadow.
 *
 * The stat sets at the Display step (Spectral 500, 34px → 44px, leading-none) —
 * the same step the hero headline takes. The hierarchy has no "stat" role, and
 * inventing one to go larger would put a number above the page's own headline;
 * making it a peer of the headline is as much size as the system has to give,
 * and the panel's air is what does the rest.
 */
export function HostProof() {
  return (
    <section className="section-y container">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <SectionHeading lead="What Injishi takes from " emphasis="hosts" />

          {/* Was a host testimonial. There are no hosts to quote yet, and the
              note above already said inventing proof is out, so the argument
              is made in our own voice instead of a stranger's. */}
          <p className="text-base leading-normal text-page-fg lg:text-lg">
            {HOST_PROOF.body}
          </p>

          {/* The reference's text link, kept as text. Anything heavier here
              would compete with the closing CTA two sections down. */}
          <Link
            href="/how-it-works#escrow"
            className="w-max text-page-fg underline underline-offset-[4px]"
          >
            How escrow and payouts work
          </Link>
        </div>

        {/* No eyebrow above the number: the heading opposite already asks the
            question, and `stat.label` under the rule already names the unit.
            A third label would be the badge clutter the anti-reference runs. */}
        <div className="flex flex-col justify-center gap-5 rounded-card bg-ink p-8 text-white lg:min-h-[400px] lg:p-12">
          <p className="font-display text-display-sm font-medium lg:text-display-md">
            {HOST_PROOF.stat.value}
          </p>
          <div className="h-px w-full bg-white/20" />
          <p className="max-w-tile text-white/70">{HOST_PROOF.stat.label}</p>
        </div>
      </div>
    </section>
  );
}
