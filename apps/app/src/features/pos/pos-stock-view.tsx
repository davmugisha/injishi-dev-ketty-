"use client";

import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Box,
  CircleExclamation,
  Magnifier,
  TriangleExclamation,
  Wallet,
} from "@gravity-ui/icons";
import { Button, Chip, Input, Label, TextField, ToggleButton } from "@heroui/react";
import { useMemo, useState } from "react";
import {
  type PosOutlet,
  type PosStockItem,
  type PosStockView,
  STOCK_KIND_LABEL,
  type StockMovementKind,
} from "@/server/pos";
import { adjustStockAction } from "./actions";
import { Kpi, Panel } from "./back-office";
import { DishArt } from "./dish-art";
import { kigaliClock, kigaliToday, rwf, shortDay } from "./format";
import { PosShell } from "./pos-shell";
import { PosDialog, parseRwf, usePosAction } from "./shared";

type Filter = "tracked" | "low" | "out" | "all";

const LEVEL_CHIP = {
  ok: { color: "success", label: "In stock" },
  low: { color: "warning", label: "Low" },
  out: { color: "danger", label: "Out of stock" },
  untracked: { color: "default", label: "Not tracked" },
} as const;

const KINDS: StockMovementKind[] = ["damaged", "broken", "expired", "spillage", "staff_use", "received", "count"];

const ACTION_LABEL: Record<string, string> = {
  "stock.consumed": "Sold",
  "stock.restored": "Returned",
  "stock.damaged": "Damaged",
  "stock.broken": "Broken",
  "stock.expired": "Expired",
  "stock.spillage": "Spilled",
  "stock.staff_use": "Staff use",
  "stock.received": "Received",
  "stock.count": "Counted",
  "stock.opening": "Opening stock",
  "stock.catalogue_edit": "Edited on the menu",
};

/**
 * The stock of one outlet (POS spec section 8). Selling takes stock out when an order is sent, a void or a
 * cancellation returns what was never served, and a person records what no sale explains: damaged, broken,
 * expired, spilled, staff use, deliveries and counts, each with a reason. Every change is in the history.
 * Values use an estimated cost (no cost price is stored per item yet), and say so.
 */
