import type { Metadata } from "next";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosMenuView } from "@/features/pos/pos-menu-view";
import { posMenu, posStations } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosMenu.pageTitle };

/** The menu and products of one outlet, as the till sells them. */
export default async function PosMenuPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosMenu", outletParam || undefined);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} />;
  const [menu, stations] = await Promise.all([posMenu(page.ctx, page.outlet.id), posStations(page.ctx, page.outlet.id)]);
  return <PosMenuView outlets={page.outlets} outlet={page.outlet} menu={menu} stations={stations} can={page.can} />;
}
