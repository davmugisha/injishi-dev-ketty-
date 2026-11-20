"use client";

import { ArrowRotateRight, Magnifier } from "@gravity-ui/icons";
import { Button, Card, Input, Label, TextArea, TextField, ToggleButton } from "@heroui/react";
import { LinkButton } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RegionOverlays } from "@/features/outlets/shared";
import type { PosAwaitingPayments, PosOrderSummary, PosOutlet, PosRegister, PosShift } from "@/server/pos";
import {
  cashMovementAction,
  closeShiftAction,
  decideMovementAction,
  openShiftAction,
  orderAction,
  reviewShiftAction,
} from "./actions";
import { MethodBadge, PaymentsAwaiting, SectionHead } from "./mobile-payment";
import {
  BILL_STAGE_LABEL,
  type BillStage,
  billStage,
  matchesBill,
  paidMethods,
  sortBills,
  whereOf,
} from "./payment-flow";
import { PosShell } from "./pos-shell";
import { clock, GuestQrChip, money, PosDialog, parseRwf, SimulationNotice, StatusChip, usePosAction } from "./shared";

/** How often the desk asks for news (a payment a waiter starts, a bill sent from the floor). */
const REFRESH_MS = 6_000;

/**
 * The Cashier Desk (POS spec §9): what needs the cashier now, in the order it is done.
 *
 * Summary → 1. confirm mobile payments → 2. collect bills → 3. paid today; beside it, the cashier's own shift
 * (cash in and out, close) and the recent shifts a reviewer checks. A cashier opens a shift with a float, records
 * cash in and out with a reason, and closes with a count; the API freezes the expected cash and the variance.
 *
 * PRESENTATION ONLY. Taking a payment still opens the bill on the till (`pay=1`), where cash, change, tips and the
 * shift rules are the till's and the API's; MoMo and Airtel are confirmed through their own dialogs.
 */
