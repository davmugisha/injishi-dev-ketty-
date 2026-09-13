"use client";

/**
 * The property's listing: what it is, whether guests can find it, and the one
 * control that changes that (ADR-049, AC-I4 to AC-I6).
 *
 * **A refused publish lists EVERY reason, in words.** The API refuses with a
 * code list and a sentence for the first code. An operator shown only the first
 * fixes it, presses Publish again and is refused for the next one, which is the
 * loop the list exists to stop. Each reason is the contract's own sentence
 * (`PUBLISH_BLOCKER_LABEL`), never a code or a column.
 *
 * **Unpublishing keeps the address.** The slug minted at the first publish
 * survives, so a republished property is found at every link that already points
 * at it (AC-I6). The screen says so, because "unpublish" otherwise reads like
 * giving the address up.
 *
 * `data-listing-acts` counts settled publish and unpublish presses. It is there
 * for a verifying browser, which cannot otherwise tell a fresh refusal from the
 * same words left over from the previous press.
 */

import type { OperatorProperty, OperatorPropertySummary } from "@injishi/contracts";
import { useState } from "react";
import { cn } from "@/lib/utils";

import { ActionButton, Badge, surfaceClass } from "../components/ui";
import { humanError } from "../data/api";
import { publishBlockers, useSetListing } from "../data/inventory";
import { usePms } from "../store";

type Refusal = { lead: string; reasons: string[] };

export function ListingPanel({
  workspaceId,
  property,
}: {
  workspaceId: string;
  property: OperatorProperty | OperatorPropertySummary;
}) {
  const { toast } = usePms();
  const setListing = useSetListing(workspaceId, property.id);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [acts, setActs] = useState(0);
  const published = property.listingStatus === "published";

  const act = (next: "publish" | "unpublish") => {
    setRefusal(null);
    setListing.mutate(next, {
      onSuccess: (saved) => {
        toast(
          next === "publish"
            ? `${saved.name} is published. Guests can find it at /property/${saved.slug ?? ""}.`
            : `${saved.name} is unpublished. Its address is kept for when you publish again.`,
          "ok",
        );
      },
      onError: (error) => {
        const reasons = publishBlockers(error);
        setRefusal(
          reasons.length > 0
            ? { lead: "This property can't be published yet:", reasons }
            : { lead: humanError(error), reasons: [] },
        );
      },
      onSettled: () => setActs((n) => n + 1),
    });
  };

  const address = [
    property.address.sectorName,
    property.address.districtName,
    property.address.provinceName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      data-section="listing"
      data-listing-acts={acts}
      className={cn(surfaceClass, "flex flex-col gap-3 px-4 py-3.5")}
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* A full row on a phone, so a long name wraps across the card rather
            than into a column beside the badge and counts. */}
        <span className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <span data-property-heading className="block text-base font-bold text-foreground">
            {property.name}
          </span>
          <span className="block text-xs text-muted-foreground">{address || "No address yet"}</span>
        </span>
        <Badge intent={published ? "ok" : "warn"}>{published ? "Published" : "Draft"}</Badge>
        <span className="pms-num text-xs text-muted-foreground">
          {property.roomTypeCount} room types · {property.sellableRoomCount} sellable rooms
        </span>
        {published ? (
          <ActionButton onClick={() => act("unpublish")} pending={setListing.isPending}>
            Unpublish
          </ActionButton>
        ) : (
          <ActionButton
            variant="primary"
            onClick={() => act("publish")}
            pending={setListing.isPending}
          >
            Publish
          </ActionButton>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {published ? (
          <>
            Guests can find it at{" "}
            <a
              href={`/property/${property.slug ?? ""}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ink underline underline-offset-2"
            >
              /property/{property.slug}
            </a>
            . Unpublishing hides it and keeps this address for when you publish again.
          </>
        ) : property.slug ? (
          <>Not visible to guests. Publishing again restores /property/{property.slug}.</>
        ) : (
          <>Not visible to guests. Publishing gives it an address guests can open.</>
        )}
      </p>

      {refusal && (
        <div role="alert" className="rounded border border-line2 bg-field px-3 py-2.5 text-sm text-foreground">
          <p className="font-semibold">{refusal.lead}</p>
          {refusal.reasons.length > 0 && (
            <ul className="mt-1.5 list-disc pl-5">
              {refusal.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
