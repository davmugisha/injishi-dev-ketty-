"use client";

/**
 * Amenities (F-P02) — what this property offers.
 *
 * **On real data** (ADR-035, D-f wave 2). Reads
 * `GET /api/v1/ops/amenities?propertyId=…` and commands `POST /ops/amenities`
 * and `DELETE /ops/amenities/:code`, both behind `amenity.manage`. The demo
 * store is gone from this screen (D-i).
 *
 * **THIS WAS BLOCKED UNTIL INVENTORY LANDED, AND THAT IS WHY IT IS HERE NOW.**
 * Every amenity route is scoped to a PROPERTY, not to the workspace, and
 * nothing on a workspace grant says which property is in view — a workspace can
 * hold several. The Room types screen answers that by reading
 * `/inventory/properties`; this screen asks the same question the same way, so
 * there is one mechanism for it rather than two.
 *
 * **THE ROOM TYPE TABS ARE GONE, AND THAT IS A FINDING.** The demo offered a tab
 * per room type and a property tab beside it, splitting the catalogue into
 * "whole place" and "in the room". `OperatorAmenity` has no room scope at all:
 * an amenity is a code, a category, a label and whether this PROPERTY offers
 * it. Keeping the tabs would have meant a kettle toggled against a room type
 * that the database has nowhere to put, so the toggle would have appeared to
 * work and changed nothing.
 *
 * **The bilingual search went with them.** The demo searched a local catalogue
 * carrying English and Kinyarwanda for every code. The server sends one
 * `label`. Searching a second language this screen does not have would find
 * nothing and read as a broken search.
 */

import { Button, Input } from "@injishi/ui";
import { cn } from "@/lib/utils";
import { useState } from "react";

import { Icon } from "../components/icon";
import { ActionButton, EmptyState, LoadFailed, SectionHeading, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useAmenities, useProperties, useSetAmenity } from "../data/ops";
import { usePms } from "../store";

export function Offer() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const list = useProperties(workspaceId);
  const properties = list.data?.properties ?? [];
  const property = properties.find((p) => p.id === selected) ?? properties[0] ?? null;

  const amenities = useAmenities(workspaceId, property?.id ?? null);
  const setAmenity = useSetAmenity(workspaceId, property?.id ?? null);

  const mayManage = can("amenity.manage");
  const denied = mayManage ? undefined : reasonFor("amenity.manage");

  if (list.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={260} delay={60} />
      </div>
    );
  }

  if (list.isError) {
    return (
      <LoadFailed onRetry={() => void list.refetch()} retrying={list.isFetching}>
        We couldn&apos;t load your properties. They are all still there — this is on our
        side, not an empty portfolio.
      </LoadFailed>
    );
  }

  if (!property) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
        No property on this business yet. Amenities describe a property, so there is
        nothing to describe.
      </EmptyState>
    );
  }

  const query = q.trim().toLowerCase();
  const all = amenities.data?.amenities ?? [];
  const matching = all.filter((a) => !query || a.label.toLowerCase().includes(query));

  /*
   * Grouped by the server's own category, and an uncategorised amenity is not
   * dropped — it lands under "Other" rather than vanishing from a screen whose
   * whole job is to show everything on offer.
   */
  const groups = new Map<string, typeof matching>();
  for (const a of matching) {
    const key = a.category ?? "Other";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  const offeredCount = all.filter((a) => a.offered).length;

  return (
    <div className="pms-enter flex flex-col gap-4">
      {/* One property is the common case, and a rail of one is noise. */}
      {properties.length > 1 && (
        <div className="flex flex-wrap items-center gap-2.5">
          {properties.map((p) => {
            const on = p.id === property.id;
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

      <div className="flex flex-wrap items-center gap-2.5">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search what you offer"
          aria-label="Search amenities"
          className="h-10 min-w-[220px] flex-1 rounded border-line2 bg-field text-sm"
        />
        <span className="pms-num text-xs text-muted-foreground">
          {offeredCount} of {all.length} offered
        </span>
      </div>

      {amenities.isPending && <Skeleton height={240} />}

      {/* A failed read is not a property that offers nothing. Told that, a host
          would think their listing had been stripped. */}
      {amenities.isError && (
        <LoadFailed onRetry={() => void amenities.refetch()} retrying={amenities.isFetching}>
          We couldn&apos;t load what this property offers. Your listing hasn&apos;t changed
          — this is on our side, not an empty list.
        </LoadFailed>
      )}

      {amenities.data && all.length === 0 && (
        <EmptyState className="p-6">
          The amenity catalogue is empty for this property.
        </EmptyState>
      )}

      {amenities.data && all.length > 0 && matching.length === 0 && (
        <EmptyState className="p-6">Nothing matches “{q}”.</EmptyState>
      )}

      {[...groups.entries()].map(([category, items]) => (
        <section key={category}>
          <SectionHeading n={items.filter((a) => a.offered).length}>{category}</SectionHeading>
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
              gap: 8,
            }}
          >
            {items.map((a) => {
              // This amenity, not every amenity: one pending toggle used to
              // freeze the whole grid.
              const busy = setAmenity.isPending && setAmenity.variables?.amenityCode === a.code;
              return (
                <Button
                  variant="ghost"
                  key={a.code}
                  onClick={() =>
                    !denied &&
                    !busy &&
                    /* A toggle that said nothing either way. The tile flips
                       from the refetch, which is a round trip later, so a host
                       tapping "Wi-Fi" on a slow connection saw nothing happen
                       and tapped it back off. */
                    setAmenity.mutate(
                      { amenityCode: a.code, offered: !a.offered },
                      {
                        onSuccess: () =>
                          toast(
                            a.offered
                              ? `${a.label} is off your listing. Guests browsing won't see it.`
                              : `${a.label} is on your listing now.`,
                            "ok",
                          ),
                        onError: toastError,
                      },
                    )
                  }
                  aria-pressed={a.offered}
                  aria-disabled={denied || busy ? true : undefined}
                  title={denied}
                  className={cn("justify-start")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    border: `1.5px solid ${a.offered ? "var(--accent-text)" : "var(--card-bd)"}`,
                    background: a.offered ? "var(--accent-soft)" : "var(--card)",
                    color: a.offered ? "var(--accent-text)" : "var(--ink2)",
                    borderRadius: "var(--radius-surface)",
                    padding: "10px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: denied || busy ? "not-allowed" : "pointer",
                    opacity: denied ? 0.6 : 1,
                    minHeight: 44,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      flex: "0 0 auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {a.offered && <Icon name="check" size={15} strokeWidth={2.6} />}
                  </span>
                  <span style={{ minWidth: 0 }}>{a.label}</span>
                </Button>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-2xs text-muted-foreground">
        The catalogue is a fixed, coded vocabulary rather than free text. That is what
        lets a listing publish to booking channels: free text has nothing to map.
      </p>
    </div>
  );
}
