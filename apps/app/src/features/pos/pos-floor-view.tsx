"use client";

import { ArrowRightArrowLeft, Bucket, Plus, Receipt, ShoppingBag } from "@gravity-ui/icons";
import { Button, Card, Label, Tabs, Toast } from "@heroui/react";
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
import { PosNav } from "./pos-nav";
import {
  clock,
  money,
  ORDER_COLOR,
  PosDialog,
  PosHeader,
  StatusChip,
  TABLE_COLOR,
  usePosAction,
  usePressKey,
} from "./shared";

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

  return (
    <div className="relative flex h-full flex-col bg-background">
      <PosHeader title="Floor" outlet={outlet}>
        {outlets.length > 1 ? (
          <Tabs
            variant="secondary"
            selectedKey={outlet.id}
            onSelectionChange={(k) => router.push(`/pos/floor?outlet=${String(k)}`)}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="Outlet">
                {outlets.map((o) => (
                  <Tabs.Tab key={o.id} id={o.id}>
                    {o.branchName ?? o.name}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        ) : null}
        {sell ? (
          <Button isDisabled={pending} onPress={() => openOrder(undefined)}>
            <ShoppingBag className="size-4" />
            New takeaway
          </Button>
        ) : null}
        <PosNav current="PosFloor" outletId={outlet.id} can={can} />
      </PosHeader>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          <Tabs variant="secondary" selectedKey={area} onSelectionChange={(k) => setArea(String(k))}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Dining area">
                {floor.areas.map((a) => (
                  <Tabs.Tab key={a.id} id={a.id}>
                    {a.name}
                    <span className="ml-1 text-muted tabular">
                      {floor.tables.filter((t) => t.areaId === a.id && t.status === "available").length}/
                      {floor.tables.filter((t) => t.areaId === a.id).length}
                    </span>
                    <Tabs.Indicator />
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
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {floor.tables
                .filter((t) => t.areaId === area)
                .map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t)}
                    aria-pressed={live?.id === t.id}
                    className={`flex min-h-[112px] flex-col gap-1 rounded-2xl border p-3 text-left transition focus-visible:outline-2 focus-visible:outline-accent ${
                      live?.id === t.id
                        ? "border-accent bg-accent/5"
                        : "border-separator bg-surface hover:border-accent/50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[20px] font-semibold">{t.label}</span>
                      <StatusChip color={TABLE_COLOR[t.status]}>{TABLE_STATUS_LABEL[t.status]}</StatusChip>
                    </span>
                    <span className="text-[12px] text-muted">
                      {t.sessionId ? `${t.guestCount} of ${t.seats} seats` : `${t.seats} seats`}
                    </span>
                    {t.sessionId ? (
                      <>
                        <span className="text-[12px] text-muted">
                          {t.waiterName ?? "No waiter"} · since {t.openedAt ? clock(t.openedAt) : ""}
                        </span>
                        <span className="text-[13px] font-medium tabular">
                          {t.outstandingRwf > 0 ? `Owes ${money(t.outstandingRwf)}` : "Nothing owed"}
                        </span>
                      </>
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

        <aside className="flex w-[340px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-separator bg-surface p-4">
          {!live ? (
            <p className="text-[13px] text-muted">
              Choose a table to seat a party, open its bill or change its status.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-[18px] font-semibold">Table {live.label}</h2>
                <StatusChip color={TABLE_COLOR[live.status]}>{TABLE_STATUS_LABEL[live.status]}</StatusChip>
              </div>
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
        <Toast.Provider placement="bottom" />
      </RegionOverlays>
    </div>
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
