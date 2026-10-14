import { screens } from "@injishi/data";
import type { KitchenStation, KitchenTicket } from "@injishi/data/fixtures/outlets";
import { getCollection } from "@injishi/db";
import type { Metadata } from "next";
import { KitchenDisplayView } from "@/features/outlets/KitchenDisplayView";
import { requirePersona } from "@/lib/session";

export const metadata: Metadata = { title: screens.KitchenDisplay.pageTitle };

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  await requirePersona("KitchenDisplay");
  const { offline } = await searchParams;
  const [stations, tickets] = await Promise.all([
    getCollection<KitchenStation>("outlets.kitchenStations"),
    getCollection<KitchenTicket>("outlets.kitchenTickets"),
  ]);
  return <KitchenDisplayView stations={stations} tickets={tickets} offline={offline === "1" || offline === "true"} />;
}
