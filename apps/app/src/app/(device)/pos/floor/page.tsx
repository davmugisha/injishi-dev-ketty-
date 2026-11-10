import type { Metadata } from "next";
import { loadPosPage, readOrBlock } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosFloorView } from "@/features/pos/pos-floor-view";
import { posFloor, posOrders } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosFloor.pageTitle };

/** The live floor: tables, sessions and open orders of one outlet, from the API. */
export default async function PosFloorPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosFloor", outletParam);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  const read = await readOrBlock(() =>
    Promise.all([
      posFloor(page.ctx, page.outlet.id),
      posOrders(page.ctx, { outletId: page.outlet.id, status: "open", limit: 200 }),
    ]),
  );
  if (!read.ok) return <PosBlocked title={read.title} message={read.message} />;
  const [floor, orders] = read.value;
  return <PosFloorView outlets={page.outlets} outlet={page.outlet} floor={floor} orders={orders} can={page.can} />;
}
