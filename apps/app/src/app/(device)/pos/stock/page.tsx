import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosStockScreen } from "@/features/pos/pos-stock-view";
import { posStock } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosStock.pageTitle };

/** The stock of one outlet: what is on hand, what is low or out, what it is worth, and every movement. */
export default async function PosStockPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosStock", outletParam || undefined);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  if (!page.can.some((p) => p === "stock.manage" || p === "shift.review")) {
    return <PosBlocked title="Not open to you" message="The stock is kept by the stock controller and the managers." />;
  }
  const stock = await posStock(page.ctx, page.outlet.id);
  return <PosStockScreen outlets={page.outlets} outlet={page.outlet} stock={stock} can={page.can} />;
}
