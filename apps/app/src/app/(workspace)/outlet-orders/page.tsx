import { screens } from "@injishi/data";
import type {
  FiscalReport,
  LiveOrder,
  OrderStage,
  Refund,
  ServiceKpi,
  StockOut,
  VoidRequest,
} from "@injishi/data/fixtures/outlets";
import type { Metadata } from "next";
import { OutletOrdersView } from "@/features/outlets/OutletOrdersView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.OutletOrders.pageTitle };

export default async function OutletOrdersPage() {
  await requirePersona("OutletOrders");
  const [kpis, stages, orders, voids, refunds, reports, stockOuts] = await Promise.all([
    getCollection<ServiceKpi>("outlets.serviceKpis"),
    getCollection<OrderStage>("outlets.orderStages"),
    getCollection<LiveOrder>("outlets.liveOrders"),
    getCollection<VoidRequest>("outlets.voidRequests"),
    getCollection<Refund>("outlets.refunds"),
    getCollection<FiscalReport>("outlets.fiscalReports"),
    getCollection<StockOut>("outlets.stockOuts"),
  ]);
  return <OutletOrdersView data={{ kpis, stages, orders, voids, refunds, reports, stockOuts }} />;
}
