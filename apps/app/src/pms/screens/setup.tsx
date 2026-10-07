"use client";

/**
 * Set-up: the owner's guided path from "approved" to "Publish listing"
 * (Onboarding board, 2026-10-07; was a checklist of links, 2026-09-13).
 *
 * THREE VIEWS, ONE ADDRESS. `?view=` picks the set-up itself (default), the
 * preview and publish, or, once live, the first week. `?step=` is the step on
 * screen, keyed by the contract's own step keys, so the setup banner, a blocker's
 * Fix and the browser's address bar all open the same step. Both live in the URL
 * for the reason `?property=` does: a link copied from here opens what was seen.
 *
 * WHAT A STEP IS AND WHETHER IT IS DONE IS THE CONTRACT'S. The steps are
 * `setupStepsFor`, "done" is `isSetupStepDone` against the counts
 * `GET /inventory/setup` read from the database, and which are required follows
 * the kind of business. This screen decides neither; it arranges them
 * (`components/setup/setup-plan.ts`).
 *
 * EVERY STEP WRITES THROUGH A ROUTE THAT ALREADY EXISTED, and mostly through the
 * screen that already edits it, imported rather than copied: room types,
 * rooms, photographs, departments, amenities, outlets and invitations are those
 * screens, embedded. The profile and the contact card are their own two short
 * forms over the same `PATCH /inventory/properties/:id` Settings uses, because
 * the board asks for them as two steps where Settings has one Save. For an
 * embedded editor, "Save and continue" asks the database whether the step is
 * now done and refuses, in words, a required one that is not.
 *
 * Behind `listing.manage`, which a business holds only once it is approved and
 * active (D20), and which a receptionist never holds: the nav hides the door,
 * the shell refuses the address, and this screen refuses again by the grant,
 * never by a role's name. Inviting staff inside it also needs `team.manage`,
 * which the embedded Invites screen asks for itself.
 */

import {
  ACCOMMODATION_CLASS_LABEL,
  currentAccommodationClass,
  isSetupStepDone,
  setupStepsFor,
  setupVocabularyFor,
  type SetupStepKey,
} from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { ArrowLeft, Check, PartyPopper } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { ContactStep } from "../components/setup/contact-step";
import { Journey } from "../components/setup/journey";
import { OpenForBusiness, useFirstWeek } from "../components/setup/open-for-business";
import { PreviewPublish } from "../components/setup/preview-publish";
import { ProfileStep } from "../components/setup/profile-step";
import { RoomsStep } from "../components/setup/rooms-step";
import {
  blockerText,
  canSkip,
  firstOpenStep,
  parseView,
  requiredProgress,
  stepNeed,
  type PlanStep,
  type SetupView,
} from "../components/setup/setup-plan";
import { StepFooter } from "../components/setup/step-footer";
import { StepRail } from "../components/setup/step-rail";
import { EmptyState, LoadFailed, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useProperties, useProperty } from "../data/ops";
import { useGrantFollowsProperties, useSetupFollowsWrites, useSetupProgress } from "../data/setup";
import { workspaceBase, workspaceHome } from "../lib/nav";
import { usePms } from "../store";
import { CreatePropertyForm } from "./create-property-form";
import { Departments } from "./departments";
import { PropertyPicker } from "./inventory-property";
import { Invites } from "./invites";
import { Offer } from "./offer";
import { Outlets } from "./outlets";
import { PropertyPhotos } from "./property-photos";
import { RoomTypesSection } from "./room-types-section";

/** Steps whose screen works on the property, and so wait for one to exist. */
const NEEDS_PROPERTY: ReadonlySet<SetupStepKey> = new Set([
  "contact",
  "departments",
  "room_types",
  "rooms",
  "photos",
  "amenities",
  "outlets",
  "listing",
]);

