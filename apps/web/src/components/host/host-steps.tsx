import { BadgeCheck, Camera, ClipboardCheck, SearchCheck, type LucideIcon } from "lucide-react";
import { REGISTRATION_STEPS } from "@/components/shared/registration-step-rail";
import { SectionHeading } from "@/components/shared/section-heading";
import { HOST_STEPS, type HostStep } from "@/data/host";

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
 * EACH STEP HAS AN ICON, and it sits in the circle the numeral used to hold.
 * The number is still shown, as a "Step 1" line over the title, so the order
 * stays information rather than inference; the icon adds what the step is
 * about, which is what a reader scanning four columns looks for.
 *
 * Step one also lists the parts registering walks, with the wizard rail's own
 * icons and labels (`REGISTRATION_STEPS`, minus Place, which the chooser above
 * has already asked). It is the overview `/host/start` used to show before the
 * wizard, moved onto this page when that page became a redirect, and it reads
 * the same list the rail renders so the two can never name different parts.
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
                vertical from under this circle to the top of the next one
                (`bottom-0` lands on the item's border box, which the `pb-8`
                extends to exactly where the next circle starts), and
                horizontal at `lg`, where `-right-8` carries it across the
                32px grid gutter so it meets the next circle instead of
                stopping short at the column edge.

                It is not rendered after the last step — a line running off the
                end would promise a fifth thing. Colour comes from `border`,
                the same token the circles' rings use, so the whole figure is
                one hairline weight in both themes. */}
            {index < lastIndex ? (
              <span
                aria-hidden
                className="absolute bottom-0 left-5 top-12 w-px bg-border lg:-right-8 lg:bottom-auto lg:left-11 lg:top-5 lg:h-px lg:w-auto"
              />
            ) : null}

            {/* A line icon in a hairline circle — DESIGN.md's icon language
                ("often boxed in a hairline square or circle"), at 1px. */}
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-page-fg">
              <StepIcon step={step} />
            </span>

            {/* The measure cap is for the vertical form only. Between `md` and
                `lg` the copy would otherwise run the full column — around 85
                characters a line — which is unreadable in a way the 375px
                case never is. */}
            <div className="flex max-w-[52ch] flex-col gap-2 lg:mt-5 lg:max-w-none">
              <p className="text-xs font-medium uppercase tracking-widest text-page-fg-70">
                Step {step.n}
              </p>
              <h3 className="text-base font-medium text-page-fg">{step.title}</h3>
              <p className="text-base text-page-fg-70">{step.body}</p>
              {step.icon === "register" ? <RegistrationParts /> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

const STEP_ICONS = {
  register: ClipboardCheck,
  verify: SearchCheck,
  photograph: Camera,
  live: BadgeCheck,
} satisfies Record<HostStep["icon"], LucideIcon>;

function StepIcon({ step }: { step: HostStep }) {
  const Icon = STEP_ICONS[step.icon];
  return <Icon size={22} strokeWidth={1} aria-hidden />;
}

/**
 * What registering asks, in the order the wizard asks it: the rail's own parts,
 * minus Place, because the chooser at the top of this page is that question.
 */
function RegistrationParts() {
  const parts = REGISTRATION_STEPS.filter((s) => s.id !== "place");
  return (
    <ul
      aria-label="What registering asks"
      className="mt-1 flex flex-wrap gap-x-4 gap-y-2 text-sm text-page-fg-70"
    >
      {parts.map((part) => (
        <li key={part.id} className="flex items-center gap-1.5">
          <part.icon size={16} strokeWidth={1.5} aria-hidden className="text-page-fg" />
          {part.label}
        </li>
      ))}
    </ul>
  );
}
