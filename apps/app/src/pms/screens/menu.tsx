"use client";

/**
 * Menu and pricing (F-P06) — the department service catalog, as a gallery.
 *
 * **On real data** (ADR-035, D-f wave 2). Reads `GET /api/v1/ops/service-catalog`
 * and commands `PATCH /ops/service-catalog/items/:id` behind `menu.manage`. The
 * demo store is gone from this screen (D-i).
 *
 * What a guest orders from is a picture and a price, so this is the operator's
 * view of the same thing: a tile per item, its availability on the tile, and a
 * category rail deciding what is on show. A list view made a 60 minute massage
 * and a Fanta the same 40px row, and gave the host nowhere to notice the
 * ABSENCE of the photograph a guest will be looking at.
 *
 * **EDITING AN ITEM NEVER REWRITES A PLACED ORDER.** An order snapshots the
 * name, the price and the tax code at order time (D8), which is what makes it
 * safe to reprice mid service: last week's bill still says what last week's
 * menu said. The Live orders board shows those snapshots, not these rows.
 *
 * **THREE STATES, NOT A SWITCH.** The demo had one boolean, "available".
 * `ServiceCatalogStatus` has three, and the middle one is the one a kitchen
 * actually needs: `out_of_stock` means we still sell this, just not right now,
 * while `archived` means we stopped selling it. Collapsing them would make a
 * host archive the fish every time it ran out.
 *
 * **The category rail comes from the server**, grouped there because that is
 * the only way anyone reads a menu, and a client that regrouped a flat list
 * would be one more place the grouping could differ.
 *
 * Adding an item is not here yet: it is a real endpoint, but it needs a photo
 * pipeline (F-S09) to be worth offering, and an item added with no picture is
 * exactly the gap this gallery exists to make visible.
 */

import { Button, Input } from "@injishi/ui";
import type { OperatorServiceItem, ServiceCatalogStatus } from "@injishi/contracts";
import { useState } from "react";

import { MediaTile, NeedsPhoto } from "../components/media-tile";
import { ActionButton, Badge, EmptyState, LoadFailed, Skeleton } from "../components/ui";
import { useCapability, useWorkspaceId } from "../data/capability";
import { useServiceCatalog, useUpdateServiceItem } from "../data/ops";
import { fmt, parseAmount } from "../lib/format";
import { menuItemPhoto } from "../lib/media";
import { usePms } from "../store";

/** The three real states, worded for a kitchen rather than a database. */
const STATUS: Record<
  ServiceCatalogStatus,
  { label: string; intent: "ok" | "warn" | "neutral" }
> = {
  active: { label: "On the menu", intent: "ok" },
  out_of_stock: { label: "Off today", intent: "warn" },
  archived: { label: "Withdrawn", intent: "neutral" },
};

