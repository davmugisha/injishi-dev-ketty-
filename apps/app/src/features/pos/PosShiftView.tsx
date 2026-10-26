"use client";

import { Button, Card, Input, Label, TextArea, TextField, Toast, ToggleButton } from "@heroui/react";
import { EmptyState } from "@heroui-pro/react";
import { useState } from "react";
import { RegionOverlays } from "@/features/outlets/shared";
import { METHOD_LABEL, type PosOutlet, type PosRegister, type PosShift } from "@/server/pos";
import { cashMovementAction, closeShiftAction, decideMovementAction, openShiftAction, reviewShiftAction } from "./actions";
import { PosNav } from "./PosNav";
import { clock, money, PosDialog, PosHeader, parseRwf, SimulationNotice, StatusChip, usePosAction } from "./shared";

/**
 * The cashier's register and shift (POS spec §9). A cashier opens a shift with a float, records cash in and
 * out with a reason, and closes with a count; the API freezes the expected cash and the variance. A
 * reviewer approves paid outs and reviews closed shifts, never their own.
 */
export function PosShiftView({
  outlet,
  registers,
  mine,
  shifts,
  can,
  userId,
}: {
  outlet: PosOutlet;
  registers: PosRegister[];
  mine: PosShift | null;
  shifts: PosShift[];
  can: string[];
  userId: string | null;
}) {
  const { run, pending } = usePosAction();
  const [openOn, setOpenOn] = useState<PosRegister | null>(null);
  const [float, setFloat] = useState("20000");
  const [move, setMove] = useState<{ kind: "paid_in" | "paid_out"; amount: string; reason: string } | null>(null);
  const [closing, setClosing] = useState<{ counted: string; note: string; handover: string } | null>(null);
  const operate = can.includes("register.operate");
  const review = can.includes("shift.review");
  const counted = closing ? parseRwf(closing.counted) : null;

  return (
    <div className="relative flex h-full flex-col bg-background">
      <PosHeader title="Cashier shift" outlet={outlet}>
        <PosNav current="PosShift" outletId={outlet.id} can={can} />
      </PosHeader>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-4 overflow-hidden p-4">
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {mine ? (
            <Card className="gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-[18px] font-semibold">Your shift on {mine.registerName}</h2>
                  <p className="text-[12px] text-muted">
                    Opened {clock(mine.openedAt)} with a float of {money(mine.openingFloatRwf)}
                  </p>
                </div>
                <StatusChip color="success">Open</StatusChip>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[14px] tabular sm:grid-cols-4">
                <Fact label="Cash taken (incl. cash tips)" value={money(mine.cashSalesRwf)} />
                <Fact label="Cash refunds" value={money(mine.cashRefundsRwf)} />
                <Fact label="Paid in / out" value={`${money(mine.paidInRwf)} / ${money(mine.paidOutRwf)}`} />
                <Fact label="Expected in the drawer" value={money(mine.expectedCashRwf)} strong />
              </dl>
              <div className="flex flex-wrap gap-2 text-[12px]">
                {mine.takingsByMethod.map((t) => (
                  <StatusChip key={t.method} color="default">
                    {METHOD_LABEL[t.method]} · {t.count} · {money(t.amountRwf)}
                  </StatusChip>
                ))}
                {mine.tipsRwf ? <StatusChip color="accent">Tips {money(mine.tipsRwf)}</StatusChip> : null}
              </div>
              <Movements shift={mine} review={review} userId={userId} pending={pending} run={run} />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onPress={() => setMove({ kind: "paid_in", amount: "", reason: "" })}>
                  Cash in
                </Button>
                <Button variant="secondary" onPress={() => setMove({ kind: "paid_out", amount: "", reason: "" })}>
                  Cash out
                </Button>
                <Button onPress={() => setClosing({ counted: "", note: "", handover: "" })}>Close shift</Button>
              </div>
            </Card>
          ) : operate ? (
            <Card className="gap-3 p-4">
              <h2 className="text-[18px] font-semibold">Open a shift</h2>
              <p className="text-[13px] text-muted">Cash can only be taken into an open shift. Choose a free register.</p>
              <div className="flex flex-wrap gap-2">
                {registers.map((r) => (
                  <Button key={r.id} variant="secondary" isDisabled={!!r.openShiftId} onPress={() => setOpenOn(r)}>
                    {r.name}
                    {r.openShiftId ? ` · ${r.openShiftCashierName ?? "in use"}` : ""}
                  </Button>
                ))}
              </div>
            </Card>
          ) : (
            <p className="text-[13px] text-muted">You do not run a till. Shifts other cashiers closed are listed for review.</p>
          )}
          <SimulationNotice>Only cash is counted into the drawer. Every other method is simulated and listed for reconciliation only.</SimulationNotice>
        </div>

        <aside className="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <h2 className="text-[14px] font-semibold">Recent shifts</h2>
          {shifts.length === 0 ? (
            <EmptyState size="sm">
              <EmptyState.Header>
                <EmptyState.Description>No shifts to show.</EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          ) : null}
          {shifts.map((s) => (
            <Card key={s.id} variant="secondary" className="gap-1 p-3 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">
                  {s.registerName} · {s.cashierName}
                </span>
                <StatusChip color={s.status === "open" ? "success" : s.status === "closed" ? "warning" : "default"}>{s.status}</StatusChip>
              </div>
              <span className="text-muted tabular">
                {clock(s.openedAt)}
                {s.closedAt ? ` – ${clock(s.closedAt)}` : ""} · expected {money(s.expectedCashRwf)}
                {s.countedCashRwf !== null ? ` · counted ${money(s.countedCashRwf)}` : ""}
              </span>
              {s.varianceRwf !== null ? (
                <span className={`font-semibold tabular ${s.varianceRwf < 0 ? "text-danger" : s.varianceRwf > 0 ? "text-warning" : "text-success"}`}>
                  {s.varianceRwf === 0 ? "Balanced" : s.varianceRwf < 0 ? `Short ${money(-s.varianceRwf)}` : `Over ${money(s.varianceRwf)}`}
                </span>
              ) : null}
              {s.closeNote ? <span>Note: {s.closeNote}</span> : null}
              {s.reviewedByName ? <span className="text-muted">Reviewed by {s.reviewedByName}{s.reviewNote ? `: ${s.reviewNote}` : ""}</span> : null}
              {review && s.status === "closed" && s.cashierUserId !== userId ? (
                <Button size="sm" className="self-start" isDisabled={pending} onPress={() => run(() => reviewShiftAction(s.id, "Reviewed"), "Shift reviewed")}>
                  Mark reviewed
                </Button>
              ) : null}
              {review && s.status === "open" && s.id !== mine?.id ? <Movements shift={s} review={review} userId={userId} pending={pending} run={run} compact /> : null}
            </Card>
          ))}
        </aside>
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
                <Button isDisabled={pending || parseRwf(float) === null} onPress={() => run(() => openShiftAction(openOn.id, parseRwf(float) ?? 0), "Shift opened", () => setOpenOn(null))}>
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
            subtitle={move.kind === "paid_out" && !review ? "A paid out waits for a manager's approval." : "Recorded with your name and the reason."}
            footer={
              <>
                <Button variant="secondary" onPress={() => setMove(null)}>
                  Cancel
                </Button>
                <Button
                  isDisabled={pending || !parseRwf(move.amount) || move.reason.trim().length < 3}
                  onPress={() =>
                    run(
                      () => cashMovementAction(mine.id, { kind: move.kind, amountRwf: parseRwf(move.amount) ?? 0, reason: move.reason.trim() }),
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
              <ToggleButton isSelected={move.kind === "paid_out"} onChange={() => setMove({ ...move, kind: "paid_out" })}>
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
                      (s) => (s.varianceRwf === 0 ? "Closed and balanced" : `Closed · variance ${money(s.varianceRwf ?? 0)}`),
                      () => setClosing(null),
                    )
                  }
                >
                  Close shift
                </Button>
              </>
            }
          >
            <TextField value={closing.counted} onChange={(v) => setClosing({ ...closing, counted: v })} fullWidth isRequired>
              <Label>Cash counted (RWF)</Label>
              <Input inputMode="numeric" className="tabular" />
            </TextField>
            {counted !== null ? (
              <p className={`text-[15px] font-semibold tabular ${counted - mine.expectedCashRwf < 0 ? "text-danger" : ""}`}>
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
        <Toast.Provider placement="bottom" />
      </RegionOverlays>
    </div>
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
          <span className="font-medium">{m.kind === "paid_in" ? "In" : "Out"} {money(m.amountRwf)}</span>
          <span className="text-muted">
            {m.reason} · {m.requestedByName}
          </span>
          {m.status === "pending_approval" && review && shift.cashierUserId !== userId ? (
            <>
              <Button size="sm" isDisabled={pending} onPress={() => run(() => decideMovementAction(m.id, true), "Approved")}>
                Approve
              </Button>
              <Button size="sm" variant="secondary" isDisabled={pending} onPress={() => run(() => decideMovementAction(m.id, false), "Rejected")}>
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
