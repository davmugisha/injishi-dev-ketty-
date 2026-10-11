"use client";

/**
 * "Preview and publish": the listing as guests will see it, what still stops it
 * going live in plain words with a Fix beside each, and the one Publish listing
 * (Onboarding board).
 *
 * EVERYTHING ON THE PREVIEW IS THE DATABASE'S. The name, the class, the place,
 * the cheapest price, the photographs in the owner's order and the amenities
 * offered are read back from the property; where one is missing the preview
 * says so ("No photo yet", a dash for the price) rather than drawing a guess.
 *
 * THE BLOCKERS ARE THE CHECKLIST'S. Each unfinished REQUIRED step is one line
 * (`blockersFor`), because the contract makes required steps the gate on going
 * live, plus a missing sector, the one publish condition no step covers. The
 * button is refused while any remains; the API checks its own conditions again
 * on the press (`POST /inventory/properties/:id/publish`), and a refusal it
 * gives anyway is shown in its own words.
 */

import {
  ACCOMMODATION_CLASS_LABEL,
  currentAccommodationClass,
  PUBLISH_BLOCKER_LABEL,
  type OperatorProperty,
  type SetupStepKey,
  type SetupVocabulary,
} from "@injishi/contracts";
import { Button } from "@injishi/ui";
import { ExternalLink, ImageOff, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { humanError } from "../../data/api";
import { publishBlockers, useSetListing } from "../../data/inventory";
import { useAmenities } from "../../data/ops";
import { fmt } from "../../lib/format";
import { usePms } from "../../store";
import { blockersFor, lowestPrice, perPeriod, publishTitle, type PlanStep } from "./setup-plan";

const PHOTO_SLOTS = 5;

export function PreviewPublish({
  workspaceId,
  property,
  steps,
  words,
  domain,
  accommodationClass,
  fixHref,
  onPublished,
  onOpenTasks,
}: {
  workspaceId: string;
  property: OperatorProperty;
  steps: readonly PlanStep[];
  words: SetupVocabulary;
  domain: "hospitality" | "residence";
  accommodationClass: string | null;
  /** The address of the step that fixes a blocker: a real link, so it opens anywhere. */
  fixHref: (step: SetupStepKey) => string;
  onPublished: () => void;
  onOpenTasks: () => void;
}) {
  const { toast } = usePms();
  const publish = useSetListing(workspaceId, property.id);
  const amenities = useAmenities(workspaceId, property.id);
  const [refusal, setRefusal] = useState<{ lead: string; reasons: string[] } | null>(null);

  const live = property.listingStatus === "published";
  const blockers = blockersFor({
    steps,
    words,
    sectorMissing: property.address.sectorId === null,
    sectorText: PUBLISH_BLOCKER_LABEL.missing_sector,
  });

  const photos = [...property.photos].sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.position - b.position);
  const price = lowestPrice(property.roomTypes);
  const kind =
    domain === "residence" ? "Residential property" : ACCOMMODATION_CLASS_LABEL[currentAccommodationClass(accommodationClass)];
  const place = [property.address.sectorName, property.address.districtName].filter(Boolean).join(", ");
  const offered = (amenities.data?.amenities ?? []).filter((a) => a.offered).slice(0, 8);

  const press = () => {
    if (blockers.length > 0 || live) return;
    setRefusal(null);
    publish.mutate("publish", {
      onSuccess: (saved) => {
        toast(`${saved.name} is live on Injishi.`, "ok");
        onPublished();
      },
      onError: (err) => {
        const reasons = publishBlockers(err);
        setRefusal(
          reasons.length > 0
            ? { lead: "The listing could not go live yet:", reasons }
            : { lead: humanError(err), reasons: [] },
        );
      },
    });
  };

  const tile = (index: number, big = false) => {
    const photo = photos[index];
    return (
      <div
        key={index}
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded bg-default text-xs font-semibold text-muted-foreground",
          big && "row-span-2",
        )}
      >
        {photo ? (
          // A short lived signed read; the image optimiser would cache an expiring URL.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={index === 0 ? `${property.name}, cover photo` : `${property.name}, photo ${index + 1}`}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <span className="flex items-center gap-1.5">
            {index === 0 && <ImageOff aria-hidden="true" className="size-4" strokeWidth={1.8} />}
            {index === 0 ? "No photo yet" : `Photo ${index + 1}`}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(17rem,1fr)]">
      <section aria-label="Listing preview" className="flex min-w-0 flex-col gap-3.5 rounded-card border border-panel-bd bg-card p-5">
        <span className="text-sm font-semibold text-muted-foreground">How guests see it on Injishi</span>
        <div className="grid h-56 grid-cols-[2fr_1fr_1fr] grid-rows-2 gap-2" aria-label={`${photos.length} photo${photos.length === 1 ? "" : "s"}`}>
          {tile(0, true)}
          {Array.from({ length: PHOTO_SLOTS - 1 }, (_, i) => tile(i + 1))}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground">{property.name}</h2>
            <p className="text-sm text-muted-foreground">
              {[kind, place || null, live ? null : "New on Injishi"].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="pms-num sm:text-right">
            <div className="text-xs text-muted-foreground">From</div>
            <div className="text-lg font-bold text-foreground">{price === null ? "—" : fmt(price)}</div>
            <div className="text-xs text-muted-foreground">{perPeriod(words.pricePeriod)}</div>
          </div>
        </div>
        <p className={cn("text-sm", property.description ? "text-foreground" : "text-muted-foreground")}>
          {property.description?.trim() || "A few lines about the property appear here."}
        </p>
        {offered.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Amenities">
            {offered.map((a) => (
              <li key={a.code} className="rounded-full bg-default px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {a.label}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="publish-title" className="flex min-w-0 flex-col gap-3.5 rounded-card border border-panel-bd bg-card p-5">
        {live ? (
          <>
            <span className="self-start rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-soft-foreground">
              Live on Injishi
            </span>
            <h2 id="publish-title" className="text-lg font-semibold text-foreground">
              Guests can book it now
            </h2>
            {property.slug && (
              <a
                href={`/property/${property.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-text underline-offset-2 hover:underline"
              >
                /property/{property.slug}
                <ExternalLink aria-hidden="true" className="size-3.5" strokeWidth={2} />
              </a>
            )}
            {blockers.length > 0 && (
              <>
                <p className="text-sm text-muted-foreground">Still to finish, so guests get the whole picture:</p>
                <BlockerList blockers={blockers} fixHref={fixHref} />
              </>
            )}
            <p className="text-xs text-muted-foreground">
              To take it off the marketplace, unpublish it from Inventory. Its address is kept for when you publish
              again.
            </p>
            <Button variant="primary" onClick={onOpenTasks} className="self-start">
              Your first week
            </Button>
          </>
        ) : (
          <>
            <h2 id="publish-title" className="text-lg font-semibold text-foreground">
              {publishTitle(blockers.length)}
            </h2>
            {blockers.length > 0 ? (
              <BlockerList blockers={blockers} fixHref={fixHref} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Everything guests need is in place. Publishing makes the property bookable on the Injishi marketplace
                straight away. You can unpublish at any time.
              </p>
            )}
            {refusal && (
              <div role="alert" className="rounded bg-danger-soft px-3 py-2.5 text-sm text-danger-soft-foreground">
                <p className="font-semibold">{refusal.lead}</p>
                {refusal.reasons.length > 0 && (
                  <ul className="mt-1 list-disc pl-5">
                    {refusal.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <Button
              variant="primary"
              onClick={press}
              pending={publish.isPending}
              aria-disabled={blockers.length > 0 || undefined}
              aria-describedby={blockers.length > 0 ? "publish-title" : undefined}
              className={cn("self-start", blockers.length > 0 && "cursor-not-allowed opacity-50")}
            >
              Publish listing
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

function BlockerList({
  blockers,
  fixHref,
}: {
  blockers: ReturnType<typeof blockersFor>;
  fixHref: (step: SetupStepKey) => string;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {blockers.map((b) => (
        <li key={b.key} className="flex items-center gap-2.5 text-sm text-foreground">
          <span aria-hidden="true" className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-soft-foreground">
            <X className="size-3.5" strokeWidth={2.5} />
          </span>
          <span className="min-w-0 flex-1">{b.text}</span>
          {b.step && (
            <Button asChild variant="secondary" size="sm">
              <Link href={fixHref(b.step)} scroll={false}>
                Fix<span className="sr-only">: {b.text}</span>
              </Link>
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
