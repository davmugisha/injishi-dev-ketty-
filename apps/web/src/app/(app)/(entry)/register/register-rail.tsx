"use client";

import { Check } from "lucide-react";
import { cn } from "@injishi/utils";

/**
 * The registration's progress (ADR-075 S10): one row of five labelled segments
 * on a wide screen, Business · You · Documents · Review · Pay. The step on
 * screen is marked; a step already reached can be pressed to go back, and
 * nothing is lost; a step not reached yet is grey and cannot be pressed. No
 * padlocks. Which steps can be opened is `openableThrough` in
 * `register-steps.ts`.
 *
 * Hidden on a phone, where `StepFrame` says "Step 2 of 5 · You" above a thin
 * bar of the same five segments. After payment the status page's tracker
 * replaces it, so form progress and PSF review are never mixed.
 */
export interface RailStep {
  id: string;
  title: string;
  status: "active" | "complete" | "inactive";
  /** Not reached yet: drawn grey, not pressable. */
  locked: boolean;
}

export function RegisterRail({ steps, onGo }: { steps: RailStep[]; onGo: (id: string) => void }) {
  return (
    <nav aria-label="Registration steps">
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((step, i) => {
          const pressable = !step.locked && step.status !== "active";
          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!pressable}
                aria-current={step.status === "active" ? "step" : undefined}
                onClick={() => onGo(step.id)}
                className={cn(
                  "flex w-full min-w-0 flex-col gap-2 rounded text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  pressable ? "hover:text-accent-text" : "cursor-default",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-1.5 w-full rounded-full",
                    step.status === "inactive" ? (step.locked ? "bg-secondary" : "bg-accent-brand/40") : "bg-accent-brand",
                  )}
                />
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 truncate",
                    step.status === "active"
                      ? "font-semibold"
                      : step.locked
                        ? "text-muted-foreground"
                        : "font-medium",
                  )}
                >
                  {step.status === "complete" ? <Check size={14} aria-hidden className="shrink-0 text-accent-text" /> : null}
                  {step.title}
                  <span className="sr-only">
                    {`, step ${i + 1} of ${steps.length}`}
                    {step.status === "complete" ? ", done" : step.locked ? ", not reached yet" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
