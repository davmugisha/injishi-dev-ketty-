"use client";

import {
  ArrowDownToLine,
  ArrowRightArrowLeft,
  Bucket,
  Copy,
  Envelope,
  Plus,
  Printer,
  QrCode as QrIcon,
  Receipt,
  ShoppingBag,
} from "@gravity-ui/icons";
import { Button, Card, Label, Tabs, ToggleButton, toast } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { NumberStepper } from "@heroui-pro/react/number-stepper";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { RegionOverlays } from "@/features/outlets/shared";
import {
  ORDER_STATUS_LABEL,
  type PosFloor,
  type PosOrder,
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
  orderAction,
  releaseAction,
  seatAction,
  tableStatusAction,
} from "./actions";
import { ReceiptDialog } from "./ebm-receipt";
import { EmailReceiptDialog } from "./mobile-payment";
import { BILL_MONEY_LABEL, billMoney, isMyTable, releaseBlockers, sittingMoney } from "./payment-flow";
import { usePosMe } from "./pos-me";
import { PosShell } from "./pos-shell";
import { downloadTablePng, guestTableLink, printTableCards, QrCode, tableCode, tableLink } from "./qr-card";
import {
  clock,
  GuestQrChip,
  money,
  ORDER_COLOR,
  PosDialog,
  QR_ORDER_LABEL,
  StatusChip,
  TABLE_COLOR,
  usePosAction,
  usePressKey,
} from "./shared";

/** The status legend under the area tabs: the same colours as the table cards. */
const LEGEND: { status: TableStatus; dot: string }[] = [
  { status: "available", dot: "bg-success" },
  { status: "occupied", dot: "bg-warning" },
  { status: "bill_requested", dot: "bg-danger" },
  { status: "reserved", dot: "bg-foreground/50" },
  { status: "cleaning", dot: "bg-foreground/25" },
];

/**
 * The floor (POS spec §5, tables and service): every table of the outlet by dining area, with who sits
 * there and what they still owe. A table opens a session; orders are taken on the session.
 */
