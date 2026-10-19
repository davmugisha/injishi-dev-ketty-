"use client";

import { Check, Lock } from "lucide-react";
import { cn } from "@injishi/utils";

/**
 * The registration's step rail (Register.dc.html): a vertical list of the
 * steps, each ACTIVE (the one on screen), COMPLETE (a tick) or not yet reached,
 * and LOCKED (a padlock, not pressable) until every step before it is done. It
 * goes back without letting anyone jump past a step nobody has checked; which
 * steps can be opened is `openableThrough` in `register-steps.ts`.
 *
 * Hidden below a tablet's width, where the step's own progress bar says the
 * same thing in less room.
 */
export interface RailStep {
  id: string;
  title: string;
  status: "active" | "complete" | "inactive";
  locked: boolean;
}

export function RegisterRail({ steps, onGo }: { steps: RailStep[]; onGo: (id: string) => void }) {
  return (
    <nav aria-label="Registration steps" className="pt-2">
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const last = i === steps.length - 1;
          const pressable = !step.locked && step.status !== "active";
          return (
            <li key={step.id} className="relative flex flex-col">
              <button
                type="button"
                disabled={!pressable}
                aria-current={step.status === "active" ? "step" : undefined}
                onClick={() => onGo(step.id)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  pressable ? "hover:text-accent-text" : "cursor-default",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step.status === "active"
                      ? "bg-accent-brand text-accent-brand-foreground"
                      : step.status === "complete"
                        ? "bg-accent-brand/15 text-accent-text"
                        : "border border-border bg-card text-muted-foreground",
                  )}
                >
                  {step.status === "complete" ? <Check size={16} aria-label="Done" /> : <span aria-hidden>{i + 1}</span>}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    step.status === "active" ? "font-semibold" : step.locked ? "text-muted-foreground" : "font-medium",
                  )}
                >
                  {step.title}
                  <span className="sr-only">
                    {`, step ${i + 1} of ${steps.length}`}
                    {step.locked ? ", opens when the steps before it are done" : ""}
                  </span>
                </span>
                {step.locked ? <Lock size={14} aria-hidden className="shrink-0 text-muted-foreground" /> : null}
              </button>
              {last ? null : (
                <span
                  aria-hidden
                  className={cn(
                    "ml-4 h-5 w-px",
                    step.status === "complete" ? "bg-accent-brand" : "bg-border",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
