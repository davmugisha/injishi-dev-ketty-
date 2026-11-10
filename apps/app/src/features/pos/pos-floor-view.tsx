"use client";

import { ArrowRightArrowLeft, Bucket, Plus, Receipt, ShoppingBag } from "@gravity-ui/icons";
import { Button, Card, Label, Tabs } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RegionOverlays } from "@/features/outlets/shared";
import {
  ORDER_STATUS_LABEL,
  type PosFloor,
  type PosOrderSummary,
  type PosOutlet,
  type PosTable,
  TABLE_MOVES,
  TABLE_STATUS_LABEL,
  type TableStatus,
} from "@/server/pos";
import {
  createOrderAction,
  mergeSessionsAction,
  moveSessionAction,
  releaseAction,
  seatAction,
  tableStatusAction,
} from "./actions";
import { PosShell } from "./pos-shell";
import { clock, money, ORDER_COLOR, PosDialog, StatusChip, TABLE_COLOR, usePosAction, usePressKey } from "./shared";

/**
 * The floor (POS spec §5, tables and service): every table of the outlet by dining area, with who sits
 * there and what they still owe. A table opens a session; orders are taken on the session.
 */
export function PosFloorView({
  outlets,
  outlet,
  floor,
  orders,
  can,
}: {
  outlets: PosOutlet[];
  outlet: PosOutlet;
  floor: PosFloor;
  orders: PosOrderSummary[];
  can: string[];
}) {
  const router = useRouter();
  const { run, pending } = usePosAction();
  const [area, setArea] = useState(floor.areas[0]?.id ?? "");
  const [selected, setSelected] = useState<PosTable | null>(null);
  const [seatFor, setSeatFor] = useState<PosTable | null>(null);
  const [guests, setGuests] = useState(2);
  const [moveFrom, setMoveFrom] = useState<{ table: PosTable; mode: "move" | "merge" } | null>(null);
  const [key, nextKey] = usePressKey();
  const manageTables = can.includes("table.manage");
  const sell = can.includes("pos.sell");

  // The floor is shared by every till: read it again every 15 seconds.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [router]);

  const live = selected ? (floor.tables.find((t) => t.id === selected.id) ?? null) : null;
  const sessionOrders = live?.sessionId ? orders.filter((o) => o.tableSessionId === live.sessionId) : [];
  const takeaways = orders.filter((o) => o.orderType !== "dine_in");

  function openOrder(tableSessionId: string | undefined) {
    run(
      () =>
        createOrderAction(
          { outletId: outlet.id, orderType: tableSessionId ? "dine_in" : "takeaway", tableSessionId },
          key,
        ),
      null,
      (order) => {
        nextKey();
        router.push(`/pos/till?order=${order.id}`);
      },
    );
  }

  const tally = (s: TableStatus) => floor.tables.filter((t) => t.status === s).length;
  const total = floor.tables.length;
  const stats: { key: string; label: string; value: number; tone: string }[] = [
    { key: "total", label: "Total tables", value: total, tone: "bg-foreground/70" },
    { key: "available", label: "Available", value: tally("available"), tone: "bg-success" },
    { key: "occupied", label: "Occupied", value: tally("occupied"), tone: "bg-warning" },
    { key: "bill_requested", label: "Bill requested", value: tally("bill_requested"), tone: "bg-danger" },
    {
      key: "other",
      label: "Reserved, cleaning",
      value: tally("reserved") + tally("cleaning"),
      tone: "bg-foreground/40",
    },
  ];

  return (
    <PosShell
      board="PosFloor"
      title="Floor and tables"
      subtitle={`${outlet.name}${outlet.branchName ? ` · ${outlet.branchName}` : ""} · live, refreshed every 15 seconds`}
      outlet={outlet}
      outlets={outlets}
      outletId={outlet.id}
      switchHref="/pos/floor"
      can={can}
      actions={
        sell ? (
          <Button isDisabled={pending} onPress={() => openOrder(undefined)}>
            <ShoppingBag className="size-4" />
            New takeaway
          </Button>
        ) : null
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 md:flex-row md:overflow-hidden md:px-6">
        <div className="flex min-w-0 flex-col gap-4 md:flex-1 md:overflow-y-auto md:pb-2">
          <section
            data-ui="floor-stats"
            aria-label="Tables now"
            className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-5"
          >
            {stats.map((s) => (
              <Card
                key={s.key}
                data-stat={s.key}
                className="min-w-[132px] shrink-0 gap-2 rounded-[20px] p-4 shadow-none sm:min-w-0"
              >
                <span className="text-[12px] font-medium text-muted">{s.label}</span>
                <span className="text-[24px] leading-7 font-bold tabular">{String(s.value).padStart(2, "0")}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-default" aria-hidden="true">
                  <span
                    className={`block h-full rounded-full ${s.tone}`}
                    style={{ width: `${total ? Math.max(4, (s.value / total) * 100) : 0}%` }}
                  />
                </span>
              </Card>
            ))}
          </section>

          <Tabs variant="secondary" selectedKey={area} onSelectionChange={(k) => setArea(String(k))}>
            <Tabs.ListContainer className="overflow-x-auto pb-1">
              <Tabs.List aria-label="Dining area" className="gap-2 border-0 shadow-none">
                {floor.areas.map((a) => (
                  <Tabs.Tab
                    key={a.id}
                    id={a.id}
                    className="h-10 w-auto shrink-0 rounded-full border border-separator bg-surface px-4 text-[13px] font-medium whitespace-nowrap text-foreground/80 transition-colors hover:border-accent/60 data-[selected=true]:border-accent data-[selected=true]:bg-accent data-[selected=true]:font-semibold data-[selected=true]:text-accent-foreground"
                  >
                    {a.name}
                    <span className="ml-1.5 rounded-full bg-foreground/8 px-1.5 text-[11px] font-semibold tabular">
                      {floor.tables.filter((t) => t.areaId === a.id && t.status === "available").length}/
                      {floor.tables.filter((t) => t.areaId === a.id).length} free
                    </span>
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          {floor.tables.length === 0 ? (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Title>No tables yet</EmptyState.Title>
                <EmptyState.Description>
                  This outlet has no dining areas. Takeaway orders still work.
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] sm:[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
              {floor.tables
                .filter((t) => t.areaId === area)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    data-ui="table-card"
                    data-table={t.label}
                    data-status={t.status}
                    data-area={t.areaId}
                    onClick={() => setSelected(t)}
                    aria-pressed={live?.id === t.id}
                    className={`flex min-h-[176px] flex-col gap-3 rounded-[20px] border bg-surface p-4 text-left transition focus-visible:outline-2 focus-visible:outline-accent ${
                      live?.id === t.id
                        ? "border-accent shadow-[0_0_0_3px_color-mix(in_oklab,var(--accent)_25%,transparent)]"
                        : "border-separator hover:border-accent/50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[17px] font-bold">{t.label}</span>
                      <StatusChip color={TABLE_COLOR[t.status]}>{TABLE_STATUS_LABEL[t.status]}</StatusChip>
                    </span>
                    <TableGlyph seats={t.seats} guests={t.guestCount ?? 0} status={t.status} />
                    <span className="grid grid-cols-2 gap-x-2 text-[12px]">
                      <span className="text-muted">Seats</span>
                      <span className="text-right text-muted">{t.sessionId ? "To pay" : "Status"}</span>
                      <span className="font-semibold tabular">
                        {t.sessionId ? `${t.guestCount} of ${t.seats}` : t.seats}
                      </span>
                      <span className="text-right font-semibold tabular">
                        {t.sessionId
                          ? t.outstandingRwf > 0
                            ? money(t.outstandingRwf)
                            : "Nothing owed"
                          : TABLE_STATUS_LABEL[t.status]}
                      </span>
                    </span>
                    {t.sessionId ? (
                      <span className="truncate text-[11px] text-muted">
                        {t.waiterName ?? "No waiter"} · since {t.openedAt ? clock(t.openedAt) : ""}
                      </span>
                    ) : null}
                  </button>
                ))}
            </div>
          )}

          {takeaways.length ? (
            <section aria-labelledby="ta-h" className="flex flex-col gap-2">
              <h2 id="ta-h" className="text-[14px] font-semibold">
                Takeaway and delivery
              </h2>
              <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]">
                {takeaways.map((o) => (
                  <OrderRow key={o.id} order={o} onOpen={() => router.push(`/pos/till?order=${o.id}`)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* On a phone the panel sits under the tables (above them once a table is chosen) and says nothing until then. */}
        <aside
          aria-label="Selected table"
          className={`flex w-full shrink-0 flex-col gap-3 self-start rounded-[20px] border border-separator bg-surface p-5 md:max-h-full md:w-[340px] md:overflow-y-auto ${live ? "max-md:order-first" : "max-xl:hidden"}`}
        >
          {!live ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <TableGlyph seats={4} guests={0} status="available" />
              <p className="text-[14px] font-semibold">No table selected</p>
              <p className="text-[13px] text-muted">
                Choose a table to seat a party, open its bill or change its status.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-muted">Table</p>
                  <h2 className="text-[22px] leading-7 font-bold">{live.label}</h2>
                </div>
                <StatusChip color={TABLE_COLOR[live.status]}>{TABLE_STATUS_LABEL[live.status]}</StatusChip>
              </div>
              <TableGlyph seats={live.seats} guests={live.guestCount ?? 0} status={live.status} large />
              {!live.sessionId ? (
                manageTables && (live.status === "available" || live.status === "reserved") ? (
                  <Button
                    size="lg"
                    onPress={() => {
                      setGuests(Math.min(2, live.seats));
                      setSeatFor(live);
                    }}
                  >
                    <Plus className="size-4" />
                    Seat guests
                  </Button>
                ) : null
              ) : (
                <>
                  <p className="text-[13px] text-muted">
                    {live.guestCount} guests · {live.waiterName ?? "No waiter"} · {money(live.outstandingRwf)} owed
                  </p>
                  {sessionOrders.map((o) => (
                    <OrderRow key={o.id} order={o} onOpen={() => router.push(`/pos/till?order=${o.id}`)} />
                  ))}
                  {sell ? (
                    <Button isDisabled={pending} onPress={() => openOrder(live.sessionId ?? undefined)}>
                      <Plus className="size-4" />
                      New order at {live.label}
                    </Button>
                  ) : null}
                  {manageTables ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" onPress={() => setMoveFrom({ table: live, mode: "move" })}>
                        <ArrowRightArrowLeft className="size-4" />
                        Move
                      </Button>
                      <Button variant="secondary" onPress={() => setMoveFrom({ table: live, mode: "merge" })}>
                        Merge in
                      </Button>
                      <Button
                        variant="secondary"
                        className="col-span-2"
                        isDisabled={pending}
                        onPress={() =>
                          run(
                            () => releaseAction(live.sessionId as string),
                            `Table ${live.label} released for cleaning`,
                          )
                        }
                      >
                        <Receipt className="size-4" />
                        Release table
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
              {manageTables && TABLE_MOVES[live.status].length ? (
                <div className="flex flex-col gap-2 border-t border-separator pt-3">
                  <Label>Set the table to</Label>
                  <div className="flex flex-wrap gap-2">
                    {TABLE_MOVES[live.status].map((s: TableStatus) => (
                      <Button
                        key={s}
                        size="sm"
                        variant="secondary"
                        isDisabled={pending}
                        onPress={() =>
                          run(() => tableStatusAction(live.id, s), `${live.label}: ${TABLE_STATUS_LABEL[s]}`)
                        }
                      >
                        {s === "available" && live.status === "cleaning" ? <Bucket className="size-4" /> : null}
                        {TABLE_STATUS_LABEL[s]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </aside>
      </div>

      <RegionOverlays>
        {seatFor ? (
          <PosDialog
            isOpen
            onOpenChange={(open) => !open && setSeatFor(null)}
            title={`Seat guests at ${seatFor.label}`}
            subtitle={`${seatFor.seats} seats`}
            footer={
              <>
                <Button variant="secondary" onPress={() => setSeatFor(null)}>
                  Cancel
                </Button>
                <Button
                  isDisabled={pending}
                  onPress={() =>
                    run(
                      () => seatAction(seatFor.id, guests),
                      `${guests} seated at ${seatFor.label}`,
                      () => setSeatFor(null),
                    )
                  }
                >
                  Seat {guests}
                </Button>
              </>
            }
          >
            <div className="flex items-center gap-3">
              <Label id="guests-l">Guests</Label>
              <NumberStepper
                aria-labelledby="guests-l"
                value={guests}
                minValue={1}
                maxValue={seatFor.seats * 2}
                onChange={(v) => setGuests(Number.isNaN(v) ? 1 : v)}
              >
                <NumberStepper.Group>
                  <NumberStepper.DecrementButton aria-label="Fewer guests" />
                  <NumberStepper.Value className="min-w-8 tabular" />
                  <NumberStepper.IncrementButton aria-label="More guests" />
                </NumberStepper.Group>
              </NumberStepper>
            </div>
          </PosDialog>
        ) : null}

        {moveFrom ? (
          <PosDialog
            isOpen
            onOpenChange={(open) => !open && setMoveFrom(null)}
            title={moveFrom.mode === "move" ? `Move ${moveFrom.table.label} to` : `Merge into ${moveFrom.table.label}`}
            subtitle={
              moveFrom.mode === "move"
                ? "The party and every order move. The old table goes to cleaning."
                : "The other table's orders move here. Its table goes to cleaning."
            }
            wide
            footer={
              <Button variant="secondary" onPress={() => setMoveFrom(null)}>
                Cancel
              </Button>
            }
          >
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(110px,1fr))]">
              {floor.tables
                .filter((t) =>
                  moveFrom.mode === "move"
                    ? t.id !== moveFrom.table.id && (t.status === "available" || t.status === "reserved")
                    : t.id !== moveFrom.table.id && t.sessionId,
                )
                .map((t) => (
                  <Button
                    key={t.id}
                    variant="secondary"
                    isDisabled={pending}
                    onPress={() =>
                      run(
                        () =>
                          moveFrom.mode === "move"
                            ? moveSessionAction(moveFrom.table.sessionId as string, t.id)
                            : mergeSessionsAction(moveFrom.table.sessionId as string, t.sessionId as string),
                        moveFrom.mode === "move"
                          ? `Moved to ${t.label}`
                          : `${t.label} merged into ${moveFrom.table.label}`,
                        () => {
                          setMoveFrom(null);
                          setSelected(moveFrom.mode === "move" ? t : moveFrom.table);
                        },
                      )
                    }
                  >
                    {t.label}
                  </Button>
                ))}
            </div>
          </PosDialog>
        ) : null}
      </RegionOverlays>
    </PosShell>
  );
}

const GLYPH_TONE: Record<TableStatus, { table: string; seat: string; taken: string }> = {
  available: { table: "bg-success-soft border-success/40", seat: "bg-success/25", taken: "bg-success" },
  occupied: { table: "bg-warning-soft border-warning/50", seat: "bg-warning/25", taken: "bg-warning" },
  reserved: {
    table: "bg-default border-dashed border-foreground/40",
    seat: "bg-foreground/15",
    taken: "bg-foreground/50",
  },
  bill_requested: { table: "bg-danger-soft border-danger/40", seat: "bg-danger/25", taken: "bg-danger" },
  cleaning: { table: "bg-default border-separator", seat: "bg-foreground/15", taken: "bg-foreground/50" },
};

/** A table seen from above: the top, and its chairs on two sides, the taken ones filled. Decoration only. */
function TableGlyph({
  seats,
  guests,
  status,
  large,
}: {
  seats: number;
  guests: number;
  status: TableStatus;
  large?: boolean;
}) {
  const shown = Math.min(Math.max(seats, 1), 12);
  const top = Math.ceil(shown / 2);
  const bottom = shown - top;
  const tone = GLYPH_TONE[status];
  const chair = (i: number) => (
    <span key={i} className={`h-2 w-5 rounded-full ${i < guests ? tone.taken : tone.seat}`} />
  );
  return (
    <span aria-hidden="true" className={`flex flex-col items-center gap-1.5 ${large ? "py-2" : ""}`}>
      <span className="flex gap-1.5">{Array.from({ length: top }, (_, i) => chair(i))}</span>
      <span
        className={`rounded-xl border ${tone.table} ${large ? "h-14" : "h-10"}`}
        style={{ width: `${Math.max(64, top * 26 + 12)}px` }}
      />
      <span className="flex gap-1.5">{Array.from({ length: bottom }, (_, i) => chair(top + i))}</span>
    </span>
  );
}

function OrderRow({ order, onOpen }: { order: PosOrderSummary; onOpen: () => void }) {
  return (
    <Card variant="secondary" className="gap-1 p-3">
      <button type="button" onClick={onOpen} className="flex flex-col gap-1 text-left">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold tabular">{order.orderNumber}</span>
          <StatusChip color={ORDER_COLOR[order.status]}>{ORDER_STATUS_LABEL[order.status]}</StatusChip>
        </span>
        <span className="text-[12px] text-muted tabular">
          {order.lineCount} lines · {money(order.totalRwf)}
          {order.settlement.outstandingRwf > 0 ? ` · owes ${money(order.settlement.outstandingRwf)}` : " · paid"}
        </span>
      </button>
    </Card>
  );
}
