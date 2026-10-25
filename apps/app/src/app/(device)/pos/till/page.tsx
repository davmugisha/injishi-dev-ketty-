import { screens } from "@injishi/data";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loadPosPage } from "@/features/pos/load";
import { PosBlocked } from "@/features/pos/PosBlocked";
import { PosTillView } from "@/features/pos/PosTillView";
import { ApiError } from "@/server/api";
import { posFloor, posMenu, posMyShift, posOrder } from "@/server/pos";

export const metadata: Metadata = { title: screens.PosTill.pageTitle };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One order at the till: the menu, the order and its checkout, from the API. Orders are opened on the floor. */
export default async function PosTillPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderId } = await searchParams;
  if (!orderId || !UUID.test(orderId)) redirect("/pos/floor");
  const first = await loadPosPage("PosTill", undefined);
  if (!first.ok) return <PosBlocked title={first.title} message={first.message} />;
  let order: Awaited<ReturnType<typeof posOrder>>;
  try {
    order = await posOrder(first.ctx, orderId);
  } catch (error) {
    if (error instanceof ApiError && error.notFound) {
      return <PosBlocked title="Order not found" message="This order is not in a branch you cover, or it does not exist." />;
    }
    throw error;
  }
  const outlet = first.outlets.find((o) => o.id === order.outletId);
  if (!outlet) return <PosBlocked title="Order not found" message="This order's outlet is not in a branch you cover." />;
  const has = (p: string) => first.can.includes(p);
  const [menu, floor, shift] = await Promise.all([
    posMenu(first.ctx, outlet.id),
    has("pos.sell") || has("table.manage") || has("pos.checkout") ? posFloor(first.ctx, outlet.id) : Promise.resolve(null),
    has("register.operate") || has("pos.checkout") ? posMyShift(first.ctx, outlet.id) : Promise.resolve(null),
  ]);
  return <PosTillView outlet={outlet} order={order} menu={menu} tables={floor?.tables ?? []} shift={shift} can={first.can} />;
}
