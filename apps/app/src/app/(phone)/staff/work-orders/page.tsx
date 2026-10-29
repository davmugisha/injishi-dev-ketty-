import { screens } from "@injishi/data";
import type { StorePart, WorkOrder } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { PmsMount } from "@/features/pms/pms-mount";
import { TechWorkOrdersView } from "@/features/staff/TechWorkOrdersView";
import { requirePersona } from "@/lib/session";
import { getCollection, requestContext } from "@/server/data";
import { myProfile } from "@/server/sources/staff";

export const metadata: Metadata = { title: screens.TechWorkOrders.pageTitle };

export default async function TechWorkOrdersPage() {
  const persona = await requirePersona("TechWorkOrders");
  // The caller's own HR file, never a sample profile (null reads "not on file").
  const [profile, orders, store] = await Promise.all([
    requestContext().then(myProfile),
    getCollection<WorkOrder>("staff.workOrders"),
    getCollection<StorePart>("staff.storeParts"),
  ]);
  // No open order is not a 404: the view says so (and keeps an order it just resolved on screen).
  return (
    <PmsMount>
      <TechWorkOrdersView persona={persona} data={{ profile: profile ?? null, orders, store }} />
    </PmsMount>
  );
}
