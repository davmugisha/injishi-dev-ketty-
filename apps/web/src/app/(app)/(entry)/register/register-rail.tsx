"use client";

import { Check } from "lucide-react";
import { Avatar, AvatarFallback, Progress } from "@injishi/ui";
import { cn } from "@injishi/utils";

/**
 * The registration's step rail (RegisterIA board): how far along you are, and
 * each step with what it asks for.
 *
 * Three steps for a business — You, Business, Check, sign and pay — and none
 * for a broker, whose registration is one screen. Each step is DONE (a tick),
 * CURRENT (raised), or LOCKED (greyed and not pressable) until the steps before
 * it are answered, so the rail can be used to go back without letting anyone
 * jump past a step nobody has checked. It is drawn here rather than with the
 * Pro stepper because that component derives every state from one index and
 * cannot lock a step whose turn has not come.
 */
export interface RailStep {
  id: string;
  title: string;
  sub: string;
  done: boolean;
  current: boolean;
  locked: boolean;
}

export function RegisterRail({
  steps,
  onGo,
}: {
  steps: RailStep[];
  onGo: (id: string) => void;
}) {
  const at = Math.max(0, steps.findIndex((s) => s.current));
  const pct = Math.round((at / steps.length) * 100);
  return (
    <nav aria-label="Registration steps" className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5">
        <span id="register-rail-progress" className="text-xs font-semibold text-muted-foreground">
          Step {at + 1} of {steps.length}
        </span>
        <Progress
          aria-labelledby="register-rail-progress"
          value={pct}
          className="h-1.5 bg-secondary"
          indicatorClassName="bg-accent-brand"
        />
      </div>
      <ol className="flex flex-col gap-1">
        {steps.map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              disabled={step.locked}
              aria-current={step.current ? "step" : undefined}
              onClick={() => onGo(step.id)}
              className={cn(
                "flex min-h-12 w-full items-center gap-3 rounded-card px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                step.current
                  ? "border border-border bg-card"
                  : "border border-transparent hover:bg-secondary",
                step.locked && "cursor-default text-muted-foreground hover:bg-transparent",
              )}
            >
              <Avatar className="size-8">
                <AvatarFallback
                  className={cn(
                    "text-xs font-semibold",
                    step.done || step.current
                      ? "bg-accent-brand/15 text-accent-text"
                      : "bg-secondary text-muted-foreground",
                  )}
                >
                  {step.done ? (
                    <Check size={16} aria-label="Done" />
                  ) : (
                    <span aria-hidden>{i + 1}</span>
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{step.title}</span>
                <span className="text-xs text-muted-foreground">{step.sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
