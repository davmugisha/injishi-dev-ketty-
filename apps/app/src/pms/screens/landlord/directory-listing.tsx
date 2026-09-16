"use client";

/**
 * Listing — whether guests can find each of the landlord's buildings, and which
 * units in them are free, on real data (2026-09-15).
 *
 * **This screen used to read the demo store.** It drew invented units, counted
 * invented broker reveals, and its switch changed a reducer and nothing else, so
 * a landlord who "listed" a flat here had listed it nowhere. The real publishing
 * control already existed under Units & rents (`ListingPanel`, which commands
 * `POST /inventory/properties/:id/publish` and `/unpublish`), so this screen
 * renders that same control for every property the business holds rather than a
 * second one. Two controls for one fact would be two answers the day they drift.
 *
 * Publishing is per BUILDING, not per unit, because that is what the API
 * publishes: a property and the unit types under it. A per unit broker directory
 * has no table or route behind it; it is not offered here rather than faked.
 *
 * Under each building, its units and whether each is free. Occupancy is derived
 * from `GET /ops/leases`, never stored: a unit is occupied while an active or
 * ending lease holds it and being signed while a draft or unsigned one does, so
 * it stops reading vacant the day its lease activates.
 *
 * The address stays `/listing` so a bookmark still opens something true.
 */

import type { OperatorLease, OperatorPropertySummary, OperatorRoom } from "@injishi/contracts";
import { Card } from "@injishi/ui";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { Badge, EmptyState, LoadFailed, Skeleton, StatCard, surfaceClass } from "../../components/ui";
import { useCapability, useWorkspaceId } from "../../data/capability";
import { useRoomTypes } from "../../data/inventory";
import { useLeases, useProperties, useRooms } from "../../data/ops";
import { fmt } from "../../lib/format";
import { workspaceBase } from "../../lib/nav";
import { ListingPanel } from "../listing-panel";

/** Occupied while a lease is live on the unit; pending while one is being signed. */
function occupancy(roomId: string, leases: readonly OperatorLease[]) {
  const live = leases.find((l) => l.roomId === roomId && (l.status === "active" || l.status === "ending"));
  if (live) return { kind: "occupied" as const, lease: live };
  const pending = leases.find(
    (l) => l.roomId === roomId && (l.status === "draft" || l.status === "pending_signature"),
  );
  if (pending) return { kind: "pending" as const, lease: pending };
  return { kind: "vacant" as const, lease: null };
}

export function DirectoryListing() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const mayList = can("listing.manage");
  const list = useProperties(mayList ? workspaceId : null);
  const rooms = useRooms(mayList ? workspaceId : null);
  const leases = useLeases(mayList ? workspaceId : null);
  const units = `${workspaceBase(workspaceId)}/units`;

  // Refused before the request, because the server refuses it too: every
  // inventory route declares `listing.manage`.
  if (!mayList) {
    return <EmptyState className="p-6 text-sm">{reasonFor("listing.manage")}</EmptyState>;
  }

  if (!workspaceId) {
    return <EmptyState className="p-6 text-sm">Open a business to see its listings.</EmptyState>;
  }

  const failed = [list, rooms, leases].find((q) => q.isError);
  if (failed) {
    /* Unreachable is not unlisted. Told "nothing is published", a landlord
       would think their building had been taken down. */
    return (
      <LoadFailed onRetry={() => void failed.refetch()} retrying={failed.isFetching}>
        We couldn&apos;t load your buildings. Your listings are untouched — this is on our
        side.
      </LoadFailed>
    );
  }

  if (list.isPending || rooms.isPending || leases.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={120} delay={60} />
      </div>
    );
  }

  const properties = (list.data?.properties ?? []).filter((p) => p.archivedAt === null);
  const allRooms = rooms.data?.rooms ?? [];
  const allLeases = leases.data?.leases ?? [];
  const vacant = allRooms.filter((r) => occupancy(r.id, allLeases).kind === "vacant");
  const published = properties.filter((p) => p.listingStatus === "published");

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
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard n={`${published.length} of ${properties.length}`} label="Buildings on the marketplace" />
            <StatCard n={String(vacant.length)} label="Vacant units" />
            <StatCard n={String(allRooms.length - vacant.length)} label="Let or being signed" />
          </div>
          {properties.map((property) => (
            <BuildingUnits
              key={property.id}
              workspaceId={workspaceId}
              property={property}
              rooms={allRooms}
              leases={allLeases}
            />
          ))}
        </>
      )}
    </div>
  );
}

function BuildingUnits({
  workspaceId,
  property,
  rooms,
  leases,
}: {
  workspaceId: string;
  property: OperatorPropertySummary;
  rooms: readonly OperatorRoom[];
  leases: readonly OperatorLease[];
}) {
  const types = useRoomTypes(workspaceId, property.id);
  const typeList = types.data?.roomTypes ?? [];
  const units = rooms.filter((r) => typeList.some((t) => t.id === r.roomTypeId));

  return (
    <section className="flex flex-col gap-3">
      <ListingPanel workspaceId={workspaceId} property={property} />

      {types.isPending ? (
        <Skeleton height={120} />
      ) : types.isError ? (
        <LoadFailed onRetry={() => void types.refetch()} retrying={types.isFetching}>
          We couldn&apos;t load the units in {property.name}.
        </LoadFailed>
      ) : units.length === 0 ? (
        <EmptyState>No units in {property.name} yet.</EmptyState>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
          {units.map((u) => {
            const type = typeList.find((t) => t.id === u.roomTypeId);
            const state = occupancy(u.id, leases);
            const rent = state.lease?.monthlyRentRwf ?? type?.basePriceRwf ?? null;
            return (
              <Card
                key={u.id}
                className={cn(
                  surfaceClass,
                  "gap-0 px-[17px] py-4 shadow-none",
                  state.kind === "vacant" && "border-accent-text",
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span className="pms-num text-base font-bold text-ink">{u.label ?? "Unnumbered"}</span>
                  <span className="text-xs text-muted-foreground">{u.roomTypeName}</span>
                </div>
                <div className="pms-num mt-1.5 text-base font-bold tracking-[-0.2px] text-ink">
                  {rent === null ? "No rent set" : fmt(rent)}
                  {rent !== null && <span className="text-2xs font-medium text-muted-foreground"> / month</span>}
                </div>
                <div className="mt-2.5">
                  {state.kind === "occupied" ? (
                    <Badge intent="neutral">
                      {state.lease.status === "ending" ? "On notice" : "Occupied"} ·{" "}
                      {state.lease.tenantName ?? "Tenant"}
                    </Badge>
                  ) : state.kind === "pending" ? (
                    <Badge intent="info">Lease being signed · {state.lease.tenantName ?? "Tenant"}</Badge>
                  ) : (
                    <Badge intent="warn">Vacant</Badge>
                  )}
                </div>
                <div className="mt-3 border-t border-line pt-3 text-2xs text-muted-foreground">
                  {state.kind !== "vacant"
                    ? "Not offered while a lease holds it."
                    : property.listingStatus === "published"
                      ? "On the marketplace as available."
                      : "Free, but this building is not published yet."}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
