import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/PosBlocked";
import { PosFloorView } from "@/features/pos/PosFloorView";
import { posFloor, posOrders } from "@/server/pos";

export const metadata: Metadata = { title: screens.PosFloor.pageTitle };

/** The live floor: tables, sessions and open orders of one outlet, from the API. */
export default async function PosFloorPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosFloor", outletParam);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} />;
  const [floor, orders] = await Promise.all([
    posFloor(page.ctx, page.outlet.id),
    posOrders(page.ctx, { outletId: page.outlet.id, status: "open", limit: 200 }),
  ]);
  return <PosFloorView outlets={page.outlets} outlet={page.outlet} floor={floor} orders={orders} can={page.can} />;
}
