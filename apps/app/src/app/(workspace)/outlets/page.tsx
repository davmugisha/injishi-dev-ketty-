import { screens } from "@injishi/data";
import type {
  DepartmentGroup,
  Outlet,
  OutletMenu,
  OutletOffer,
  OutletOrder,
  OutletOrderLoad,
} from "@injishi/data/fixtures/operations";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { OutletsMenusView, type OutletTab } from "@/features/operations/OutletsMenusView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.OutletsMenus.pageTitle };

export default async function OutletsMenusPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const persona = await requirePersona("OutletsMenus");
  const [outlets, departments, menus, orders, orderLoad, offers] = await Promise.all([
    getCollection<Outlet>("operations.outlets"),
    getCollection<DepartmentGroup>("operations.departments"),
    getCollection<OutletMenu>("operations.outletMenus"),
    getCollection<OutletOrder>("operations.outletOrders"),
    getCollection<OutletOrderLoad>("operations.outletOrderLoad"),
    getCollection<OutletOffer>("operations.outletOffers"),
  ]);
  const { tab } = await searchParams;
  const tabs: OutletTab[] = ["outlets", "menus", "orders", "offers"];
  const initialTab = tabs.find((t) => t === tab) ?? "outlets";
  return (
    <OutletsMenusView
      persona={persona}
      initialTab={initialTab}
      data={{ outlets, departments, menus, orders, orderLoad, offers }}
    />
  );
}
