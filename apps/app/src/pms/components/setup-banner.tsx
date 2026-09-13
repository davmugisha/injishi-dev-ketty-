"use client";

/**
 * "Finish setting up", on the screen an operator lands on (2026-09-13).
 *
 * An approved owner who signs in lands on Today, or a landlord on Rent roll —
 * screens that are empty until the property exists. This says why, and opens
 * Setup. It shows only while a REQUIRED step is unfinished, only to someone who
 * can do the setup (`listing.manage`), and only for a workspace the server
 * answered for: the standalone demo has nothing to set up.
 */

import { setupCompletion, setupStepsFor } from "@injishi/contracts";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { useCapability, useWorkspaceId } from "../data/capability";
import { useSetupProgress } from "../data/setup";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";
import { Icon } from "./icon";
import { surfaceClass } from "./ui";

export function SetupBanner() {
  const { state } = usePms();
  const workspaceId = useWorkspaceId();
  const { can } = useCapability();
  const live = Boolean(state.grants && state.grants.length > 0 && workspaceId);
  const progress = useSetupProgress(live && can("listing.manage") ? workspaceId : null);

  if (!progress.data) return null;
  const p = progress.data;
  const done = setupCompletion(setupStepsFor({ domain: p.domain, accommodationClass: p.accommodationClass }), p.counts);
  if (done.requiredDone === done.requiredTotal) return null;

  return (
    <div
      data-cy="setup-banner"
      className={cn(surfaceClass, "flex flex-wrap items-center gap-3 border-primary px-4 py-3")}
    >
      <Icon name="list-checks" size={18} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-semibold text-ink">Finish setting up {p.propertyName ?? p.legalName}</span>
        <span className="text-xs text-muted-foreground">
          {done.requiredDone} of {done.requiredTotal} required steps done. Until then this screen has nothing to show.
        </span>
      </span>
      <Link
        href={`${workspaceBase(workspaceId)}/setup`}
        className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground no-underline"
      >
        Continue setup
      </Link>
    </div>
  );
}
