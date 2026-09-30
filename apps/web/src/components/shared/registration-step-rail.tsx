import { cn } from "@injishi/utils";

/**
 * The step object that runs across the `/host` -> `/register` handoff.
 *
 * `/host/start` renders it in preview (`active={null}`) before the wizard
 * exists; `RegisterWizard` renders the same component as its own progress rail
 * once a person is inside it. That continuity is the point: pressing the button
 * on `/host/start` does not open a different page so much as continue the
 * object already on screen.
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
 * A broker walks a shorter path — no business, no documents, no fee — so the
 * rail is a LIST rather than a constant, and `BROKER_STEPS` is that list. A
 * broker shown five nodes and stopped after two would read as an abandoned
 * form.
 */
export type RegistrationStepId =
  | "place"
  | "about"
  | "business"
  | "documents"
  | "pay";

export interface RegistrationStep {
  id: RegistrationStepId;
  label: string;
}

/**
 * A business's path, every screen of it (ADR-060): its branches are declared
 * on the Business step, and the read back, the agreement and the fee are one
 * screen at the end.
 */
export const REGISTRATION_STEPS: ReadonlyArray<RegistrationStep> = [
  { id: "place", label: "Place" },
  { id: "about", label: "You" },
  { id: "business", label: "Business" },
  { id: "documents", label: "Documents" },
  { id: "pay", label: "Review & pay" },
];

/** A residence walks the same five screens; it simply declares no branches. */
export const RESIDENCE_STEPS: ReadonlyArray<RegistrationStep> = REGISTRATION_STEPS;

/** A broker registers a person, not a business — two steps and no fee. */
export const BROKER_STEPS: ReadonlyArray<RegistrationStep> = [
  { id: "place", label: "Place" },
  { id: "about", label: "You" },
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

  return (
    <ol
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm font-semibold",
        className,
      )}
      aria-label="Registration steps"
    >
      {steps.map((step, i) => {
        const done = at > i;
        const current = at === i;
        const upNext = at === -1 && i === 0;

        return (
          <li key={step.id} className="flex items-center gap-2">
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
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full",
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
                      // same grey and the step number disappears. An unreached
                      // step reads as quiet rather than as filled anyway.
                      : "border border-border text-muted-foreground",
              )}
              aria-current={current ? "step" : undefined}
            >
              {i + 1}
            </span>
            <span
              className={cn(
                "hidden sm:inline",
                current || upNext ? undefined : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
