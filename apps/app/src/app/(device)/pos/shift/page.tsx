import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosShiftView } from "@/features/pos/pos-shift-view";
import { posMyShift, posOrders, posRegisters, posShifts } from "@/server/pos";

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
  const [registers, mine, shifts, open] = await Promise.all([
    posRegisters(page.ctx, page.outlet.id),
    has("register.operate") ? posMyShift(page.ctx, page.outlet.id) : Promise.resolve(null),
    has("shift.review") || has("money.view")
      ? posShifts(page.ctx, { outletId: page.outlet.id, limit: 20 })
      : Promise.resolve([]),
    // The cashier desk lists the bills still owed, so whoever takes payment sees the queue on arrival.
    has("pos.checkout")
      ? posOrders(page.ctx, { outletId: page.outlet.id, status: "open", limit: 200 }).catch(() => [])
      : Promise.resolve([]),
  ]);
  const bills = open
    .filter((o) => o.lineCount > 0 && o.settlement.outstandingRwf > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <PosShiftView
      outlet={page.outlet}
      outlets={page.outlets}
      registers={registers}
      mine={mine}
      shifts={shifts}
      bills={bills}
      can={page.can}
      userId={page.userId}
    />
  );
}