export function Menu() {
  const { toast, toastError } = usePms();
  const workspaceId = useWorkspaceId();
  const { can, reasonFor } = useCapability();
  const query = useServiceCatalog(workspaceId);
  const update = useUpdateServiceItem(workspaceId);

  const [category, setCategory] = useState<string | null>(null);
  /** Withdrawn items still matter to the host; they are dimmed, not dropped. */
  const [showWithdrawn, setShowWithdrawn] = useState(true);
  /** The item whose price is being edited, and what has been typed. */
  const [pricing, setPricing] = useState<string | null>(null);
  const [price, setPrice] = useState("");

  const mayManage = can("menu.manage");
  const denied = mayManage ? undefined : reasonFor("menu.manage");

  function setStatus(item: OperatorServiceItem, status: ServiceCatalogStatus) {
    update.mutate(
      { itemId: item.id, status },
      {
        // What a guest ordering right now will see, rather than the word on
        // the button that was pressed.
        onSuccess: () =>
          toast(
            status === "active"
              ? `${item.name} is on the menu — guests can order it.`
              : status === "out_of_stock"
                ? `${item.name} is off for today. It stays on the menu for tomorrow.`
                : `${item.name} is withdrawn. Guests no longer see it.`,
            "ok",
          ),
        onError: toastError,
      },
    );
  }

  function savePrice(item: OperatorServiceItem) {
    const next = parseAmount(price);
    if (!Number.isFinite(next) || next < 0 || next === item.priceRwf) {
      setPricing(null);
      return;
    }
    update.mutate(
      { itemId: item.id, priceRwf: next },
      {
        onSuccess: () => {
          setPricing(null);
          toast(`${item.name} is ${fmt(next)} from now on. Orders already placed keep the old price.`, "ok");
        },
        onError: toastError,
      },
    );
  }

  if (query.isPending) {
    return (
      <div className="pms-enter flex flex-col gap-4">
        <Skeleton height={40} />
        <Skeleton height={280} delay={60} />
      </div>
    );
  }

  if (query.isError) {
    /* A failed read is not an empty menu. A kitchen told it sells nothing is
       the worst possible reading of a failed request. */
    return (
      <LoadFailed onRetry={() => void query.refetch()} retrying={query.isFetching}>
        We couldn&apos;t load your menu. Every item and price is still there — this is on
        our side, not an empty catalogue.
      </LoadFailed>
    );
  }

  const categories = query.data?.categories ?? [];

  if (categories.length === 0) {
    return (
      <EmptyState style={{ padding: 26, fontSize: 13.5 }}>
        No menu yet. A service department gets its catalog when its first category is
        added.
      </EmptyState>
    );
  }

  const current = categories.find((c) => c.id === category) ?? categories[0];
  const items = current.items.filter((i) => showWithdrawn || i.status !== "archived");

  return (
    <div className="pms-enter flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {categories.map((c) => {
          const on = c.id === current.id;
          return (
            <Button
              variant="ghost"
              key={c.id}
              onClick={() => setCategory(c.id)}
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
              {c.name}
              {c.departmentName ? ` · ${c.departmentName}` : ""}
            </Button>
          );
        })}
        <span className="flex-1" />
        <Button
          variant="ghost"
          onClick={() => setShowWithdrawn((v) => !v)}
          aria-pressed={showWithdrawn}
          style={{
            border: "1px solid var(--card-bd)",
            background: showWithdrawn ? "var(--hover)" : "var(--card)",
            color: "var(--muted)",
            borderRadius: 999,
            padding: "7px 13px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {showWithdrawn ? "Hiding nothing" : "Withdrawn hidden"}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState className="p-6">
          Nothing on this menu yet.
        </EmptyState>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: 14,
          }}
        >
          {items.map((item) => {
            const photo = menuItemPhoto(item.name);
            const status = STATUS[item.status];
            const editing = pricing === item.id;
            // THIS item, not every item on the menu: a shared `isPending`
            // greyed the whole gallery while one price saved.
            const busy = update.isPending && update.variables?.itemId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-bd)",
                  borderRadius: 12,
                  overflow: "hidden",
                  opacity: item.status === "archived" ? 0.6 : 1,
                }}
              >
                <MediaTile
                  photo={photo}
                  name={item.name}
                  radius={0}
                  overlay={<Badge intent={status.intent}>{status.label}</Badge>}
                />
                {/* The absence of a photograph is a fact the host should see,
                    not a grey box that reads as a loading state. */}
                {!photo && <NeedsPhoto />}

                <div style={{ padding: "10px 12px 12px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--foreground)" }}>
                    {item.name}
                  </div>
                  {item.description && (
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 11.5,
                        color: "var(--muted)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.description}
                    </div>
                  )}

                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    {editing ? (
                      <Input
                        autoFocus
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePrice(item);
                          if (e.key === "Escape") setPricing(null);
                        }}
                        inputMode="numeric"
                        aria-label={`Price for ${item.name}`}
                        className="h-9 rounded border-line2 bg-field text-sm"
                      />
                    ) : (
                      <span className="pms-num" style={{ fontSize: 14, fontWeight: 700 }}>
                        {fmt(item.priceRwf)}
                      </span>
                    )}
                    <span style={{ flex: 1 }} />
                    <ActionButton
                      deniedReason={denied}
                      pending={busy}
                      onClick={() => {
                        if (editing) {
                          savePrice(item);
                          return;
                        }
                        setPricing(item.id);
                        setPrice(String(item.priceRwf));
                      }}
                    >
                      {editing ? (busy ? "Saving" : "Save") : "Price"}
                    </ActionButton>
                  </div>

                  {/*
                    Three states, not a toggle. "Off today" is the one a kitchen
                    reaches for when the fish runs out, and it is not the same
                    thing as taking the dish off the menu.
                  */}
                  <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(Object.keys(STATUS) as ServiceCatalogStatus[]).map((s) => {
                      const on = item.status === s;
                      const off = Boolean(denied) || busy || on;
                      return (
                        <Button
                          variant="ghost"
                          key={s}
                          onClick={() => !off && setStatus(item, s)}
                          aria-pressed={on}
                          aria-disabled={off ? true : undefined}
                          title={denied}
                          style={{
                            border: `1px solid ${on ? "var(--accent-text)" : "var(--line2)"}`,
                            background: on ? "var(--accent-soft)" : "var(--field)",
                            color: on ? "var(--accent-text)" : "var(--muted)",
                            borderRadius: 8,
                            padding: "4px 9px",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: off ? "default" : "pointer",
                            opacity: denied ? 0.5 : 1,
                          }}
                        >
                          {STATUS[s].label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
