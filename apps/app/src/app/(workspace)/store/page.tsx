import { screens } from "@injishi/data";
import type {
  CountVariance,
  Delivery,
  ReorderAlert,
  StoreKpi,
  StoreRequisition,
  StoreValueRow,
} from "@injishi/data/fixtures/stock";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { StoreHomeView } from "@/features/stock/StoreHomeView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.StoreHome.pageTitle };

export default async function StoreHomePage() {
  const persona = await requirePersona("StoreHome");
  const [kpis, reorder, deliveries, values, requisitions, variances] = await Promise.all([
    getCollection<StoreKpi>("stock.homeKpis"),
    getCollection<ReorderAlert>("stock.reorderAlerts"),
    getCollection<Delivery>("stock.deliveries"),
    getCollection<StoreValueRow>("stock.storeValues"),
    getCollection<StoreRequisition>("stock.storeRequisitions"),
    getCollection<CountVariance>("stock.countVariances"),
  ]);
  return <StoreHomeView persona={persona} data={{ kpis, reorder, deliveries, values, requisitions, variances }} />;
}
