"use client";

/**
 * Room types (F-P01) — the inventory the grid and the folio both run on.
 *
 * **On real data** (ADR-035, D-f wave 2). Reads
 * `GET /api/v1/inventory/properties` and then `GET /inventory/properties/:id`
 * for the room types on the property in view. The demo store is gone from this
 * screen (D-i).
 *
 * **INVENTORY IS SETUP, AND IT IS GATED DIFFERENTLY.** Every inventory route
 * declares `listing.manage` — the permission that says who may decide what this
 * business sells — which a receptionist and a housekeeper do not hold. That is
 * a different question from `/ops/*`, which is today's work, and the two are
 * kept apart on the server for that reason.
 *
 * **THE PROPERTY PICKER IS THE POINT OF THIS SCREEN, BEYOND ITSELF.** A
 * workspace can hold several properties and nothing on the grant says which one
 * is in view. That gap is what still blocks Amenities and department creation
 * (ADR-035). This is the first screen to answer it, by asking the server for the
 * list and letting the operator choose.
 *
 * **What the demo showed that the data does not carry**, all removed rather
 * than faked: bed configurations, room size, per type amenities, and rate plans
 * with their cancellation tiers. `OperatorProperty.roomTypes` carries a name, a
 * domain, a status, a base price and a sellable room count. Rate plans are a
 * lens of their own and still a placeholder; inventing one here would put a
 * second, staler answer beside it.
 */

import { cn } from "@/lib/utils";
import { Button } from "@injishi/ui";
import { useState } from "react";

import { MediaTile } from "../components/media-tile";
import {
  ActionButton,
  Badge,
  EmptyState,
  LoadFailed,
  SectionHeading,
  Skeleton,
  surfaceClass,
} from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useProperties, useProperty } from "../data/ops";
import { fmt } from "../lib/format";
import { roomTypePhoto } from "../lib/media";
import { CreatePropertyForm } from "./create-property-form";

/** What a listing status means to the person who has to act on it. */
const LISTING: Record<string, { label: string; intent: "ok" | "warn" | "neutral" }> = {
  published: { label: "Published", intent: "ok" },
  draft: { label: "Draft", intent: "warn" },
  unpublished: { label: "Unpublished", intent: "neutral" },
  suspended: { label: "Suspended", intent: "neutral" },
};

export function RoomsRates() {
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const [selected, setSelected] = useState<string | null>(null);

  const list = useProperties(workspaceId);
  const properties = list.data?.properties ?? [];
  const current = properties.find((p) => p.id === selected) ?? properties[0] ?? null;
  const detail = useProperty(workspaceId, current?.id ?? null);

  const mayManage = can("listing.manage");

  /*
   * Refused before the request, because the server refuses it too. The nav
   * already keeps a receptionist off Inventory; this is the second answer for
   * somebody who arrives by bookmark, and it names the cause.
   */
  if (!mayManage) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
        {reasonFor("listing.manage")}
      </EmptyState>
    );
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

  if (!current) {
    if (!workspaceId) {
      return (
        <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
          No property on this business yet. Inventory begins with one.
        </EmptyState>
      );
    }
    return <CreatePropertyForm workspaceId={workspaceId} />;
  }

  const roomTypes = detail.data?.roomTypes ?? [];
  const active = roomTypes.filter((t) => t.status === "active");
  const archived = roomTypes.filter((t) => t.status !== "active");
  const status = LISTING[current.listingStatus] ?? {
    label: current.listingStatus,
    intent: "neutral" as const,
  };

  const tile = (t: (typeof roomTypes)[number]) => (
    <div
      key={t.id}
      className={cn(surfaceClass, "overflow-hidden")}
      style={{ opacity: t.status === "active" ? 1 : 0.6 }}
    >
      <MediaTile photo={roomTypePhoto(t.name)} name={t.name} radius={0} />
      <div style={{ padding: "11px 13px 13px" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--foreground)" }}>{t.name}</div>
        <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="pms-num" style={{ fontSize: 15, fontWeight: 700 }}>
            {t.basePriceRwf === null ? "No price yet" : fmt(t.basePriceRwf)}
          </span>
          {t.basePriceRwf !== null && (
            <span style={{ fontSize: 11, color: "var(--muted)" }}>per night</span>
          )}
        </div>
        <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 6 }}>
          {/* The inventory truth: how many rooms of this type can be sold.
              A type with none is a type that cannot be booked, which is a job
              to finish rather than an error to hide. */}
          <Badge intent={t.sellableRoomCount > 0 ? "ok" : "warn"}>
            {t.sellableRoomCount > 0
              ? `${t.sellableRoomCount} sellable`
              : "No sellable rooms"}
          </Badge>
          {t.status !== "active" && <Badge intent="neutral">Archived</Badge>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="pms-enter flex flex-col gap-4">
      {/* The picker only appears when there is a choice to make. One property
          is the common case and a rail of one is noise. */}
      {properties.length > 1 && (
        <div className="flex flex-wrap items-center gap-2.5">
          {properties.map((p) => {
            const on = p.id === current.id;
            return (
              <Button
                variant="ghost"
                key={p.id}
                onClick={() => setSelected(p.id)}
                aria-pressed={on}
                style={{
                  border: `1.5px solid ${on ? "var(--accent-text)" : "var(--card-bd)"}`,
                  background: on ? "var(--accent-soft)" : "var(--card)",
                  color: on ? "var(--accent-text)" : "var(--ink2)",
                  borderRadius: 999,
                  padding: "8px 15px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  minHeight: 40,
                }}
              >
                {p.name}
              </Button>
            );
          })}
        </div>
      )}

      <div
        className={cn(surfaceClass)}
        style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "13px 16px" }}
      >
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>
            {current.name}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--muted)" }}>
            {[current.address.sectorName, current.address.districtName, current.address.provinceName]
              .filter(Boolean)
              .join(" · ") || "No address yet"}
          </span>
        </span>
        <Badge intent={status.intent}>{status.label}</Badge>
        <span className="pms-num" style={{ fontSize: 12.5, color: "var(--muted)" }}>
          {current.roomTypeCount} room types · {current.sellableRoomCount} sellable rooms
        </span>
      </div>

      {detail.isPending && <Skeleton height={220} />}

      {detail.isError && (
        <LoadFailed onRetry={() => void detail.refetch()} retrying={detail.isFetching}>
          We couldn&apos;t load this property&apos;s room types. They are all still there —
          this is on our side, not an empty property.
        </LoadFailed>
      )}

      {detail.data && roomTypes.length === 0 && (
        <EmptyState className="p-6">
          No room types yet. A property cannot be published until it has one, which is why
          publishing refuses.
        </EmptyState>
      )}

      {active.length > 0 && (
        <section>
          <SectionHeading n={active.length}>On sale</SectionHeading>
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 14,
            }}
          >
            {active.map(tile)}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <SectionHeading n={archived.length}>Archived</SectionHeading>
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 14,
            }}
          >
            {archived.map(tile)}
          </div>
        </section>
      )}

      <p style={{ fontSize: 11.5, color: "var(--muted)" }}>
        A room type is what the guest gets. A rate is the terms it sells on, and rate plans
        are their own lens — this screen deliberately does not guess at them.
      </p>
    </div>
  );
}