export function PosFloorView({
  outlets,
  outlet,
  floor,
  orders,
  paidBills = [],
  can,
  qrCodes = {},
}: {
  outlets: PosOutlet[];
  outlet: PosOutlet;
  floor: PosFloor;
  orders: PosOrderSummary[];
  /** Bills already paid in full on tables still seated (read only): they stay in the table's panel for the receipt. */
  paidBills?: PosOrderSummary[];
  can: string[];
  /** Each table's permanent guest-ordering code, by table id (migration 0156). */
  qrCodes?: Record<string, string>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { run, pending } = usePosAction();
  // A table's QR code opens the floor with that table chosen (`?table=`), in its own area.
  const linked = floor.tables.find((t) => t.id === params.get("table")) ?? null;
  const [area, setArea] = useState(linked?.areaId ?? floor.areas[0]?.id ?? "");
  const [selected, setSelected] = useState<PosTable | null>(linked);
  const [qrSheet, setQrSheet] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const areaName = new Map(floor.areas.map((a) => [a.id, a.name]));
  const venue = outlet.name;
  // The QR on a table opens that table's guest menu (`/t/<code>`); a table without a code yet keeps the staff link.
  const linkFor = (tableId: string) =>
    qrCodes[tableId] ? guestTableLink(origin, qrCodes[tableId]) : tableLink(origin, outlet.id, tableId);
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
  // Every bill of the seated party, the paid ones too (for the receipt), oldest first.
  const sessionOrders = live?.sessionId
    ? [...orders, ...paidBills.filter((p) => !orders.some((o) => o.id === p.id))]
        .filter((o) => o.tableSessionId === live.sessionId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  // Display only: why the API would refuse the release right now (a draft, money owed, a payment the cashier has
  // not confirmed). The API checks again on release and stays the judge.
  const blockers = releaseBlockers(sessionOrders);
  // What the whole sitting still needs: money to ask for, and money waiting for the cashier (which is NOT paid).
  const sitting = sittingMoney(sessionOrders);
  // The tables whose bills hold a MoMo or Airtel payment the cashier has not confirmed yet.
  const waitingSessions = useMemo(
    () => new Set(orders.filter((o) => o.settlement.pendingRwf > 0 && o.tableSessionId).map((o) => o.tableSessionId)),
    [orders],
  );
  const me = usePosMe();
  const [mineOnly, setMineOnly] = useState(false);
  const mine = floor.tables.filter((t) => isMyTable(t, me?.name));
  // The tables the guests have left: clear and clean them, then make them available (no API time is shown yet).
  const [cleanOnly, setCleanOnly] = useState(false);
  const toClean = floor.tables.filter((t) => t.status === "cleaning");
  const shownTables = cleanOnly ? toClean : mineOnly ? mine : floor.tables.filter((t) => t.areaId === area);
  const [receiptOrder, setReceiptOrder] = useState<PosOrder | null>(null);
  const [emailFor, setEmailFor] = useState<{ id: string; orderNumber: string } | null>(null);
  const [reading, startReading] = useTransition();
  const showReceipt = (orderId: string) =>
    startReading(async () => {
      const r = await orderAction(orderId);
      if (!r.ok) {
        toast.danger(r.error);
        return;
      }
      setReceiptOrder(r.value);
    });
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
    { key: "reserved", label: "Reserved", value: tally("reserved"), tone: "bg-foreground/50" },
    // Its own tile now (it used to share one with Reserved): the tables waiting to be cleaned.
    { key: "cleaning", label: "To clean", value: tally("cleaning"), tone: "bg-foreground/25" },
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
        <>
          {floor.tables.length ? (
            <Button variant="secondary" onPress={() => setQrSheet(true)}>
              <QrIcon className="size-4" />
              Table QR codes
            </Button>
          ) : null}
          {sell ? (
            <Button isDisabled={pending} onPress={() => openOrder(undefined)}>
              <ShoppingBag className="size-4" />
              New takeaway
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 md:flex-row md:overflow-hidden md:px-6">
        <div className="flex min-w-0 flex-col gap-4 md:flex-1 md:overflow-y-auto md:pb-2">
          <section
            data-ui="floor-stats"
            aria-label="Tables now"
            className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 xl:grid-cols-6"
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

          {(sell && (mine.length > 0 || mineOnly)) || toClean.length > 0 || cleanOnly ? (
            <div className="-mb-1 flex flex-wrap items-center gap-2">
              {sell && (mine.length > 0 || mineOnly) ? (
                <ToggleButton
                  isSelected={mineOnly}
                  onChange={(on) => {
                    setMineOnly(on);
                    if (on) setCleanOnly(false);
                  }}
                  data-ui="my-tables"
                >
                  My tables · {mine.length}
                </ToggleButton>
              ) : null}
              {toClean.length > 0 || cleanOnly ? (
                <ToggleButton
                  isSelected={cleanOnly}
                  onChange={(on) => {
                    setCleanOnly(on);
                    if (on) setMineOnly(false);
                  }}
                  data-ui="to-clean"
                >
                  <Bucket className="size-4" />
                  To clean · {toClean.length}
                </ToggleButton>
              ) : null}
              <span className="text-[12px] text-muted">
                {cleanOnly
                  ? "The tables the guests have left, in every area. Clean them, then make them available."
                  : mineOnly
                    ? "Only the tables you serve, in every area."
                    : "Show only the tables you serve, or the tables to clean."}
              </span>
            </div>
          ) : null}

          {mineOnly || cleanOnly ? null : (
            <Tabs variant="secondary" selectedKey={area} onSelectionChange={(k) => setArea(String(k))}>
              <Tabs.ListContainer className="overflow-x-auto pb-1">
                <Tabs.List aria-label="Dining area" className="gap-2 border-0 shadow-none">
                  {floor.areas.map((a) => (
                    <Tabs.Tab key={a.id} id={a.id} className="pos-chip">
                      {a.name}
                      <span className="pos-chip-count tabular">
                        {floor.tables.filter((t) => t.areaId === a.id && t.status === "available").length}/
                        {floor.tables.filter((t) => t.areaId === a.id).length} free
                        {toClean.some((t) => t.areaId === a.id)
                          ? ` · ${toClean.filter((t) => t.areaId === a.id).length} to clean`
                          : ""}
                      </span>
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          )}

          {floor.tables.length ? (
            <ul aria-label="Table colours" className="-mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
              {LEGEND.map((l) => (
                <li key={l.status} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${l.dot}`} aria-hidden="true" />
                  {TABLE_STATUS_LABEL[l.status]}
                </li>
              ))}
            </ul>
          ) : null}

          {cleanOnly && toClean.length === 0 ? (
            <p data-ui="nothing-to-clean" className="text-[13px] text-muted">
              No table is waiting to be cleaned.
            </p>
          ) : null}

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
              {shownTables.map((t) => (
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
                  {t.qrOrders ? (
                    <span
                      data-ui="table-qr-orders"
                      className="-mt-1 self-start rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-soft-foreground"
                    >
                      {t.qrOrders === 1 ? QR_ORDER_LABEL : `${t.qrOrders} × ${QR_ORDER_LABEL}`}
                    </span>
                  ) : null}
                  {t.sessionId && waitingSessions.has(t.sessionId) ? (
                    <span
                      data-ui="table-waiting-cashier"
                      className="-mt-1 self-start rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-soft-foreground"
                    >
                      Waiting for the cashier
                    </span>
                  ) : null}
                  {t.status === "cleaning" ? (
                    <span
                      data-ui="table-needs-cleaning"
                      className="-mt-1 flex items-center gap-1 self-start rounded-full bg-default px-2 py-0.5 text-[11px] font-semibold text-foreground"
                    >
                      <Bucket className="size-3" />
                      Needs cleaning
                    </span>
                  ) : null}
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
                  ) : t.status === "cleaning" ? (
                    <span className="truncate text-[11px] text-muted">Clean it, then make it available</span>
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
                ) : live.status === "cleaning" ? (
                  // Waiting for cleaning (the guests left). The same move as before (Cleaning → Available, by hand),
                  // now the panel's main button instead of a small one at the bottom.
                  <div data-ui="cleaning-panel" className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1 rounded-xl bg-[var(--pos-band)] px-3 py-2.5 text-[13px]">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <Bucket className="size-4" />
                        Waiting for cleaning
                      </p>
                      <p className="text-muted">
                        Nobody can be seated here, and guests can't order from its QR code, until it is marked cleaned.
                      </p>
                    </div>
                    {manageTables ? (
                      <Button
                        size="lg"
                        isDisabled={pending}
                        data-ui="make-available"
                        onPress={() =>
                          run(
                            () => tableStatusAction(live.id, "available"),
                            `${live.label} is clean and available. Guests can be seated there again.`,
                          )
                        }
                      >
                        <Bucket className="size-4" />
                        Table cleaned · make it available
                      </Button>
                    ) : (
                      <p className="text-[12px] text-muted">A waiter or a manager marks it cleaned.</p>
                    )}
                  </div>
                ) : null
              ) : (
                <>
                  <p className="text-[13px] text-muted" data-ui="sitting-summary">
                    {live.guestCount} guests · {live.waiterName ?? "No waiter"} ·{" "}
                    {/* From the sitting's bills when the floor has them: money waiting for the cashier is NOT owed. */}
                    {sessionOrders.length
                      ? sitting.payableRwf > 0 || sitting.pendingRwf > 0
                        ? [
                            sitting.payableRwf > 0 ? `${money(sitting.payableRwf)} to pay` : null,
                            sitting.pendingRwf > 0 ? `${money(sitting.pendingRwf)} waiting for the cashier` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "nothing owed"
                      : `${money(live.outstandingRwf)} owed`}
                  </p>
                  {sessionOrders.map((o) => (
                    <BillRow
                      key={o.id}
                      order={o}
                      busy={reading}
                      onOpen={() => router.push(`/pos/till?order=${o.id}`)}
                      onPrint={() => showReceipt(o.id)}
                      onEmail={() => setEmailFor({ id: o.id, orderNumber: o.orderNumber })}
                    />
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
                      {blockers.length ? (
                        <div
                          data-ui="release-blocked"
                          className="col-span-2 flex flex-col gap-1 rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-soft-foreground"
                        >
                          <p className="font-semibold">
                            {live.label} can't be released yet. Every bill must be sent and paid first:
                          </p>
                          <ul className="flex list-disc flex-col gap-0.5 pl-4">
                            {blockers.map((b) => (
                              <li key={b}>{b}</li>
                            ))}
                          </ul>
                          {blockers.length > 1 && (sitting.payableRwf > 0 || sitting.pendingRwf > 0) ? (
                            <p data-ui="release-blocked-total" className="tabular">
                              In all:{" "}
                              {[
                                sitting.payableRwf > 0 ? `${money(sitting.payableRwf)} still to pay` : null,
                                sitting.pendingRwf > 0 ? `${money(sitting.pendingRwf)} waiting for the cashier` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                              .
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="col-span-2 text-[12px] text-muted" data-ui="release-ready">
                          All paid. When the guests have left, release the table: it goes to Cleaning, and becomes
                          Available only once it is marked cleaned.
                        </p>
                      )}
                      <Button
                        variant="secondary"
                        className="col-span-2"
                        isDisabled={pending || blockers.length > 0}
                        data-ui="release-table"
                        onPress={() =>
                          run(
                            () => releaseAction(live.sessionId as string),
                            `Table ${live.label} is being cleaned. Nobody can be seated there yet.`,
                          )
                        }
                      >
                        <Receipt className="size-4" />
                        Guests left · release for cleaning
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
              {origin ? (
                <div data-ui="table-qr" className="flex items-center gap-3 rounded-2xl bg-[var(--pos-band)] p-3">
                  <QrCode value={linkFor(live.id)} size={84} label={`QR code for table ${live.label}`} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="text-[13px] leading-tight font-semibold">Table QR code</p>
                    <p className="text-[11.5px] leading-snug text-muted">
                      Code {tableCode(live.label, live.id)} ·{" "}
                      {qrCodes[live.id]
                        ? "guests scan it to see the menu and order to this table"
                        : "scan with a staff phone to open this table"}
                    </p>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        isIconOnly
                        aria-label={`Download the QR card of ${live.label}`}
                        onPress={() =>
                          downloadTablePng(
                            venue,
                            live.label,
                            areaName.get(live.areaId) ?? "",
                            linkFor(live.id),
                            tableCode(live.label, live.id),
                          )
                        }
                      >
                        <ArrowDownToLine className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        isIconOnly
                        aria-label={`Copy the link of ${live.label}`}
                        onPress={() =>
                          navigator.clipboard
                            .writeText(linkFor(live.id))
                            .then(() => toast.success(`Link of ${live.label} copied`))
                            .catch(() => toast.danger("The browser did not allow copying"))
                        }
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        isIconOnly
                        aria-label={`Print the QR card of ${live.label}`}
                        onPress={() =>
                          printTableCards(venue, [
                            {
                              label: live.label,
                              area: areaName.get(live.areaId) ?? "",
                              link: linkFor(live.id),
                              code: tableCode(live.label, live.id),
                              seats: live.seats,
                            },
                          ]) || toast.danger("Allow pop-ups to print the card")
                        }
                      >
                        <Printer className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
              {/* A table in Cleaning has its one move (make it available) at the top of the panel instead. */}
              {manageTables && live.status !== "cleaning" && TABLE_MOVES[live.status].length ? (
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
                        {s === "cleaning" ? <Bucket className="size-4" /> : null}
                        {/* By hand, a free table that still needs cleaning goes to Cleaning (the same move as before). */}
                        {s === "cleaning" ? "Needs cleaning" : TABLE_STATUS_LABEL[s]}
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
        {receiptOrder ? (
          <ReceiptDialog order={receiptOrder} outlet={outlet} onClose={() => setReceiptOrder(null)} />
        ) : null}
        {emailFor ? (
          <EmailReceiptDialog
            orderId={emailFor.id}
            orderNumber={emailFor.orderNumber}
            onClose={() => setEmailFor(null)}
          />
        ) : null}
        {qrSheet && origin ? (
          <PosDialog
            isOpen
            onOpenChange={(open) => !open && setQrSheet(false)}
            title="Table QR codes"
            subtitle={`One code per table at ${venue}. Print them as table cards: a guest who scans one sees the menu on their phone and orders straight to that table, the kitchen and the bar.`}
            wide
            footer={
              <>
                <Button variant="secondary" onPress={() => setQrSheet(false)}>
                  Close
                </Button>
                <Button
                  onPress={() =>
                    printTableCards(
                      venue,
                      floor.tables.map((t) => ({
                        label: t.label,
                        area: areaName.get(t.areaId) ?? "",
                        link: linkFor(t.id),
                        code: tableCode(t.label, t.id),
                        seats: t.seats,
                      })),
                    ) || toast.danger("Allow pop-ups to print the cards")
                  }
                >
                  <Printer className="size-4" />
                  Print all {floor.tables.length} cards
                </Button>
              </>
            }
          >
            <div className="flex max-h-[62vh] flex-col gap-5 overflow-y-auto pr-1">
              {floor.areas.map((a) => {
                const tables = floor.tables.filter((t) => t.areaId === a.id);
                if (!tables.length) return null;
                return (
                  <section key={a.id} aria-label={a.name} className="flex flex-col gap-2">
                    <h3 className="text-[13px] font-semibold">
                      {a.name} <span className="font-normal text-muted">· {tables.length} tables</span>
                    </h3>
                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                      {tables.map((t) => (
                        <article
                          key={t.id}
                          data-ui="qr-card"
                          className="flex flex-col items-center gap-1.5 rounded-2xl border border-t-4 border-[var(--pos-card-border)] border-t-[#0b8442] bg-white p-3 text-center text-[#0f1a14]"
                        >
                          <span className="w-full truncate text-[10px] font-semibold tracking-[0.12em] text-[#4b5563] uppercase">
                            {outlet.branchName ?? venue}
                          </span>
                          <span className="text-[22px] leading-6 font-bold">{t.label}</span>
                          <QrCode value={linkFor(t.id)} size={112} label={`QR code for table ${t.label}`} />
                          <span className="text-[10.5px] tracking-wide text-[#6b7280]">{tableCode(t.label, t.id)}</span>
                          <span className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              isIconOnly
                              aria-label={`Download the QR card of ${t.label}`}
                              onPress={() =>
                                downloadTablePng(venue, t.label, a.name, linkFor(t.id), tableCode(t.label, t.id))
                              }
                            >
                              <ArrowDownToLine className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              isIconOnly
                              aria-label={`Copy the link of ${t.label}`}
                              onPress={() =>
                                navigator.clipboard
                                  .writeText(linkFor(t.id))
                                  .then(() => toast.success(`Link of ${t.label} copied`))
                                  .catch(() => toast.danger("The browser did not allow copying"))
                              }
                            >
                              <Copy className="size-4" />
                            </Button>
                          </span>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </PosDialog>
        ) : null}
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

/**
 * One bill of the seated party, for the waiter: total, paid, waiting for the cashier (NOT paid) and the balance.
 * A bill paid in full offers its receipt, printed or emailed, only if the customer asks.
 */
function BillRow({
  order,
  busy,
  onOpen,
  onPrint,
  onEmail,
}: {
  order: PosOrderSummary;
  busy: boolean;
  onOpen: () => void;
  onPrint: () => void;
  onEmail: () => void;
}) {
  const m = billMoney(order);
  const tone =
    m.state === "paid" ? "success" : m.state === "waiting" ? "warning" : m.state === "part_paid" ? "accent" : "default";
  return (
    <Card
      variant="secondary"
      className="gap-2 p-3"
      data-ui="bill-row"
      data-bill={order.orderNumber}
      data-state={m.state}
    >
      <button type="button" onClick={onOpen} className="flex flex-col gap-2 text-left">
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold whitespace-nowrap tabular">{order.orderNumber}</span>
          <span className="flex flex-wrap items-center gap-1">
            {order.source === "table_qr" ? <GuestQrChip /> : null}
            <StatusChip color={tone}>{BILL_MONEY_LABEL[m.state]}</StatusChip>
          </span>
        </span>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[12px] tabular">
          <dt className="text-muted">Total</dt>
          <dd className="text-right">{money(m.totalRwf)}</dd>
          <dt className="text-muted">Paid</dt>
          <dd className="text-right">{money(m.paidRwf)}</dd>
          {m.waitingRwf ? (
            <>
              <dt className="text-warning-soft-foreground">Waiting for the cashier</dt>
              <dd className="text-right text-warning-soft-foreground">{money(m.waitingRwf)}</dd>
            </>
          ) : null}
          <dt className="font-semibold">Balance</dt>
          <dd className="text-right font-semibold">{money(m.balanceRwf)}</dd>
        </dl>
        <span className="text-[11.5px] text-muted">
          {order.lineCount} line{order.lineCount === 1 ? "" : "s"} · {ORDER_STATUS_LABEL[order.status]}
        </span>
      </button>
      {m.state === "paid" ? (
        <span className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" isDisabled={busy} onPress={onPrint} data-ui="bill-print-receipt">
            <Printer className="size-4" />
            Print receipt
          </Button>
          <Button size="sm" variant="secondary" onPress={onEmail} data-ui="bill-email-receipt">
            <Envelope className="size-4" />
            Email receipt
          </Button>
        </span>
      ) : null}
    </Card>
  );
}

function OrderRow({ order, onOpen }: { order: PosOrderSummary; onOpen: () => void }) {
  return (
    <Card variant="secondary" className="gap-1 p-3">
      <button type="button" onClick={onOpen} className="flex flex-col gap-1 text-left">
        <span className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold whitespace-nowrap tabular">{order.orderNumber}</span>
          <span className="flex flex-wrap items-center gap-1">
            {order.source === "table_qr" ? <GuestQrChip /> : null}
            <StatusChip color={ORDER_COLOR[order.status]}>{ORDER_STATUS_LABEL[order.status]}</StatusChip>
          </span>
        </span>
        <span className="text-[12px] text-muted tabular">
          {order.lineCount} lines · {money(order.totalRwf)}
          {order.settlement.outstandingRwf > 0 ? ` · owes ${money(order.settlement.outstandingRwf)}` : " · paid"}
        </span>
      </button>
    </Card>
  );
}
