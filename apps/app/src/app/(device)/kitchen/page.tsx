import { screens } from "@injishi/data";
import type { KitchenStation, KitchenTicket } from "@injishi/data/fixtures/outlets";
import { KitchenDisplayView } from "@injishi/product-outlets/web";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OutletsMount } from "@/features/outlets/outlets-mount";
import { requirePersona } from "@/lib/session";
import { getCollection } from "@/server/data";
import { holdsSampleData } from "@/server/sample-data";

export const metadata: Metadata = { title: screens.KitchenDisplay.pageTitle };

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ offline?: string }> }) {
  await requirePersona("KitchenDisplay");
  // Sample screen: a real business uses the live POS at /pos/stations.
  if (!(await holdsSampleData())) redirect("/pos/stations");
  const { offline } = await searchParams;
  const [stations, tickets] = await Promise.all([
    getCollection<KitchenStation>("outlets.kitchenStations"),
    getCollection<KitchenTicket>("outlets.kitchenTickets"),
  ]);
  return (
    <OutletsMount>
      <KitchenDisplayView stations={stations} tickets={tickets} offline={offline === "1" || offline === "true"} />
    </OutletsMount>
  );
}
