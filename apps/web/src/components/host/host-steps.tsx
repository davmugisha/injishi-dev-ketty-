import { SectionHeading } from "@/components/shared/section-heading";
import { HOST_STEPS } from "@/data/host";

/**
 * "How a listing goes live" — the four steps, as a timeline.
 *
 * These are a real sequence, not four parallel selling points, so two things
 * follow. The numbers are shown rather than implied: they are information here,
 * and `HOST_STEPS` carries them. And the steps are connected — a hairline runs
 * from each numeral to the next, so the order is drawn rather than left to the
 * reader to infer from four numerals sitting in four unrelated boxes.
 *
 * The timeline runs left to right at `lg` and top to bottom below it, which is
 * the same rule turned ninety degrees rather than a second layout: one hairline
 * per step, one numeral per step, in both directions. The vertical form is the
 * one that has to survive 375px, and it is the easy one — a 40px numeral, a
 * 16px gutter, and the copy taking the remaining ~287px at the narrowest
 * supported width. Nothing is side by side at that size, so nothing can crush.
 *
 * Deliberately *not* a second three-up row of hairline-separated columns: the
 * benefits section directly above is exactly that, and repeating it here would
 * flatten a sequence into a set and make two different kinds of content look
 * like one.
 *
 * It also stays on the page ground rather than becoming a `bg-ink-700` band.
 * Bands take `section-y-loose` and there is no third step to reach for, so a
 * band here would make the steps a chapter of their own — which is a page-level
 * decision about where the page's one colour break belongs, not this
 * component's to take.
 */
export function HostSteps() {
  const lastIndex = HOST_STEPS.length - 1;

  return (
    <section className="section-y container">
      <SectionHeading lead="How a listing " emphasis="goes live" className="mb-8" />

      <ol className="grid grid-cols-1 lg:grid-cols-4 lg:gap-x-8">
        {HOST_STEPS.map((step, index) => (
          <li
            key={step.n}
            className="relative flex gap-4 pb-8 last:pb-0 lg:block lg:pb-0"
          >
            {/* The connector. One element, rotated by the breakpoint:
                vertical from under this numeral to the top of the next one
                (`bottom-0` lands on the item's border box, which the `pb-8`
                extends to exactly where the next numeral starts), and
                horizontal at `lg`, where `-right-8` carries it across the
                32px grid gutter so it meets the next numeral instead of
                stopping short at the column edge.

                It is not rendered after the last step — a line running off the
                end would promise a fifth thing. Colour comes from `border`,
                the same token the numerals' rings use, so the whole figure is
                one hairline weight in both themes. */}
            {index < lastIndex ? (
              <span
                aria-hidden
                className="absolute bottom-0 left-5 top-12 w-px bg-border lg:-right-8 lg:bottom-auto lg:left-11 lg:top-5 lg:h-px lg:w-auto"
              />
            ) : null}

            {/* A numeral in a hairline circle — DESIGN.md's icon language
                ("often boxed in a hairline square or circle"), and Figtree
                carries every number in the system. */}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-base font-medium text-page-fg">
              {step.n}
            </span>

            {/* The measure cap is for the vertical form only. Between `md` and
                `lg` the copy would otherwise run the full column — around 85
                characters a line — which is unreadable in a way the 375px
                case never is. */}
            <div className="flex max-w-[52ch] flex-col gap-2 lg:mt-5 lg:max-w-none">
              <h3 className="text-base font-medium text-page-fg">{step.title}</h3>
              <p className="text-base text-page-fg-70">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
