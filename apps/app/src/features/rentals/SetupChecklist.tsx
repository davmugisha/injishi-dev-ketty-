"use client";

import { Chip, ProgressBar } from "@heroui/react";
import { RENTALS_SETUP_STEP_LABEL, type RentalsSetupView } from "@injishi/contracts";
import { ActionLink, Icon, SectionCard } from "@injishi/ui";
import { SETUP_STEP_HREF } from "./shared";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * The first-run checklist of a new landlord (driven by `GET /ops/rentals/setup`): where the homes are,
 * the units, how rent is paid out, the lease defaults and who signs. The next step is the one main action.
 */
export function SetupChecklist({
  setup,
  title = "Get set up",
  headingLevel = 2,
  className,
}: {
  setup: RentalsSetupView;
  title?: string;
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const done = setup.steps.filter((s) => s.done).length;
  const total = setup.steps.length;
  return (
    <SectionCard
      title={title}
      description={
        setup.complete
          ? "Everything is in place."
          : `${done} of ${total} done. Tenants can sign once these are in place.`
      }
      headingLevel={headingLevel}
      className={className}
      actions={
        setup.complete ? (
          <Chip size="sm" color="success" variant="soft">
            Done
          </Chip>
        ) : null
      }
    >
      <ProgressBar
        aria-label="Setup progress"
        value={done}
        maxValue={total}
        size="sm"
        color={setup.complete ? "success" : "accent"}
      >
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
      <ol className="flex flex-col divide-y divide-separator">
        {setup.steps.map((s, i) => {
          const next = s.step === setup.next;
          return (
            <li key={s.step} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
              <span
                className={cx(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular",
                  s.done
                    ? "bg-success-soft text-success"
                    : next
                      ? "bg-accent-soft text-accent"
                      : "bg-default text-muted",
                )}
                aria-hidden="true"
              >
                {s.done ? <Icon name="Check" /> : i + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cx("text-sm font-medium", s.done && "text-muted")}>
                  {RENTALS_SETUP_STEP_LABEL[s.step]}
                  <span className="sr-only">{s.done ? ", done" : ", to do"}</span>
                </span>
                <span className="truncate text-xs text-muted">{s.detail}</span>
              </span>
              <ActionLink
                href={SETUP_STEP_HREF[s.step]}
                size="sm"
                intent={next ? "primary" : s.done ? "ghost" : "secondary"}
                aria-label={`${s.done ? "Change" : "Start"}: ${RENTALS_SETUP_STEP_LABEL[s.step]}`}
              >
                {s.done ? "Change" : next ? "Start" : "Open"}
              </ActionLink>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
}
