"use client";

/**
 * "Setup progress": how many required steps are done, and every step with its
 * own state, each one a button that opens it (Onboarding board).
 *
 * NOT THE PRO STEPPER, ON PURPOSE. HeroUI Pro's `Stepper` derives each step's
 * state from its position — everything before the current step is drawn
 * complete. Set-up is not linear: an owner skips a recommended step and comes
 * back, or finishes photos before rooms, so a step's tick has to come from the
 * database, never from where it sits. A list of buttons with
 * `aria-current="step"` says exactly that, and the journey above the page uses
 * the Stepper where the order IS the state.
 */

import { Progress } from "@injishi/ui";
import { Check } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";
import { railNeed, requiredProgress, type PlanStep } from "./setup-plan";

export function StepRail({
  steps,
  current,
  onSelect,
}: {
  steps: readonly PlanStep[];
  /** Index of the step on screen, or -1 when another view is. */
  current: number;
  onSelect: (index: number) => void;
}) {
  const titleId = useId();
  const req = requiredProgress(steps);

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-0.5 self-start rounded-card border border-panel-bd bg-card p-3"
    >
      <div className="flex flex-col gap-2 px-2.5 pt-1.5 pb-3">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <h2 id={titleId} className="font-semibold text-foreground">
            Setup progress
          </h2>
          <span className="pms-num text-muted-foreground">
            {req.done} of {req.total} required
          </span>
        </div>
        <Progress
          aria-labelledby={titleId}
          value={req.pct}
          // `block`: HeroUI's `.progress-bar` is a two row grid (label, then
          // track), and the fill this adapter draws lands in the label row,
          // squeezed to a hairline by the gap. One row is all this bar has.
          className="block h-1.5 bg-default"
          indicatorClassName="bg-primary"
        />
      </div>

      <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          const here = i === current;
          return (
            <li key={step.key}>
              <button
                type="button"
                aria-current={here ? "step" : undefined}
                data-setup-step={step.key}
                data-done={step.done ? "true" : "false"}
                onClick={() => onSelect(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded px-2.5 py-2 text-left text-sm text-foreground",
                  "hover:bg-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  here && "bg-accent-soft text-accent-soft-foreground hover:bg-accent-soft",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "pms-num flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    step.done
                      ? "bg-primary text-primary-foreground"
                      : here
                        ? "bg-card text-accent-soft-foreground"
                        : "bg-default text-muted-foreground",
                  )}
                >
                  {step.done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span className={cn("min-w-0 flex-1", here ? "font-semibold" : "font-medium")}>{step.title}</span>
                <span
                  className={cn(
                    "shrink-0 text-2xs font-semibold",
                    here ? "text-accent-soft-foreground" : "text-muted-foreground",
                  )}
                >
                  {/* "Done" in words as well as the tick, so the state is never colour or shape alone. */}
                  {railNeed(step, isLast)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
