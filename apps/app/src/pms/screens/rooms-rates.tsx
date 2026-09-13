"use client";

/**
 * Room types (F-P01): the property in view, set up end to end (ADR-053).
 *
 * **On real data** (ADR-035, D-f wave 2), and since ADR-053 **writable**. An
 * owner used to be able to create a property here and then do nothing with it:
 * every inventory write existed on the API and none had a control. This screen
 * is now where a property becomes sellable, in the order publishing asks for it:
 *
 *   1. The listing: status, the public address, and Publish or Unpublish, with
 *      every reason a publish is refused, in words.
 *   2. Photographs: add, order, choose the cover, remove.
 *   3. Room types: add, edit, archive, restore. Each seeds its default rate plan;
 *      the other terms it sells on are the Rate plans lens.
 *
 * **INVENTORY IS SETUP, AND IT IS GATED DIFFERENTLY.** Every inventory route
 * declares `listing.manage`, which a receptionist and a housekeeper do not hold.
 * That is a different question from `/ops/*`, which is today's work.
 *
 * **Which property is in view lives in the URL** (`usePropertyInView`), so the
 * lenses agree on it and a copied link opens on the same property.
 */

import { EmptyState, LoadFailed, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useProperty } from "../data/ops";
import { CreatePropertyForm } from "./create-property-form";
import { PropertyPicker, usePropertyInView } from "./inventory-property";
import { ListingPanel } from "./listing-panel";
import { PropertyPhotos } from "./property-photos";
import { RoomTypesSection } from "./room-types-section";

export function RoomsRates() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const { list, properties, current, select } = usePropertyInView(workspaceId);
  const detail = useProperty(workspaceId, current?.id ?? null);

  /*
   * Refused before the request, because the server refuses it too. The nav
   * already keeps a receptionist off Inventory; this is the second answer for
   * somebody who arrives by bookmark, and it names the cause.
   */
  if (!can("listing.manage")) {
    return <EmptyState className="p-6 text-sm">{reasonFor("listing.manage")}</EmptyState>;
  }

  if (list.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={260} delay={60} />
      </div>
    );
  }

  if (list.isError) {
    /* An unreachable API is not a business with no property. Told that, an
       owner would think their listing had been taken down. */
    return (
      <LoadFailed onRetry={() => void list.refetch()} retrying={list.isFetching}>
        We couldn&apos;t load your properties. Your listing is untouched — this is on our
        side, not an empty portfolio.
      </LoadFailed>
    );
  }

  if (!current || !workspaceId) {
    if (!workspaceId) {
      return (
        <EmptyState className="p-6 text-sm">
          No property on this business yet. Inventory begins with one.
        </EmptyState>
      );
    }
    return <CreatePropertyForm workspaceId={workspaceId} />;
  }

  return (
    <div className="pms-enter flex flex-col gap-5">
      <PropertyPicker properties={properties} current={current} onSelect={select} />

      <ListingPanel workspaceId={workspaceId} property={detail.data ?? current} />

      {detail.isPending && <Skeleton height={200} />}
      {detail.isError && (
        <LoadFailed onRetry={() => void detail.refetch()} retrying={detail.isFetching}>
          We couldn&apos;t load this property&apos;s photographs. They are all still there —
          this is on our side.
        </LoadFailed>
      )}
      {detail.data && (
        <PropertyPhotos
          workspaceId={workspaceId}
          propertyId={current.id}
          propertyName={current.name}
          photos={detail.data.photos}
        />
      )}

      <RoomTypesSection workspaceId={workspaceId} propertyId={current.id} />

      <p className="text-xs text-muted-foreground">
        A room type is what the guest gets. A rate plan is the terms it sells on; the price
        set here seeds its default plan, and the rest lives under Rate plans.
      </p>
    </div>
  );
}
