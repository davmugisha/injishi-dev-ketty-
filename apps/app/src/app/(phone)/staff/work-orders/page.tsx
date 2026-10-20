import { screens } from "@injishi/data";
import type { StaffProfile, StorePart, WorkOrder } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { TechWorkOrdersView } from "@/features/staff/TechWorkOrdersView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.TechWorkOrders.pageTitle };

export default async function TechWorkOrdersPage() {
  const persona = await requirePersona("TechWorkOrders");
  // The caller's own profile only: never another persona's shown as theirs (null reads "not on file").
  const [profile, orders, store] = await Promise.all([
    getDocument<StaffProfile>("staff.profiles", persona.id),
    getCollection<WorkOrder>("staff.workOrders"),
    getCollection<StorePart>("staff.storeParts"),
  ]);
  // No open order is not a 404: the view says so (and keeps an order it just resolved on screen).
  return <TechWorkOrdersView persona={persona} data={{ profile: profile ?? null, orders, store }} />;
}
