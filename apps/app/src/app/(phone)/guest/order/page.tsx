import { screens } from "@injishi/data";
import type { BasketLine, MenuCategory, MenuItem, RoomServiceOrder, ServiceHour } from "@injishi/data/fixtures/outlets";
import { QrOrderView, type QrStep } from "@injishi/product-outlets/web";
import type { Metadata } from "next";
import { OutletsMount } from "@/features/outlets/outlets-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.QROrder.pageTitle };

const STEPS: readonly QrStep[] = ["menu", "item", "basket", "tracking"];

export default async function QrOrderPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const persona = await requirePersona("QROrder");
  const { step: stepParam } = await searchParams;
  const step = STEPS.find((id) => id === stepParam) ?? "basket";
  const [items, categories, basket, orders, hours] = await Promise.all([
    getCollection<MenuItem>("outlets.menuItems"),
    getCollection<MenuCategory>("outlets.menuCategories"),
    getCollection<BasketLine>("outlets.basketLines"),
    getCollection<RoomServiceOrder>("outlets.roomServiceOrders"),
    getCollection<ServiceHour>("outlets.serviceHours"),
  ]);
  return (
    <OutletsMount>
      <QrOrderView
        persona={persona}
        step={step}
        data={{
          items,
          categories: categories.filter((c) => c.menu === "room"),
          basket,
          orders,
          hours,
        }}
      />
    </OutletsMount>
  );
}
