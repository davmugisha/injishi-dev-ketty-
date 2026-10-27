import { Building2, Check, CreditCard, FileText, House, ListChecks, type LucideIcon } from "lucide-react";
import { cn } from "@injishi/utils";

import { STEP_TITLE, type StepId } from "@/app/(app)/(entry)/register/register-steps";

/**
 * The registration wizard's progress rail, and the step overview `/host` shows
 * before it.
 *
 * SINCE THE REGISTRATION ARTBOARD (Register.dc.html, 2026-10-19) a business
 * walks SIX steps: Business type, TIN and licences, Branches and PSF,
 * Documents, Overview, Pay; a residence walks five. The wizard draws its own
 * rail (`app/(app)/(entry)/register/register-rail.tsx`), `register-steps.ts`
 * owns the order, and `/host` is the only reader of `REGISTRATION_STEPS`. The
 * paragraphs below record why ADR-060 named five and the Journey board four
 * (ADR-069 D-g), and stay as their history.
 *
 * `/host/start` used to preview this rail (`active={null}`) on the page between
 * the chooser and the wizard. That page is a redirect now, so the wizard is the
 * rail's one renderer, and `/host` reads the same list (`REGISTRATION_STEPS`)
 * for the overview in "How a listing goes live", so the parts named there are
 * the parts the wizard walks.
 *
 * A hospitality business and a residence both walk FIVE screens since ADR-060,
 * and the rail names every one: Branches moved onto the Business step, and
 * Review, contract and payment became one screen, so no screen is walked that
 * the rail does not show (it showed six nodes over nine screens before). It
 * carried three under ADR-026. The three were "You",
 * "Business", "Pay", which described the form and not the journey: the first
 * thing that actually happens is choosing what you are registering, and
 * attaching documents is a step a person prepares for rather than a field they
 * fill in. A rail that hides two of the five steps is a rail that under-quotes
 * the work, which is worse than a longer one.
 *
 * The converse holds as well: a rail must not show a step nobody will walk. A
 * kind chosen on `/host` arrives answered and the wizard skips Place, so the
 * wizard passes the list without it (`register/register-steps.ts`) and the rail
 * renders what it is given.
 *
 * EACH STEP CARRIES AN ICON, and the icon is what the node shows. A numeral
 * said where you are and nothing about what is asked there; on a phone, where
 * the labels do not fit beside the nodes, five numbered dots were the whole
 * rail. A person, a building, a document and a card tell a registrant what
 * the next screen wants before they reach it. The count is not lost: every
 * node says "Step 2 of 4" to a screen reader, and a phone shows the same
 * count and the current step's name on a line under the rail.
 */
type RegistrationStepId = StepId | "about";

export interface RegistrationStep {
  id: RegistrationStepId;
  label: string;
  icon: LucideIcon;
}

/**
 * A business's path, every step of it: the five ADR-075 decides (AC-3), Business
 * · You · Documents · Review · Pay. The labels are the wizard's own
 * (`STEP_TITLE` in `register/register-steps.ts`, which owns the order), so
 * what `/host` names is what the wizard walks.
 */
export const REGISTRATION_STEPS: ReadonlyArray<RegistrationStep> = [
  { id: "business", label: STEP_TITLE.business, icon: Building2 },
  { id: "you", label: STEP_TITLE.you, icon: House },
  { id: "documents", label: STEP_TITLE.documents, icon: FileText },
  { id: "review", label: STEP_TITLE.review, icon: ListChecks },
  { id: "pay", label: STEP_TITLE.pay, icon: CreditCard },
];

export function RegistrationStepRail({
  active,
  steps = REGISTRATION_STEPS,
  className,
}: {
  /**
   * The step in progress, or `null` before registration has actually started.
   * `null` is not the same as "step one in progress": nothing has been entered
   * yet, so node one renders as a hollow ring rather than the filled,
   * current-step treatment — "about to start" and "started" are different true
   * things and read as two different marks.
   */
  active: RegistrationStepId | null;
  steps?: ReadonlyArray<RegistrationStep>;
  className?: string;
}) {
  const at = active === null ? -1 : steps.findIndex((s) => s.id === active);

  const currentStep = at >= 0 ? steps[at] : undefined;

  return (
    <div className={className}>
      <ol
        className="flex flex-wrap items-center gap-2 text-sm font-semibold"
        aria-label="Registration steps"
      >
        {steps.map((step, i) => {
          const done = at > i;
          const current = at === i;
          const upNext = at === -1 && i === 0;
          const Icon = done ? Check : step.icon;

          return (
            <li
              key={step.id}
              className="flex items-center gap-2"
              aria-current={current ? "step" : undefined}
            >
              {i > 0 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.5 w-4 rounded-full sm:w-8",
                    done || current ? "bg-accent-brand" : "bg-border",
                  )}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                  current
                    ? "bg-accent-brand text-accent-brand-foreground"
                    : done
                      ? "bg-success text-success-foreground"
                      : upNext
                        ? "border-2 border-accent-brand text-accent-brand"
                        // A hairline ring, never `bg-muted`. In this app's
                        // stylesheet `--muted-foreground` is ALIASED ONTO
                        // `--muted` (the HeroUI role block aliases the legacy
                        // Injishi names, and HeroUI's `muted` is a TEXT grey),
                        // so `bg-muted text-muted-foreground` paints grey on the
                        // same grey and the mark disappears. An unreached
                        // step reads as quiet rather than as filled anyway.
                        : "border border-border text-muted-foreground",
                )}
              >
                <Icon size={16} strokeWidth={done ? 2.5 : 2} />
              </span>
              {/* The label is for the eye; the sentence below is for a screen
                  reader, which is told the count, the name and the state in one
                  go. Below `sm` the labels give way to the caption under the
                  rail, so five nodes fit a 320px screen whichever is current. */}
              <span
                aria-hidden="true"
                className={cn(
                  "hidden sm:inline",
                  current || upNext ? undefined : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              <span className="sr-only">
                {`Step ${i + 1} of ${steps.length}: ${step.label}${
                  done ? ", done" : current ? ", current" : ""
                }`}
              </span>
            </li>
          );
        })}
      </ol>
      {/* A phone's words for where the registrant is: the count and the
          name, on a line of their own, because a label inline beside five
          nodes runs off a narrow screen once the current step is the last
          one. Hidden from a screen reader, which has the full sentence on
          every node already. */}
      {currentStep ? (
        <p aria-hidden="true" className="mt-2 text-sm font-semibold sm:hidden">
          {`Step ${at + 1} of ${steps.length}: ${currentStep.label}`}
        </p>
      ) : null}
    </div>
  );
}
