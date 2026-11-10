import type { Metadata } from "next";
import { loadPosPage, readOrBlock } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/pos-blocked";
import { POS_BOARDS } from "@/features/pos/pos-boards";
import { PosMenuManager } from "@/features/pos/pos-menu-manager";
import { PosMenuView } from "@/features/pos/pos-menu-view";
import { posCatalog, posMenu, posStations } from "@/server/pos";

export const metadata: Metadata = { title: POS_BOARDS.PosMenu.pageTitle };

/**
 * The menu and products of one outlet. Someone who holds `menu.manage` (owner, manager) manages it here; everyone
 * else (waiter, cashier, bartender, kitchen) reads it as the till sells it. The API decides every write.
 */
export default async function PosMenuPage({ searchParams }: { searchParams: Promise<{ outlet?: string }> }) {
  const { outlet: outletParam } = await searchParams;
  const page = await loadPosPage("PosMenu", outletParam || undefined);
  if (!page.ok) return <PosBlocked title={page.title} message={page.message} firstOutlet={page.firstOutlet} />;
  if (page.can.includes("menu.manage")) {
    const catalog = await posCatalog(page.ctx);
    return <PosMenuManager outlets={page.outlets} outlet={page.outlet} catalog={catalog} can={page.can} />;
  }
  const read = await readOrBlock(() =>
    Promise.all([posMenu(page.ctx, page.outlet.id), posStations(page.ctx, page.outlet.id)]),
  );
  if (!read.ok) return <PosBlocked title={read.title} message={read.message} />;
  const [menu, stations] = read.value;
  return <PosMenuView outlets={page.outlets} outlet={page.outlet} menu={menu} stations={stations} can={page.can} />;
}
