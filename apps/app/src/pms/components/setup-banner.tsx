"use client";

/**
 * "Finish setting up", on the screen an operator lands on (2026-09-13).
 *
 * An approved owner who signs in lands on Today, or a landlord on Rent roll.
 * This says how far the property's setup has got and opens Setup. It shows only
 * while a REQUIRED step is unfinished, only to someone who can do the setup
 * (`listing.manage`), and only for a workspace the server answered for: the
 * standalone demo has nothing to set up.
 *
 * **ONE LINE, AND IT NO LONGER CLAIMS THE SCREEN IS EMPTY (2026-10-06).** It was
 * a two line card saying "Until then this screen has nothing to show", sitting
 * above a Today full of bookings. Both halves were wrong: the screen below it
 * works whatever the checklist says, and what the required steps actually gate
 * is the listing going live (`SetupStep.required`, "required steps gate ready
 * to publish"). So it says that, names the next step by its own title, shows
 * the count as a bar, and takes one row instead of three, which is a third of
 * what used to push the first guest down the page.
 */

import { isSetupStepDone, setupCompletion, setupStepsFor } from "@injishi/contracts";
import { Progress } from "@injishi/ui";
import { ArrowRight, ListChecks } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { useCapability, useWorkspaceId } from "../data/capability";
import { useSetupProgress } from "../data/setup";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";

export function SetupBanner() {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const live = Boolean(state.grants && state.grants.length > 0 && workspaceId);
  const progress = useSetupProgress(live && can("listing.manage") ? workspaceId : null);

  if (!progress.data) return null;
  const p = progress.data;
  const steps = setupStepsFor({ domain: p.domain, accommodationClass: p.accommodationClass });
  const done = setupCompletion(steps, p.counts);
  if (done.requiredDone === done.requiredTotal) return null;
  const next = steps.find((s) => s.required && !isSetupStepDone(s.key, p.counts));

  return (
    <SetupNoticeView
      name={p.propertyName ?? p.legalName}
      done={done.requiredDone}
      total={done.requiredTotal}
      next={next?.title}
      href={`${workspaceBase(workspaceId)}/setup`}
    />
  );
}

/**
 * The notice itself, from plain numbers. Split from the read above so the
 * wording and the layout can be looked at without a server behind them.
 */
export function SetupNoticeView({
  name,
  done,
  total,
  next,
  href,
}: {
  name: string;
  done: number;
  total: number;
  /** The first unfinished required step's title. */
  next?: string;
  href: string;
}) {
  const titleId = useId();
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      data-cy="setup-banner"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded border border-panel-bd bg-card px-3.5 py-1"
    >
      <span className="flex min-w-0 flex-1 basis-72 items-center gap-2.5">
        <ListChecks aria-hidden="true" className="size-[18px] shrink-0 text-accent-text" strokeWidth={2} />
        <span className="min-w-0 text-sm">
          <span id={titleId} className="font-semibold text-foreground">
            Finish setting up {name}.
          </span>{" "}
          <span className="text-xs text-muted-foreground">
            Your listing can go live once the required steps are done.
          </span>
        </span>
      </span>
      <span className="flex items-center gap-2">
        <Progress
          aria-labelledby={titleId}
          value={pct}
          // The bar is the at-a-glance half; on a phone the words beside it
          // carry the count alone, which keeps the link on the same line.
          className="hidden h-1.5 w-20 bg-accent-soft sm:block"
          indicatorClassName="bg-accent"
        />
        <span className="pms-num text-xs font-semibold whitespace-nowrap text-ink2">
          {done} of {total} required
        </span>
      </span>
      <Link
        href={href}
        className="inline-flex items-center gap-1 rounded py-1 text-sm font-semibold whitespace-nowrap text-accent-text no-underline hover:underline"
      >
        {next ? `Continue with ${next}` : "Continue setup"}
        <ArrowRight aria-hidden="true" className="size-4" strokeWidth={2} />
      </Link>
    </div>
  );
}
