"use client";

/**
 * Set a branch up and publish it: one focused drawer, one step at a time.
 *
 * WHY A DRAWER, AND WHY STEPS. Getting a branch onto the marketplace first took
 * three tabs (Branches, then Inventory, then Publish). The first fix stacked
 * all three Inventory sections inside the branch's row, which kept everything
 * on one tab but read as a long, boxed-in page that repeated the branch's name
 * and badge and never said what to do next. This replaces it with a side
 * sheet: the branch list stays where it was, the work happens in front of it,
 * and the sheet asks for one thing at a time — rooms and prices, then photos,
 * then a look at what guests will see before the Publish press — with Back and
 * Continue at the bottom and a progress bar that ticks itself.
 *
 * Nothing in it is new behaviour. The rooms and photos steps are the same
 * components the Inventory tab renders, against the same queries, so the two
 * screens cannot disagree, and the publish rules are still the server's (a
 * priced room type and a photograph); a refusal lists every reason it gives.
 */

import type { OperatorProperty, OperatorPropertySummary } from "@injishi/contracts";
import { NativeDialog } from "@injishi/ui";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

import { ActionButton, LoadFailed, Skeleton } from "../components/ui";
import { Icon } from "../components/icon";
import { humanError } from "../data/api";
import { publishBlockers, useSetListing } from "../data/inventory";
import { useProperty } from "../data/ops";
import { usePms } from "../store";
import { ListingPanel } from "./listing-panel";
import { PropertyPhotos } from "./property-photos";
import { RoomTypesSection } from "./room-types-section";

type StepKey = "rooms" | "photos" | "review";

const STEPS: { key: StepKey; title: string; icon: "bed-double" | "camera" | "eye" }[] = [
  { key: "rooms", title: "Rooms and prices", icon: "bed-double" },
  { key: "photos", title: "Photos", icon: "camera" },
  { key: "review", title: "Review and publish", icon: "eye" },
];

/** What each step needs before Publish will be accepted. */
function readiness(property: OperatorProperty) {
  const active = property.roomTypes.filter((rt) => rt.status === "active");
  const priced = active.filter((rt) => rt.basePriceRwf !== null && rt.basePriceRwf > 0);
  return {
    rooms: priced.length > 0,
    photos: property.photos.length > 0,
    review: property.listingStatus === "published",
    fromPrice: priced.length ? Math.min(...priced.map((rt) => rt.basePriceRwf as number)) : null,
    roomTypeCount: active.length,
    sellableRooms: active.reduce((n, rt) => n + rt.sellableRoomCount, 0),
  };
}