export function PosStockScreen({
  outlets,
  outlet,
  stock,
  can,
}: {
  outlets: PosOutlet[];
  outlet: PosOutlet;
  stock: PosStockView;
  can: string[];
}) {
  const { run, pending } = usePosAction();
  const [filter, setFilter] = useState<Filter>("tracked");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{
    item: PosStockItem;
    kind: StockMovementKind;
    quantity: string;
    reason: string;
  } | null>(null);
  const manage = can.includes("stock.manage");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const items = q
      ? stock.items.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      : stock.items;
    if (filter === "all") return items;
    if (filter === "tracked") return items.filter((i) => i.stockQty !== null || i.level === "out");
    return items.filter((i) => i.level === filter);
  }, [stock.items, filter, query]);
  // What to restock first: out of stock, then the lowest counts.
  const restock = useMemo(
    () =>
      stock.items
        .filter((i) => i.level === "out" || i.level === "low")
        .sort((a, b) => (a.stockQty ?? -1) - (b.stockQty ?? -1))
        .slice(0, 8),
    [stock.items],
  );
  // A full bar is five times the low-stock line: a healthy shelf reads as full, a low one as nearly empty.
  const full = Math.max(1, stock.lowAt * 5);
  const sectionOf = new Map(stock.items.map((i) => [i.name, i.category]));

  const quantity = editing ? parseRwf(editing.quantity) : null;
  const isCount = editing?.kind === "count";

  return (
    <PosShell
      board="PosStock"
      title="Stock"
      subtitle="What is on hand, and what moved"
      outlet={outlet}
      outlets={outlets}
      outletId={outlet.id}
      switchHref="/pos/stock"
      can={can}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 md:px-6">
        <section aria-label="Stock summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Stock value"
            icon={Wallet}
            value={rwf(stock.summary.valuationRwf)}
            sub={`Estimated at ${Math.round(stock.costRatio * 100)}% of selling price`}
          />
          <Kpi
            label="Items tracked"
            icon={Box}
            tint="default"
            value={stock.summary.tracked}
            sub="Counted down as orders are sent"
          />
          <Kpi
            label="Low stock"
            icon={CircleExclamation}
            tint="warning"
            value={stock.summary.low}
            tone={stock.summary.low ? "warn" : "good"}
            sub={`${stock.lowAt} units or fewer`}
          />
          <Kpi
            label="Out of stock"
            icon={TriangleExclamation}
            tint="danger"
            value={stock.summary.out}
            tone={stock.summary.out ? "bad" : "good"}
            sub="Cannot be sold until restocked"
          />
        </section>

        {restock.length ? (
          <section aria-labelledby="restock-h" className="flex flex-col gap-3">
            <div>
              <h2 id="restock-h" className="text-[16px] font-semibold">
                Needs restocking
              </h2>
              <p className="text-[12.5px] text-muted">Out of stock first, then the lowest counts.</p>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(210px,1fr))]">
              {restock.map((i) => (
                <article
                  key={i.id}
                  data-ui="restock-card"
                  className="flex gap-3 rounded-[18px] border border-[var(--pos-card-border)] bg-surface p-2.5 shadow-[var(--pos-card-shadow)]"
                >
                  <DishArt name={i.name} section={i.category} size="thumb" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-[13.5px] font-semibold">{i.name}</p>
                    <p className="flex items-center gap-1.5 text-[12px]">
                      <span
                        className={`size-1.5 rounded-full ${i.level === "out" ? "bg-danger" : "bg-warning"}`}
                        aria-hidden="true"
                      />
                      <span
                        className={
                          i.level === "out" ? "font-medium text-danger" : "font-medium text-warning-soft-foreground"
                        }
                      >
                        {i.level === "out" ? "Out of stock" : `${i.stockQty} left`}
                      </span>
                    </p>
                    {manage ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-0.5 h-7 self-start px-2.5 text-[12px]"
                        onPress={() =>
                          setEditing({ item: i, kind: "received", quantity: "", reason: "Delivery received" })
                        }
                      >
                        <ArrowDownToLine className="size-3.5" />
                        Receive
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Panel
            title="Items"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex h-9 w-full items-center gap-2 rounded-full border border-[var(--pos-ctl-border)] bg-surface px-3 text-[13px] sm:w-52">
                  <Magnifier className="size-4 shrink-0 text-muted" />
                  <input
                    aria-label="Search stock"
                    placeholder="Search items"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
                  />
                </label>
                <fieldset className="flex flex-wrap gap-1 m-0 min-w-0 border-0 p-0" aria-label="Show">
                  {(
                    [
                      ["tracked", "Tracked"],
                      ["low", `Low (${stock.summary.low})`],
                      ["out", `Out (${stock.summary.out})`],
                      ["all", "All items"],
                    ] as const
                  ).map(([key, label]) => (
                    <ToggleButton key={key} size="sm" isSelected={filter === key} onChange={() => setFilter(key)}>
                      {label}
                    </ToggleButton>
                  ))}
                </fieldset>
              </div>
            }
          >
            {shown.length === 0 ? (
              <p className="py-2 text-[13px] text-muted">Nothing in this view.</p>
            ) : (
              <div className="overflow-x-auto">
                <table data-ui="stock-table" className="w-full min-w-[620px] border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[var(--pos-band)] text-left text-[12px] text-muted">
                      <th className="rounded-l-xl py-2.5 pr-3 pl-3 font-medium">Item</th>
                      <th className="py-2.5 pr-3 font-medium">On hand</th>
                      <th className="py-2.5 pr-3 font-medium">Status</th>
                      <th className="py-2.5 pr-3 text-right font-medium">Value</th>
                      <th className="rounded-r-xl py-2.5 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((i) => {
                      const chip = LEVEL_CHIP[i.level];
                      return (
                        <tr key={i.id} className="border-b border-separator/60 last:border-0">
                          <td className="py-2.5 pr-3 pl-3">
                            <span className="flex items-center gap-3">
                              <DishArt name={i.name} section={i.category} size="row" />
                              <span className="min-w-0">
                                <span className="block truncate font-semibold">{i.name}</span>
                                <span className="block truncate text-[12px] text-muted">{i.category}</span>
                              </span>
                            </span>
                          </td>
                          <td className="py-2.5 pr-3">
                            {i.stockQty === null ? (
                              <span className="text-muted">Not counted</span>
                            ) : (
                              <span className="flex min-w-[120px] items-center gap-2.5">
                                <span className="w-8 text-right font-semibold tabular">{i.stockQty}</span>
                                <span
                                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--pos-row)]"
                                  aria-hidden="true"
                                >
                                  <span
                                    className={`block h-full rounded-full ${i.level === "out" ? "bg-danger" : i.level === "low" ? "bg-warning" : "bg-[#17c964]"}`}
                                    style={{ width: `${Math.min(100, Math.round((i.stockQty / full) * 100))}%` }}
                                  />
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Chip size="sm" variant="soft" color={chip.color} className="whitespace-nowrap">
                              <Chip.Label>{chip.label}</Chip.Label>
                            </Chip>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-medium whitespace-nowrap tabular">
                            {i.stockQty === null ? "-" : rwf(i.valueRwf)}
                          </td>
                          {manage ? (
                            <td className="py-2.5 pr-2 text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                onPress={() => setEditing({ item: i, kind: "damaged", quantity: "", reason: "" })}
                              >
                                Record
                              </Button>
                            </td>
                          ) : (
                            <td />
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Stock history" note="Every change: sales, returns, damage, deliveries and counts.">
            {stock.movements.length === 0 ? (
              <p className="py-2 text-[13px] text-muted">No stock movements yet.</p>
            ) : (
              <ul className="flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
                {stock.movements.map((m) => {
                  const kind = ACTION_LABEL[m.action] ?? m.action;
                  const delta = m.delta === null ? "" : m.delta > 0 ? `+${m.delta}` : `${m.delta}`;
                  return (
                    <li key={m.id} className="flex gap-3 rounded-2xl border border-separator px-2.5 py-2 text-[12px]">
                      <DishArt name={m.item || "Item"} section={sectionOf.get(m.item) ?? ""} size="row" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="min-w-0 truncate font-semibold text-[13px]">{m.item || "Item"}</span>
                          <span
                            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 text-[12px] font-semibold tabular ${m.delta !== null && m.delta > 0 ? "bg-success-soft text-success-soft-foreground" : m.delta !== null && m.delta < 0 ? "bg-danger-soft text-danger-soft-foreground" : "bg-default text-muted"}`}
                          >
                            {m.delta !== null && m.delta > 0 ? <ArrowUp className="size-3" /> : null}
                            {m.delta !== null && m.delta < 0 ? <ArrowDown className="size-3" /> : null}
                            {delta.replace("-", "")}
                          </span>
                        </div>
                        <div className="text-muted">
                          {kind}
                          {m.stockBefore !== null && m.stockAfter !== null
                            ? ` · ${m.stockBefore} to ${m.stockAfter}`
                            : ""}
                          {m.order ? ` · ${m.order}` : ""}
                        </div>
                        <div className="text-muted">
                          {shortDay(kigaliToday(new Date(m.at)))} {kigaliClock(m.at)}
                          {m.by ? ` · ${m.by}` : ""}
                        </div>
                        {m.reason ? <div className="mt-0.5">{m.reason}</div> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {editing ? (
        <PosDialog
          isOpen
          onOpenChange={(open) => !open && setEditing(null)}
          title={editing.item.name}
          subtitle={`On hand: ${editing.item.stockQty ?? "not tracked yet"}. Recorded with your name and the reason.`}
          footer={
            <>
              <Button variant="secondary" onPress={() => setEditing(null)}>
                Cancel
              </Button>
              <Button
                isDisabled={
                  pending || quantity === null || (!isCount && quantity < 1) || editing.reason.trim().length < 3
                }
                onPress={() =>
                  run(
                    () =>
                      adjustStockAction({
                        serviceItemId: editing.item.id,
                        kind: editing.kind,
                        quantity: quantity ?? 0,
                        reason: editing.reason.trim(),
                      }),
                    (item) => `${item.name}: now ${item.stockQty ?? 0} in stock`,
                    () => setEditing(null),
                  )
                }
              >
                Save
              </Button>
            </>
          }
        >
          <fieldset className="flex flex-wrap gap-1.5 m-0 min-w-0 border-0 p-0" aria-label="What happened">
            {KINDS.map((k) => (
              <ToggleButton
                key={k}
                isSelected={editing.kind === k}
                onChange={() => setEditing({ ...editing, kind: k })}
              >
                {STOCK_KIND_LABEL[k]}
              </ToggleButton>
            ))}
          </fieldset>
          <TextField
            value={editing.quantity}
            onChange={(v) => setEditing({ ...editing, quantity: v })}
            fullWidth
            isRequired
          >
            <Label>
              {isCount ? "Counted quantity" : editing.kind === "received" ? "Quantity received" : "Quantity lost"}
            </Label>
            <Input inputMode="numeric" className="tabular" />
          </TextField>
          <TextField
            value={editing.reason}
            onChange={(v) => setEditing({ ...editing, reason: v })}
            fullWidth
            isRequired
          >
            <Label>Reason (required)</Label>
            <Input />
          </TextField>
        </PosDialog>
      ) : null}
    </PosShell>
  );
}
