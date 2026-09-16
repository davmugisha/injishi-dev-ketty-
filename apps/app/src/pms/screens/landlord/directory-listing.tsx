"use client";

/**
 * Listing — whether guests can find each of the landlord's buildings, on real
 * data (2026-09-15).
 *
 * **This screen used to read the demo store.** It drew invented units, counted
 * invented broker reveals, and its switch changed a reducer and nothing else, so
 * a landlord who "listed" a flat here had listed it nowhere. The real publishing
 * control already existed under Units & rents (`ListingPanel`, which commands
 * `POST /inventory/properties/:id/publish` and `/unpublish`), so this screen now
 * renders that same control for every property the business holds rather than a
 * second one. Two controls for one fact would be two answers the day they drift.
 *
 * Publishing is per BUILDING, not per unit, because that is what the API
 * publishes: a property and the unit types under it. A per unit broker directory
 * has no table or route behind it; it is not offered here rather than faked.
 *
 * The address stays `/listing` so a bookmark still opens something true.
 */

import Link from "next/link";

import { EmptyState, LoadFailed, Skeleton } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useProperties } from "../../data/ops";
import { workspaceBase } from "../../lib/nav";
import { ListingPanel } from "../listing-panel";

export function DirectoryListing() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const list = useProperties(can("listing.manage") ? workspaceId : null);
  const units = `${workspaceBase(workspaceId)}/units`;

  // Refused before the request, because the server refuses it too: every
  // inventory route declares `listing.manage`.
  if (!can("listing.manage")) {
    return <EmptyState className="p-6 text-sm">{reasonFor("listing.manage")}</EmptyState>;
  }

  if (!workspaceId) {
    return (
      <EmptyState className="p-6 text-sm">
        Open a business to see its listings.
      </EmptyState>
    );
  }

  if (list.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={120} delay={60} />
      </div>
    );
  }

  if (list.isError) {
    /* Unreachable is not unlisted. Told "nothing is published", a landlord
       would think their building had been taken down. */
    return (
      <LoadFailed onRetry={() => void list.refetch()} retrying={list.isFetching}>
        We couldn&apos;t load your buildings. Your listings are untouched — this is on our
        side.
      </LoadFailed>
    );
  }

  const properties = list.data.properties;

  return (
    <div className="pms-enter flex flex-col gap-4" data-screen="listing">
      <p className="text-xs text-muted-foreground">
        A published building can be found by anyone on the Injishi marketplace. Its units, rents and
        photos are set up under{" "}
        <Link href={units} className="font-semibold text-ink underline underline-offset-2">
          Units &amp; rents
        </Link>
        ; if a publish is refused, the reasons listed tell you what to add there first.
      </p>

      {properties.length === 0 ? (
        <EmptyState className="p-6 text-sm">
          No building on this business yet. Add one under{" "}
          <Link href={units} className="font-semibold underline underline-offset-2">
            Units &amp; rents
          </Link>{" "}
          and publish it here.
        </EmptyState>
      ) : (
        properties.map((property) => (
          <ListingPanel key={property.id} workspaceId={workspaceId} property={property} />
        ))
      )}
    </div>
  );
}
