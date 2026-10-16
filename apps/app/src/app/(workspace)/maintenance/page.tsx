import { screens } from "@injishi/data";
import type { ConditionSignal, SignalReview, WorkOrder } from "@injishi/data/fixtures/operations";
import type { Metadata } from "next";
import { MaintenanceView } from "@/features/operations/MaintenanceView";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";

export const metadata: Metadata = { title: screens.Maintenance.pageTitle };

export default async function MaintenancePage() {
  const persona = await requirePersona("Maintenance");
  const [workOrders, signals, reviews] = await Promise.all([
    getCollection<WorkOrder>("operations.workOrders"),
    getCollection<ConditionSignal>("operations.conditionSignals"),
    getCollection<SignalReview>("operations.signalReviews"),
  ]);
  return <MaintenanceView persona={persona} data={{ workOrders, signals, reviews }} />;
}
