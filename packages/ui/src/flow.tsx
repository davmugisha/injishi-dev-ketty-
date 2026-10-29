"use client";

import { Stepper, Timeline } from "@heroui-pro/react";
import type { ReactNode } from "react";
import { formatDay, toKigaliDay } from "./date.tsx";
import { useMediaQuery } from "./hooks.ts";
import type { StatusTone } from "./status.ts";
import { toneStatus } from "./tone.ts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export interface TimelineEvent {
  id: string;
  /** What happened, short: "Tenant signed", "Payment received". */
  title: ReactNode;
  /** One muted line: who, how much, the reference. */
  detail?: ReactNode;
  /** When: a Kigali day (`yyyy-mm-dd`) or an instant. */
  at: string | Date | number;
  /** The marker's tone. "current" marks the step happening now. @default "default" */
  tone?: StatusTone | "current";
}

/** A record's history, oldest first (a lease, a fault, a payment): what happened, by whom, when. */
export function EventTimeline({
  label,
  events,
  className,
}: {
  /** For screen readers: "Lease history". */
  label: string;
  events: TimelineEvent[];
  className?: string;
}) {
  return (
    <Timeline size="sm" density="compact" aria-label={label} className={className}>
      {events.map((e) => (
        <Timeline.Item key={e.id} status={toneStatus(e.tone === "current" ? "current" : (e.tone ?? null))}>
          <Timeline.Rail>
            <Timeline.Marker />
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content className="flex min-w-0 flex-col gap-0.5 pb-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-sm font-medium text-foreground">{e.title}</span>
              <time dateTime={toKigaliDay(e.at)} className="text-xs whitespace-nowrap text-muted tabular">
                {formatDay(e.at, "short")}
              </time>
            </div>
            {e.detail ? <span className="text-xs text-muted">{e.detail}</span> : null}
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

export interface FlowStep {
  id: string;
  title: string;
  /** One short line under the title on wide screens. */
  description?: string;
}

/**
 * Where a multi-step flow stands (new lease, signing, setup, a declaration): done steps are ticked, the
 * current one is highlighted. Horizontal from sm up, vertical on a phone. With `onStepChange`, done
 * steps can be pressed to go back.
 */
export function FlowStepper({
  label,
  steps,
  current,
  onStepChange,
  orientation,
  className,
}: {
  /** For screen readers: "New lease steps". */
  label: string;
  steps: FlowStep[];
  /** The current step, by index or id. `steps.length` means every step is done. */
  current: number | string;
  onStepChange?: (index: number) => void;
  /** Force one layout; by default it follows the screen width. */
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const wide = useMediaQuery("(min-width: 640px)");
  const index =
    typeof current === "number"
      ? current
      : Math.max(
          0,
          steps.findIndex((s) => s.id === current),
        );
  const layout = orientation ?? (wide ? "horizontal" : "vertical");
  return (
    <Stepper
      aria-label={label}
      size="sm"
      orientation={layout}
      currentStep={index}
      onStepChange={onStepChange ? (i) => i < index && onStepChange(i) : undefined}
      className={cx("w-full", className)}
    >
      {steps.map((s, i) => (
        <Stepper.Step key={s.id} aria-current={i === index ? "step" : undefined}>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>{s.title}</Stepper.Title>
            {s.description ? (
              <Stepper.Description className={cx(layout === "horizontal" && "hidden lg:block")}>
                {s.description}
              </Stepper.Description>
            ) : null}
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
      ))}
    </Stepper>
  );
}