export function BranchSetupDrawer({
  workspaceId,
  branch,
  onClose,
}: {
  workspaceId: string;
  branch: OperatorPropertySummary;
  onClose: () => void;
}) {
  const detail = useProperty(workspaceId, branch.id);
  const [step, setStep] = useState<StepKey | null>(null);

  // Open on the first step still to do, once, when the branch has loaded.
  useEffect(() => {
    if (step !== null || !detail.data) return;
    const ready = readiness(detail.data);
    setStep(!ready.rooms ? "rooms" : !ready.photos ? "photos" : "review");
  }, [detail.data, step]);

  const property = detail.data;
  const ready = property ? readiness(property) : null;
  const index = STEPS.findIndex((s) => s.key === step);
  const address = placeLine(branch.address.sectorName, branch.address.districtName);

  return (
    <NativeDialog
      open
      onClose={onClose}
      ariaLabel={`Set up ${branch.name}`}
      className={cn(
        // A side sheet: full height at the right edge, the whole screen on a phone.
        "fixed inset-y-0 right-0 m-0 ml-auto flex h-dvh max-h-none w-full max-w-none flex-col rounded-none sm:max-w-read sm:rounded-l-card",
      )}
    >
      {/* Header: which branch, and where it is in the three steps. */}
      <header className="flex flex-col gap-4 border-b border-line2 px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-2xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {ready?.review ? "Branch on the marketplace" : "Set up branch"}
            </span>
            <span className="truncate text-lg font-bold text-foreground">{branch.name}</span>
            {address ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon name="map-pin" size={12} />
                {address}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-field hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <ol className="grid grid-cols-3 gap-2" aria-label="Setup steps">
          {STEPS.map((s, i) => {
            const done = ready ? ready[s.key] : false;
            const current = s.key === step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setStep(s.key)}
                  aria-current={current ? "step" : undefined}
                  className="group flex w-full flex-col gap-1.5 text-left focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "h-1.5 w-full rounded-full transition-colors",
                      done ? "bg-primary" : current ? "bg-primary/40" : "bg-line2",
                    )}
                  />
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-semibold",
                      current ? "text-foreground" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    {done ? <Icon name="check" size={12} /> : <span className="tabular-nums">{i + 1}.</span>}
                    <span className="truncate">{s.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </header>

      {/* Body: one step at a time. */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {detail.isPending || step === null ? (
          <Skeleton height={260} />
        ) : detail.isError || !property || !ready ? (
          <LoadFailed onRetry={() => void detail.refetch()} retrying={detail.isFetching}>
            We couldn&apos;t load {branch.name}&apos;s setup. Nothing is lost — this is on our side.
          </LoadFailed>
        ) : step === "rooms" ? (
          <StepIntro
            title="What can guests book?"
            body="Add each kind of room with its price per person, per night, and how many of them you have."
          >
            <RoomTypesSection workspaceId={workspaceId} propertyId={branch.id} />
          </StepIntro>
        ) : step === "photos" ? (
          <StepIntro
            title="Show guests the place"
            body="Bright, wide photos sell rooms. The first one becomes the cover guests see in search."
          >
            <PropertyPhotos
              workspaceId={workspaceId}
              propertyId={branch.id}
              propertyName={property.name}
              photos={property.photos}
            />
          </StepIntro>
        ) : (
          <ReviewStep workspaceId={workspaceId} property={property} ready={ready} onFix={setStep} />
        )}
      </div>

      {/* Footer: Back and Continue, the one decision each step asks for. */}
      {step !== null && ready && step !== "review" ? (
        <footer className="flex items-center justify-between gap-3 border-t border-line2 px-5 py-4">
          <span>
            {index > 0 ? (
              <ActionButton variant="secondary" onClick={() => setStep(STEPS[index - 1]!.key)}>
                Back
              </ActionButton>
            ) : null}
          </span>
          <div className="flex items-center gap-3">
            {!ready[step] ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {step === "rooms" ? "Add a priced room type to continue" : "Add a photo to continue"}
              </span>
            ) : null}
            <ActionButton
              variant={ready[step] ? "primary" : "secondary"}
              onClick={() => setStep(STEPS[index + 1]!.key)}
            >
              {ready[step] ? "Continue" : "Skip for now"}
            </ActionButton>
          </div>
        </footer>
      ) : null}
    </NativeDialog>
  );
}

/** "Remera, Gasabo"; a sector named after its district is said once ("Kicukiro"). */
function placeLine(sector: string | null | undefined, district: string | null | undefined): string {
  return [...new Set([sector, district].filter((part): part is string => Boolean(part)))].join(", ");
}

function StepIntro({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {children}
    </div>
  );
}

/** The last step: what guests will see, what is missing, and the Publish press. */
function ReviewStep({
  workspaceId,
  property,
  ready,
  onFix,
}: {
  workspaceId: string;
  property: OperatorProperty;
  ready: ReturnType<typeof readiness>;
  onFix: (step: StepKey) => void;
}) {
  const { toast } = usePms();
  const setListing = useSetListing(workspaceId, property.id);
  const [refusal, setRefusal] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const cover = property.photos.find((p) => p.isCover) ?? property.photos[0] ?? null;
  const link = property.slug ? `/property/${property.slug}` : null;

  const publish = () => {
    setRefusal(null);
    setProblem(null);
    setListing.mutate("publish", {
      onSuccess: (saved) => toast(`${saved.name} is live on the marketplace.`, "ok"),
      onError: (error) => {
        const reasons = publishBlockers(error);
        if (reasons.length > 0) setRefusal(reasons);
        else setProblem(humanError(error));
      },
    });
  };

  const copyLink = () => {
    if (!link) return;
    void navigator.clipboard
      .writeText(`${window.location.origin}${link}`)
      .then(() => toast("Link copied", "ok"))
      .catch(() => toast("Couldn't copy the link. Open it and copy it from the address bar.", "warn"));
  };

  const checks: { key: StepKey; label: string; ok: boolean }[] = [
    {
      key: "rooms",
      label: ready.rooms
        ? `${ready.roomTypeCount} room ${ready.roomTypeCount === 1 ? "type" : "types"}, ${ready.sellableRooms} ${ready.sellableRooms === 1 ? "room" : "rooms"} to sell`
        : "No priced room type yet",
      ok: ready.rooms,
    },
    {
      key: "photos",
      label: ready.photos
        ? `${property.photos.length} ${property.photos.length === 1 ? "photo" : "photos"}`
        : "No photo yet",
      ok: ready.photos,
    },
  ];
  const canPublish = ready.rooms && ready.photos;

  return (
    <div className="flex flex-col gap-5">
      {ready.review ? (
        <div className="flex flex-col items-center gap-2 rounded-card bg-field px-5 py-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Icon name="badge-check" size={24} />
          </span>
          <h2 className="text-lg font-bold text-foreground">{property.name} is live</h2>
          <p className="text-sm text-muted-foreground">
            Guests can find it in search and book it now. Change its rooms, prices or photos any time from here.
          </p>
        </div>
      ) : (
        <StepIntroHeader />
      )}

      {/* The guest's view: the card search will show. */}
      <figure className="overflow-hidden rounded-card border border-line2 bg-card">
        <div className="aspect-[16/9] bg-field">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- an uploaded photo from the API's photo route
            <img src={cover.url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Your cover photo appears here
            </span>
          )}
        </div>
        <figcaption className="flex flex-col gap-0.5 px-4 py-3">
          <span className="text-base font-bold text-foreground">{property.name}</span>
          <span className="text-xs text-muted-foreground">
            {placeLine(property.address.sectorName, property.address.districtName)}
          </span>
          <span className="mt-1 text-sm text-foreground">
            {ready.fromPrice !== null ? (
              <>
                From <b>RWF {ready.fromPrice.toLocaleString("en-US")}</b>{" "}
                <span className="text-muted-foreground">per person, per night</span>
              </>
            ) : (
              <span className="text-muted-foreground">No price yet</span>
            )}
          </span>
        </figcaption>
      </figure>

      {!ready.review ? (
        <ul className="flex flex-col gap-2">
          {checks.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    c.ok ? "bg-primary text-primary-foreground" : "border border-line2 text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {c.ok ? <Icon name="check" size={12} /> : null}
                </span>
                <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </span>
              {!c.ok ? (
                <button
                  type="button"
                  onClick={() => onFix(c.key)}
                  className="text-xs font-semibold text-foreground underline underline-offset-2"
                >
                  {c.key === "rooms" ? "Add rooms" : "Add a photo"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {refusal ? (
        <div role="alert" className="rounded border border-line2 bg-field px-3 py-2.5 text-sm text-foreground">
          <p className="font-semibold">This branch can&apos;t be published yet:</p>
          <ul className="mt-1.5 list-disc pl-5">
            {refusal.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm text-danger">
          {problem}
        </p>
      ) : null}

      {ready.review ? (
        <div className="flex flex-col gap-4">
          {link ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground no-underline"
              >
                <Icon name="globe" size={16} />
                View as a guest
              </a>
              <ActionButton variant="secondary" onClick={copyLink}>
                Copy link
              </ActionButton>
            </div>
          ) : null}
          {/* Unpublishing, with its own confirmation, stays available but quiet. */}
          <ListingPanel workspaceId={workspaceId} property={property} />
        </div>
      ) : (
        <ActionButton variant="primary" onClick={publish} pending={setListing.isPending} disabled={!canPublish}>
          {canPublish ? "Publish to the marketplace" : "Finish the steps above to publish"}
        </ActionButton>
      )}
    </div>
  );
}

function StepIntroHeader() {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base font-bold text-foreground">This is what guests will see</h2>
      <p className="text-sm text-muted-foreground">
        Check the card below. When you publish, it goes into search and guests can book it straight away.
      </p>
    </div>
  );
}
