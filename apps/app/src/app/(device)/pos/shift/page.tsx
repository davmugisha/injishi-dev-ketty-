import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { paidToday } from "@/features/pos/payment-flow";
import { PosShiftView } from "@/features/pos/pos-shift-view";
import { posAwaitingPayments, posMyShift, posOrders, posRegisters, posShifts } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosShift.pageTitle };

/** The cashier's shift at one outlet, and the shifts a reviewer checks, from the API. */
export default async function PosShiftPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosShift", outletParam);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  const has = (p: string) => page.can.includes(p);
  if (!has("register.operate") && !has("shift.review")) {
    return (
      <PosBlocked title="Not open to you" message="Running a till or reviewing shifts is not part of your role." />
    );
  }
  const [registers, mine, shifts, open, awaiting, completed] = await Promise.all([
    posRegisters(page.ctx, page.outlet.id),
    has("register.operate") ? posMyShift(page.ctx, page.outlet.id) : Promise.resolve(null),
    has("shift.review") || has("money.view")
      ? posShifts(page.ctx, { outletId: page.outlet.id, limit: 20 })
      : Promise.resolve([]),
    // The cashier desk lists the bills still owed, so whoever takes payment sees the queue on arrival.
    has("pos.checkout")
      ? posOrders(page.ctx, { outletId: page.outlet.id, status: "open", limit: 200 }).catch(() => [])
      : Promise.resolve([]),
    // Payments a customer started (MTN MoMo, Airtel Money) that wait for the cashier to see the money arrive.
    has("pos.checkout") ? posAwaitingPayments(page.ctx, page.outlet.id).catch(() => null) : Promise.resolve(null),
    // READ ONLY: the latest closed bills, for "Paid today" (every method). Nothing is taken or settled here.
    has("pos.checkout")
      ? posOrders(page.ctx, { outletId: page.outlet.id, status: "completed", limit: 200 }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const bills = open
    .filter((o) => o.lineCount > 0 && o.settlement.outstandingRwf > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const now = Date.now();
  // Paid in full today: closed bills, and bills already paid but still being served.
  const paid = paidToday([...completed, ...open], now);
  return (
    <PosShiftView
      outlet={page.outlet}
      outlets={page.outlets}
      registers={registers}
      mine={mine}
      shifts={shifts}
      bills={bills}
      awaiting={awaiting}
      paid={paid}
      loadedAt={new Date(now).toISOString()}
      can={page.can}
      userId={page.userId}
    />
  );
}
