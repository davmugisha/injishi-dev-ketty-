import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/PosBlocked";
import { PosShiftView } from "@/features/pos/PosShiftView";
import { posMyShift, posRegisters, posShifts } from "@/server/pos";

export const metadata: Metadata = { title: screens.PosShift.pageTitle };

/** The cashier's shift at one outlet, and the shifts a reviewer checks, from the API. */
export default async function PosShiftPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosShift", outletParam);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} />;
  const has = (p: string) => page.can.includes(p);
  if (!has("register.operate") && !has("shift.review")) {
    return <PosBlocked title="Not open to you" message="Running a till or reviewing shifts is not part of your role." />;
  }
  const [registers, mine, shifts] = await Promise.all([
    posRegisters(page.ctx, page.outlet.id),
    has("register.operate") ? posMyShift(page.ctx, page.outlet.id) : Promise.resolve(null),
    has("shift.review") || has("money.view") ? posShifts(page.ctx, { outletId: page.outlet.id, limit: 20 }) : Promise.resolve([]),
  ]);
  return <PosShiftView outlet={page.outlet} registers={registers} mine={mine} shifts={shifts} can={page.can} userId={page.userId} />;
}
