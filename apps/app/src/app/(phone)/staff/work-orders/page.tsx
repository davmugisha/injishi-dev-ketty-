import { screens } from "@injishi/data";
import type { StaffProfile, StorePart, WorkOrder } from "@injishi/data/fixtures/staff";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TechWorkOrdersView } from "@/features/staff/TechWorkOrdersView";
import { requirePersona } from "@/lib/session";
import { getCollection, getDocument } from "@/server/data";

export const metadata: Metadata = { title: screens.TechWorkOrders.pageTitle };

export default async function TechWorkOrdersPage() {
  const persona = await requirePersona("TechWorkOrders");
  const [profile, fallbackProfile, orders, store] = await Promise.all([
    getDocument<StaffProfile>("staff.profiles", persona.id),
    getDocument<StaffProfile>("staff.profiles", "technician"),
    getCollection<WorkOrder>("staff.workOrders"),
    getCollection<StorePart>("staff.storeParts"),
  ]);
  const me = profile ?? fallbackProfile;
  if (!me || !orders.length) notFound();
  return <TechWorkOrdersView persona={persona} data={{ profile: me, orders, store }} />;
}
