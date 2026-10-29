import { screens } from "@injishi/data";
import type { ConditionSignal, SignalReview, WorkOrder } from "@injishi/data/fixtures/operations";
import { stock } from "@injishi/data/media";
import type { Metadata } from "next";
import { MaintenanceView } from "@/features/operations/MaintenanceView";
import { PmsMount } from "@/features/pms/pms-mount";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { placeName, readWorkOrders } from "@/server/sources/operations";

export const metadata: Metadata = { title: screens.Maintenance.pageTitle };

export default async function MaintenancePage() {
  const persona = await requirePersona("Maintenance");
  const [workOrders, signals, reviews] = await Promise.all([
    getCollection<WorkOrder>("operations.workOrders"),
    getCollection<ConditionSignal>("operations.conditionSignals"),
    getCollection<SignalReview>("operations.signalReviews"),
  ]);
  // The list the work orders were read from (one read per request): the API's own median time to close,
  // and how many uploaded photos each order holds that the screen cannot draw.
  const ctx = await requestContext();
  const list = await readWorkOrders(ctx);
  const unshownPhotos = Object.fromEntries(
    list.workOrders.map((o) => [
      o.reference,
      o.photos.filter((p) => !(p.key.startsWith("stock:") && p.key.slice(6) in stock)).length,
    ]),
  );
  return (
    <PmsMount>
      <MaintenanceView
        persona={persona}
        data={{
          workOrders,
          signals,
          reviews,
          placeName: placeName(ctx),
          medianHoursToClose: list.medianHoursToClose,
          unshownPhotos,
        }}
      />
    </PmsMount>
  );
}