export function Setup() {
  const workspaceId = useWorkspaceId();
  const { state, toast } = usePms();
  const { can, reasonFor } = useCapability();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  /**
   * The step and view the page first settled on. Focus follows a MOVE from it
   * (a button, a Fix link, Back), never the first paint, which would steal
   * focus from wherever the person arrived.
   */
  const settled = useRef<string | null>(null);

  const mayManage = can("listing.manage");
  const ws = mayManage ? workspaceId : null;
  const progress = useSetupProgress(ws, params.get("property"));
  const p = progress.data;
  const propertyId = p?.propertyId ?? null;
  const detail = useProperty(ws, propertyId);
  const list = useProperties(ws);
  useSetupFollowsWrites();
  useGrantFollowsProperties(p?.counts.properties);

  const [stepError, setStepError] = useState<{ key: SetupStepKey; text: string } | null>(null);
  const [checking, setChecking] = useState(false);

  const steps: PlanStep[] = useMemo(() => {
    if (!p) return [];
    return setupStepsFor({ domain: p.domain, accommodationClass: p.accommodationClass }).map((s) => ({
      ...s,
      done: isSetupStepDone(s.key, p.counts),
    }));
  }, [p]);
  const words = useMemo(
    () => setupVocabularyFor({ domain: p?.domain ?? "hospitality", accommodationClass: p?.accommodationClass ?? null }),
    [p?.domain, p?.accommodationClass],
  );

  const stepKey = params.get("step");
  const asked = steps.findIndex((s) => s.key === stepKey);
  const current = asked >= 0 ? asked : firstOpenStep(steps);
  const published = (p?.counts.published ?? 0) > 0;
  const residence = p?.domain === "residence";
  const wantedView = parseView(params.get("view"));
  // The first week belongs to a live listing; asked for before then, show what stops it.
  const view: SetupView = wantedView === "open" && !published ? "publish" : wantedView;

  const base = workspaceBase(workspaceId);
  const hrefWith = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      const q = next.toString();
      return q ? `${pathname}?${q}` : pathname;
    },
    [params, pathname],
  );
  const go = useCallback(
    (patch: Record<string, string | null>) => {
      setStepError(null);
      router.replace(hrefWith(patch), { scroll: false });
    },
    [hrefWith, router],
  );

  /*
   * Pin the step in the address once the counts are in. Without this the step
   * on screen is "the first unfinished one", which MOVES the moment an embedded
   * editor finishes it: the room types form would vanish under the hand that
   * just saved it and the rooms step take its place.
   */
  useEffect(() => {
    if (steps.length === 0 || asked >= 0) return;
    router.replace(hrefWith({ step: steps[firstOpenStep(steps)].key }), { scroll: false });
  }, [steps, asked, hrefWith, router]);

  // Focus follows a move, so a keyboard or screen reader user lands on the new step's title.
  const ready = steps.length > 0 && asked >= 0;
  useEffect(() => {
    if (!ready) return;
    const key = `${view}:${current}`;
    if (settled.current === null) {
      settled.current = key;
      return;
    }
    if (settled.current === key) return;
    settled.current = key;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "nearest" });
  }, [ready, current, view]);

  const firstWeek = useFirstWeek({
    workspaceId,
    base,
    residence,
    staffCount: p?.counts.staff ?? 0,
    staffHref: hrefWith({ view: null, step: "staff" }),
    // Once live, the journey above every view counts these, so they are read whatever the view.
    enabled: published,
  });

  /*
   * Refused by the grant, never by a role's name. The shell already refuses this
   * address to anyone whose nav lacks Setup; this is the answer for the moment
   * between a revoked permission and the next read of the grant.
   */
  if (!mayManage) {
    return <EmptyState className="p-6 text-sm">{reasonFor("listing.manage")}</EmptyState>;
  }
  if (progress.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={84} />
        <Skeleton height={420} delay={60} />
      </div>
    );
  }
  if (progress.isError || !p) {
    return (
      <LoadFailed onRetry={() => void progress.refetch()} retrying={progress.isFetching}>
        We couldn&apos;t load your set-up. Nothing you have set up is lost; this is on our side.
      </LoadFailed>
    );
  }

  const req = requiredProgress(steps);
  const step = steps[current];
  const isLast = current === steps.length - 1;
  const next = steps[Math.min(current + 1, steps.length - 1)];
  const prev = current > 0 ? steps[current - 1] : null;
  const property = detail.data ?? null;
  const summary = list.data?.properties.find((x) => x.id === propertyId) ?? null;

  const toStep = (key: SetupStepKey) => go({ view: null, step: key });
  const onBack = prev ? () => toStep(prev.key) : undefined;
  const onSkip = canSkip(step, isLast) ? () => toStep(next.key) : undefined;
  const onSaved = () => {
    toast(`${step.title} saved`, "ok");
    toStep(next.key);
  };

  /**
   * "Save and continue" for a step whose editor saves as it goes: ask the
   * database whether the step is done now, and refuse a required one that is
   * not, in the same words its blocker uses.
   */
  const continueChecked = async () => {
    setStepError(null);
    setChecking(true);
    const fresh = await progress.refetch();
    setChecking(false);
    const counts = fresh.data?.counts;
    const done = counts ? isSetupStepDone(step.key, counts) : step.done;
    if (step.required && !done) {
      setStepError({ key: step.key, text: blockerText(step.key, words, step.title) });
      return;
    }
    toStep(next.key);
  };

  const footer = (
    <StepFooter
      error={stepError?.key === step.key ? stepError.text : null}
      onBack={onBack}
      onSkip={onSkip}
      onSave={isLast ? undefined : () => void continueChecked()}
      saving={checking}
    />
  );

  const waitForDetail = (render: (pr: NonNullable<typeof property>) => ReactNode) =>
    property ? (
      render(property)
    ) : detail.isError ? (
      <LoadFailed onRetry={() => void detail.refetch()} retrying={detail.isFetching}>
        We couldn&apos;t load the property. Everything on it is still there; this is on our side.
      </LoadFailed>
    ) : (
      <Skeleton height={220} />
    );

  const body = (): ReactNode => {
    if (!propertyId && NEEDS_PROPERTY.has(step.key)) {
      return (
        <>
          <EmptyState className="flex flex-wrap items-center justify-between gap-3 p-5">
            <span>This step works on the property, and there is none yet.</span>
            <Button variant="secondary" size="sm" onClick={() => toStep("property")}>
              Add the property
            </Button>
          </EmptyState>
          {footer}
        </>
      );
    }
    const id = propertyId as string;
    const wsId = workspaceId as string;
    switch (step.key) {
      case "property":
        return propertyId ? (
          waitForDetail((pr) => (
            <ProfileStep
              key={pr.id}
              workspaceId={wsId}
              property={pr}
              domain={p.domain}
              accommodationClass={p.accommodationClass}
              onBack={onBack}
              onDone={onSaved}
            />
          ))
        ) : (
          <>
            <CreatePropertyForm workspaceId={wsId} />
            {footer}
          </>
        );
      case "contact":
        return waitForDetail((pr) => (
          <ContactStep
            key={pr.id}
            workspaceId={wsId}
            property={pr}
            residence={residence}
            onBack={onBack}
            onDone={onSaved}
          />
        ));
      case "departments":
        return (
          <>
            <Departments />
            {footer}
          </>
        );
      case "room_types":
        return (
          <>
            <RoomTypesSection workspaceId={wsId} propertyId={id} />
            {footer}
          </>
        );
      case "rooms":
        return (
          <>
            <RoomsStep workspaceId={wsId} propertyId={id} words={words} onAddTypes={() => toStep("room_types")} />
            {footer}
          </>
        );
      case "photos":
        return (
          <>
            {waitForDetail((pr) => (
              <PropertyPhotos workspaceId={wsId} propertyId={pr.id} propertyName={pr.name} photos={pr.photos} />
            ))}
            {footer}
          </>
        );
      case "amenities":
        return (
          <>
            <Offer />
            {footer}
          </>
        );
      case "outlets":
        return (
          <>
            <Outlets />
            {footer}
          </>
        );
      case "staff":
        return (
          <>
            <Invites landlord={residence} />
            {footer}
          </>
        );
      case "listing":
        return (
          <>
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-foreground">
                {published
                  ? "Your listing is live. See it as guests do, and what is still worth finishing."
                  : "Check the listing as guests will see it, then publish. You can unpublish at any time."}
              </p>
              <Button variant="primary" onClick={() => go({ view: "publish" })}>
                {published ? "See the listing" : "Preview and publish"}
              </Button>
            </div>
            {footer}
          </>
        );
    }
  };

  const kind = residence
    ? "Residential property"
    : ACCOMMODATION_CLASS_LABEL[currentAccommodationClass(p.accommodationClass)];
  const place = summary
    ? [summary.address.sectorName, summary.address.districtName].filter(Boolean).join(", ")
    : null;
  const properties = list.data?.properties ?? [];

  return (
    <div className="pms-enter flex flex-col gap-5" data-screen="setup" data-view={view}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-foreground">{p.propertyName ?? p.legalName}</p>
          <p className="text-sm text-muted-foreground">
            {propertyId ? [kind, place].filter(Boolean).join(" · ") : `${kind} · no property yet`}
          </p>
        </div>
        {summary && (
          <PropertyPicker
            properties={properties}
            current={summary}
            onSelect={(id) => go({ property: id, step: null, view: null })}
          />
        )}
      </div>

      <Journey
        requiredDone={req.done}
        requiredTotal={req.total}
        published={published}
        openDone={firstWeek.filter((t) => t.done).length}
        openTotal={firstWeek.length}
      />

      {view === "setup" && !published && req.done < req.total && (
        <div role="note" className="flex items-start gap-3 rounded-card bg-success-soft px-4 py-3.5 text-success-soft-foreground">
          <PartyPopper aria-hidden="true" className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">Approved and activated</span>
            <span className="text-sm">
              Approval opened your workspace. Finish the {req.total} required steps, then publish your listing.
            </span>
          </div>
        </div>
      )}

      {view === "setup" && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)]">
          <StepRail steps={steps} current={current} onSelect={(i) => toStep(steps[i].key)} />
          <section
            aria-labelledby={headingId}
            data-step={step.key}
            // On a phone the step comes first: the journey above already says how
            // far along it is, and ten rail rows would push the form off screen.
            className="order-first flex min-w-0 flex-col gap-4 rounded-card border border-panel-bd bg-card p-5 sm:p-6 lg:order-none"
          >
            <div className="flex flex-col gap-1">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted-foreground">
                <span className="pms-num">
                  Step {current + 1} of {steps.length} · {stepNeed(step, isLast)}
                </span>
                {step.done && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs text-success-soft-foreground">
                    <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                    Done
                  </span>
                )}
              </span>
              <h2
                id={headingId}
                ref={headingRef}
                tabIndex={-1}
                className="text-xl font-bold text-foreground outline-none"
              >
                {step.title}
              </h2>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
            {body()}
          </section>
        </div>
      )}

      {view !== "setup" && (
        <Link
          href={view === "open" ? hrefWith({ view: "publish" }) : hrefWith({ view: null })}
          scroll={false}
          className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent-text underline-offset-2 hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={2} />
          {view === "open" ? "Back to the listing" : "Back to set-up"}
        </Link>
      )}

      {view !== "setup" && (
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className="sr-only">
          {view === "publish" ? "Preview and publish" : "Open for business"}
        </h2>
      )}

      {view === "publish" &&
        (property ? (
          <PreviewPublish
            workspaceId={workspaceId as string}
            property={property}
            steps={steps}
            words={words}
            domain={p.domain}
            accommodationClass={p.accommodationClass}
            fixHref={(key) => hrefWith({ view: null, step: key })}
            onPublished={() => go({ view: "open" })}
            onOpenTasks={() => go({ view: "open" })}
          />
        ) : propertyId ? (
          waitForDetail(() => null)
        ) : (
          <EmptyState className="p-6">
            There is no property to publish yet.{" "}
            <Link href={hrefWith({ view: null, step: "property" })} className="font-semibold text-accent-text">
              Add it first
            </Link>
            .
          </EmptyState>
        ))}

      {view === "open" && (
        <OpenForBusiness
          name={p.propertyName ?? p.legalName}
          residence={residence}
          tasks={firstWeek}
          homeHref={workspaceHome(state.ws, workspaceId)}
        />
      )}
    </div>
  );
}
