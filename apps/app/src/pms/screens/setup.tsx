"use client";

/**
 * Setup: what an approved business still has to do before it can trade
 * (2026-09-13).
 *
 * Where the approval mail and the registration pipeline send a new business.
 * The steps come from `setupStepsFor` in `@injishi/contracts` and "done" from
 * `isSetupStepDone` against the API's counts, so this screen never decides for
 * itself what a hotel, a tented camp or a landlord owes. Each step links to the
 * screen that edits it; nothing is edited twice.
 *
 * Behind `listing.manage`, which a business only holds once approved, so the
 * checklist cannot open during registration (the user's ruling, and D20).
 */

import {
  isSetupStepDone,
  setupCompletion,
  setupStepsFor,
  setupVocabularyFor,
  type PropertySetupCounts,
  type SetupStep,
  type SetupStepKey,
} from "@injishi/contracts";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { Icon } from "../components/icon";
import { Badge, EmptyState, LoadFailed, SectionHeading, Skeleton, surfaceClass } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useSetupProgress } from "../data/setup";
import { workspaceBase } from "../lib/nav";
import { usePms } from "../store";

/** What each count reads as, beside a finished step. */
function summary(key: SetupStepKey, c: PropertySetupCounts, unitPlural: string): string | null {
  switch (key) {
    case "property":
      return c.properties === 1 ? "1 property" : `${c.properties} properties`;
    case "contact":
      return c.contactDetails > 0 ? "Phone and email on file" : null;
    case "departments":
      return `${c.departmentHeads} of ${c.departments} departments have a head`;
    case "room_types":
      return `${c.pricedRoomTypes} priced of ${c.roomTypes}`;
    case "rooms":
      return `${c.rooms} ${unitPlural}`;
    case "photos":
      return `${c.photos} photo${c.photos === 1 ? "" : "s"}`;
    case "amenities":
      return `${c.amenities} offered`;
    case "outlets":
      return `${c.outlets} outlet${c.outlets === 1 ? "" : "s"}`;
    case "staff":
      return `${c.staff} member${c.staff === 1 ? "" : "s"} or invitation${c.staff === 1 ? "" : "s"}`;
    case "listing":
      return c.published > 0 ? "Live on the marketplace" : null;
  }
}

export function Setup() {
  const workspaceId = useWorkspaceId();
  const { state } = usePms();
  const { can, reasonFor } = useCapability();
  const progress = useSetupProgress(workspaceId);
  const base = workspaceBase(workspaceId);
  const landlord = state.ws === "landlord";

  if (!can("listing.manage")) {
    return <EmptyState className="p-6 text-sm">{reasonFor("listing.manage")}</EmptyState>;
  }
  if (progress.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={90} />
        <Skeleton height={320} delay={60} />
      </div>
    );
  }
  if (progress.isError || !progress.data) {
    return (
      <LoadFailed onRetry={() => void progress.refetch()} retrying={progress.isFetching}>
        We couldn&apos;t load your setup checklist. Nothing you set up is lost — this is on our side.
      </LoadFailed>
    );
  }

  const p = progress.data;
  const business = { domain: p.domain, accommodationClass: p.accommodationClass };
  const steps = setupStepsFor(business);
  const words = setupVocabularyFor(business);
  const done = setupCompletion(steps, p.counts);
  const pct = Math.round((done.done / done.total) * 100);
  const property = p.propertyId ? `?property=${encodeURIComponent(p.propertyId)}` : "";
  const inventory = landlord ? `${base}/units${property}` : `${base}/inventory${property}`;

  /** The screen that edits each step. */
  const href: Record<SetupStepKey, string> = {
    property: inventory,
    contact: `${base}/settings`,
    departments: `${base}/people/departments`,
    room_types: inventory,
    rooms: inventory,
    photos: inventory,
    amenities: `${base}/inventory/amenities`,
    outlets: `${base}/services/outlets`,
    staff: `${base}/people/invites`,
    listing: inventory,
  };
  // A step whose screen needs the property first says so, rather than opening
  // an empty form.
  const needsProperty = (key: SetupStepKey) => key !== "property" && key !== "staff" && p.counts.properties === 0;

  const nextStep = steps.find((s) => !isSetupStepDone(s.key, p.counts) && !needsProperty(s.key));

  const row = (step: SetupStep, i: number) => {
    const finished = isSetupStepDone(step.key, p.counts);
    const blocked = !finished && needsProperty(step.key);
    const detail = finished ? summary(step.key, p.counts, words.unitPlural) : null;
    const isNext = nextStep?.key === step.key;
    return (
      <li
        key={step.key}
        data-setup-step={step.key}
        data-done={finished ? "true" : "false"}
        className={cn("flex items-start gap-3 px-4 py-3.5", i > 0 && "border-t border-line")}
      >
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-2xs font-bold",
            finished ? "border-transparent bg-success text-success-foreground" : "border-line2 bg-field text-ink2",
          )}
        >
          {finished ? <Icon name="check" size={14} /> : i + 1}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{step.title}</span>
            {step.required ? <Badge intent="neutral">Required</Badge> : <Badge intent="info">Recommended</Badge>}
            {finished && <Badge intent="ok">Done</Badge>}
            {isNext && <Badge intent="warn">Next</Badge>}
          </span>
          <span className="text-xs text-muted-foreground">{step.description}</span>
          {detail && <span className="text-xs text-ink2">{detail}</span>}
          {blocked && <span className="text-xs text-muted-foreground">Add the property first.</span>}
        </span>
        {!blocked && (
          <Link
            href={href[step.key]}
            className={cn(
              "shrink-0 self-center rounded border px-3 py-1.5 text-xs font-semibold",
              isNext ? "border-transparent bg-primary text-primary-foreground" : "border-line2 bg-card text-ink2 hover:bg-hover",
            )}
          >
            {finished ? "Review" : isNext ? "Start" : "Open"}
          </Link>
        )}
      </li>
    );
  };

  return (
    <div className="pms-enter flex flex-col gap-5" data-screen="setup">
      <section className={cn(surfaceClass, "flex flex-col gap-3 p-4")}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-base font-semibold text-ink">
            {p.propertyName ?? p.legalName}
          </span>
          <span className="text-xs text-muted-foreground">
            {done.done} of {done.total} steps · {done.requiredDone} of {done.requiredTotal} required
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Setup progress"
          className="h-2 overflow-hidden rounded-full bg-hover"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-muted-foreground">
          {done.requiredDone === done.requiredTotal
            ? "Everything required is in place. Publish when you are ready to take bookings."
            : `Your business is approved. Set up your ${words.typePlural.toLowerCase()}, ${words.unitPlural}, team and the rest here — each step opens the screen where it is done.`}
        </p>
      </section>

      <section className="flex flex-col gap-2.5">
        <SectionHeading n={`${done.done}/${done.total}`}>Checklist</SectionHeading>
        <ol className={cn(surfaceClass, "m-0 list-none p-0")}>{steps.map(row)}</ol>
      </section>
    </div>
  );
}