export function PosShiftView({
  outlet,
  outlets,
  registers,
  mine,
  shifts,
  bills = [],
  awaiting = null,
  paid = [],
  loadedAt,
  can,
  userId,
}: {
  outlet: PosOutlet;
  outlets: PosOutlet[];
  registers: PosRegister[];
  mine: PosShift | null;
  shifts: PosShift[];
  /** Open bills with money still owed (only for someone who takes payment). */
  bills?: PosOrderSummary[];
  /** MTN MoMo and Airtel Money payments waiting for the cashier to see the money arrive (null when not read). */
  awaiting?: PosAwaitingPayments | null;
  /** Bills paid in full today, by any method, newest first (read only). */
  paid?: PosOrderSummary[];
  /** When the server read this page: the "Updated" time. */
  loadedAt?: string;
  can: string[];
  userId: string | null;
}) {
  const router = useRouter();
  const { run, pending } = usePosAction();
  const [openOn, setOpenOn] = useState<PosRegister | null>(null);
  const [float, setFloat] = useState("20000");
  const [move, setMove] = useState<{ kind: "paid_in" | "paid_out"; amount: string; reason: string } | null>(null);
  const [closing, setClosing] = useState<{ counted: string; note: string; handover: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, startRefresh] = useTransition();
  const operate = can.includes("register.operate");
  const review = can.includes("shift.review");
  const checkout = can.includes("pos.checkout");
  const counted = closing ? parseRwf(closing.counted) : null;

  // The desk keeps itself current: a payment a waiter starts or a bill sent from the floor appears by itself.
  useEffect(() => {
    if (!checkout) return;
    const t = setInterval(() => {
      setNow(Date.now());
      if (document.visibilityState === "visible") startRefresh(() => router.refresh());
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [checkout, router]);

  const owed = bills.reduce((a, b) => a + b.settlement.outstandingRwf, 0);
  const waitingTotal = (awaiting?.awaiting ?? []).reduce((a, p) => a + p.amountRwf, 0);
  const paidTotal = paid.reduce((a, b) => a + b.totalRwf, 0);

  return (
    <PosShell
      board="PosShift"
      title={operate ? "Cashier desk" : "Cashier shifts"}
      subtitle={`${outlet.name}${outlet.branchName ? ` · ${outlet.branchName}` : ""}`}
      outlet={outlet}
      outlets={outlets}
      outletId={outlet.id}
      switchHref="/pos/shift"
      can={can}
      actions={
        checkout ? (
          <span
            data-ui="desk-live"
            className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12px] text-muted"
          >
            <ArrowRotateRight className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Updating…" : loadedAt ? `Updated ${clock(loadedAt)} · live` : "Live"}
          </span>
        ) : null
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6 md:px-6">
        {checkout ? (
          <nav aria-label="Desk summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <SummaryTile
              href="#desk-confirm"
              label="To confirm"
              value={String(awaiting?.awaiting.length ?? 0)}
              detail={awaiting?.awaiting.length ? `${money(waitingTotal)} MoMo / Airtel` : "Nothing waiting"}
              tone={awaiting?.awaiting.length ? "warning" : "calm"}
            />
            <SummaryTile
              href="#desk-bills"
              label="Bills to collect"
              value={String(bills.length)}
              detail={bills.length ? `${money(owed)} still owed` : "Nothing owed"}
              tone={bills.length ? "attention" : "calm"}
            />
            <SummaryTile
              href="#desk-paid"
              label="Paid today"
              value={String(paid.length)}
              detail={paid.length ? `${money(paidTotal)} in all` : "No bill paid yet today"}
              tone="done"
            />
            <SummaryTile
              href="#desk-shift"
              label="Expected in drawer"
              value={mine ? money(mine.expectedCashRwf) : "—"}
              detail={mine ? `${mine.registerName} · cash only` : operate ? "No shift open" : "You do not run a till"}
              tone={mine ? "calm" : "attention"}
            />
          </nav>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            {!mine && operate ? (
              <Card
                id="desk-shift"
                className="scroll-mt-4 gap-3 rounded-[20px] p-4 shadow-none ring-2 ring-warning/40 sm:p-5"
              >
                <SectionHead
                  title="Open a shift to take cash"
                  hint="Cash lands in a drawer, so it needs your open shift. You can still confirm MTN MoMo and Airtel Money without one."
                />
                <div className="flex flex-wrap gap-2">
                  {registers.length === 0 ? (
                    <p className="text-[13px] text-muted">
                      No register is set up at this outlet. A manager adds one in Setup.
                    </p>
                  ) : null}
                  {registers.map((r) => (
                    <Button key={r.id} variant="secondary" isDisabled={!!r.openShiftId} onPress={() => setOpenOn(r)}>
                      Open on {r.name}
                      {r.openShiftId ? ` · in use by ${r.openShiftCashierName ?? "someone"}` : ""}
                    </Button>
                  ))}
                </div>
              </Card>
            ) : null}
            {checkout && awaiting ? <PaymentsAwaiting data={awaiting} now={now} /> : null}
            {checkout ? <BillsToCollect bills={bills} outletId={outlet.id} hasShift={!!mine} /> : null}
            {checkout ? <PaidToday paid={paid} /> : null}
            {!checkout && !operate ? (
              <p className="text-[13px] text-muted">
                You do not run a till. Shifts other cashiers closed are listed for review.
              </p>
            ) : null}
          </div>

          <aside className="flex min-w-0 flex-col gap-4" aria-label="Shift">
            {mine ? (
              <Card id="desk-shift" className="scroll-mt-4 gap-4 rounded-[20px] p-4 shadow-none sm:p-5">
                <SectionHead
                  title="Your shift"
                  hint={`${mine.registerName} · opened ${clock(mine.openedAt)} with ${money(mine.openingFloatRwf)}`}
                  right={<StatusChip color="success">Open</StatusChip>}
                />
                <div className="rounded-2xl bg-default/50 p-3">
                  <p className="text-[12px] text-muted">Expected in the drawer</p>
                  <p className="text-[24px] leading-8 font-bold tabular">{money(mine.expectedCashRwf)}</p>
                  <p className="text-[11.5px] text-muted">
                    Float + cash taken + cash in − cash out − cash refunds. Count it when you close.
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px] tabular">
                  <Fact label="Cash taken (incl. cash tips)" value={money(mine.cashSalesRwf)} />
                  <Fact label="Cash refunds" value={money(mine.cashRefundsRwf)} />
                  <Fact label="Cash in" value={money(mine.paidInRwf)} />
                  <Fact label="Cash out" value={money(mine.paidOutRwf)} />
                </dl>
                {mine.takingsByMethod.length || mine.tipsRwf ? (
                  <div className="flex flex-col gap-1.5">
                    <p className="text-[12px] font-medium text-muted">Taken in this shift, by method</p>
                    <ul className="flex flex-col gap-1 text-[13px] tabular">
                      {mine.takingsByMethod.map((t) => (
                        <li key={t.method} className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <MethodBadge method={t.method} />
                            <span className="text-muted">× {t.count}</span>
                          </span>
                          <span className="font-medium">{money(t.amountRwf)}</span>
                        </li>
                      ))}
                      {mine.tipsRwf ? (
                        <li className="flex items-center justify-between gap-2">
                          <span className="text-muted">Tips</span>
                          <span className="font-medium">{money(mine.tipsRwf)}</span>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}
                <Movements shift={mine} review={review} userId={userId} pending={pending} run={run} />
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onPress={() => setMove({ kind: "paid_in", amount: "", reason: "" })}>
                    Cash in
                  </Button>
                  <Button variant="secondary" onPress={() => setMove({ kind: "paid_out", amount: "", reason: "" })}>
                    Cash out
                  </Button>
                  <Button
                    variant="danger-soft"
                    className="col-span-2"
                    onPress={() => setClosing({ counted: "", note: "", handover: "" })}
                  >
                    Close shift and count the drawer
                  </Button>
                </div>
              </Card>
            ) : null}

            {review || shifts.length > 0 ? (
              <Card className="gap-2 rounded-[20px] p-4 shadow-none sm:p-5" aria-label="Recent shifts">
                <SectionHead title="Recent shifts" hint={review ? "Closed shifts wait for your review." : undefined} />
                {shifts.length === 0 ? <p className="text-[13px] text-muted">No shifts to show yet.</p> : null}
                <ul className="flex flex-col divide-y divide-separator">
                  {shifts.map((s) => (
                    <li key={s.id} className="flex flex-col gap-1 py-2.5 text-[12.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold">
                          {s.registerName} · {s.cashierName}
                        </span>
                        <StatusChip
                          color={s.status === "open" ? "success" : s.status === "closed" ? "warning" : "default"}
                        >
                          {s.status === "open" ? "Open" : s.status === "closed" ? "To review" : "Reviewed"}
                        </StatusChip>
                      </div>
                      <span className="text-muted tabular">
                        {clock(s.openedAt)}
                        {s.closedAt ? ` – ${clock(s.closedAt)}` : ""} · expected {money(s.expectedCashRwf)}
                        {s.countedCashRwf !== null ? ` · counted ${money(s.countedCashRwf)}` : ""}
                      </span>
                      {s.varianceRwf !== null ? (
                        <span
                          className={`font-semibold tabular ${s.varianceRwf < 0 ? "text-danger" : s.varianceRwf > 0 ? "text-warning" : "text-success-soft-foreground"}`}
                        >
                          {s.varianceRwf === 0
                            ? "Balanced"
                            : s.varianceRwf < 0
                              ? `Short ${money(-s.varianceRwf)}`
                              : `Over ${money(s.varianceRwf)}`}
                        </span>
                      ) : null}
                      {s.closeNote ? <span>Note: {s.closeNote}</span> : null}
                      {s.reviewedByName ? (
                        <span className="text-muted">
                          Reviewed by {s.reviewedByName}
                          {s.reviewNote ? `: ${s.reviewNote}` : ""}
                        </span>
                      ) : null}
                      {review && s.status === "closed" && s.cashierUserId !== userId ? (
                        <Button
                          size="sm"
                          className="self-start"
                          isDisabled={pending}
                          onPress={() => run(() => reviewShiftAction(s.id, "Reviewed"), "Shift reviewed")}
                        >
                          Mark reviewed
                        </Button>
                      ) : null}
                      {review && s.status === "open" && s.id !== mine?.id ? (
                        <Movements shift={s} review={review} userId={userId} pending={pending} run={run} compact />
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <SimulationNotice>
              Only cash is counted into the drawer. MTN MoMo and Airtel Money are confirmed by you once the money
              arrives; card and bank transfer are simulated.
            </SimulationNotice>
          </aside>
        </div>
      </div>

      <RegionOverlays>
        {openOn ? (
          <PosDialog
            isOpen
            onOpenChange={(open) => !open && setOpenOn(null)}
            title={`Open ${openOn.name}`}
            subtitle="Count the float into the drawer."
            footer={
              <>
                <Button variant="secondary" onPress={() => setOpenOn(null)}>
                  Cancel
                </Button>
                <Button
                  isDisabled={pending || parseRwf(float) === null}
                  onPress={() =>
                    run(
                      () => openShiftAction(openOn.id, parseRwf(float) ?? 0),
                      "Shift opened",
                      () => setOpenOn(null),
                    )
                  }
                >
                  Open with {money(parseRwf(float) ?? 0)}
                </Button>
              </>
            }
          >
            <TextField value={float} onChange={setFloat} fullWidth>
              <Label>Opening float (RWF)</Label>
              <Input inputMode="numeric" className="tabular" />
            </TextField>
          </PosDialog>
        ) : null}
        {move && mine ? (
          <PosDialog
            isOpen
            onOpenChange={(open) => !open && setMove(null)}
            title={move.kind === "paid_in" ? "Cash into the drawer" : "Cash out of the drawer"}
            subtitle={
              move.kind === "paid_out" && !review
                ? "A paid out waits for a manager's approval."
                : "Recorded with your name and the reason."
            }
            footer={
              <>
                <Button variant="secondary" onPress={() => setMove(null)}>
                  Cancel
                </Button>
                <Button
                  isDisabled={pending || !parseRwf(move.amount) || move.reason.trim().length < 3}
                  onPress={() =>
                    run(
                      () =>
                        cashMovementAction(mine.id, {
                          kind: move.kind,
                          amountRwf: parseRwf(move.amount) ?? 0,
                          reason: move.reason.trim(),
                        }),
                      "Recorded",
                      () => setMove(null),
                    )
                  }
                >
                  Record
                </Button>
              </>
            }
          >
            <div className="flex gap-1.5">
              <ToggleButton isSelected={move.kind === "paid_in"} onChange={() => setMove({ ...move, kind: "paid_in" })}>
                Cash in
              </ToggleButton>
              <ToggleButton
                isSelected={move.kind === "paid_out"}
                onChange={() => setMove({ ...move, kind: "paid_out" })}
              >
                Cash out
              </ToggleButton>
            </div>
            <TextField value={move.amount} onChange={(v) => setMove({ ...move, amount: v })} fullWidth>
              <Label>Amount (RWF)</Label>
              <Input inputMode="numeric" className="tabular" />
            </TextField>
            <TextField value={move.reason} onChange={(v) => setMove({ ...move, reason: v })} fullWidth isRequired>
              <Label>Reason (required)</Label>
              <Input />
            </TextField>
          </PosDialog>
        ) : null}
        {closing && mine ? (
          <PosDialog
            isOpen
            onOpenChange={(open) => !open && setClosing(null)}
            title="Close the shift"
            subtitle={`Expected in the drawer: ${money(mine.expectedCashRwf)}. Count it before you type.`}
            footer={
              <>
                <Button variant="secondary" onPress={() => setClosing(null)}>
                  Keep it open
                </Button>
                <Button
                  isDisabled={pending || counted === null}
                  onPress={() =>
                    run(
                      () =>
                        closeShiftAction(mine.id, {
                          countedCashRwf: counted ?? 0,
                          closeNote: closing.note.trim() || undefined,
                          handoverNote: closing.handover.trim() || undefined,
                        }),
                      (s) =>
                        s.varianceRwf === 0 ? "Closed and balanced" : `Closed · variance ${money(s.varianceRwf ?? 0)}`,
                      () => setClosing(null),
                    )
                  }
                >
                  Close shift
                </Button>
              </>
            }
          >
            <TextField
              value={closing.counted}
              onChange={(v) => setClosing({ ...closing, counted: v })}
              fullWidth
              isRequired
            >
              <Label>Cash counted (RWF)</Label>
              <Input inputMode="numeric" className="tabular" />
            </TextField>
            {counted !== null ? (
              <p
                className={`text-[15px] font-semibold tabular ${counted - mine.expectedCashRwf < 0 ? "text-danger" : ""}`}
              >
                {counted === mine.expectedCashRwf
                  ? "Balanced"
                  : counted < mine.expectedCashRwf
                    ? `Short ${money(mine.expectedCashRwf - counted)}`
                    : `Over ${money(counted - mine.expectedCashRwf)}`}
              </p>
            ) : null}
            <TextField value={closing.note} onChange={(v) => setClosing({ ...closing, note: v })} fullWidth>
              <Label>Note on the count</Label>
              <TextArea rows={2} />
            </TextField>
            <TextField value={closing.handover} onChange={(v) => setClosing({ ...closing, handover: v })} fullWidth>
              <Label>Handover to the next shift</Label>
              <TextArea rows={2} />
            </TextField>
          </PosDialog>
        ) : null}
      </RegionOverlays>
    </PosShell>
  );
}

/** One figure of the summary row: a link to its section. */
function SummaryTile({
  href,
  label,
  value,
  detail,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
  tone: "warning" | "attention" | "done" | "calm";
}) {
  const ring =
    tone === "warning"
      ? "border-warning/60 bg-warning-soft/50"
      : tone === "attention"
        ? "border-separator bg-surface"
        : tone === "done"
          ? "border-success/40 bg-success-soft/40"
          : "border-separator bg-surface";
  return (
    <a
      href={href}
      data-ui="desk-tile"
      className={`flex min-w-0 flex-col gap-0.5 rounded-2xl border p-3 no-underline transition-colors hover:border-foreground/30 sm:p-4 ${ring}`}
    >
      <span className="text-[12px] font-medium text-muted">{label}</span>
      <span className="text-[19px] leading-7 font-bold break-words tabular sm:text-[26px] sm:leading-8">{value}</span>
      <span className="truncate text-[12px] text-muted">{detail}</span>
    </a>
  );
}

const STAGE_COLOR: Record<BillStage, "success" | "warning" | "default" | "accent"> = {
  ready: "success",
  preparing: "default",
  not_sent: "default",
  confirming: "warning",
};
const FILTERS: { key: "all" | BillStage | "kitchen"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "ready", label: "Ready to pay" },
  { key: "kitchen", label: "Still being prepared" },
  { key: "confirming", label: "Waiting for confirmation" },
];

/**
 * Step 2: every open bill with money still owed, ready-to-pay first. "Take payment" opens the bill on the till with
 * its payment dialog (`pay=1`), exactly as before; a bill whose whole balance waits for a MoMo or Airtel
 * confirmation only opens, so nobody takes it twice.
 */
function BillsToCollect({
  bills,
  outletId,
  hasShift,
}: {
  bills: PosOrderSummary[];
  outletId: string;
  hasShift: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const sorted = useMemo(() => sortBills(bills), [bills]);
  const count = (k: (typeof FILTERS)[number]["key"]) =>
    k === "all"
      ? bills.length
      : bills.filter((b) => {
          const s = billStage(b);
          return k === "kitchen" ? s === "preparing" || s === "not_sent" : s === k;
        }).length;
  const shown = sorted.filter((b) => {
    const s = billStage(b);
    const inFilter = filter === "all" || (filter === "kitchen" ? s === "preparing" || s === "not_sent" : s === filter);
    return inFilter && matchesBill(b, query);
  });
  const owed = bills.reduce((a, b) => a + b.settlement.outstandingRwf, 0);
  return (
    <Card
      id="desk-bills"
      className="scroll-mt-4 gap-3 rounded-[20px] p-4 shadow-none sm:p-5"
      aria-label="Bills waiting for payment"
    >
      <SectionHead
        step={2}
        title="Bills waiting for payment"
        hint={
          bills.length === 0
            ? "Nothing is owed right now. Bills appear here as soon as they are opened on the floor."
            : `${bills.length} open bill${bills.length === 1 ? "" : "s"} · ${money(owed)} still to collect. Ready to pay comes first.`
        }
        right={
          <LinkButton href={`/pos/floor?outlet=${outletId}`} variant="secondary" size="sm">
            Open floor
          </LinkButton>
        }
      />
      {!hasShift && bills.length > 0 ? (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-[12.5px] text-warning-soft-foreground">
          No shift open: open one before taking cash. Payments are recorded against your drawer.
        </p>
      ) : null}
      {bills.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <fieldset className="m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0" aria-label="Show bills">
            {FILTERS.map((f) => (
              <ToggleButton key={f.key} isSelected={filter === f.key} onChange={() => setFilter(f.key)}>
                {f.label} · {count(f.key)}
              </ToggleButton>
            ))}
          </fieldset>
          <label className="relative flex w-full items-center sm:w-[220px]">
            <Magnifier className="pointer-events-none absolute left-3 size-4 text-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Table, bill no., waiter"
              aria-label="Find a bill"
              className="h-9 w-full rounded-xl border border-separator bg-surface pr-3 pl-9 text-[13px] outline-none focus:border-foreground/40"
            />
          </label>
        </div>
      ) : null}
      {bills.length > 0 && shown.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-muted">
          No bill matches. Clear the search or pick another filter.
        </p>
      ) : null}
      {shown.length > 0 ? (
        <ul className="flex flex-col divide-y divide-separator">
          {shown.map((b) => {
            const stage = billStage(b);
            const held = stage === "confirming";
            return (
              <li
                key={b.id}
                data-bill={b.orderNumber}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-x-2 text-[14px] font-semibold">
                    <span className="whitespace-nowrap">{whereOf(b.orderType, b.tableLabel)}</span>
                    <span className="text-[12px] font-normal whitespace-nowrap text-muted tabular">
                      {b.orderNumber}
                    </span>
                    {b.source === "table_qr" ? <GuestQrChip /> : null}
                  </span>
                  <span className="truncate text-[12px] text-muted">
                    {b.waiterName ? `${b.waiterName} · ` : ""}since {clock(b.createdAt)} · {b.lineCount} line
                    {b.lineCount === 1 ? "" : "s"}
                    {b.customer ? ` · ${b.customer.fullName}` : ""}
                  </span>
                </div>
                <span className="text-right text-[16px] font-bold whitespace-nowrap tabular sm:order-3 sm:min-w-[110px]">
                  {money(b.settlement.outstandingRwf)}
                  {b.settlement.collectedRwf > 0 ? (
                    <span className="block text-[11px] font-normal text-muted">of {money(b.totalRwf)} · part paid</span>
                  ) : null}
                </span>
                <span className="sm:order-2">
                  <StatusChip color={STAGE_COLOR[stage]}>{BILL_STAGE_LABEL[stage]}</StatusChip>
                </span>
                {/* `pay=1`: the till opens on this bill with the payment dialog, not on the menu (unchanged). */}
                <LinkButton
                  href={`/pos/till?order=${b.id}&pay=1`}
                  size="sm"
                  variant="secondary"
                  className="justify-self-end sm:order-4 sm:min-w-[118px]"
                >
                  {held ? "View bill" : "Take payment"}
                </LinkButton>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}

/**
 * Step 3: the bills paid in full today, by any method (cash, MTN MoMo, Airtel Money…), newest first. Read only.
 * The methods of each bill are read only when the cashier opens the list, from the bill itself.
 */
function PaidToday({ paid }: { paid: PosOrderSummary[] }) {
  const [open, setOpen] = useState(false);
  const [methods, setMethods] = useState<Record<string, string[] | null>>({});
  const [reading, setReading] = useState(0);
  const asked = useRef(new Set<string>());
  const total = paid.reduce((a, b) => a + b.totalRwf, 0);
  const shown = paid.slice(0, 30);
  // The same bills after the desk's refresh read as the same key: each bill is read once, never again.
  const ids = shown.map((b) => b.id).join(",");

  useEffect(() => {
    if (!open || !ids) return;
    const missing = ids.split(",").filter((id) => !asked.current.has(id));
    if (missing.length === 0) return;
    for (const id of missing) asked.current.add(id);
    setReading((n) => n + missing.length);
    void (async () => {
      for (const id of missing) {
        const r = await orderAction(id);
        setMethods((old) => ({ ...old, [id]: r.ok ? paidMethods(r.value.payments) : null }));
        setReading((n) => n - 1);
      }
    })();
  }, [open, ids]);
  const loading = reading > 0;

  return (
    <Card id="desk-paid" className="scroll-mt-4 gap-3 rounded-[20px] p-4 shadow-none sm:p-5" aria-label="Paid today">
      <SectionHead
        step={3}
        title="Paid today"
        hint={
          paid.length === 0
            ? "No bill has been paid in full today yet."
            : `${paid.length} bill${paid.length === 1 ? "" : "s"} paid in full · ${money(total)}. Cash, MTN MoMo, Airtel Money and every other method.`
        }
        right={
          paid.length ? (
            <Button size="sm" variant="secondary" onPress={() => setOpen((v) => !v)} data-ui="paid-today-toggle">
              {open ? "Hide" : "Show"}
            </Button>
          ) : null
        }
      />
      {open && paid.length > 0 ? (
        <>
          {loading ? <p className="text-[12px] text-muted">Loading how each bill was paid…</p> : null}
          <ul className="flex flex-col divide-y divide-separator" data-ui="paid-today">
            {shown.map((b) => (
              <li
                key={b.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-[13.5px] font-semibold">
                    <span className="whitespace-nowrap">{whereOf(b.orderType, b.tableLabel)}</span>
                    <span className="ml-2 text-[12px] font-normal whitespace-nowrap text-muted tabular">
                      {b.orderNumber}
                    </span>
                  </span>
                  <span className="text-[12px] text-muted">
                    Paid {b.settledAt ? clock(b.settledAt) : ""}
                    {b.waiterName ? ` · ${b.waiterName}` : ""}
                  </span>
                </div>
                <span className="flex flex-wrap justify-end gap-1 sm:order-2">
                  {methods[b.id]?.map((m) => (
                    <MethodBadge key={m} method={m} />
                  ))}
                  {methods[b.id] === null ? <span className="text-[11.5px] text-muted">method not read</span> : null}
                </span>
                <span className="text-right text-[14px] font-semibold whitespace-nowrap tabular sm:order-3 sm:min-w-[100px]">
                  {money(b.totalRwf)}
                </span>
              </li>
            ))}
          </ul>
          {paid.length > shown.length ? (
            <p className="text-[12px] text-muted">Showing the {shown.length} most recent.</p>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

function Fact({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={strong ? "text-[16px] font-semibold" : ""}>{value}</dd>
    </div>
  );
}

function Movements({
  shift,
  review,
  userId,
  pending,
  run,
  compact,
}: {
  shift: PosShift;
  review: boolean;
  userId: string | null;
  pending: boolean;
  run: ReturnType<typeof usePosAction>["run"];
  compact?: boolean;
}) {
  const list = compact ? shift.movements.filter((m) => m.status === "pending_approval") : shift.movements;
  if (list.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-[12px]">
      {list.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-2">
          <span className="font-medium">
            {m.kind === "paid_in" ? "In" : "Out"} {money(m.amountRwf)}
          </span>
          <span className="text-muted">
            {m.reason} · {m.requestedByName}
          </span>
          {m.status === "pending_approval" && review && shift.cashierUserId !== userId ? (
            <>
              <Button
                size="sm"
                isDisabled={pending}
                onPress={() => run(() => decideMovementAction(m.id, true), "Approved")}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={pending}
                onPress={() => run(() => decideMovementAction(m.id, false), "Rejected")}
              >
                Reject
              </Button>
            </>
          ) : (
            <StatusChip color={m.status === "approved" ? "success" : m.status === "rejected" ? "danger" : "warning"}>
              {m.status === "pending_approval" ? "Waiting for approval" : m.status}
            </StatusChip>
          )}
        </li>
      ))}
    </ul>
  );
}
