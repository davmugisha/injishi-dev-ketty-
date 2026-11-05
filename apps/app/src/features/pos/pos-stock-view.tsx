"use client";

import { Button, Chip, Input, Label, TextField, ToggleButton } from "@heroui/react";
import { useMemo, useState } from "react";
import { type PosOutlet, type PosStockItem, type PosStockView, STOCK_KIND_LABEL, type StockMovementKind } from "@/server/pos";
import { adjustStockAction } from "./actions";
import { Kpi, OutletSwitch, Panel } from "./back-office";
import { kigaliClock, kigaliToday, rwf, shortDay } from "./format";
import { PosNav } from "./pos-nav";
import { PosDialog, PosHeader, parseRwf, usePosAction } from "./shared";

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
  const [editing, setEditing] = useState<{ item: PosStockItem; kind: StockMovementKind; quantity: string; reason: string } | null>(null);
  const manage = can.includes("stock.manage");

  const shown = useMemo(() => {
    const items = stock.items;
    if (filter === "all") return items;
    if (filter === "tracked") return items.filter((i) => i.stockQty !== null || i.level === "out");
    return items.filter((i) => i.level === filter);
  }, [stock.items, filter]);

  const quantity = editing ? parseRwf(editing.quantity) : null;
  const isCount = editing?.kind === "count";

  return (
    <div className="relative flex h-full flex-col bg-background">
      <PosHeader title="Stock" outlet={outlet}>
        <OutletSwitch outlets={outlets} current={outlet.id} href="/pos/stock" />
        <PosNav current="PosStock" outletId={outlet.id} can={can} />
      </PosHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <section aria-label="Stock summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Stock value" value={rwf(stock.summary.valuationRwf)} sub={`Estimated at ${Math.round(stock.costRatio * 100)}% of selling price`} />
          <Kpi label="Items tracked" value={stock.summary.tracked} sub="Counted down as orders are sent" />
          <Kpi label="Low stock" value={stock.summary.low} tone={stock.summary.low ? "warn" : "good"} sub={`${stock.lowAt} units or fewer`} />
          <Kpi label="Out of stock" value={stock.summary.out} tone={stock.summary.out ? "bad" : "good"} sub="Cannot be sold until restocked" />
        </section>

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Panel
            title="Items"
            action={
              <div className="flex flex-wrap gap-1" role="group" aria-label="Show">
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
              </div>
            }
          >
            {shown.length === 0 ? (
              <p className="py-2 text-[13px] text-muted">Nothing in this view.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-separator text-left text-[11px] tracking-wide text-muted uppercase">
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="py-2 pr-3 font-medium">Category</th>
                      <th className="py-2 pr-3 text-right font-medium">On hand</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 text-right font-medium">Value</th>
                      {manage ? <th className="py-2 font-medium" /> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((i) => {
                      const chip = LEVEL_CHIP[i.level];
                      return (
                        <tr key={i.id} className="border-b border-separator/60 last:border-0">
                          <td className="py-2 pr-3 font-medium">{i.name}</td>
                          <td className="py-2 pr-3 text-muted">{i.category}</td>
                          <td className="py-2 pr-3 text-right tabular">{i.stockQty ?? "-"}</td>
                          <td className="py-2 pr-3">
                            <Chip size="sm" variant="soft" color={chip.color}>
                              <Chip.Label>{chip.label}</Chip.Label>
                            </Chip>
                          </td>
                          <td className="py-2 pr-3 text-right tabular">{i.stockQty === null ? "-" : rwf(i.valueRwf)}</td>
                          {manage ? (
                            <td className="py-2 text-right">
                              <Button size="sm" variant="secondary" onPress={() => setEditing({ item: i, kind: "damaged", quantity: "", reason: "" })}>
                                Record
                              </Button>
                            </td>
                          ) : null}
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
                    <li key={m.id} className="rounded-xl border border-separator px-3 py-2 text-[12px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate font-medium text-[13px]">{m.item || "Item"}</span>
                        <span className="shrink-0 font-semibold tabular">{delta}</span>
                      </div>
                      <div className="text-muted">
                        {kind}
                        {m.stockBefore !== null && m.stockAfter !== null ? ` · ${m.stockBefore} to ${m.stockAfter}` : ""}
                        {m.order ? ` · ${m.order}` : ""}
                      </div>
                      <div className="text-muted">
                        {shortDay(kigaliToday(new Date(m.at)))} {kigaliClock(m.at)}
                        {m.by ? ` · ${m.by}` : ""}
                      </div>
                      {m.reason ? <div className="mt-0.5">{m.reason}</div> : null}
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
                isDisabled={pending || quantity === null || (!isCount && quantity < 1) || editing.reason.trim().length < 3}
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
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="What happened">
            {KINDS.map((k) => (
              <ToggleButton key={k} isSelected={editing.kind === k} onChange={() => setEditing({ ...editing, kind: k })}>
                {STOCK_KIND_LABEL[k]}
              </ToggleButton>
            ))}
          </div>
          <TextField value={editing.quantity} onChange={(v) => setEditing({ ...editing, quantity: v })} fullWidth isRequired>
            <Label>{isCount ? "Counted quantity" : editing.kind === "received" ? "Quantity received" : "Quantity lost"}</Label>
            <Input inputMode="numeric" className="tabular" />
          </TextField>
          <TextField value={editing.reason} onChange={(v) => setEditing({ ...editing, reason: v })} fullWidth isRequired>
            <Label>Reason (required)</Label>
            <Input />
          </TextField>
        </PosDialog>
      ) : null}
    </div>
  );
}
