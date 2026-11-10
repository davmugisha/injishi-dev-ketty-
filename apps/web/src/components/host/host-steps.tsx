import { BadgeCheck, Camera, ClipboardCheck, SearchCheck, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SectionHeading } from "@/components/shared/section-heading";
import { HOST_STEPS, type HostStep } from "@/data/host";

/**
 * "How a listing goes live" — the four steps, as numbered panels.
 *
 * (Earlier notes below describe the timeline form this replaced: a hairline
 * connector between circles, and step one listing the wizard's parts. Both
 * were dropped to give each step room to read on its own.)
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
 * icons and labels (`REGISTRATION_STEPS`, minus Business type, which the chooser above
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
export async function HostSteps() {
  const t = await getTranslations("host.sections");
  return (
    <section className="section-y container">
      <SectionHeading lead={t("stepsLead")} emphasis={t("stepsEmphasis")} className="mb-8" />

      {/* Four hairline panels, numbered. The numeral carries the order, so no
          connector is drawn between them; the panels close square at every
          width (one column, two at `sm`, four at `lg`). */}
      <ol className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {HOST_STEPS.map((step) => (
          <li
            key={step.n}
            className="flex flex-col gap-4 rounded-card border border-border p-6"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-[0.75rem] bg-surface-secondary text-page-fg">
                <StepIcon step={step} />
              </span>
              <span
                aria-hidden
                className="font-display text-3xl font-medium text-page-fg-70 opacity-40 tabular-nums"
              >
                {String(step.n).padStart(2, "0")}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <p className="sr-only">{t("stepNumber", { n: step.n })}</p>
              <h3 className="text-lg font-medium text-page-fg">{t(`step${step.n}Title`)}</h3>
              <p className="text-justify text-sm leading-relaxed text-page-fg-70 hyphens-auto">{t(`step${step.n}Body`)}</p>
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
